const API_BASE = "/api";

let products = [];
let cart = {};
let currentDeviceUuid = "";
let currentDeviceName = "무인 결제 단말기";
let barcodeBuffer = "";
let barcodeTimeout = null;

let videoStream = null;
let isCameraScanning = false;
let qrScanCooldown = false;
let kioskFacingMode = "user"; // 기본 전면 카메라
let editingProductId = null; // 수정 중인 상품 ID
let currentDefaultProductId = null; // 기본 자동 결제 상품 ID
let kioskNdefReader = null; // 중복 NDEFReader 생성 방지용 글로벌 레퍼런스
let kioskNfcAbortController = null; // Web NFC scan() 중단(카메라 사용 시 일시정지)을 위한 컨트롤러
let isKioskPaymentProcessing = false; // 결제 중복 요청 방지 락
let kioskNfcScanCooldown = false; // NFC 연속 태깅 방지 쿨다운
let lastQrDecodeTime = 0; // QR 실시간 연산 쓰로틀링을 위한 최종 디코딩 시각 타임스탬프

// 현재 활성화된 카드 리더 종류: "WEB_NFC" | "BUILTIN_NFC" | "USB_CCID" | "USB_HID_KEYBOARD" | "NONE" | "UNKNOWN"
// Android 래퍼 안에서는 window.onCardReaderModeChanged가, 일반 브라우저에서는 Web NFC 성공 시 직접 갱신한다.
let currentReaderMode = "UNKNOWN";
// 관리자 설정: 외부 리더 사용 시 카메라와 동시 사용을 허용할지 여부 (서버에서 로드, 기본값 false)
let allowCameraReaderConcurrent = false;

function isInternalReaderActive() {
  return currentReaderMode === "WEB_NFC" || currentReaderMode === "BUILTIN_NFC";
}

function isExternalReaderActive() {
  return currentReaderMode === "USB_CCID" || currentReaderMode === "USB_HID_KEYBOARD";
}

// 카메라를 켤 때 리더를 잠시 멈춰야 하는지 여부.
// 내장 센서(Web NFC/기기 자체 NFC)는 항상 배제, 외부 리더는 관리자가 "동시 사용"을 켠 경우에만 예외.
function shouldPauseReaderForCamera() {
  return isInternalReaderActive() || !allowCameraReaderConcurrent;
}

// "QR 스캐너 항상 켜기" 설정 On/Off에 맞춰 수동 토글 버튼 표시 여부와 카메라 구동 상태를 즉시 반영
function applyAlwaysOnCameraMode() {
  const toggleBtn = document.getElementById("camera-toggle-btn");
  if (toggleBtn) toggleBtn.style.display = allowCameraReaderConcurrent ? "none" : "inline-flex";

  if (allowCameraReaderConcurrent) {
    maybeAutoStartAlwaysOnCamera();
  } else if (isCameraScanning) {
    stopCameraScanner();
  }
}

// 상시 켜기 모드에서 결제/모달 처리로 잠시 꺼졌던 카메라를 다시 구동 (다른 모달이 열려있으면 대기)
function maybeAutoStartAlwaysOnCamera() {
  if (!allowCameraReaderConcurrent || isCameraScanning || isKioskPaymentProcessing) return;
  const blockingModalIds = ["repeat-pay-modal", "kiosk-admin-modal", "kiosk-pin-modal"];
  for (const id of blockingModalIds) {
    const el = document.getElementById(id);
    if (el && (el.style.display === "flex" || el.classList.contains("active"))) return;
  }
  startCameraScanner(true);
}

// 테스트 모드: 카메라/리더 하드웨어 없이 결제 흐름을 시연/테스트하기 위한 기기 로컬 설정
// (서버에 저장하지 않음 - 이 브라우저/기기에서만 유지되는 localStorage 값)
let kioskTestMode = false;

function initKioskTestMode() {
  kioskTestMode = localStorage.getItem("somang_kiosk_test_mode") === "true";
  updateKioskTestModeUI();
}

function toggleKioskTestMode(enabled) {
  kioskTestMode = !!enabled;
  localStorage.setItem("somang_kiosk_test_mode", kioskTestMode ? "true" : "false");
  updateKioskTestModeUI();
  updateCameraConcurrentToggleAvailability();
  appendDebugLog(`🧪 [테스트 모드] ${kioskTestMode ? "활성화" : "비활성화"}됨`, kioskTestMode ? "WARN" : "INFO");
}

function updateKioskTestModeUI() {
  const badge = document.getElementById("kiosk-test-mode-badge");
  if (badge) badge.style.display = kioskTestMode ? "inline-flex" : "none";
  const checkbox = document.getElementById("k-test-mode-input");
  if (checkbox) checkbox.checked = kioskTestMode;
}

window.onCardReaderModeChanged = function (mode) {
  currentReaderMode = mode;
  appendDebugLog(`🔧 [카드 리더] 활성 모드 변경: ${mode}`, "INFO");
  updateCameraConcurrentToggleAvailability();
};

document.addEventListener("DOMContentLoaded", async () => {
  appendDebugLog("[SYSTEM] 키오스크 단말기 모듈 초기화 완료.");
  initKioskTestMode();
  await initDeviceUUID();
  await loadProducts();
  resetCart(); // 기본 결제 상품으로 장바구니 자동 세팅 및 메뉴 UI 갱신
  initWebNFC(); // 권한 상태 확인 후 자동 NFC 활성화 시도

  // USB Barcode / QR Code Scanner Keyboard Emulation Listener
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") {
      return;
    }

    if (e.key === "Enter") {
      if (barcodeBuffer.length >= 4) {
        const scannedQr = barcodeBuffer.trim();

        // USB HID 키보드형 카드 리더가 활성 모드일 때, 카메라 사용 중이면 태깅 무시
        // (일반 바코드/QR 스캐너는 currentReaderMode가 USB_HID_KEYBOARD로 잡히지 않으므로 영향 없음)
        if (isCameraScanning && currentReaderMode === "USB_HID_KEYBOARD" && shouldPauseReaderForCamera()) {
          appendDebugLog(`⚡ [카드 리더] 카메라 사용 중이라 태깅 무시됨: ${scannedQr}`, "WARN");
          barcodeBuffer = "";
          return;
        }

        appendDebugLog(`📷 [USB QR/바코드 스캐너 감지] 스캔 코드: ${scannedQr}`, "SUCCESS");

        const cardUidInput = document.getElementById("kiosk-scanned-card-uid");
        const cardTab = document.getElementById("admin-tab-card");
        if (cardTab && cardTab.style.display !== "none" && cardUidInput) {
          cardUidInput.value = scannedQr;
        } else {
          triggerKioskPayment(scannedQr);
        }
      }
      barcodeBuffer = "";
    } else if (e.key.length === 1) {
      barcodeBuffer += e.key;
      if (barcodeTimeout) clearTimeout(barcodeTimeout);
      barcodeTimeout = setTimeout(() => {
        barcodeBuffer = "";
      }, 300);
    }
  });

});

// 태블릿 전용 3분할 레이아웃(결제금액/카메라/최근내역) 브레이크포인트와 동일한 조건 - style.css 참고
function isKioskTabletLayout() {
  return window.matchMedia('(min-width: 768px) and (min-height: 700px)').matches;
}

// 카메라 뷰포트를 태블릿에서는 체크아웃 패널의 도킹 슬롯으로, 모바일에서는 원래 위치(메뉴 영역 전체 오버레이)로 이동
function dockCameraViewport(cameraBox) {
  if (!cameraBox) return;
  const dock = document.getElementById("kiosk-checkout-camera-dock");

  if (isKioskTabletLayout() && dock) {
    if (cameraBox.parentElement !== dock) dock.appendChild(cameraBox);
    cameraBox.style.position = "relative";
    cameraBox.style.inset = "auto";
    cameraBox.style.width = "100%";
    cameraBox.style.height = "100%";
    return true; // 도킹됨 - 좌측 메뉴는 그대로 보여도 됨
  }

  const menuSection = document.querySelector(".kiosk-menu-section");
  if (menuSection && cameraBox.parentElement !== menuSection) menuSection.appendChild(cameraBox);
  cameraBox.style.position = "absolute";
  cameraBox.style.inset = "0";
  return false; // 도킹 안 됨 - 기존처럼 메뉴 영역을 전체 오버레이로 대체해야 함
}

