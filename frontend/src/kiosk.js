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
let currentDefaultProductId = null; // 기본 자동 결제 상품 ID
let currentAssignedProducts = []; // 이 단말기에 노출할 메뉴 ID 목록 - 비어있으면 전체 메뉴 노출(하위호환)
let kioskNdefReader = null; // 중복 NDEFReader 생성 방지용 글로벌 레퍼런스
let kioskNfcAbortController = null; // Web NFC scan() 중단(카메라 사용 시 일시정지)을 위한 컨트롤러
let isKioskPaymentProcessing = false; // 결제 중복 요청 방지 락
let kioskNfcScanCooldown = false; // NFC 연속 태깅 방지 쿨다운
let lastQrDecodeTime = 0; // QR 실시간 연산 쓰로틀링을 위한 최종 디코딩 시각 타임스탬프

// version-check.js(auto 모드)가 "지금 새 코드로 새로고침해도 되는지" 판단할 때 쓰는 함수.
// 결제 처리 중이거나 장바구니에 담긴 게 있으면 손님이 이용 중인 것이므로 안전하지 않은 것으로 본다
// (모달이 열려있는지는 version-check.js가 별도로 이미 확인한다).
window.isKioskIdleForReload = function () {
  return !isKioskPaymentProcessing && Object.keys(cart).length === 0;
};

// 현재 활성화된 카드 리더 종류: "WEB_NFC" | "BUILTIN_NFC" | "USB_CCID" | "USB_HID_KEYBOARD" | "NONE" | "UNKNOWN"
// Android 래퍼 안에서는 window.onCardReaderModeChanged가, 일반 브라우저에서는 Web NFC 성공 시 직접 갱신한다.
let currentReaderMode = "UNKNOWN";
// 관리자 설정 "QR 스캐너 켜기" - QR 인식 기능 자체의 유일한 on/off 스위치.
// 켜지면 화면 표시 없이 백그라운드에서 카메라가 계속 QR을 읽고, 꺼지면 QR 인식을 하지 않는다.
// (서버에서 로드, 기본값 false)
let allowCameraReaderConcurrent = false;

function isInternalReaderActive() {
  return currentReaderMode === "WEB_NFC" || currentReaderMode === "BUILTIN_NFC";
}

function isExternalReaderActive() {
  return currentReaderMode === "USB_CCID" || currentReaderMode === "USB_HID_KEYBOARD";
}

// 카메라를 켤 때 리더를 잠시 멈춰야 하는지 여부.
// 내장 센서(Web NFC/기기 자체 NFC)는 항상 배제, 외부 리더는 관리자가 "동시 사용"을 켠 경우에만
// 예외 - 실기기에서 카메라+내장 NFC 동시 사용을 시도해봤으나 실제로 안 돼서(#34 후속) 원래대로
// 되돌렸다.
function shouldPauseReaderForCamera() {
  return isInternalReaderActive() || !allowCameraReaderConcurrent;
}

// "QR 스캐너 켜기" 설정 On/Off에 맞춰 카메라 구동 상태를 즉시 반영 (수동 버튼 없이 이 설정이 유일한 스위치)
function applyAlwaysOnCameraMode() {
  updateQrScanStatusUI();
  if (allowCameraReaderConcurrent) {
    maybeAutoStartAlwaysOnCamera();
  } else if (isCameraScanning) {
    stopCameraScanner();
  }
}

// 상단 헤더의 QR 상태 배지 갱신 - 화면에 카메라 미리보기를 띄우지 않으므로 이 배지가
// 사용자에게 QR 인식이 실제로 켜져 있는지 알려주는 유일한 표시다.
function updateQrScanStatusUI() {
  const textElem = document.getElementById("qr-status-text");
  const wrapElem = document.getElementById("qr-status-indicator");
  if (!textElem || !wrapElem) return;

  if (isCameraScanning) {
    textElem.innerText = "QR 스캔 활성화";
    wrapElem.style.background = "rgba(16,185,129,0.2)";
    wrapElem.style.borderColor = "#10b981";
    wrapElem.style.color = "#10b981";
  } else {
    textElem.innerText = "QR 스캔 비활성";
    wrapElem.style.background = "rgba(148,163,184,0.15)";
    wrapElem.style.borderColor = "#94a3b8";
    wrapElem.style.color = "#94a3b8";
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

// 리더 활성 모드에 따라 상단 NFC 상태 배지 문구/색상을 갱신한다.
// 리더 종류별 상세 문구 대신, 켜짐/꺼짐만 짧게 표시한다 (초록 = 활성화, 회색 = 비활성).
function updateNfcReaderStatusUI(mode) {
  const btnText = document.getElementById("nfc-status-btn-text");
  const btnElem = document.getElementById("nfc-activate-btn");
  if (!btnText || !btnElem) return;

  const active = ["USB_CCID", "USB_VENDOR_HID_NFC", "USB_HID_KEYBOARD", "BUILTIN_NFC", "WEB_NFC"].includes(mode);

  if (active) {
    btnText.innerText = "NFC 스캔 활성화";
    btnElem.style.background = "rgba(16,185,129,0.2)";
    btnElem.style.borderColor = "#10b981";
    btnElem.style.color = "#10b981";
  } else {
    btnText.innerText = "NFC 스캔 비활성";
    btnElem.style.background = "rgba(148,163,184,0.15)";
    btnElem.style.borderColor = "#94a3b8";
    btnElem.style.color = "#94a3b8";
  }
}

window.onCardReaderModeChanged = function (mode) {
  currentReaderMode = mode;
  appendDebugLog(`🔧 [카드 리더] 활성 모드 변경: ${mode}`, "INFO");
  updateCameraConcurrentToggleAvailability();
  updateNfcReaderStatusUI(mode);
};

document.addEventListener("DOMContentLoaded", async () => {
  appendDebugLog("[SYSTEM] 키오스크 단말기 모듈 초기화 완료.");
  initKioskTestMode();
  await initDeviceUUID();
  await loadProducts();
  resetCart(); // 기본 결제 상품으로 장바구니 자동 세팅 및 메뉴 UI 갱신
  initWebNFC(); // 권한 상태 확인 후 자동 NFC 활성화 시도
  initKioskPinToggle();
  initKioskTheme();

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

// Camera WebCam Realtime QR Decoder (jsQR)
// 테스트 모드: 실제 getUserMedia 없이 카메라 뷰포트만 띄우고 시뮬레이션 버튼을 보여줌.
// 실제 카메라는 화면에 표시되지 않으므로(백그라운드 인식) 체크아웃 레이아웃에 전용 자리를
// 두지 않고, 테스트 모드일 때만 메뉴 영역 위에 전체 오버레이로 띄운다.
function startTestModeCameraView() {
  const cameraBox = document.getElementById("kiosk-camera-viewport-container");
  const testOverlay = document.getElementById("kiosk-camera-test-overlay");
  const menuSection = document.querySelector(".kiosk-menu-section");

  if (cameraBox) {
    if (menuSection && cameraBox.parentElement !== menuSection) menuSection.appendChild(cameraBox);
    cameraBox.style.position = "absolute";
    cameraBox.style.inset = "0";
    cameraBox.style.display = "flex";
  }
  if (testOverlay) testOverlay.style.display = "flex";

  isCameraScanning = true;
  updateQrScanStatusUI();
  appendDebugLog("🧪 [테스트 모드] 카메라 시뮬레이션 뷰 표시 (실제 카메라 미사용)", "WARN");

  // 리더 일시정지 로직은 실제 카메라와 동일하게 적용 (테스트 중에도 동시사용 정책을 검증할 수 있도록)
  if (shouldPauseReaderForCamera()) {
    if (currentReaderMode === "WEB_NFC") {
      stopKioskNfcScan();
      // currentReaderMode 자체는 안 건드린다 - 카메라가 꺼지면 stopCameraScanner()가 이 값을
      // 보고 NFC를 다시 켜야 하는지 판단한다. 배지만 "지금은 실제로 안 잡히는 중"으로 갱신한다.
      updateNfcReaderStatusUI("NONE");
    } else if (window.AndroidInterface && typeof window.AndroidInterface.pauseReaderForCamera === "function") {
      window.AndroidInterface.pauseReaderForCamera();
      updateNfcReaderStatusUI("NONE");
    }
  }
}

// 실제 QR 스캐너 - 관리자 설정("QR 스캐너 켜기")이 켜져 있는 동안 화면에 아무것도 띄우지 않고
// 백그라운드에서 카메라 프레임을 계속 읽어 QR 코드를 인식한다.
async function startCameraScanner(silent = false, facingMode) {
  if (kioskTestMode) {
    startTestModeCameraView();
    return;
  }

  const video = document.getElementById("qr-video");
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
    appendDebugLog("[카메라] 이 환경은 카메라 접근을 지원하지 않습니다. USB 바코드/QR 스캐너 입력을 사용하세요.", "WARN");
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
        // currentReaderMode는 안 건드린다(카메라 꺼지면 stopCameraScanner()가 이 값으로 재가동
        // 여부를 판단) - 배지만 지금 실제로는 안 잡히는 중이라는 걸 반영해 "비활성"으로 갱신.
        updateNfcReaderStatusUI("NONE");
      } else if (window.AndroidInterface && typeof window.AndroidInterface.pauseReaderForCamera === "function") {
        window.AndroidInterface.pauseReaderForCamera();
        appendDebugLog("📷 [카메라] Android 내장 리더 일시 중단을 요청했습니다.", "INFO");
        updateNfcReaderStatusUI("NONE");
      }
    }

    isCameraScanning = true;
    kioskFacingMode = fm;
    updateQrScanStatusUI();
    appendDebugLog("📷 [QR 스캐너] 백그라운드 QR 스캐너 구동 완료.");

    requestAnimationFrame(scanQRCodeLoop);
  } catch (err) {
    console.warn("Camera init error:", err);
    appendDebugLog(`📷 [웹캠 에러] 카메라 구동 실패: ${err.name} - ${err.message}`, "ERROR");
    if (!silent) alert(`💡 [카메라 켜기 실패 안내]\n에러 타입: ${err.name}\n에러 메시지: ${err.message}\n\n* 만약 'NotAllowedError'인 경우 기기 설정이나 권한 허용을 다시 체크해 주세요.`);
    updateQrScanStatusUI();
  }
}

function stopCameraScanner() {
  const cameraBox = document.getElementById("kiosk-camera-viewport-container");

  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  isCameraScanning = false;
  updateQrScanStatusUI();

  // 테스트 모드가 띄웠을 수 있는 뷰포트/시뮬레이션 오버레이를 다시 숨기고 원래 자리로 되돌림
  if (cameraBox) {
    cameraBox.style.display = "none";
    const menuSection = document.querySelector(".kiosk-menu-section");
    if (menuSection && cameraBox.parentElement !== menuSection) menuSection.appendChild(cameraBox);
    cameraBox.style.position = "absolute";
    cameraBox.style.inset = "0";
  }
  const testOverlay = document.getElementById("kiosk-camera-test-overlay");
  if (testOverlay) testOverlay.style.display = "none";

  appendDebugLog("📷 [QR 스캐너] 카메라 구동 중지.");

  // 카메라 드라이버 완전 해제 후 500ms 지연 후 리더 재활성화
  setTimeout(() => {
    if (window.AndroidInterface && typeof window.AndroidInterface.reenableNfcReader === "function") {
      // Android 래퍼: CCID/HID/내장 NFC 우선순위 재평가(일시정지했던 내장 NFC도 여기서 다시 켜짐)
      window.AndroidInterface.reenableNfcReader();
      appendDebugLog("⚡ [Android Native App] 네이티브 NFC 리더 모드 재활성화(Re-bind) 호출 완료!", "SUCCESS");
    } else if (currentReaderMode === "WEB_NFC" && !kioskNdefReader) {
      // 일반 브라우저: 카메라 사용을 위해 중단했던 Web NFC 스캔 재개
      startKioskNfcScan();
      appendDebugLog("⚡ [Web NFC] 카메라 종료 - NFC 스캔 재가동.", "SUCCESS");
    }
  }, 500);
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

          // 📡 실시간 디버그 콘솔 로그 및 시각 효과 전송
          appendDebugLog(`📷 [웹캠 QR 실시간 감지 완료!] QR 코드 데이터: ${detectedQr}`, "SUCCESS");
          console.log(`[QR Auto Detect] Data: ${detectedQr}`);

          // 진동 + 삑 소리 피드백 (NFC 태깅과 동일하게 즉시 재생)
          triggerKioskDetectionFeedback();

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
      currentAssignedProducts = data.assigned_products || [];
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
  const assignedChecklist = document.getElementById("k-assigned-products-checklist");
  const assignedProducts = assignedChecklist
    ? Array.from(assignedChecklist.querySelectorAll(".menu-card.assigned")).map(card => parseInt(card.dataset.productId))
    : currentAssignedProducts;

  try {
    const res = await fetch(`${API_BASE}/kiosk/device/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_uuid: currentDeviceUuid,
        device_name: newName,
        default_product_id: defaultProductId ? parseInt(defaultProductId) : null,
        allow_camera_reader_concurrent: concurrentValue,
        assigned_products: assignedProducts
      })
    });

    if (res.ok) {
      currentDeviceName = newName;
      currentDefaultProductId = defaultProductId ? parseInt(defaultProductId) : null;
      allowCameraReaderConcurrent = concurrentValue;
      currentAssignedProducts = assignedProducts;
      updateDeviceHeaderUI();
      updateCameraConcurrentToggleAvailability();
      applyAlwaysOnCameraMode();
      resetCart(); // 새로운 기본 결제 상품/노출 메뉴로 화면 및 선택 메뉴 즉시 동기화
      appendDebugLog(`[DEVICE] 단말기 설정 자동 저장: "${newName}" (기본 상품 ID: ${currentDefaultProductId || "없음"}, QR 스캐너 켜기: ${allowCameraReaderConcurrent}, 노출 메뉴: ${assignedProducts.length || "전체"})`, "SUCCESS");
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
    renderKioskAssignedChecklist();

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

// 이 단말기에 노출할 메뉴만 걸러낸다 - currentAssignedProducts가 비어있으면(배정 안 함)
// 하위호환으로 전체 메뉴를 보여준다. 장바구니/기본결제 조회 등 다른 로직은 계속
// 전체 카탈로그(products)를 기준으로 하고, 여기 고객 화면 렌더링만 걸러진 목록을 쓴다.
function visibleKioskProducts() {
  if (!currentAssignedProducts || currentAssignedProducts.length === 0) return products;
  return products.filter(p => currentAssignedProducts.includes(p.id));
}

function renderKioskProducts() {
  const container = document.getElementById("kiosk-menu-grid");
  if (!container) return;
  container.innerHTML = "";
  const visibleProducts = visibleKioskProducts();

  visibleProducts.forEach(p => {
    const qty = cart[p.id] || 0;
    const card = document.createElement("div");
    card.className = `menu-card ${qty > 0 ? 'selected' : ''}`;
    card.innerHTML = `
      <div class="menu-name">${p.name}</div>
      <div class="menu-price-block">
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
  const next = Math.min(99, Math.max(0, current + delta));
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

  // 기본 메뉴는 장바구니 "초기화" 시점(최초 로딩, 결제 후 리셋)에만 자동 선택되는
  // 값이다 - 사용자가 수량을 직접 0으로 바꿔 장바구니를 비운 경우까지 결제 시점에
  // 기본 메뉴로 되돌려 대신 결제해버리면 안 된다. 비어있으면 그냥 선택을 요구한다.
  if (items.length === 0) {
    showNoMenuModal();
    return;
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
        resetCart(); // 다음 고객을 위해 메뉴 선택을 기본 메뉴로 복원
      }
      // ─── 그 외 오류 ───
      else {
        playSpeech("결제에 실패했습니다.");
        triggerErrorEdgeGlow();
      }

      isKioskPaymentProcessing = false;
      return;
    }

    // ─── 결제 성공 ─── status가 명시적으로 SUCCESS일 때만 성공 처리.
    // (res.ok && !CONFIRM_REQUIRED라고 해서 무조건 성공으로 취급하면, 예상 밖의
    // 2xx 응답(프록시/캐시 오작동 등)을 성공으로 오인해 미등록 카드가 "회원, 0원
    // 결제"로 잘못 표시되는 사고가 날 수 있다.)
    if (data.status !== "SUCCESS") {
      appendDebugLog(`예상치 못한 결제 응답: ${JSON.stringify(data)}`, "ERROR");
      console.error("Kiosk Payment unexpected response:", data);
      playSpeech("결제에 실패했습니다.");
      triggerErrorEdgeGlow();
      isKioskPaymentProcessing = false;
      return;
    }

    appendDebugLog(`결제 성공! 회원: ${data.user_name} (${data.user_type}), 차감금액: ${(data.total_amount ?? 0).toLocaleString()}원, 남은잔액: ${(data.balance_after ?? 0).toLocaleString()}원`, "SUCCESS");
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
  if (msg) msg.innerText = `「${userName}」님이 방금 결제하셨습니다.`;
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
    // 실제 결제 결과(성공/잔액부족/실패)에 따른 TTS는 triggerKioskPayment 내부에서
    // 처리한다 - 여기서 미리 "감사합니다"를 재생하면 결제가 실패해도 성공 TTS가 먼저
    // 나가버리거나, 성공 시 TTS가 중복 재생되는 문제가 있었다.
    appendDebugLog(`[재결제 확인] force_confirm=true 재결제 시도: ${capturedUid}`, "INFO");
    triggerKioskPayment(capturedUid, true);
  } else {
    appendDebugLog(`[재결제 취소]`, "WARN");
    maybeAutoStartAlwaysOnCamera();
  }
}

function showNoMenuModal() {
  const modal = document.getElementById("no-menu-modal");
  if (modal) { modal.style.display = "flex"; modal.classList.add("active"); }
  playSpeech("메뉴를 선택하세요.");
}

function closeNoMenuModal() {
  const modal = document.getElementById("no-menu-modal");
  if (modal) { modal.style.display = "none"; modal.classList.remove("active"); }
  resetCart(); // 다음 시도를 위해 메뉴 선택을 기본 메뉴로 복원
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
    amount: data.total_amount ?? 0,
    balance: data.balance_after ?? 0
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
    const badgeColor = isSenior ? "#f59e0b" : "#6781c0";
    const badgeBg = isSenior ? "rgba(245,158,11,0.15)" : "rgba(103,129,192,0.15)";
    return `<div class="recent-payment-row" style="display: flex; justify-content: space-between; align-items: center; padding: 0.2rem 0.4rem; background: ${i === 0 ? 'rgba(16,185,129,0.12)' : 'var(--surface-1)'}; border-radius: 6px; border-left: 3px solid ${i === 0 ? '#10b981' : 'var(--border-glass)'}; font-size: 0.74rem;">
      <div style="display: flex; align-items: center; gap: 0.3rem;">
        <span class="recent-payment-time" style="color: var(--text-muted); font-family: monospace; font-size: 0.68rem;">${p.time}</span>
        <strong class="recent-payment-name" style="color: var(--text-main);">${p.userName}</strong>
        <span class="recent-payment-badge" style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}; border-radius: 4px; padding: 0 0.25rem; font-size: 0.65rem; font-weight: bold;">${p.userType}</span>
      </div>
      <div class="recent-payment-amount" style="color: var(--accent-emerald); font-weight: 700; font-size: 0.78rem;">${p.amount.toLocaleString()}원</div>
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

// 서버가 실제로 검증하고 서명한 토큰만 신뢰한다 - 예전엔 pin === "1234"를 로컬에서
// 비교하기만 해서 개발자도구로 sessionStorage 값만 조작하면 누구나 관리자 모드에
// 들어갈 수 있었다. 발급받은 토큰은 상품 수정/삭제 등 관리자 전용 API 호출 시 그대로 사용.
let kioskAdminToken = sessionStorage.getItem("kiosk_admin_token") || null;

// 관리자 전용 API 호출 공통 헬퍼 - Authorization 헤더 자동 첨부, 401이면 세션 초기화
async function kioskAdminFetch(url, options = {}) {
  const headers = Object.assign({}, options.headers || {}, kioskAdminToken ? { "Authorization": `Bearer ${kioskAdminToken}` } : {});
  const res = await fetch(url, Object.assign({}, options, { headers }));
  if (res.status === 401) {
    kioskAdminToken = null;
    sessionStorage.removeItem("kiosk_admin_token");
    alert("관리자 세션이 만료되었습니다. 다시 인증해 주세요.");
    kioskHideModal("kiosk-admin-modal");
    kioskShowModal("kiosk-pin-modal");
  }
  return res;
}

// ---------------- 라이트/다크 테마 ----------------
// 시스템/라이트/다크 3가지, 기본값은 "시스템"(기기 명암 설정을 따름). 저장값이 없으면(=시스템)
// body에 data-theme를 아예 안 얹어서, style.css의 시스템 설정 기반 미디어 쿼리
// (@media (prefers-color-scheme: light))가 그대로 적용되게 둔다. 화면 전환 시 깜빡임(FOUC)을
// 막기 위해 저장된 값은 <body> 여는 태그 바로 뒤 인라인 <script>가 렌더 전에
// 먼저 반영해두므로, 여기 initKioskTheme()은 설정 화면의 버튼 활성 표시만 맞춘다.
const KIOSK_THEME_KEY = "kiosk_theme_pref";

function setKioskTheme(pref) {
  // body에 건다 - 설정 모달 등 .modal-overlay는 .kiosk-wrapper의 자식이 아니라 body 바로
  // 아래 형제라서(fixed 오버레이), 래퍼에만 스코프를 걸면 모달 내부가 테마를 안 탄다.
  if (pref === "system") {
    localStorage.removeItem(KIOSK_THEME_KEY);
    document.body.removeAttribute("data-theme");
  } else {
    localStorage.setItem(KIOSK_THEME_KEY, pref);
    document.body.setAttribute("data-theme", pref);
  }
  updateKioskThemeButtonsUI(pref);
  updateKioskThemeColorMeta();
  appendDebugLog(`[화면 테마] ${pref} 로 전환`, "INFO");
}

function initKioskTheme() {
  updateKioskThemeButtonsUI(localStorage.getItem(KIOSK_THEME_KEY) || "system");
  updateKioskThemeColorMeta();
  // "시스템" 상태일 때 OS 명암 설정이 바뀌면(예: 저녁에 기기가 자동으로 다크 전환) CSS는
  // 미디어 쿼리로 알아서 다시 그려지지만, <meta name="theme-color">는 JS로 직접 갱신해야 한다.
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", updateKioskThemeColorMeta);
  }
}

// 브라우저 주소창/상태 표시줄 색(PWA 크롬)을 현재 테마에 맞춘다 - 전용 락다운 빌드는 몰입
// 모드라 안 보이지만, 일반 브라우저에서 열었을 때는 눈에 띄는 부분이라 같이 맞춰준다.
function updateKioskThemeColorMeta() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const pref = localStorage.getItem(KIOSK_THEME_KEY) || "system";
  const isLight = pref === "light" || (pref === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
  meta.setAttribute("content", isLight ? "#eef1f7" : "#000000");
}

function updateKioskThemeButtonsUI(activePref) {
  const buttons = {
    system: document.getElementById("k-theme-system-btn"),
    light: document.getElementById("k-theme-light-btn"),
    dark: document.getElementById("k-theme-dark-btn"),
  };
  Object.entries(buttons).forEach(([pref, btn]) => {
    if (!btn) return;
    const active = pref === activePref;
    btn.style.background = active ? "var(--accent-cyan)" : "var(--surface-1)";
    btn.style.color = active ? "#001318" : "var(--text-main)";
  });
}

// ---------------- 화면 고정(Screen Pinning) 토글 버튼 ----------------
// 전용 키오스크 락다운 빌드에서만 의미가 있다 - AndroidInterface가 없는 일반 브라우저나
// 락다운이 꺼진 admin/user 빌드에서는 버튼 자체를 숨겨둔다(initWebNFC()와 동일한 판단 방식).
function initKioskPinToggle() {
  const btn = document.getElementById("kiosk-pin-toggle-btn");
  if (!btn) return;
  if (!window.AndroidInterface || typeof window.AndroidInterface.isKioskLockdownEnabled !== "function"
      || !window.AndroidInterface.isKioskLockdownEnabled()) {
    return; // 조건이 안 맞으면 버튼은 기본 display:none 그대로 숨겨둔다
  }
  btn.style.display = "inline-flex";
  refreshKioskPinButtonUi();
}

function refreshKioskPinButtonUi() {
  const btn = document.getElementById("kiosk-pin-toggle-btn");
  if (!btn || btn.style.display === "none") return;
  if (!window.AndroidInterface || typeof window.AndroidInterface.isScreenPinningActive !== "function") return;
  const active = window.AndroidInterface.isScreenPinningActive();
  btn.textContent = active ? "🔒" : "🔓";
  btn.title = active ? "화면 고정 중 (눌러서 해제)" : "화면 고정 꺼짐 (눌러서 다시 고정)";
}

// AndroidInterface.toggleScreenPinning()은 runOnUiThread로 실제 처리를 예약만 하고 바로
// 리턴하는 비동기 호출이라, 여기서 곧바로 상태를 다시 물어보면 아직 안 바뀐 값을 읽을 수
// 있다 - 실제 처리가 끝나면 네이티브가 window.refreshKioskPinButtonUi()를 직접 호출해준다.
function toggleKioskScreenPinning() {
  if (!window.AndroidInterface || typeof window.AndroidInterface.toggleScreenPinning !== "function") return;
  window.AndroidInterface.toggleScreenPinning();
}

// 시스템 제스처(뒤로가기+최근 앱 길게 누르기)로 화면 고정이 풀렸다가 앱으로 포커스가 돌아왔을
// 때도 버튼 아이콘을 실제 상태에 맞춰 다시 그린다.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshKioskPinButtonUi();
});

function openKioskAdminPinModal() {
  // 설정 화면으로 들어가는 동안엔 상시 켜기 카메라를 잠시 꺼둔다 (모달 닫을 때 다시 켜짐)
  if (isCameraScanning) stopCameraScanner();

  // 설정 화면은 매번 PIN을 다시 입력해야 한다 - 이전엔 sessionStorage에 인증 여부를
  // 저장해뒀다가 같은 세션이면 PIN 없이 바로 열어줬는데, 키오스크 단말기 특성상
  // 브라우저 세션이 며칠씩 유지되는 경우가 많아 사실상 최초 1회 인증 이후로는
  // 아무나 설정에 들어갈 수 있는 문제가 있었다.
  kioskShowModal("kiosk-pin-modal");
  const input = document.getElementById("kiosk-pin-input");
  if (input) { input.value = ""; input.focus(); }
}

function closeKioskPinModal() {
  kioskHideModal("kiosk-pin-modal");
  maybeAutoStartAlwaysOnCamera();
}

async function verifyKioskAdminPin() {
  const pinInput = document.getElementById("kiosk-pin-input");
  const pin = pinInput ? pinInput.value.trim() : "";
  if (!pin) return;

  try {
    const res = await fetch(`${API_BASE}/admin/verify-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pin })
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.token) {
      kioskAdminToken = data.token;
      sessionStorage.setItem("kiosk_admin_token", kioskAdminToken);
      closeKioskPinModal();
      openKioskAdminModal();
      appendDebugLog("[ADMIN] 단말기 관리자 모드 진입 성공", "SUCCESS");
    } else if (res.status === 429) {
      alert(data.detail || "PIN 시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요.");
    } else {
      alert("PIN 번호가 올바르지 않습니다.");
      appendDebugLog("[ADMIN] 잘못된 PIN 입력 시도", "ERROR");
      if (pinInput) pinInput.value = "";
    }
  } catch (err) {
    console.error("Kiosk admin PIN auth error:", err);
    alert("서버 연결 오류. 잠시 후 다시 시도하세요.");
  }
}