// Camera WebCam Realtime QR Decoder (jsQR)
// 테스트 모드: 실제 getUserMedia 없이 카메라 뷰포트만 띄우고 시뮬레이션 버튼을 보여줌
function startTestModeCameraView() {
  const cameraBox = document.getElementById("kiosk-camera-viewport-container");
  const menuContentWrap = document.getElementById("kiosk-menu-content-wrap");
  const statusText = document.getElementById("camera-status-text");
  const toggleBtn = document.getElementById("camera-toggle-btn");
  const testOverlay = document.getElementById("kiosk-camera-test-overlay");

  const docked = dockCameraViewport(cameraBox);
  if (menuContentWrap) menuContentWrap.style.display = docked ? "block" : "none";
  if (cameraBox) cameraBox.style.display = "flex";
  if (testOverlay) testOverlay.style.display = "flex";

  isCameraScanning = true;

  if (toggleBtn) {
    toggleBtn.innerText = "✕ QR 스캔 취소";
    toggleBtn.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
    toggleBtn.style.boxShadow = "0 4px 15px rgba(239, 68, 68, 0.4)";
  }
  // 오버레이 안에 이미 "테스트 모드" 안내가 있으므로 상태 텍스트는 비워 카메라 슬롯 공간을 최대한 확보
  if (statusText) statusText.innerText = "";
  appendDebugLog("🧪 [테스트 모드] 카메라 시뮬레이션 뷰 표시 (실제 카메라 미사용)", "WARN");

  // 리더 일시정지 로직은 실제 카메라와 동일하게 적용 (테스트 중에도 동시사용 정책을 검증할 수 있도록)
  if (shouldPauseReaderForCamera()) {
    if (currentReaderMode === "WEB_NFC") {
      stopKioskNfcScan();
    } else if (window.AndroidInterface && typeof window.AndroidInterface.pauseReaderForCamera === "function") {
      window.AndroidInterface.pauseReaderForCamera();
    }
  }
}

async function startCameraScanner(silent = false, facingMode) {
  if (kioskTestMode) {
    startTestModeCameraView();
    return;
  }

  const video = document.getElementById("qr-video");
  const cameraBox = document.getElementById("kiosk-camera-viewport-container");
  const menuGrid = document.getElementById("kiosk-menu-grid");
  const leftTitle = document.getElementById("kiosk-left-title");
  const statusText = document.getElementById("camera-status-text");
  const toggleBtn = document.getElementById("camera-toggle-btn");
  const flipBtn = document.getElementById("kiosk-camera-flip-btn");
  const fm = facingMode || kioskFacingMode;

  // 전면 카메라일 때만 .mirror-mode 클래스로 좌우반전 적용
  if (video) {
    if (fm === "user") {
      video.classList.add("mirror-mode");
    } else {
      video.classList.remove("mirror-mode");
    }
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (!silent) alert("현재 브라우저 환경에서 카메라 접근을 지원하지 않습니다.");
    if (statusText) statusText.innerText = "[카메라 안내] USB 바코드/QR 스캐너 입력을 사용하세요.";
    return;
  }

  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: fm }
    });
    video.srcObject = videoStream;
    video.setAttribute("playsinline", true);
    await video.play();

    // 내장 리더(Web NFC/기기 자체 NFC)는 카메라와 상시 배제, 외부 리더는 관리자가 동시사용을
    // 허용한 경우에만 예외 — 그 외 경우엔 카메라 사용 중 리더 인식도 함께 멈춘다.
    if (shouldPauseReaderForCamera()) {
      if (currentReaderMode === "WEB_NFC") {
        stopKioskNfcScan();
        appendDebugLog("📷 [카메라] 내장 NFC 스캔을 일시 중단했습니다.", "INFO");
      } else if (window.AndroidInterface && typeof window.AndroidInterface.pauseReaderForCamera === "function") {
        window.AndroidInterface.pauseReaderForCamera();
        appendDebugLog("📷 [카메라] Android 내장 리더 일시 중단을 요청했습니다.", "INFO");
      }
    }

    // 태블릿: 카메라를 체크아웃 패널 중앙 슬롯에 도킹(좌측 메뉴는 계속 보임)
    // 모바일: 기존처럼 좌측 메뉴 선택 및 식권 카드 전체 구역을 카메라 뷰포트로 완전 대체
    const menuContentWrap = document.getElementById("kiosk-menu-content-wrap");
    const docked = dockCameraViewport(cameraBox);
    if (menuContentWrap) menuContentWrap.style.display = docked ? "block" : "none";
    if (cameraBox) cameraBox.style.display = "flex";

    isCameraScanning = true;
    kioskFacingMode = fm;

    // 🔴 버튼 상태를 '✕ QR 스캔 취소' 스타일로 변경 (상시 켜기 모드에서는 버튼 자체가 숨겨져 있음)
    if (toggleBtn) {
      toggleBtn.innerText = "✕ QR 스캔 취소";
      toggleBtn.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
      toggleBtn.style.boxShadow = "0 4px 15px rgba(239, 68, 68, 0.4)";
    }
    if (flipBtn) flipBtn.style.display = "inline-flex";
    appendDebugLog("📷 [웹캠 스캐너] 웹 카메라 구동 완료. 좌측 메인 뷰포트 전체에 QR 스캐너 표시 중.");

    // ⏱️ 30초간 미입력 시 자동 취소 타이머 및 카운트다운 생성
    // "QR 스캐너 항상 켜기" 모드에서는 취소 개념이 없으므로 타이머를 만들지 않고 계속 켜둔다.
    clearInterval(window.kioskCameraInterval);
    if (!allowCameraReaderConcurrent) {
      let secondsLeft = 30;
      if (statusText) {
        statusText.innerText = `${secondsLeft}초 후 자동 취소`;
      }

      window.kioskCameraInterval = setInterval(() => {
        secondsLeft--;
        if (statusText) {
          statusText.innerText = `${secondsLeft}초 후 자동 취소`;
        }
        if (secondsLeft <= 0) {
          clearInterval(window.kioskCameraInterval);
          appendDebugLog("📷 [웹캠 스캐너] 30초 경과로 QR 스캐너를 자동 취소하고 메뉴 선택 화면으로 복원합니다.");
          stopCameraScanner();
        }
      }, 1000);
    } else if (statusText) {
      statusText.innerText = "";
    }

    requestAnimationFrame(scanQRCodeLoop);
  } catch (err) {
    console.warn("Camera init error:", err);
    appendDebugLog(`📷 [웹캠 에러] 카메라 구동 실패: ${err.name} - ${err.message}`, "ERROR");
    if (!silent) alert(`💡 [카메라 켜기 실패 안내]\n에러 타입: ${err.name}\n에러 메시지: ${err.message}\n\n* 만약 'NotAllowedError'인 경우 기기 설정이나 권한 허용을 다시 체크해 주세요.`);
    if (statusText) statusText.innerText = "[카메라 오류] 카메라 사용 승인 또는 설정을 체크해 주세요.";
  }
}

async function flipKioskCamera() {
  const newFacing = (kioskFacingMode === "user") ? "environment" : "user";
  if (videoStream) { videoStream.getTracks().forEach(t => t.stop()); videoStream = null; }
  isCameraScanning = false;
  await startCameraScanner(false, newFacing);
}

function stopCameraScanner() {
  const cameraBox = document.getElementById("kiosk-camera-viewport-container");
  const menuContentWrap = document.getElementById("kiosk-menu-content-wrap");
  const statusText = document.getElementById("camera-status-text");
  const toggleBtn = document.getElementById("camera-toggle-btn");
  const flipBtn = document.getElementById("kiosk-camera-flip-btn");

  // 30초 카운트다운 타이머 해제
  clearInterval(window.kioskCameraInterval);

  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  isCameraScanning = false;

  // 📺 좌측 영역 전체를 다시 메뉴 선택 및 식권 카드 화면으로 복원 + 도킹됐던 카메라 뷰포트를 원래 자리로 되돌림
  if (cameraBox) {
    cameraBox.style.display = "none";
    const menuSection = document.querySelector(".kiosk-menu-section");
    if (menuSection && cameraBox.parentElement !== menuSection) menuSection.appendChild(cameraBox);
    cameraBox.style.position = "absolute";
    cameraBox.style.inset = "0";
  }
  if (menuContentWrap) menuContentWrap.style.display = "block";

  // 테스트 모드 시뮬레이션 오버레이도 함께 닫기
  const testOverlay = document.getElementById("kiosk-camera-test-overlay");
  if (testOverlay) testOverlay.style.display = "none";

  // 🔵 버튼 상태를 '📷 교인증 QR 코드 스캔' 스타일로 복원
  if (toggleBtn) {
    toggleBtn.innerText = "📷 교인증 QR 코드 스캔";
    toggleBtn.style.background = "linear-gradient(135deg, #06b6d4, #3b82f6)";
    toggleBtn.style.boxShadow = "0 4px 15px rgba(6, 182, 212, 0.3)";
  }
  if (flipBtn) flipBtn.style.display = "none"; // 카메라 끄면 전환 버튼 숨김
  if (statusText) {
    statusText.innerText = "";
  }
  appendDebugLog("📷 [웹캠 스캐너] 웹 카메라 구동 중지 (메뉴 선택 뷰 복원 & NFC 활성화).");

  // 카메라 드라이버 완전 해제 후 500ms 지연 후 리더 재활성화
  setTimeout(() => {
    if (window.AndroidInterface && typeof window.AndroidInterface.reenableNfcReader === "function") {
      // Android 래퍼: CCID/HID/내장 NFC 우선순위 재평가(일시정지했던 내장 NFC도 여기서 다시 켜짐)
      window.AndroidInterface.reenableNfcReader();
      appendDebugLog("⚡ [Android Native App] 네이티브 NFC 리더 모드 재활성화(Re-bind) 호출 완료!", "SUCCESS");
    } else if (currentReaderMode === "WEB_NFC" && !kioskNdefReader) {
      // 일반 브라우저: 카메라 사용을 위해 중단했던 Web NFC 스캔 재개
      startKioskNfcScan(true);
      appendDebugLog("⚡ [Web NFC] 카메라 종료 - NFC 스캔 재가동.", "SUCCESS");
    }
  }, 500);
}

function toggleCameraScanner() {
  if (isCameraScanning) {
    stopCameraScanner();
  } else {
    startCameraScanner(false);
  }
}

function scanQRCodeLoop() {
  if (!isCameraScanning) return;

  const video = document.getElementById("qr-video");
  const canvas = document.getElementById("qr-canvas");

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.height = video.videoHeight;
    canvas.width = video.videoWidth;
    const ctx = canvas.getContext("2d");

    // 전면 카메라일 때만 좌우반전 보정 (후면은 정방향) - 화면 그리기는 매 프레임(60fps) 부드럽게 처리
    if (kioskFacingMode === "user") {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    // 📡 CPU 부하 차단 쓰로틀링: 250ms(초당 4회) 주기로만 무거운 픽셀 분석 및 QR 디코딩 실행
    const now = Date.now();
    if (now - lastQrDecodeTime >= 250) {
      lastQrDecodeTime = now;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (typeof jsQR !== "undefined") {
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth"
        });

        if (code && code.data && !qrScanCooldown) {
          const detectedQr = code.data.trim();
          qrScanCooldown = true;

          // "QR 스캐너 항상 켜기" 모드에서는 결제 처리 중에도 카메라 화면을 계속 띄워둬서
          // 화면 깜빡임 없이 다음 고객을 바로 이어서 스캔할 수 있게 한다.
          // 수동 모드에서는 기존처럼 스캔 즉시 카메라를 끄고 NFC 센서 우선권을 복구한다.
          if (!allowCameraReaderConcurrent) {
            stopCameraScanner();
          }

          // 📡 실시간 디버그 콘솔 로그 및 시각 효과 전송
          appendDebugLog(`📷 [웹캠 QR 실시간 감지 완료!] QR 코드 데이터: ${detectedQr}`, "SUCCESS");
          console.log(`[QR Auto Detect] Data: ${detectedQr}`);

          // 진동 피드백 (모바일 지원 기기용)
          if (navigator.vibrate) {
            try {
              navigator.vibrate(100);
            } catch (e) {
              console.log("Vibration blocked or unsupported:", e);
            }
          }

          // Autofill inside admin card modal if open
          const cardUidInput = document.getElementById("kiosk-scanned-card-uid");
          const cardTab = document.getElementById("admin-tab-card");
          if (cardTab && cardTab.style.display !== "none" && cardUidInput) {
            cardUidInput.value = detectedQr;
            appendDebugLog(`💳 [현장 대리 발급] 카메라 QR 데이터를 발급 입력창에 자동 입력함: ${detectedQr}`, "SUCCESS");
          } else {
            triggerKioskPayment(detectedQr);
          }

          setTimeout(() => { qrScanCooldown = false; }, 3000);
        }
      }
    }
  }

  if (isCameraScanning) {
    requestAnimationFrame(scanQRCodeLoop);
  }
}

// Device UUID & LocalStorage / Server Sync Engine
async function initDeviceUUID() {
  let uuid = localStorage.getItem("somang_device_uuid");
  if (!uuid) {
    uuid = `DEV_UUID_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    localStorage.setItem("somang_device_uuid", uuid);
    appendDebugLog(`[DEVICE] 신규 단말기 고유 식별자 발급: ${uuid}`, "SUCCESS");
  } else {
    appendDebugLog(`[DEVICE] 기존 단말기 식별자 로드: ${uuid}`, "INFO");
  }
  currentDeviceUuid = uuid;

  // Restore Settings from Backend Server
  try {
    const res = await fetch(`${API_BASE}/kiosk/device/${uuid}`);
    if (res.ok) {
      const data = await res.json();
      currentDeviceName = data.device_name || "무인 결제 단말기";
      currentDefaultProductId = data.default_product_id;
      allowCameraReaderConcurrent = !!data.allow_camera_reader_concurrent;
      updateDeviceHeaderUI();
      updateCameraConcurrentToggleAvailability();
      applyAlwaysOnCameraMode();
      appendDebugLog(`[DEVICE] 단말기 설정 복원 완료: "${currentDeviceName}" (기본 결제 상품 ID: ${currentDefaultProductId || "없음"})`, "SUCCESS");
    }
  } catch (err) {
    console.error("Device sync restore error:", err);
  }
}

// "QR 스캐너 항상 켜기" 체크박스의 현재 상태 표시값을 갱신 (하드웨어 리더 유무와 무관하게 항상 선택 가능)
function updateCameraConcurrentToggleAvailability() {
  const checkbox = document.getElementById("k-allow-camera-concurrent-input");
  if (!checkbox) return;
  checkbox.checked = allowCameraReaderConcurrent;
}

function updateDeviceHeaderUI() {
  const titleElem = document.getElementById("kiosk-device-title-text");
  const uuidElem = document.getElementById("kiosk-device-uuid-display");
  const inputElem = document.getElementById("k-device-name-input");
  const selectElem = document.getElementById("k-default-product-select");

  if (titleElem) titleElem.innerText = currentDeviceName;
  if (uuidElem) uuidElem.innerText = `단말기 ID: ${currentDeviceUuid}`;
  if (inputElem) inputElem.value = currentDeviceName;
  if (selectElem && currentDefaultProductId) {
    selectElem.value = currentDefaultProductId;
  }
}

// 단말기 명칭 / 기본 자동 결제 메뉴 / QR 스캐너 항상 켜기 - 셋 다 별도 저장 버튼 없이
// 값이 바뀌는 즉시(입력창은 blur, 선택/체크박스는 change) 호출되어 곧바로 DB에 반영됨
async function saveKioskDeviceSettings() {
  const nameInput = document.getElementById("k-device-name-input");
  const newName = nameInput ? nameInput.value.trim() : "";
  if (!newName) {
    // 빈 값으로 지우다 만 상태로 저장되지 않도록 건너뜀 (기존 값 유지)
    return;
  }

  const defaultProductSelect = document.getElementById("k-default-product-select");
  const defaultProductId = defaultProductSelect ? defaultProductSelect.value : "";
  const concurrentCheckbox = document.getElementById("k-allow-camera-concurrent-input");
  const concurrentValue = concurrentCheckbox ? concurrentCheckbox.checked : allowCameraReaderConcurrent;

  try {
    const res = await fetch(`${API_BASE}/kiosk/device/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_uuid: currentDeviceUuid,
        device_name: newName,
        default_product_id: defaultProductId ? parseInt(defaultProductId) : null,
        allow_camera_reader_concurrent: concurrentValue
      })
    });

    if (res.ok) {
      currentDeviceName = newName;
      currentDefaultProductId = defaultProductId ? parseInt(defaultProductId) : null;
      allowCameraReaderConcurrent = concurrentValue;
      updateDeviceHeaderUI();
      updateCameraConcurrentToggleAvailability();
      applyAlwaysOnCameraMode();
      resetCart(); // 새로운 기본 결제 상품으로 화면 및 선택 메뉴 즉시 동기화
      appendDebugLog(`[DEVICE] 단말기 설정 자동 저장: "${newName}" (기본 상품 ID: ${currentDefaultProductId || "없음"}, QR 상시켜기: ${allowCameraReaderConcurrent})`, "SUCCESS");
      flashDeviceSaveStatus(true);
    } else {
      flashDeviceSaveStatus(false);
    }
  } catch (err) {
    console.error("Save device settings error:", err);
    appendDebugLog("단말기 설정 저장 실패", "ERROR");
    flashDeviceSaveStatus(false);
  }
}

// 저장 버튼이 없어진 대신 "기본 결제 설정" 제목 옆에 잠깐 뜨는 저장 결과 표시
function flashDeviceSaveStatus(success) {
  const el = document.getElementById("k-device-save-status");
  if (!el) return;
  el.innerText = success ? "✓ 저장됨" : "⚠ 저장 실패";
  el.style.color = success ? "#10b981" : "#ef4444";
  el.style.opacity = "1";
  clearTimeout(window._kDeviceSaveStatusTimer);
  window._kDeviceSaveStatusTimer = setTimeout(() => { el.style.opacity = "0"; }, 1600);
}

// Debug Logger Function
function appendDebugLog(msg, type = "INFO") {
  const consoleElem = document.getElementById("debug-log-console");
  if (!consoleElem) return;
  const time = new Date().toLocaleTimeString();
  let color = "#38bdf8"; // cyan
  if (type === "SUCCESS") color = "#10b981";
  if (type === "ERROR") color = "#f43f5e";
  if (type === "WARN") color = "#f59e0b";

  consoleElem.innerHTML += `<div style="color:${color}; margin-bottom:0.2rem;">[${time}] [${type}] ${msg}</div>`;
  consoleElem.scrollTop = consoleElem.scrollHeight;
}

function clearDebugLog() {
  const consoleElem = document.getElementById("debug-log-console");
  if (consoleElem) consoleElem.innerHTML = `[SYSTEM] 디버그 로그가 초기화되었습니다.<br>`;
}