// 화면 방향 강제 전환.
// Android 네이티브 래퍼 안에서는 Screen Orientation API의 lock()이 전체화면(Fullscreen API)
// 상태가 아니면 지원되지 않아 항상 실패하므로, AndroidInterface.setOrientation()으로
// 네이티브 Activity.setRequestedOrientation()을 직접 호출한다 (설치 여부와 무관하게 동작).
// 일반 브라우저(홈 화면에 설치된 PWA 등)에서는 기존처럼 Screen Orientation API를 사용한다.
function setKioskOrientation(mode) {
  if (window.AndroidInterface && typeof window.AndroidInterface.setOrientation === "function") {
    try {
      window.AndroidInterface.setOrientation(mode);
      appendDebugLog(`[화면 방향] ${mode === "portrait" ? "세로" : "가로"} 모드로 전환 요청 (Android 네이티브)`, "SUCCESS");
      updateKioskOrientationButtonsUI(mode);
    } catch (e) {
      appendDebugLog(`[화면 방향] Android 네이티브 전환 실패: ${e}`, "ERROR");
    }
    return;
  }

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
    btn.style.background = active ? "var(--accent-cyan)" : "var(--surface-1)";
    btn.style.color = active ? "#001318" : "var(--text-main)";
  });
}

function openKioskAdminModal() {
  kioskShowModal("kiosk-admin-modal");
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

  const isMenu = tabName === 'menu';
  menuSec.style.display = isMenu ? "block" : "none";
  debugSec.style.display = isMenu ? "none" : "block";
  btnMenu.classList.toggle("btn-primary", isMenu);
  btnDebug.classList.toggle("btn-primary", !isMenu);
}