async function loadProducts() {
  appendDebugLog("메뉴 상품 데이터 로딩 중...", "INFO");
  try {
    const res = await fetch(`${API_BASE}/products`);
    products = await res.json();
    appendDebugLog(`메뉴 데이터 ${products.length}건 로드 성공`, "SUCCESS");
    renderKioskProducts();
    renderKioskAdminProducts();

    // 기본 자동 결제 메뉴 드롭다운 갱신
    const select = document.getElementById("k-default-product-select");
    if (select) {
      select.innerHTML = '<option value="">-- 기본 결제 없음 (메뉴 선택 필수) --</option>';
      products.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.innerText = `${p.name} (일반: ${p.price_general.toLocaleString()}원 / 시니어: ${p.price_senior.toLocaleString()}원)`;
        select.appendChild(opt);
      });
      if (currentDefaultProductId) {
        select.value = currentDefaultProductId;
      }
      resetCart();
    }
  } catch (err) {
    appendDebugLog(`메뉴 데이터 로드 실패: ${err}`, "ERROR");
    console.error("Failed to load products:", err);
  }
}

function resetCart() {
  cart = {};
  if (currentDefaultProductId && products.some(p => p.id === currentDefaultProductId)) {
    cart[currentDefaultProductId] = 1;
    appendDebugLog(`[장바구니] 기본 자동 결제 메뉴로 초기화됨 (상품 ID: ${currentDefaultProductId})`, "INFO");
  } else {
    appendDebugLog("[장바구니] 초기화 완료 (기본 선택 메뉴 없음)", "INFO");
  }
  renderKioskProducts();
}

// 메뉴 개수에 따라 그리드 열/행을 동적으로 나눈다 (태블릿 전용 - 모바일은 기존 auto-fill 유지):
// 1개 = 1열(가로 꽉 참), 2개 = 1열 2행(각각 가로 꽉 참), 3~4개 = 2열 2행, 5개 이상 = 3열(행은 필요한 만큼)
function applyKioskMenuGridLayout(container, count) {
  if (!isKioskTabletLayout()) {
    container.style.removeProperty("grid-template-columns");
    container.style.removeProperty("grid-template-rows");
    return;
  }

  // 1~4개: 2x2, 5~9개: 3x3(최대). 10개부터는 3열을 유지한 채 행만 늘려서 스크롤로 대응.
  let columns, rows;
  if (count <= 4) {
    columns = 2;
    rows = 2;
  } else if (count <= 9) {
    columns = 3;
    rows = 3;
  } else {
    columns = 3;
    rows = Math.ceil(count / 3);
  }

  // style.css의 .menu-grid grid-template-columns가 !important라서, 인라인에서도
  // !important로 지정해야 우선순위가 이긴다.
  container.style.setProperty("grid-template-columns", `repeat(${columns}, 1fr)`, "important");
  container.style.setProperty("grid-template-rows", `repeat(${rows}, 1fr)`, "important");
}

function renderKioskProducts() {
  const container = document.getElementById("kiosk-menu-grid");
  if (!container) return;
  container.innerHTML = "";
  applyKioskMenuGridLayout(container, products.length);

  products.forEach(p => {
    const qty = cart[p.id] || 0;
    const card = document.createElement("div");
    card.className = `menu-card ${qty > 0 ? 'selected' : ''}`;
    card.innerHTML = `
      <div>
        <div class="menu-name">${p.name}</div>
        <div class="menu-price">일반: ${p.price_general.toLocaleString()}원</div>
        <div class="menu-price-senior">시니어: ${p.price_senior.toLocaleString()}원</div>
      </div>
      <div class="touch-qty-box" onclick="event.stopPropagation()">
        <button class="touch-qty-btn" onclick="updateQty(${p.id}, -1)">-</button>
        <span class="touch-qty-val">${qty}</span>
        <button class="touch-qty-btn" onclick="updateQty(${p.id}, 1)">+</button>
      </div>
    `;
    container.appendChild(card);
  });

  updateCheckoutSummary();
}

function updateQty(productId, delta) {
  const current = cart[productId] || 0;
  const next = Math.max(0, current + delta);
  if (next === 0) delete cart[productId];
  else cart[productId] = next;

  renderKioskProducts();
}

function updateCheckoutSummary() {
  const container = document.getElementById("cart-items-container");
  const totalDisplay = document.getElementById("kiosk-total-price");
  if (!container || !totalDisplay) return;

  container.innerHTML = "";
  let totalMax = 0;
  let totalMin = 0;
  let count = 0;

  for (const [pid, qty] of Object.entries(cart)) {
    const product = products.find(p => p.id === parseInt(pid));
    if (product) {
      count += qty;
      totalMax += product.price_general * qty;
      totalMin += product.price_senior * qty;

      const itemDiv = document.createElement("div");
      itemDiv.className = "cart-item";
      itemDiv.innerHTML = `
        <span><strong>${product.name}</strong> x${qty}</span>
        <span>${(product.price_general * qty).toLocaleString()}원</span>
      `;
      container.appendChild(itemDiv);
    }
  }

  if (count === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; margin-top: 2rem;">선택된 메뉴가 없습니다.</p>`;
    totalDisplay.innerText = "0원";
  } else if (totalMax === totalMin) {
    totalDisplay.innerText = `${totalMax.toLocaleString()}원`;
  } else {
    totalDisplay.innerText = `${totalMax.toLocaleString()}원`;
  }
}

// 테스트 모드 결제 시뮬레이션 - 실제 서버 API를 호출하지 않고 성공/실패 UI만 재현한다.
function simulateKioskPayment(outcome) {
  // 상시 켜기 모드에서는 시뮬레이션 후에도 카메라(테스트) 화면을 계속 띄워둔다.
  // 수동 모드에서는 기존처럼 오버레이를 닫고 리더 재활성화까지 기존 로직 재사용.
  if (!allowCameraReaderConcurrent) {
    stopCameraScanner();
  }

  let total = 0;
  for (const [pid, qty] of Object.entries(cart)) {
    const product = products.find(p => p.id === parseInt(pid));
    if (product) total += product.price_general * qty;
  }
  if (total === 0) {
    const defaultProduct = products.find(p => p.id === currentDefaultProductId);
    total = defaultProduct ? defaultProduct.price_general : 2000;
  }

  if (outcome === "SUCCESS") {
    appendDebugLog(`🧪 [테스트 모드] 결제 성공 시뮬레이션 (${total.toLocaleString()}원)`, "SUCCESS");
    triggerSuccessEdgeGlow();
    playSpeech("감사합니다.");
    addRecentPayment({
      user_name: "테스트 사용자",
      user_type: "일반",
      total_amount: total,
      balance_after: Math.max(0, 50000 - total)
    });
    resetCart();
  } else if (outcome === "INSUFFICIENT_BALANCE") {
    appendDebugLog(`🧪 [테스트 모드] 잔액 부족 시뮬레이션`, "WARN");
    triggerWarningEdgeGlow();
    playSpeech("잔액이 부족합니다.");
  } else if (outcome === "UNREGISTERED_CARD") {
    appendDebugLog(`🧪 [테스트 모드] 미등록 카드 시뮬레이션`, "WARN");
    triggerErrorEdgeGlow();
    playSpeech("등록되지 않은 카드입니다.");
  }

  maybeAutoStartAlwaysOnCamera();
}

async function triggerKioskPayment(cardUid, forceConfirm = false) {
  // 재결제 확인 팝업으로 넘어간 경우엔 그 팝업이 닫힐 때 카메라를 재개해야 하므로,
  // 이 함수 종료 시 상시 켜기 모드의 카메라 자동 재개를 건너뛴다.
  let deferCameraResume = false;

  // 1. 이미 결제 요청이 처리 중이거나 결과 팝업창이 열려 있으면 추가적인 태깅/스캔 무시
  if (isKioskPaymentProcessing) {
    console.log("Payment already in progress. Ignoring duplicate tag.");
    return;
  }
  const modal = document.getElementById("payment-modal");
  if (modal && (modal.style.display === 'flex' || modal.classList.contains("active"))) {
    console.log("Payment success/failure modal is currently open. Ignoring tag.");
    return;
  }

  const items = [];
  for (const [pid, qty] of Object.entries(cart)) {
    if (qty > 0) items.push({ product_id: parseInt(pid), quantity: qty });
  }

  if (items.length === 0) {
    if (currentDefaultProductId) {
      items.push({ product_id: currentDefaultProductId, quantity: 1 });
      appendDebugLog(`[결제] 선택된 메뉴 없음. 기본 자동 결제 메뉴로 결제 요청 (ID: ${currentDefaultProductId})`, "INFO");
    } else {
      alert("결제하실 메뉴의 수량을 먼저 선택해주세요.");
      return;
    }
  }

  // 결제 락 활성화
  isKioskPaymentProcessing = true;

  // 진동 피드백 (태깅 성공)
  if (navigator.vibrate) {
    try { navigator.vibrate(100); } catch (e) { }
  }

  appendDebugLog(`NFC 태깅 감지! Card UID: ${cardUid}`, "WARN");
  appendDebugLog(`결제 요청 서버 전송 중... (상품 ${items.length}종, force_confirm: ${forceConfirm})`, "INFO");

  try {
    const res = await fetch(`${API_BASE}/payments/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_uid: cardUid,
        device_uuid: currentDeviceUuid,
        items: items,
        merchant_id: 1,
        force_confirm: forceConfirm
      })
    });

    const data = await res.json();

    // ─── 200 OK 이지만 재결제 확인 필요 (30초 이내 동일 회원) ───
    if (res.ok && data.status === "CONFIRM_REQUIRED") {
      isKioskPaymentProcessing = false;
      deferCameraResume = true;
      appendDebugLog(`[30초 재결제 감지] ${data.user_name} — 커스텀 확인 팝업 표시`, "WARN");
      showRepeatPayModal(data.user_name, cardUid);
      return;
    }

    if (!res.ok) {
      const detail = data.detail || "결제 실패";
      appendDebugLog(`결제 실패: ${detail}`, "ERROR");

      // ─── 미등록 카드 / 비활성화 식별자 ───
      if (detail.includes("등록되지 않") || detail.includes("비활성화") || detail.includes("유효하지 않")) {
        playSpeech("등록되지 않은 카드입니다.");
        triggerErrorEdgeGlow();
      }
      // ─── 잔액 부족 ───
      else if (detail.includes("잔액")) {
        playSpeech("잔액이 부족합니다.");
        triggerWarningEdgeGlow();
      }
      // ─── 그 외 오류 ───
      else {
        playSpeech("결제에 실패했습니다.");
        triggerErrorEdgeGlow();
      }

      isKioskPaymentProcessing = false;
      return;
    }

    // ─── 결제 성공 ─── 팝업 없이 글로우 + TTS + 최근 결제 내역 갱신
    appendDebugLog(`결제 성공! 회원: ${data.user_name} (${data.user_type}), 차감금액: ${data.total_amount.toLocaleString()}원, 남은잔액: ${data.balance_after.toLocaleString()}원`, "SUCCESS");
    triggerSuccessEdgeGlow();
    playSpeech("감사합니다.");
    addRecentPayment(data);

    // Clear cart & restore default product
    resetCart();
  } catch (err) {
    appendDebugLog(`통신 에러 발생: ${err}`, "ERROR");
    console.error("Kiosk Payment error:", err);
    triggerErrorEdgeGlow();
    playSpeech("서버 연결에 실패했습니다.");
  } finally {
    isKioskPaymentProcessing = false;
    // 상시 켜기 모드면 결제 처리로 잠시 꺼졌던 카메라를 다음 고객을 위해 다시 켠다
    if (!deferCameraResume) maybeAutoStartAlwaysOnCamera();
  }
}


// ─── Custom Repeat Payment Confirm Popup ───
let _repeatPayCardUid = null;

function showRepeatPayModal(userName, cardUid) {
  _repeatPayCardUid = cardUid;
  const modal = document.getElementById("repeat-pay-modal");
  const msg = document.getElementById("repeat-pay-msg");
  if (msg) msg.innerText = `「${userName}」님이 방금 결제하셨습니다.\n동일 메뉴를 한 번 더 결제합니다.`;
  if (modal) { modal.style.display = "flex"; modal.classList.add("active"); }
  playSpeech("추가 결제 하시겠습니까?");
}

function closeRepeatPayModal(confirmed) {
  const modal = document.getElementById("repeat-pay-modal");
  if (modal) { modal.style.display = "none"; modal.classList.remove("active"); }
  // UID를 로컈에 선 캐쳐한 후 전역 초기화 (비동기 경쥐 조건 방지)
  const capturedUid = _repeatPayCardUid;
  _repeatPayCardUid = null;
  if (confirmed && capturedUid) {
    appendDebugLog(`[재결제 확인] force_confirm=true 재결제 시도: ${capturedUid}`, "INFO");
    triggerKioskPayment(capturedUid, true);
  } else {
    appendDebugLog(`[재결제 취소]`, "WARN");
    maybeAutoStartAlwaysOnCamera();
  }
}

// ================= SUCCESS GLOW & RECENT PAYMENTS =================

function triggerSuccessEdgeGlow() {
  const wrapper = document.querySelector(".kiosk-wrapper");
  if (!wrapper) return;
  wrapper.classList.remove("success-glow-active", "error-glow-active", "warning-glow-active");
  void wrapper.offsetWidth;
  wrapper.classList.add("success-glow-active");
  setTimeout(() => wrapper.classList.remove("success-glow-active"), 1500);
}

function triggerErrorEdgeGlow() {
  const wrapper = document.querySelector(".kiosk-wrapper");
  if (!wrapper) return;
  wrapper.classList.remove("success-glow-active", "error-glow-active", "warning-glow-active");
  void wrapper.offsetWidth;
  wrapper.classList.add("error-glow-active");
  setTimeout(() => wrapper.classList.remove("error-glow-active"), 1500);
}

function triggerWarningEdgeGlow() {
  const wrapper = document.querySelector(".kiosk-wrapper");
  if (!wrapper) return;
  wrapper.classList.remove("success-glow-active", "error-glow-active", "warning-glow-active");
  void wrapper.offsetWidth;
  wrapper.classList.add("warning-glow-active");
  setTimeout(() => wrapper.classList.remove("warning-glow-active"), 1500);
}

let recentPaymentsList = [];

function addRecentPayment(data) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  recentPaymentsList.unshift({
    time: timeStr,
    userName: data.user_name || "회원",
    userType: data.user_type || "일반",
    amount: data.total_amount,
    balance: data.balance_after
  });
  if (recentPaymentsList.length > 5) recentPaymentsList.pop();
  renderRecentPaymentsUI();
}

function renderRecentPaymentsUI() {
  const list = document.getElementById("recent-payments-list");
  if (!list) return;
  if (recentPaymentsList.length === 0) {
    list.innerHTML = `<div class="recent-payment-empty" style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 0.25rem 0;">최근 결제 내역이 없습니다.</div>`;
    return;
  }
  list.innerHTML = recentPaymentsList.map((p, i) => {
    const isSenior = p.userType === "시니어";
    const badgeColor = isSenior ? "#f59e0b" : "#06b6d4";
    const badgeBg = isSenior ? "rgba(245,158,11,0.15)" : "rgba(6,182,212,0.15)";
    return `<div class="recent-payment-row" style="display: flex; justify-content: space-between; align-items: center; padding: 0.2rem 0.4rem; background: ${i === 0 ? 'rgba(16,185,129,0.12)' : 'rgba(15,23,42,0.5)'}; border-radius: 6px; border-left: 3px solid ${i === 0 ? '#10b981' : 'rgba(255,255,255,0.1)'}; font-size: 0.74rem;">
      <div style="display: flex; align-items: center; gap: 0.3rem;">
        <span class="recent-payment-time" style="color: var(--text-muted); font-family: monospace; font-size: 0.68rem;">${p.time}</span>
        <strong class="recent-payment-name" style="color: #f1f5f9;">${p.userName}</strong>
        <span class="recent-payment-badge" style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}; border-radius: 4px; padding: 0 0.25rem; font-size: 0.65rem; font-weight: bold;">${p.userType}</span>
      </div>
      <div class="recent-payment-amount" style="color: #10b981; font-weight: 700; font-size: 0.78rem;">${p.amount.toLocaleString()}원</div>
    </div>`;
  }).join("");
}

// ================= KIOSK ADMIN & DEBUG CONSOLE FUNCTIONS =================

// 키오스크 모달 헬퍼 (인라인 style + .active 클래스 동시 제어)
function kioskShowModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'flex';
    el.classList.add("active");
  }
}
function kioskHideModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'none';
    el.classList.remove("active");
  }
}

function openKioskAdminPinModal() {
  // 설정 화면으로 들어가는 동안엔 상시 켜기 카메라를 잠시 꺼둔다 (모달 닫을 때 다시 켜짐)
  if (isCameraScanning) stopCameraScanner();

  if (sessionStorage.getItem("kiosk_admin_auth") === "true") {
    openKioskAdminModal();
    return;
  }
  kioskShowModal("kiosk-pin-modal");
  const input = document.getElementById("kiosk-pin-input");
  if (input) { input.value = ""; input.focus(); }
}

function closeKioskPinModal() {
  kioskHideModal("kiosk-pin-modal");
  maybeAutoStartAlwaysOnCamera();
}

function verifyKioskAdminPin() {
  const pinInput = document.getElementById("kiosk-pin-input");
  const pin = pinInput ? pinInput.value.trim() : "";
  if (pin === "1234") {
    sessionStorage.setItem("kiosk_admin_auth", "true");
    closeKioskPinModal();
    openKioskAdminModal();
    appendDebugLog("[ADMIN] 단말기 관리자 모드 진입 성공", "SUCCESS");
  } else {
    alert("PIN 번호가 올바르지 않습니다.");
    appendDebugLog("[ADMIN] 잘못된 PIN 입력 시도", "ERROR");
    if (pinInput) pinInput.value = "";
  }
}