// 이 단말기에 노출할 메뉴 그리드 (전체 카탈로그 기준 - 메뉴 자체는 어느 단말기에서든
// 추가/수정/삭제 가능하고, 여기서는 "이 단말기에 보여줄지"만 정한다) - admin.js의 단말기별
// 메뉴 배정 화면(.kiosk-menu-assign-grid, renderKioskDetail)과 동일한 카드형 UI/동작으로
// 통일했다: 카드를 누르면 즉시 assigned 상태가 뒤집히고(체크박스 없이) 바로 저장된다.
function renderKioskAssignedChecklist() {
  const container = document.getElementById("k-assigned-products-checklist");
  if (!container) return;
  container.innerHTML = "";

  if (products.length === 0) {
    container.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">등록된 메뉴가 없습니다.</span>`;
    return;
  }

  container.innerHTML = products.map(p => `
    <div class="menu-card ${currentAssignedProducts.includes(p.id) ? 'assigned' : ''}" data-product-id="${p.id}" onclick="toggleKioskAssignedProduct(${p.id})">
      <span class="menu-toggle-badge"><svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 6 6L20 6"/></svg></span>
      <div>
        <div class="menu-name">${p.name}</div>
        <div class="menu-price">일반 ${p.price_general.toLocaleString()}원</div>
        <div class="menu-price-senior">시니어 ${p.price_senior.toLocaleString()}원</div>
      </div>
    </div>
  `).join("");
}