// 화면 방향 강제 전환 (Screen Orientation API) - 안드로이드에서 홈 화면에 설치된 앱(PWA)
// 상태일 때만 동작함. 일반 브라우저 탭에서는 lock()이 지원되지 않아 실패할 수 있음.
function setKioskOrientation(mode) {
  if (!screen.orientation || typeof screen.orientation.lock !== "function") {
    appendDebugLog("[화면 방향] 이 환경에서는 화면 방향 고정을 지원하지 않습니다.", "WARN");
    alert("화면 방향 전환은 홈 화면에 설치된 앱 상태에서만 지원됩니다.");
    return;
  }

  screen.orientation.lock(mode).then(() => {
    appendDebugLog(`[화면 방향] ${mode === "portrait" ? "세로" : "가로"} 모드로 전환되었습니다.`, "SUCCESS");
    updateKioskOrientationButtonsUI(mode);
  }).catch(err => {
    appendDebugLog(`[화면 방향] 전환 실패: ${err.name} - ${err.message}`, "ERROR");
    alert(`화면 방향 전환에 실패했습니다. (${err.name})\n홈 화면에 설치된 앱 상태인지 확인해주세요.`);
  });
}

function updateKioskOrientationButtonsUI(activeMode) {
  const portraitBtn = document.getElementById("k-orientation-portrait-btn");
  const landscapeBtn = document.getElementById("k-orientation-landscape-btn");
  [[portraitBtn, "portrait"], [landscapeBtn, "landscape"]].forEach(([btn, mode]) => {
    if (!btn) return;
    const active = mode === activeMode;
    btn.style.background = active ? "var(--accent-cyan)" : "rgba(255,255,255,0.1)";
    btn.style.color = active ? "#001318" : "#fff";
  });
}

function openKioskAdminModal() {
  kioskShowModal("kiosk-admin-modal");
  renderKioskAdminProducts();
  updateCameraConcurrentToggleAvailability();
  updateKioskTestModeUI();
  updateKioskOrientationButtonsUI(screen.orientation ? screen.orientation.type.split("-")[0] : null);
}

function closeKioskAdminModal() {
  kioskHideModal("kiosk-admin-modal");
  maybeAutoStartAlwaysOnCamera();
}

function switchKioskAdminTab(tabName) {
  const menuSec = document.getElementById("kiosk-admin-menu-sec");
  const debugSec = document.getElementById("kiosk-admin-debug-sec");
  const btnMenu = document.getElementById("kiosk-tab-btn-menu");
  const btnDebug = document.getElementById("kiosk-tab-btn-debug");

  if (tabName === 'menu') {
    menuSec.style.display = "block";
    debugSec.style.display = "none";
    btnMenu.className = "btn-action btn-primary";
    btnDebug.className = "btn-action";
    btnDebug.style.background = "rgba(255,255,255,0.1)";
  } else {
    menuSec.style.display = "none";
    debugSec.style.display = "block";
    btnDebug.className = "btn-action btn-primary";
    btnMenu.className = "btn-action";
    btnMenu.style.background = "rgba(255,255,255,0.1)";
  }
}

function renderKioskAdminProducts() {
  const tbody = document.getElementById("kiosk-admin-product-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  products.forEach(p => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid rgba(255,255,255,0.06)";
    tr.style.transition = "background 0.2s ease";
    tr.innerHTML = `
      <td style="padding: 0.85rem 1rem; text-align: left; font-weight: 700; color: #fff;">${p.name}</td>
      <td style="padding: 0.85rem 0.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">${p.price_general.toLocaleString()}원</td>
      <td style="padding: 0.85rem 0.5rem; text-align: center; color: var(--accent-amber); font-weight: 800; font-size: 0.95rem;">${p.price_senior.toLocaleString()}원</td>
      <td style="padding: 0.85rem 1rem; text-align: center;">
        <div style="display: flex; gap: 0.4rem; justify-content: center; align-items: center;">
          <button class="btn-action" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; font-weight: 600; border-radius: 6px; background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.4); min-height: 28px; transition: all 0.2s;" onclick="kioskStartEditProduct(${p.id})">수정</button>
          <button class="btn-action" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; font-weight: 600; border-radius: 6px; background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.4); min-height: 28px; transition: all 0.2s;" onclick="kioskDeleteProduct(${p.id})">삭제</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function kioskStartEditProduct(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  document.getElementById("k-prod-name").value = product.name;
  document.getElementById("k-prod-gen").value = product.price_general;
  document.getElementById("k-prod-sen").value = product.price_senior;

  editingProductId = id;

  const titleElem = document.getElementById("kiosk-crud-title");
  if (titleElem) titleElem.innerText = "메뉴 수정";

  const btnElem = document.getElementById("k-add-btn");
  if (btnElem) {
    btnElem.innerText = "수정";
    btnElem.className = "btn-action btn-primary";
    btnElem.style.background = "var(--primary)";
  }
}

async function kioskAddProduct() {
  const name = document.getElementById("k-prod-name").value.trim();
  const genPrice = parseInt(document.getElementById("k-prod-gen").value);
  const senPrice = parseInt(document.getElementById("k-prod-sen").value);

  if (!name || isNaN(genPrice)) {
    alert("메뉴 이름과 일반 가격을 입력하세요.");
    return;
  }

  const payload = {
    name: name,
    price_general: genPrice,
    price_senior: isNaN(senPrice) ? genPrice : senPrice
  };

  try {
    let res;
    if (editingProductId !== null) {
      // 수정 모드
      res = await fetch(`${API_BASE}/products/${editingProductId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else {
      // 추가 모드
      res = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      if (editingProductId !== null) {
        appendDebugLog(`[ADMIN] 메뉴 수정 완료: ${name}`, "SUCCESS");
      } else {
        appendDebugLog(`[ADMIN] 신규 메뉴 추가 완료: ${name}`, "SUCCESS");
      }

      // 입력 폼 초기화 및 상태 원복
      document.getElementById("k-prod-name").value = "";
      document.getElementById("k-prod-gen").value = "";
      document.getElementById("k-prod-sen").value = "";

      editingProductId = null;
      const titleElem = document.getElementById("kiosk-crud-title");
      if (titleElem) titleElem.innerText = "메뉴 추가";

      const btnElem = document.getElementById("k-add-btn");
      if (btnElem) {
        btnElem.innerText = "추가";
        btnElem.className = "btn-action btn-emerald";
        btnElem.style.background = ""; // Reset inline override style
      }

      await loadProducts();
    } else {
      appendDebugLog(`메뉴 처리 실패`, "ERROR");
    }
  } catch (err) {
    appendDebugLog(`메뉴 처리 오류: ${err}`, "ERROR");
  }
}

async function kioskDeleteProduct(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  if (!confirm(`"${product.name}" 메뉴를 정말 삭제하시겠습니까?`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: "DELETE"
    });

    if (res.ok) {
      appendDebugLog(`[ADMIN] 메뉴 삭제 완료: ${product.name}`, "SUCCESS");

      // 수정 중이던 메뉴가 삭제되는 경우 수정 모드 해제
      if (editingProductId === id) {
        document.getElementById("k-prod-name").value = "";
        document.getElementById("k-prod-gen").value = "";
        document.getElementById("k-prod-sen").value = "";

        editingProductId = null;
        const titleElem = document.getElementById("kiosk-crud-title");
        if (titleElem) titleElem.innerText = "메뉴 추가";

        const btnElem = document.getElementById("k-add-btn");
        if (btnElem) {
          btnElem.innerText = "추가";
          btnElem.className = "btn-action btn-emerald";
          btnElem.style.background = "";
        }
      }

      await loadProducts();
    } else {
      appendDebugLog(`메뉴 삭제 실패`, "ERROR");
    }
  } catch (err) {
    appendDebugLog(`메뉴 삭제 통신 오류: ${err}`, "ERROR");
  }
}

function playSpeech(text) {
  // 1순위: Android Native JavascriptInterface TTS (가장 안정적)
  if (window.AndroidInterface && typeof window.AndroidInterface.speakText === 'function') {
    try {
      window.AndroidInterface.speakText(text);
      return;
    } catch (e) {
      console.warn('AndroidInterface.speakText failed:', e);
    }
  }
  // 2순위: Web SpeechSynthesis API
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 1.0;
      utterance.volume = 1.0;
      // Android WebView 첫 utterance 묵음 버그 우회: 빈 발화 후 실 발화
      const dummy = new SpeechSynthesisUtterance('');
      dummy.onend = () => window.speechSynthesis.speak(utterance);
      window.speechSynthesis.speak(dummy);
    } catch (e) {
      console.warn('speechSynthesis failed:', e);
    }
  }
}

function switchAdminTab(tabName) {
  const menuTab = document.getElementById("admin-tab-menu");
  const cardTab = document.getElementById("admin-tab-card");
  const logTab = document.getElementById("admin-tab-log");

  if (menuTab) menuTab.style.display = tabName === "menu" ? "block" : "none";
  if (cardTab) cardTab.style.display = tabName === "card" ? "block" : "none";
  if (logTab) logTab.style.display = tabName === "log" ? "block" : "none";

  if (tabName === "card") {
    loadKioskUsersForCardIssue();
  }
}