// 카드 클릭 시 즉시 시각적으로 토글하고(admin.js toggleKioskProduct와 동일한 즉각 피드백
// 느낌) 바로 저장 - 별도 체크박스/저장 버튼 없이 한 번의 클릭으로 끝난다.
function toggleKioskAssignedProduct(productId) {
  const card = document.querySelector(`#k-assigned-products-checklist .menu-card[data-product-id="${productId}"]`);
  if (card) card.classList.toggle("assigned");
  saveKioskDeviceSettings();
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
    const res = await kioskAdminFetch(`${API_BASE}/users`);
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
    const res = await kioskAdminFetch(`${API_BASE}/admin/cards`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_uid: cardUid,
        card_name: "키오스크 현장 대리 발급 실물 카드",
        card_type: "NFC",
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
    gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (e) {
    console.log("Audio feedback context block:", e);
  }
}

// 실제 NFC 스캔 가동 핵심 함수 - 스캐너 연결/권한 상태에 따라 자동으로만 호출됨 (사용자 조작 불필요)
async function startKioskNfcScan() {
  if (kioskNdefReader) return; // 이미 실행 중

  let scanTimeoutId = null;

  // 실패/타임아웃 시 항상 비활성 상태로 복구
  const resetNfcStatus = () => updateNfcReaderStatusUI("NONE");

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
      setTimeout(() => { kioskNfcScanCooldown = false; }, 3000);

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
    updateNfcReaderStatusUI("WEB_NFC");
  } catch (err) {
    clearTimeout(scanTimeoutId);
    kioskNdefReader = null;
    kioskNfcAbortController = null;
    if (err.name === 'AbortError') {
      // 카메라 사용을 위해 의도적으로 중단시킨 경우 - 에러로 취급하지 않음
      appendDebugLog("[Web NFC] 카메라 사용을 위해 일시 중단되었습니다.", "INFO");
      resetNfcStatus();
    } else if (err.name === 'TimeoutError') {
      appendDebugLog("[Web NFC] NFC 권한 요청이 응답 없이 시간 초과되었습니다. 기기의 NFC 지원 여부/설정을 확인해주세요.", "ERROR");
      resetNfcStatus();
    } else if (err.name === 'NotAllowedError' || String(err).includes('permission')) {
      // 조용히 실패 → 비활성 상태로 복구만 하고 알림 없음 (스캐너/권한이 준비되면 다음 자동 시도에서 가동됨)
      appendDebugLog("[Web NFC] NFC 권한이 허용되지 않았습니다. 리더 연결 상태를 확인해주세요.", "INFO");
      resetNfcStatus();
    } else {
      appendDebugLog(`[Web NFC] 오류: ${err}`, "ERROR");
      console.error("NFC scan error:", err);
      resetNfcStatus();
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


// Android 네이티브 브릿지에 현재 리더 모드를 동기 조회 (getCurrentReaderMode 미지원 구버전 APK 대비 방어)
function queryAndroidReaderMode() {
  if (window.AndroidInterface && typeof window.AndroidInterface.getCurrentReaderMode === "function") {
    try {
      return window.AndroidInterface.getCurrentReaderMode();
    } catch (e) {
      appendDebugLog(`⚠️ [Android Native] 리더 상태 조회 실패: ${e}`, "WARN");
    }
  }
  return "UNKNOWN";
}

function initWebNFC() {
  // Android 네이티브 앱 환경 감지 (AndroidInterface 존재 여부)
  // WebView는 Web NFC scan()을 지원 안 함 — 하드웨어 NFC 전용
  if (window.AndroidInterface) {
    const mode = queryAndroidReaderMode();
    currentReaderMode = mode;
    updateNfcReaderStatusUI(mode);
    appendDebugLog(`🎉 [Android Native App] 네이티브 하드웨어 리더 가동 완료! 현재 모드: ${mode}`, "SUCCESS");
    return;
  }

  if (!('NDEFReader' in window)) {
    appendDebugLog("[Web NFC] 모바일 브라우저 NFC 미지원 (시뮬레이션 모드 활성화)", "INFO");
    return;
  }

  // 권한이 "이미" 허용된 상태라면(과거에 아래 toggleKioskNfcReader()로 한 번 허용받은
  // 뒤 재방문한 경우) scan()이 사용자 제스처 없이도 조용히 성공한다 - 자동 재가동 시도.
  // 아직 한 번도 허용받은 적 없다면 브라우저가 permission prompt 자체를 띄우지 않고
  // NotAllowedError로 즉시 실패한다(#34 후속 - Web NFC scan()은 스펙상 최초 권한 요청 시
  // "user gesture(transient activation)" 안에서 호출돼야만 브라우저가 프롬프트를 띄운다;
  // DOMContentLoaded 같은 자동 실행 컨텍스트에서는 절대 권한 창이 뜨지 않는다). 최초 허용은
  // 아래 nfc-activate-btn 탭 → toggleKioskNfcReader()에서만 가능하다.
  appendDebugLog("[Web NFC] NFC 센서 자동 가동 시도 중... (이미 허용된 경우에만 성공)", "INFO");
  startKioskNfcScan();
}

// nfc-activate-btn 탭 핸들러 - 켜져 있으면 끄고, 꺼져 있으면 켠다.
// 켤 때: Web NFC의 최초 권한 프롬프트는 user gesture 안에서 호출된 scan()에서만 뜨므로,
// initWebNFC()의 자동 시도만으로는 최초 허용이 불가능하다 - 이 클릭 이벤트 자체가 user
// gesture가 되어 scan()이 실제 권한 대화상자를 띄운다.
// 끌 때: currentReaderMode를 명시적으로 "NONE"으로 남겨야 한다 - startCameraScanner()가
// 카메라 사용 중 리더를 일시정지시킬 때는 mode를 안 건드리고 kioskNdefReader만 비우는데
// (카메라 종료 후 "원래 켜져 있었으니 재가동" 판단 기준이 mode이므로), 여기서도 mode를
// 안 건드리면 사용자가 수동으로 껐어도 다음 카메라 온/오프 사이클에서 되살아나 버린다.
function toggleKioskNfcReader() {
  if (window.AndroidInterface) return; // 네이티브 앱은 하드웨어 리더 자동 관리 - 이 배지는 상태 표시만
  if (!('NDEFReader' in window)) return; // 브라우저가 Web NFC 자체를 미지원

  if (kioskNdefReader) {
    stopKioskNfcScan();
    currentReaderMode = "NONE";
    updateNfcReaderStatusUI("NONE");
    appendDebugLog("[Web NFC] 탭으로 NFC 스캔을 껐습니다.", "INFO");
  } else {
    appendDebugLog("[Web NFC] 탭으로 NFC 권한 요청 시작...", "INFO");
    startKioskNfcScan();
  }
}

// qr-status-indicator 탭 핸들러 - 켜져 있으면 끄고, 꺼져 있으면 켠다.
// 관리자 설정("QR 스캐너 켜기"/allowCameraReaderConcurrent)이 켜져 있으면 결제 종료·모달 닫힘
// 등의 시점마다 maybeAutoStartAlwaysOnCamera()가 카메라를 다시 켜려고 시도하므로, 그 모드가
// 켜진 상태에서 수동으로 끈 건 다음 트리거 시점에 다시 켜질 수 있다 - 관리자 설정이 최종
// 권한을 갖는 기존 동작 그대로 두고, 이 배지는 그 사이 구간에서의 즉석 on/off만 담당한다.
function toggleKioskQrScanner() {
  if (isCameraScanning) {
    stopCameraScanner();
    appendDebugLog("[QR 스캐너] 탭으로 카메라를 껐습니다.", "INFO");
  } else {
    appendDebugLog("[QR 스캐너] 탭으로 카메라 권한 요청 시작...", "INFO");
    startCameraScanner();
  }
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

  // 결제 API 응답(네트워크 왕복)을 기다리지 않고, 태그 인식 즉시 진동+삑 소리로 피드백
  triggerKioskDetectionFeedback();

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
  currentReaderMode = "NONE";
  updateNfcReaderStatusUI("NONE");
};

// Check Native App Environment on Load
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    appendDebugLog("🟢 [Android Native App] 네이티브 하드웨어 NFC 리더 가동 완료! (카드를 갖다 대세요)", "SUCCESS");
  }, 1000);
});