async function loadKioskUsersForCardIssue() {
  const select = document.getElementById("kiosk-card-user-select");
  if (!select) return;

  try {
    const res = await fetch(`${API_BASE}/users`);
    if (res.ok) {
      const users = await res.json();
      select.innerHTML = '<option value="">-- 어르신/회원 선택 --</option>' + users.map(u => `<option value="${u.id}">[${u.user_type === 'SENIOR' ? '시니어' : '일반'}] ${u.name} (${u.phone || u.account_number || '연락처없음'})</option>`).join("");
    }
  } catch (e) {
    console.error("loadKioskUsersForCardIssue error:", e);
  }
}

async function issueKioskCardToUser() {
  const userId = document.getElementById("kiosk-card-user-select").value;
  const cardUid = document.getElementById("kiosk-scanned-card-uid").value.trim();

  if (!userId) {
    alert("발급 대상 회원을 선택해 주세요.");
    return;
  }
  if (!cardUid) {
    alert("실물 카드를 단말기에 대시거나 카드 번호(UID)를 입력해 주세요.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/cards/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_uid: cardUid,
        card_name: "키오스크 현장 대리 발급 실물 카드",
        user_id: parseInt(userId)
      })
    });

    if (res.ok) {
      alert(`🎉 [현장 실물 카드 발급 완료!]\n카드 UID: ${cardUid}\n선택하신 회원 계정에 1:1 발급되었습니다.`);
      document.getElementById("kiosk-scanned-card-uid").value = "";
      appendDebugLog(`💳 [현장 대리 발급 성공] UID: ${cardUid}`, "SUCCESS");
    } else {
      const errData = await res.json();
      alert(`발급 실패: ${errData.detail || '오류 발생'}`);
    }
  } catch (err) {
    console.error("Issue card error:", err);
    alert("서버 통신 중 에러가 발생했습니다.");
  }
}

function showModal(isSuccess, data) {
  const modal = document.getElementById("payment-modal");
  const modalBox = document.getElementById("modal-box");
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add("active");
  }

  if (isSuccess) {
    modalBox.style.borderColor = "#10b981";
    modalBox.innerHTML = `
      <div style="font-size: 4.5rem; color: #10b981; margin-bottom: 0.5rem;">✅</div>
      <h1 style="font-size: 2.2rem; margin-bottom: 0.5rem;">결제 승인 완료</h1>
      <div style="margin-bottom: 1.2rem;">
        <span class="badge-tag ${data.user_type === '시니어' ? 'badge-senior' : 'badge-general'}">${data.user_type} 회원</span>
        <strong style="font-size: 1.5rem; margin-left: 0.5rem;">${data.user_name}님</strong>
      </div>
      <div style="background: rgba(15,23,42,0.8); padding: 1.5rem; border-radius: 18px; margin: 1.2rem 0;">
        <div style="color: var(--text-muted); font-size: 1.1rem;">결제 차감 금액</div>
        <div style="font-size: 2.2rem; font-weight: 900; color: #7c3aed;">${data.total_amount.toLocaleString()}원</div>
        <div style="color: var(--text-muted); font-size: 1.1rem; margin-top: 0.8rem;">결제 후 남은 잔액</div>
        <div style="font-size: 1.8rem; font-weight: 900; color: #10b981;">${data.balance_after.toLocaleString()}원</div>
      </div>
      <p id="kiosk-modal-timer" style="color: var(--text-muted); font-size: 1.1rem;">3초 후 대기 화면으로 자동 전환됩니다.</p>
    `;

    let seconds = 3;
    const interval = setInterval(() => {
      seconds--;
      const timerElem = document.getElementById("kiosk-modal-timer");
      if (timerElem) timerElem.innerText = `${seconds}초 후 대기 화면으로 자동 전환됩니다.`;
      if (seconds <= 0) {
        clearInterval(interval);
        closeModal();
      }
    }, 1000);
  } else {
    modalBox.style.borderColor = "#f43f5e";
    modalBox.innerHTML = `
      <div style="font-size: 4.5rem; color: #f43f5e; margin-bottom: 0.5rem;">⚠️</div>
      <h1 style="font-size: 2.2rem; margin-bottom: 0.5rem; color: #f43f5e;">결제 실패</h1>
      <p style="font-size: 1.4rem; margin: 1.5rem 0; color: #f8fafc;">${data}</p>
      <button class="btn-action btn-primary" onclick="closeModal()">닫기</button>
    `;
  }
}

function closeModal() {
  const modal = document.getElementById("payment-modal");
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove("active");
  }
  resetCart(); // 결제 결과 팝업 닫힘 시 기본 자동 결제 메뉴로 장바구니 자동 복원
}

function triggerKioskDetectionFeedback() {
  // 1. 진동 피드백
  if (navigator.vibrate) {
    try {
      navigator.vibrate(100);
      navigator.vibrate([100]);
    } catch (e) {
      console.log("Vibration not allowed or supported yet:", e);
    }
  }

  // 2. 오디오 피드백 (800Hz 삑 소리)
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (e) {
    console.log("Audio feedback context block:", e);
  }
}

// 수동 버튼 클릭 시 호출 (사용자 제스처가 필요한 최초 권한 요청)
async function requestNfcPermissionByUserGesture() {
  const btnText = document.getElementById("nfc-status-btn-text");
  const btnElem = document.getElementById("nfc-activate-btn");

  // Android 네이티브 앱 환경 감지 시 Web NFC를 우회하고 바로 하드웨어 NFC 알림 표시
  if (window.AndroidInterface) {
    appendDebugLog("[NFC] Android 네이티브 앱 감지 - 하드웨어 NFC가 이미 백그라운드에서 상시 작동 중입니다.", "SUCCESS");
    if (btnText) btnText.innerText = "🟢 NFC 무인 태깅 작동 중";
    if (btnElem) {
      btnElem.style.background = "rgba(16,185,129,0.3)";
      btnElem.style.borderColor = "#10b981";
    }
    return;
  }

  if (!('NDEFReader' in window)) {
    // Web NFC 미지원 환경 (일부 WebView) — Android Native NFC는 별도로 항상 가동 중
    appendDebugLog("[Web NFC] 이 환경에서는 Web NFC API가 지원되지 않습니다. Android Native NFC로 동작합니다.", "WARN");
    if (btnText) btnText.innerText = "🟢 NFC 무인 태깅 작동 중 (Native)";
    if (btnElem) {
      btnElem.style.background = "rgba(16,185,129,0.3)";
      btnElem.style.borderColor = "#10b981";
    }
    return;
  }

  // 사용자 터치 버튼을 직접 누른 경우, 기존 리더가 있더라도 강제로 자원 해제 후 재생성하여
  // 브라우저의 사용자 제스처(User Gesture) 락 및 백그라운드 무반응 문제를 확실하게 깨우고 갱신합니다.
  appendDebugLog("[Web NFC] 사용자 터치 제스처 수신 - NFC 리더 강제 갱신 및 재가동...", "INFO");
  if (btnText) btnText.innerText = "⏳ NFC 권한 요청 중...";
  kioskNdefReader = null;
  await startKioskNfcScan(false);
}

// 실제 NFC 스캔 가동 핵심 함수 (자동/수동 양쪽에서 호출됨)
// silent=true: 자동 시도 (권한 거부 시 alert 없이 조용히 실패, 버튼 대기 상태 유지)
// silent=false: 사용자 버튼 클릭 시 (권한 거부 시 경고 메시지 표시)
async function startKioskNfcScan(silent = false) {
  if (kioskNdefReader) return; // 이미 실행 중

  const btnText = document.getElementById("nfc-status-btn-text");
  const btnElem = document.getElementById("nfc-activate-btn");
  let scanTimeoutId = null;

  // "⏳ NFC 권한 요청 중..." 문구에 영원히 멈춰있지 않도록, 실패/타임아웃 시 항상 대기 버튼으로 복구
  const resetNfcButton = () => {
    if (btnText) btnText.innerText = "📲 NFC 센서 활성화";
    if (btnElem) {
      btnElem.style.background = "rgba(16,185,129,0.2)";
      btnElem.style.borderColor = "#10b981";
    }
  };

  try {
    kioskNdefReader = new NDEFReader();
    kioskNfcAbortController = new AbortController();

    // NDEF 규격 카드 감지 리스너 (scan() 호출 전에 사전 등록)
    kioskNdefReader.addEventListener("reading", event => {
      if (kioskNfcScanCooldown) return;
      kioskNfcScanCooldown = true;
      setTimeout(() => { kioskNfcScanCooldown = false; }, 3000);

      const serialNum = event.serialNumber || "RAW_HCE_NO_SERIAL";

      // 1. 디버그 로그 및 피드백 최우선 실행 (NDEF 레코드 파싱 예외로 인한 로그 누락 차단)
      appendDebugLog(`📡 [Web NFC] 실물 NFC/스마트폰 스캔 원시 데이터 감지!`, "SUCCESS");
      appendDebugLog(`  ├─ 💳 보안 HCE 시리얼 번호 (UID): ${serialNum}`, "WARN");
      appendDebugLog(`  └─ ⏱️ 감지 시각: ${new Date(event.timeStamp || Date.now()).toLocaleTimeString()}`, "INFO");

      try {
        triggerKioskDetectionFeedback();
      } catch (e) {
        console.warn("NFC feedback error:", e);
      }

      // 2. NDEF 레코드 안전 디코딩
      let recordsDetails = [];
      try {
        if (event.message && event.message.records) {
          for (const record of event.message.records) {
            let textData = "Binary/HEX Payload";
            if (record.data) {
              try {
                const textDecoder = new TextDecoder(record.encoding || "utf-8");
                textData = textDecoder.decode(record.data);
              } catch (e) { }
            }
            recordsDetails.push(`[Type: ${record.recordType || 'unknown'}, Payload: ${textData}]`);
          }
        }
      } catch (err) {
        console.warn("NDEF records decode error:", err);
      }

      if (recordsDetails.length > 0) {
        appendDebugLog(`  └─ 📑 NDEF 레코드 토큰: ${recordsDetails.join(" / ")}`, "INFO");
      }

      triggerKioskPayment(serialNum);
    });

    // 비NDEF/스마트폰 HCE 접촉 감지 리스너 (scan() 호출 전에 사전 등록)
    kioskNdefReader.addEventListener("readingerror", event => {
      if (kioskNfcScanCooldown) return;
      kioskNfcScanCooldown = true;
      setTimeout(() => { kioskNfcScanCooldown = false; }, 2000);

      const rawHceToken = `HCE_EVENT_TOKEN_${Math.floor(event.timeStamp || Date.now())}`;

      // 디버그 로그 및 피드백 최우선 실행
      appendDebugLog(`⚡ [Web NFC] 스마트폰 HCE 접촉 감지! (미등록/보안 가상 카드)`, "WARN");
      appendDebugLog(`  ├─ 💳 원시 HCE 식별 토큰: ${rawHceToken}`, "WARN");
      appendDebugLog(`  └─ 💡 미등록 폰인 경우 위 토큰(${rawHceToken})을 회원 계정에 등록하시면 즉시 구별 결제됩니다!`, "INFO");

      try {
        triggerKioskDetectionFeedback();
      } catch (e) {
        console.warn("NFC feedback error:", e);
      }

      triggerKioskPayment(rawHceToken);
    });

    // scan()이 하드웨어 미지원이나 권한 대화상자 먹통 등으로 영영 응답하지 않을 경우를 대비한 안전장치.
    // 8초 안에 성공/실패 응답이 없으면 타임아웃으로 간주하고 버튼을 복구한다.
    const timeoutPromise = new Promise((_, reject) => {
      scanTimeoutId = setTimeout(() => reject(Object.assign(new Error("NFC 권한 요청 응답 시간 초과"), { name: "TimeoutError" })), 8000);
    });

    await Promise.race([
      kioskNdefReader.scan({ signal: kioskNfcAbortController.signal }),
      timeoutPromise
    ]);
    clearTimeout(scanTimeoutId);

    currentReaderMode = "WEB_NFC";
    updateCameraConcurrentToggleAvailability();
    appendDebugLog("🎉 [Web NFC] 안드로이드 NFC 센서 권한 허용 및 스캔 가동 성공!", "SUCCESS");
    if (btnText) btnText.innerText = "🟢 NFC 무인 태깅 작동 중";
    if (btnElem) {
      btnElem.style.background = "rgba(16,185,129,0.3)";
      btnElem.style.borderColor = "#10b981";
    }
  } catch (err) {
    clearTimeout(scanTimeoutId);
    kioskNdefReader = null;
    kioskNfcAbortController = null;
    if (err.name === 'AbortError') {
      // 카메라 사용을 위해 의도적으로 중단시킨 경우 - 에러로 취급하지 않음
      appendDebugLog("[Web NFC] 카메라 사용을 위해 일시 중단되었습니다.", "INFO");
      resetNfcButton();
    } else if (err.name === 'TimeoutError') {
      appendDebugLog("[Web NFC] NFC 권한 요청이 응답 없이 시간 초과되었습니다. 기기의 NFC 지원 여부/설정을 확인해주세요.", "ERROR");
      if (!silent) alert("NFC 권한 요청이 응답하지 않았습니다.\n\n기기에 NFC가 없거나 꺼져 있을 수 있습니다.\n설정 > 연결 항목에서 NFC를 켠 뒤 다시 시도해주세요.");
      resetNfcButton();
    } else if (err.name === 'NotAllowedError' || String(err).includes('permission')) {
      // 자동 시작 시도(silent=true)에서는 조용히 실패 → 버튼 대기 상태로 복구만 하고 알림 없음
      if (!silent) {
        appendDebugLog(`[Web NFC] NFC 권한이 거부되었습니다. 버튼을 눌러 권한을 허용해 주세요.`, "WARN");
      } else {
        appendDebugLog("[Web NFC] 상단 [📲 NFC 센서 권한 활성화] 버튼을 터치하여 NFC를 가동하세요.", "INFO");
      }
      resetNfcButton();
    } else {
      appendDebugLog(`[Web NFC] 오류: ${err}`, "ERROR");
      console.error("NFC scan error:", err);
      resetNfcButton();
    }
  }
}

// 카메라 사용을 위해 진행 중인 Web NFC 스캔을 중단 (내장 센서 전용 - 외부 리더에는 영향 없음)
function stopKioskNfcScan() {
  if (kioskNfcAbortController) {
    kioskNfcAbortController.abort();
  }
  kioskNdefReader = null;
  kioskNfcAbortController = null;
}


function initWebNFC() {
  // Android 네이티브 앱 환경 감지 (AndroidInterface 존재 여부)
  // WebView는 Web NFC scan()을 지원 안 함 — 하드웨어 NFC 전용
  if (window.AndroidInterface) {
    const btnText = document.getElementById("nfc-status-btn-text");
    const btnElem = document.getElementById("nfc-activate-btn");
    if (btnText) btnText.innerText = "🟢 NFC 무인 태깅 작동 중";
    if (btnElem) {
      btnElem.style.background = "rgba(16,185,129,0.3)";
      btnElem.style.borderColor = "#10b981";
    }
    appendDebugLog("🎉 [Android Native App] 네이티브 하드웨어 NFC 리더 가동 완료! (카드를 갖다 대세요)", "SUCCESS");
    return;
  }

  if (!('NDEFReader' in window)) {
    appendDebugLog("[Web NFC] 모바일 브라우저 NFC 미지원 (시뮬레이션 모드 활성화)", "INFO");
    return;
  }

  // Admin.js와 동일한 방식: 권한이 이미 허용되어 있으면 자동 가동됨.
  // 미허용 시 scan()이 NotAllowedError로 실패하며 kioskNdefReader를 null로 초기화.
  // 이 경우 버튼이 그대로 남아 사용자가 수동으로 눌러 권한 요청 가능.
  appendDebugLog("[Web NFC] NFC 센서 자동 가동 시도 중...", "INFO");
  startKioskNfcScan(true);
}

// Android Native App Hardware ReaderMode Direct Receiver
window.onAndroidNfcScanned = function (rawHexUid) {
  // 카메라 사용 중이고, 리더와 카메라 동시사용이 허용되지 않은 상태라면 태깅을 무시
  // (내장 NFC는 이미 하드웨어 단에서 일시정지되지만, 외부 CCID 리더는 계속 폴링되므로 여기서 한 번 더 막는다)
  if (isCameraScanning && shouldPauseReaderForCamera()) {
    appendDebugLog(`⚡ [카드 리더] 카메라 사용 중이라 태깅 무시됨: ${rawHexUid}`, "WARN");
    return;
  }

  // 3초 하드웨어 쿨다운 (flickering 방지)
  if (kioskNfcScanCooldown) {
    appendDebugLog(`⚡ [Android Native NFC] 쿨다운 중 — 태깅 무시됨 (3초 내 중복)`, "WARN");
    return;
  }
  kioskNfcScanCooldown = true;
  setTimeout(() => { kioskNfcScanCooldown = false; }, 3000);

  appendDebugLog(`⚡ [Android Native App] 하드웨어 레벨 NFC 태그 스캔 성공!`, "SUCCESS");
  appendDebugLog(`  ├─ 💳 원시 하드웨어 UID (Raw Hex): ${rawHexUid}`, "WARN");
  appendDebugLog(`  └─ ⏱️ 수신 시각: ${new Date().toLocaleTimeString()}`, "INFO");

  // If Admin Modal Card Tab is open, autofill UID
  const cardUidInput = document.getElementById("kiosk-scanned-card-uid");
  const cardTab = document.getElementById("admin-tab-card");
  if (cardTab && cardTab.style.display !== "none" && cardUidInput) {
    cardUidInput.value = rawHexUid;
    appendDebugLog(`💳 [현장 대리 발급] 실물 카드 UID (${rawHexUid}) 자동 입력됨`, "SUCCESS");
    return;
  }

  triggerKioskPayment(rawHexUid);
};

// Android Native App Card Reader Unavailable Notice (USB/내장 NFC 모두 없음)
window.onKioskReaderError = function (message) {
  appendDebugLog(`⚠️ [Android Native] 카드 리더 사용 불가: ${message}`, "ERROR");
};

// Check Native App Environment on Load
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    appendDebugLog("🟢 [Android Native App] 네이티브 하드웨어 NFC 리더 가동 완료! (카드를 갖다 대세요)", "SUCCESS");
  }, 1000);
});
