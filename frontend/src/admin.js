const API_BASE = "/api";

let users = [];
let products = [];
let cards = [];
let depositHistories = [];
let rechargeQueue = [];
let isAdminAuthenticated = false;
let adminToken = null;

// 요청 진행 중 버튼을 비활성화해 두 번 눌러서 중복 충전/중복 등록되는 걸 막는다.
async function withButtonLock(btn, fn) {
  if (!btn) return fn();
  if (btn.disabled) return; // 이미 처리 중이면 무시
  const originalText = btn.innerText;
  btn.disabled = true;
  btn.style.opacity = "0.6";
  btn.style.cursor = "not-allowed";
  try {
    await fn();
  } finally {
    btn.disabled = false;
    btn.style.opacity = "";
    btn.style.cursor = "";
    btn.innerText = originalText;
  }
}

// 관리자 전용 API 호출 공통 헬퍼 - Authorization 헤더를 자동으로 붙이고,
// 토큰이 만료/무효화(401)됐으면 세션을 초기화하고 PIN 재인증을 요구한다.
async function adminFetch(url, options = {}) {
  const headers = Object.assign({}, options.headers || {}, adminToken ? { "Authorization": `Bearer ${adminToken}` } : {});
  const res = await fetch(url, Object.assign({}, options, { headers }));
  if (res.status === 401) {
    adminToken = null;
    isAdminAuthenticated = false;
    sessionStorage.removeItem("admin_auth");
    sessionStorage.removeItem("admin_token");
    showAlertModal("관리자 세션이 만료되었습니다. 다시 인증해 주세요.");
    showModal("admin-pin-modal");
  }
  return res;
}

// 모달 show/hide 헬퍼 (인라인 style + .active 클래스 동시 제어)
function showModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'flex';
    el.classList.add("active");
  }
}
function hideModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'none';
    el.classList.remove("active");
  }
}

// ============ 공용 알림/확인 모달 (alert()/confirm() 대체) ============
let _alertModalResolve = null;
let _confirmModalResolve = null;

function showAlertModal(message, title = "알림") {
  document.getElementById("generic-alert-title").innerText = title;
  document.getElementById("generic-alert-message").innerText = message;
  showModal("generic-alert-modal");
  return new Promise(resolve => { _alertModalResolve = resolve; });
}
function _resolveAlertModal() {
  hideModal("generic-alert-modal");
  if (_alertModalResolve) { _alertModalResolve(); _alertModalResolve = null; }
}
function showConfirmModal(message, title = "확인") {
  document.getElementById("generic-confirm-title").innerText = title;
  document.getElementById("generic-confirm-message").innerText = message;
  showModal("generic-confirm-modal");
  return new Promise(resolve => { _confirmModalResolve = resolve; });
}
function _resolveConfirmModal(result) {
  hideModal("generic-confirm-modal");
  if (_confirmModalResolve) { _confirmModalResolve(result); _confirmModalResolve = null; }
}

// 전화번호 입력 필드에 실시간으로 하이픈을 자동 삽입한다 (010-1234-5678 형태).
function formatPhoneInput(input) {
  const digits = input.value.replace(/\D/g, "").slice(0, 11);
  let formatted = digits;
  if (digits.length > 3 && digits.length <= 7) {
    formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
  } else if (digits.length > 7) {
    formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  input.value = formatted;
}

document.addEventListener("DOMContentLoaded", () => {
  const savedToken = sessionStorage.getItem("admin_token");
  if (savedToken && sessionStorage.getItem("admin_auth") === "true") {
    adminToken = savedToken;
    isAdminAuthenticated = true;
    hideModal("admin-pin-modal");
    initAdminDashboard();
  } else {
    showModal("admin-pin-modal");
  }
});

async function submitAdminPin() {
  const pinInput = document.getElementById("admin-pin-input");
  const pin = pinInput ? pinInput.value.trim() : "";
  if (!pin) {
    await showAlertModal("PIN 번호를 입력하세요.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/verify-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pin })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.token) {
      adminToken = data.token;
      sessionStorage.setItem("admin_auth", "true");
      sessionStorage.setItem("admin_token", adminToken);
      isAdminAuthenticated = true;
      hideModal("admin-pin-modal");
      initAdminDashboard();
    } else if (res.status === 429) {
      await showAlertModal(data.detail || "PIN 시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요.");
    } else {
      await showAlertModal("관리자 PIN 번호가 올바르지 않습니다.");
      if (pinInput) pinInput.value = "";
    }
  } catch (err) {
    console.error("PIN Auth error:", err);
    await showAlertModal("서버 연결 오류. 잠시 후 다시 시도하세요.");
  }
}

function initAdminDashboard() {
  loadAdminUsers();
  loadAdminProducts();
  loadDepositHistories();
  loadAdminCards();
  loadRechargeQueue();
  loadStatsSummary();
  loadSmsDetectSettings();
  connectAdminWebSocket();
}

// ============ 실시간 갱신 (WebSocket) ============
// DB가 바뀌면(다른 관리자 세션, 회원의 충전 신청, 키오스크 결제 등) 서버가 "이 범위가
// 바뀌었다"는 신호만 보내고, 실제 반영은 이미 있는 REST 로드 함수를 그대로 재사용한다.
let adminWs = null;
let adminWsReconnectTimer = null;

function connectAdminWebSocket() {
  if (!adminToken) return;
  if (adminWs && adminWs.readyState <= 1) return; // 이미 연결(중)이면 중복 연결 안 함

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  adminWs = new WebSocket(`${protocol}//${location.host}/ws/admin?token=${encodeURIComponent(adminToken)}`);

  adminWs.onmessage = (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch (e) { return; }
    if (data.type !== "refresh") return;
    handleAdminRefreshEvent(data.scopes || []).catch(err => console.error("Refresh event error:", err));
  };

  adminWs.onclose = () => {
    adminWs = null;
    if (!isAdminAuthenticated) return; // 로그아웃/세션만료로 인한 정상 종료면 재연결 안 함
    clearTimeout(adminWsReconnectTimer);
    adminWsReconnectTimer = setTimeout(connectAdminWebSocket, 3000);
  };

  adminWs.onerror = () => {
    if (adminWs) adminWs.close();
  };
}

async function handleAdminRefreshEvent(scopes) {
  const tasks = [];
  if (scopes.includes("users")) tasks.push(loadAdminUsers());
  if (scopes.includes("cards")) tasks.push(loadAdminCards());
  if (scopes.includes("recharge_queue")) tasks.push(loadRechargeQueue());
  if (scopes.includes("stats")) tasks.push(loadStatsSummary());
  if (scopes.includes("deposits")) tasks.push(loadDepositHistories());
  await Promise.all(tasks);

  // 지금 열려 있는 회원 상세도 최신 데이터(users/cards/deposits)로 다시 그린다.
  if (currentDetailUserId && (scopes.includes("users") || scopes.includes("cards") || scopes.includes("deposits"))) {
    renderMemberDetail();
  }
}

// ============ 탭 내비게이션 (트위터 스타일) ============
let currentDetailUserId = null;
let detailReturnView = "search";

function switchAdminView(viewName) {
  document.querySelectorAll(".admin-view").forEach(el => el.classList.remove("active"));
  const target = document.getElementById(`admin-view-${viewName}`);
  if (target) target.classList.add("active");

  const tabViews = ["home", "search", "inbox", "menu"];
  if (tabViews.includes(viewName)) {
    document.querySelectorAll(".admin-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === viewName);
    });
    if (viewName === "search") renderMemberFeed();
    if (viewName === "home") renderHomeRecentMembers();
  }
}

let adminScanMode = "NFC";
let adminCameraScanning = false;
let adminVideoStream = null;
let adminAnimFrameId = null;
let adminFacingMode = "user"; // 기본 전면 카메라
let adminQrCooldown = false; // 연속 스캔 방지 쿨다운
let adminNfcCooldown = false; // NFC 연속 태깅 방지 쿨다운
let adminNdefReader = null; // 중복 NDEFReader 생성 방지용 글로벌 레퍼런스

// 현재 활성화된 카드 리더 종류: "WEB_NFC" | "BUILTIN_NFC" | "USB_CCID" | "USB_VENDOR_HID_NFC" | "USB_HID_KEYBOARD" | "NONE" | "UNKNOWN"
// kiosk.js와 동일한 브릿지 - Android 래퍼 안에서는 window.onCardReaderModeChanged가, 일반 브라우저에서는 Web NFC 성공 시 직접 갱신한다.
let currentReaderMode = "UNKNOWN";
let adminHidBuffer = ""; // USB 키보드 에뮬레이션형 리더용 입력 버퍼
let adminHidTimeout = null;

function switchAdminScanMode(mode) {
  adminScanMode = mode;
  const nfcBtn = document.getElementById("admin-mode-nfc-btn");
  const qrBtn = document.getElementById("admin-mode-qr-btn");
  const nfcView = document.getElementById("admin-nfc-scan-view");
  const qrView = document.getElementById("admin-qr-scan-view");

  if (mode === "NFC") {
    nfcBtn.className = "btn-action btn-primary";
    qrBtn.className = "btn-action";
    qrBtn.style.background = "rgba(255,255,255,0.1)";
    qrBtn.style.color = "#fff";
    nfcView.style.display = "block";
    qrView.style.display = "none";
    stopAdminCameraScanner();
    initAdminNfcReader();
  } else {
    qrBtn.className = "btn-action btn-primary";
    nfcBtn.className = "btn-action";
    nfcBtn.style.background = "rgba(255,255,255,0.1)";
    nfcBtn.style.color = "#fff";
    qrView.style.display = "block";
    nfcView.style.display = "none";
  }
}

let adminCheckTimeout = null;

function triggerDetectionFeedback() {
  // 1. 진동 피드백 (모바일 지원 환경: 단일 숫자 및 배열 둘 다 지원)
  if (navigator.vibrate) {
    try {
      navigator.vibrate(100);
      navigator.vibrate([100]);
    } catch (e) {
      console.log("Vibration not allowed or supported yet:", e);
    }
  }

  // 1-2. 보조 사운드 피드백 (브라우저 진동 제한 시 보조)
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, audioCtx.currentTime); // 800Hz 소프트 삑소리
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (e) {
    console.log("Audio feedback context block:", e);
  }

  // 2. 입력란 옆 초록색 체크표시 시각 피드백
  const check = document.getElementById("admin-detect-check");
  if (check) {
    check.style.display = "inline-block";

    if (adminCheckTimeout) {
      clearTimeout(adminCheckTimeout);
    }

    adminCheckTimeout = setTimeout(() => {
      check.style.display = "none";
    }, 2000);
  }
}

// kiosk.js의 initWebNFC()와 동일한 판단 순서: Android 네이티브 래퍼(AndroidInterface) 안이면
// WebView가 Web NFC scan()을 지원하지 않으므로 그쪽은 시도하지 않고 네이티브 브릿지에 위임한다.
// 일반 브라우저면 Web NFC를 시도하고, 그마저 없으면 USB_HID_KEYBOARD(키보드 에뮬레이션형
// USB 리더)나 카메라 QR, 데모 시뮬레이션 버튼으로 자연스럽게 대체된다.
async function initAdminNfcReader() {
  if (window.AndroidInterface) {
    if (typeof window.AndroidInterface.getCurrentReaderMode === "function") {
      try {
        currentReaderMode = window.AndroidInterface.getCurrentReaderMode();
      } catch (e) {
        currentReaderMode = "UNKNOWN";
      }
    }
    console.log("Android Native App 카드 리더 브릿지 감지됨. 현재 모드:", currentReaderMode);
    return;
  }

  if (!("NDEFReader" in window)) return;

  // 이미 싱글톤 인스턴스가 존재하면 중복 생성 및 .scan() 중복 트리거를 차단하여 크래시 방지
  if (adminNdefReader) {
    console.log("NFC Reader already active.");
    return;
  }

  try {
    adminNdefReader = new NDEFReader();

    // NDEF 규격 카드 감지 리스너 (scan() 호출 전에 바인딩)
    adminNdefReader.addEventListener("reading", ({ serialNumber }) => {
      if (serialNumber && !adminNfcCooldown) {
        adminNfcCooldown = true;
        const uid = serialNumber.toUpperCase();
        document.getElementById("admin-card-uid-input").value = uid;
        triggerDetectionFeedback();

        // 2초 동안 동일 혹은 연속 접촉으로 인한 중복 동작 방지
        setTimeout(() => {
          adminNfcCooldown = false;
        }, 2000);
      }
    });

    // 비NDEF/스마트폰 HCE 접촉 감지 리스너
    adminNdefReader.addEventListener("readingerror", () => {
      if (adminNfcCooldown) return;
      adminNfcCooldown = true;
      setTimeout(() => {
        adminNfcCooldown = false;
      }, 2000);

      const rawHceToken = `HCE_EVENT_TOKEN_${Math.floor(Date.now())}`;
      document.getElementById("admin-card-uid-input").value = rawHceToken;
      triggerDetectionFeedback();
    });

    await adminNdefReader.scan();
    currentReaderMode = "WEB_NFC";
    console.log("Web NFC Auto Scan Activated.");
  } catch (e) {
    console.log("Web NFC Access/Scan Error:", e);
    adminNdefReader = null; // 실패 시 재시도 가능하게 초기화
  }
}

// ============ Android 네이티브 카드 리더 브릿지 (kiosk.js와 동일한 훅) ============
// 네이티브 앱이 evaluateJavascript로 이 이름 그대로 호출하므로 함수명을 바꾸면 안 된다.

window.onCardReaderModeChanged = function (mode) {
  currentReaderMode = mode;
  console.log("🔧 [카드 리더] 활성 모드 변경:", mode);
};

window.onAndroidNfcScanned = function (rawHexUid) {
  // 카드 스캐너 모달이 열려 있을 때만 반영 - 모달이 닫혀 있으면 관리자가 스캔을 기다리는
  // 상황이 아니므로 스탠바이 상태의 실수 태깅을 조용히 무시한다.
  const modal = document.getElementById("card-scanner-modal");
  if (!modal || !modal.classList.contains("active")) return;
  if (adminNfcCooldown) return;
  adminNfcCooldown = true;
  setTimeout(() => { adminNfcCooldown = false; }, 2000);

  document.getElementById("admin-card-uid-input").value = rawHexUid;
  triggerDetectionFeedback();
  console.log("⚡ [Android Native App] 하드웨어 카드 리더 스캔 성공:", rawHexUid);
};

window.onKioskReaderError = function (message) {
  console.log("⚠️ [Android Native] 카드 리더 사용 불가:", message);
  currentReaderMode = "NONE";
};

// USB 키보드 에뮬레이션형 리더(드라이버 불필요, 태그 시 UID를 키 입력처럼 전송) 지원.
// 카드 스캐너 모달이 열려 있을 때만 버퍼링해서, 검색창 등 다른 입력 중에는 간섭하지 않는다.
window.addEventListener("keydown", (e) => {
  const modal = document.getElementById("card-scanner-modal");
  if (!modal || !modal.classList.contains("active")) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;

  if (e.key === "Enter") {
    if (adminHidBuffer.length >= 4) {
      const scannedUid = adminHidBuffer.trim();
      currentReaderMode = "USB_HID_KEYBOARD";
      document.getElementById("admin-card-uid-input").value = scannedUid;
      triggerDetectionFeedback();
      console.log("📇 [USB HID 키보드 리더] 스캔 감지:", scannedUid);
    }
    adminHidBuffer = "";
  } else if (e.key.length === 1) {
    adminHidBuffer += e.key;
    if (adminHidTimeout) clearTimeout(adminHidTimeout);
    adminHidTimeout = setTimeout(() => { adminHidBuffer = ""; }, 300);
  }
});

function triggerSimulatedNfcScan() {
  const simUid = `CARD_SIM_${Math.floor(1000 + Math.random() * 9000)}`;
  document.getElementById("admin-card-uid-input").value = simUid;
  triggerDetectionFeedback();
}

function triggerSimulatedQrScan() {
  const simQr = `CHURCH_QR_${Math.floor(10000 + Math.random() * 90000)}`;
  document.getElementById("admin-card-uid-input").value = simQr;
  triggerDetectionFeedback();
}

async function toggleAdminCameraScanner() {
  if (adminCameraScanning) {
    stopAdminCameraScanner();
  } else {
    await startAdminCameraScanner();
  }
}

async function startAdminCameraScanner(facingMode) {
  const videoBox = document.getElementById("admin-camera-video-box");
  const video = document.getElementById("admin-qr-video");
  const toggleBtn = document.getElementById("admin-camera-toggle-btn");
  const flipBtn = document.getElementById("admin-camera-flip-btn");
  const fm = facingMode || adminFacingMode;

  // 전면 카메라일 때만 .mirror-mode 클래스로 좌우반전 적용
  if (video) {
    if (fm === "user") {
      video.classList.add("mirror-mode");
    } else {
      video.classList.remove("mirror-mode");
    }
  }

  try {
    adminVideoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: fm } });
    video.srcObject = adminVideoStream;
    video.setAttribute("playsinline", true);
    await video.play();

    // 카메라 사용 중에는 외부 리더(USB CCID/벤더 HID)와의 동시 폴링 충돌을 피하기 위해
    // 네이티브 래퍼에 일시정지를 요청한다 (kiosk.js와 동일 패턴). 내장 Web NFC는 카메라와
    // 무관하게 계속 동작해도 문제없어 별도 처리하지 않는다.
    if (window.AndroidInterface && typeof window.AndroidInterface.pauseReaderForCamera === "function") {
      window.AndroidInterface.pauseReaderForCamera();
    }

    adminCameraScanning = true;
    adminFacingMode = fm;
    if (videoBox) videoBox.style.display = "block";
    if (toggleBtn) {
      toggleBtn.innerText = "📷 카메라 끄기";
      toggleBtn.style.background = "rgba(239,68,68,0.3)";
      toggleBtn.style.color = "#fca5a5";
    }
    // 카메라가 켜지면 전환 버튼 표시
    if (flipBtn) flipBtn.style.display = "inline-flex";

    scanAdminQrFrame();
  } catch (err) {
    console.error("Camera access error:", err);
    await showAlertModal("카메라에 접근할 수 없습니다. 실시간 QR 스캔 시뮬레이션 버튼을 이용해 주세요.");
  }
}

async function flipAdminCamera() {
  // 전/후면 전환
  const newFacing = (adminFacingMode === "user") ? "environment" : "user";
  // 현재 스트림 정지 (애님 멈완하지 않고 실태만 없애움)
  if (adminAnimFrameId) { cancelAnimationFrame(adminAnimFrameId); adminAnimFrameId = null; }
  if (adminVideoStream) { adminVideoStream.getTracks().forEach(t => t.stop()); adminVideoStream = null; }
  adminCameraScanning = false;
  // 새 카메라로 재시작
  await startAdminCameraScanner(newFacing);
}

function stopAdminCameraScanner() {
  if (adminAnimFrameId) {
    cancelAnimationFrame(adminAnimFrameId);
    adminAnimFrameId = null;
  }
  if (adminVideoStream) {
    adminVideoStream.getTracks().forEach(track => track.stop());
    adminVideoStream = null;
  }
  adminCameraScanning = false;

  const videoBox = document.getElementById("admin-camera-video-box");
  const toggleBtn = document.getElementById("admin-camera-toggle-btn");
  const flipBtn = document.getElementById("admin-camera-flip-btn");
  if (videoBox) videoBox.style.display = "none";
  if (flipBtn) flipBtn.style.display = "none"; // 카메라 끌면 전환 버튼 숨김
  if (toggleBtn) {
    toggleBtn.innerText = "📷 카메라 켜기";
    toggleBtn.style.background = "rgba(6,182,212,0.2)";
    toggleBtn.style.color = "#67e8f9";
  }

  // 카메라 드라이버 완전 해제 후 지연을 두고 외부 리더 재활성화 (kiosk.js와 동일 패턴)
  setTimeout(() => {
    if (window.AndroidInterface && typeof window.AndroidInterface.reenableNfcReader === "function") {
      window.AndroidInterface.reenableNfcReader();
      console.log("⚡ [Android Native App] 네이티브 카드 리더 재활성화 호출 완료.");
    }
  }, 500);
}

function scanAdminQrFrame() {
  if (!adminCameraScanning) return;

  const video = document.getElementById("admin-qr-video");
  const canvas = document.getElementById("admin-qr-canvas");
  if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
    adminAnimFrameId = requestAnimationFrame(scanAdminQrFrame);
    return;
  }

  const ctx = canvas.getContext("2d");
  canvas.height = video.videoHeight;
  canvas.width = video.videoWidth;
  // 전면 카메라일 때만 좌우반전 보정 (후면은 정방향)
  if (adminFacingMode === "user") {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
  } else {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (window.jsQR) {
    const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth"
    });

    if (code && code.data && !adminQrCooldown) {
      adminQrCooldown = true;
      const detectedQr = code.data.trim();
      document.getElementById("admin-card-uid-input").value = detectedQr;
      triggerDetectionFeedback();

      // 2초 동안 동일 혹은 신규 스캔으로 인한 연속 스캔 방지
      setTimeout(() => {
        adminQrCooldown = false;
      }, 2000);
    }
  }

  adminAnimFrameId = requestAnimationFrame(scanAdminQrFrame);
}

// ============ 카드 스캐너 모달 (검색 모드 / 등록 모드 공용) ============
let scannerMode = "SEARCH"; // SEARCH | REGISTER
let scannerContext = null; // REGISTER 모드일 때 { userId, cardType }

function openScannerModal(mode, context) {
  scannerMode = mode;
  scannerContext = context || null;

  const title = document.getElementById("scanner-modal-title");
  const desc = document.getElementById("scanner-modal-desc");
  const confirmBtn = document.getElementById("scanner-confirm-btn");
  document.getElementById("admin-card-uid-input").value = "";

  if (mode === "SEARCH") {
    title.innerText = "📲 NFC/QR 태그로 회원 찾기";
    desc.innerHTML = "회원의 <strong>NFC 카드를 태그</strong>하거나 <strong>QR 코드를 카메라에 비추면</strong> 해당 회원 상세 페이지로 바로 이동합니다.";
    confirmBtn.innerText = "검색하기";
    switchAdminScanMode("NFC");
  } else {
    const typeLabel = context.cardType === "QR_CODE" ? "QR 코드" : "NFC 카드";
    title.innerText = `📷💳 ${typeLabel} 등록`;
    desc.innerHTML = `<strong>${typeLabel}</strong>를 스캔하면 이 회원에게 등록(또는 교체)됩니다.`;
    confirmBtn.innerText = "등록하기";
    switchAdminScanMode(context.cardType === "QR_CODE" ? "QR" : "NFC");
  }

  showModal("card-scanner-modal");
}

function closeScannerModal() {
  stopAdminCameraScanner();
  hideModal("card-scanner-modal");
}

async function handleScannerConfirm() {
  const cardUid = document.getElementById("admin-card-uid-input").value.trim();
  if (!cardUid) {
    await showAlertModal("NFC 카드를 태그하시거나 QR 코드를 카메라에 스캔해 주세요.");
    return;
  }

  if (scannerMode === "SEARCH") {
    const card = cards.find(c => c.card_uid === cardUid);
    if (!card) {
      await showAlertModal("등록되지 않은 카드입니다.");
      return;
    }
    closeScannerModal();
    openMemberDetail(card.user_id);
    return;
  }

  // REGISTER 모드
  const { userId, cardType } = scannerContext;
  try {
    const res = await adminFetch(`${API_BASE}/admin/cards`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_uid: cardUid, card_type: cardType, user_id: userId })
    });

    if (res.ok) {
      closeScannerModal();
      await loadAdminCards();
      if (currentDetailUserId === userId) renderDetailCardSlots();
      await showAlertModal(`🎉 ${cardType === "QR_CODE" ? "QR 코드" : "NFC 카드"}가 등록(또는 교체)되었습니다.`);
    } else {
      const errData = await res.json().catch(() => ({}));
      await showAlertModal(`등록 실패: ${errData.detail || "오류 발생"}`);
    }
  } catch (err) {
    console.error("Register card error:", err);
    await showAlertModal("서버 통신 중 에러가 발생했습니다.");
  }
}

// ============ 데이터 로드 ============

async function loadAdminUsers() {
  try {
    const res = await adminFetch(`${API_BASE}/users`);
    if (!res.ok) return;
    users = await res.json();
    renderHomeRecentMembers();
    renderMemberFeed();
  } catch (err) {
    console.error("Failed to load users:", err);
  }
}

async function loadAdminProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    products = await res.json();
    renderProductsTable();
  } catch (err) {
    console.error("Failed to load products:", err);
  }
}

async function loadDepositHistories() {
  try {
    const res = await adminFetch(`${API_BASE}/histories/deposits`);
    if (!res.ok) return;
    depositHistories = await res.json();
  } catch (err) {
    console.error("Failed to load deposit histories:", err);
  }
}

async function loadAdminCards() {
  try {
    const res = await adminFetch(`${API_BASE}/admin/cards`);
    if (!res.ok) return;
    cards = await res.json();
  } catch (err) {
    console.error("Failed to load cards:", err);
  }
}

async function loadStatsSummary() {
  try {
    const res = await adminFetch(`${API_BASE}/admin/stats/summary`);
    if (!res.ok) return;
    renderDashboard(await res.json());
  } catch (err) {
    console.error("Failed to load stats summary:", err);
  }
}

function renderDashboard(stats) {
  document.getElementById("stat-total-balance").innerText = `${stats.total_balance.toLocaleString()}원`;
  document.getElementById("stat-total-users").innerText = `${stats.total_users.toLocaleString()}명`;
  document.getElementById("stat-today-deposit").innerText = `${stats.today.deposit_amount.toLocaleString()}원`;
  document.getElementById("stat-today-payment").innerText = `${stats.today.payment_amount.toLocaleString()}원`;
  document.getElementById("stat-month-deposit").innerText = `${stats.this_month.deposit_amount.toLocaleString()}원`;
  document.getElementById("stat-month-payment").innerText = `${stats.this_month.payment_amount.toLocaleString()}원`;
  document.getElementById("stat-unmatched").innerText = `${stats.unmatched_deposit_count}건`;
  document.getElementById("stat-pending").innerText = `${stats.pending_recharge_count}건`;

  document.getElementById("attention-unmatched").classList.toggle("has-items", stats.unmatched_deposit_count > 0);
  document.getElementById("attention-pending").classList.toggle("has-items", stats.pending_recharge_count > 0);

  const badgeCount = stats.unmatched_deposit_count + stats.pending_recharge_count;
  const badge = document.getElementById("inbox-tab-badge");
  if (badge) {
    badge.style.display = badgeCount > 0 ? "flex" : "none";
    badge.innerText = badgeCount > 99 ? "99+" : String(badgeCount);
  }
}

// ============ 회원 검색 피드 (트위터 피드 스타일) ============

// 이름 해시로 팔레트에서 색을 고르는 트위터식 이니셜 아바타 (프로필 사진이 없는 회원용)
const AVATAR_PALETTE = ['#1d9bf0', '#7856ff', '#f91880', '#ff7a00', '#00ba7c', '#e0245e', '#635bff', '#0f9b8e'];

function avatarColorFor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function avatarInitialFor(name) {
  return (name || '').trim().charAt(0).toUpperCase() || '?';
}

function renderMemberFeedCard(u) {
  const isActive = u.status === "ACTIVE";
  const div = document.createElement("div");
  div.className = "glass-container member-card";
  div.onclick = () => openMemberDetail(u.id);
  div.innerHTML = `
    <div class="member-card-avatar" style="background: ${avatarColorFor(u.name)};">${avatarInitialFor(u.name)}</div>
    <div class="member-card-info">
      <div class="member-card-name">
        <span class="status-dot ${isActive ? '' : 'suspended'}"></span>${u.name}
        <span class="badge-tag ${u.user_type === 'SENIOR' ? 'badge-senior' : 'badge-general'}" style="margin-left: 0.4rem;">${u.user_type === 'SENIOR' ? '시니어' : '일반'}</span>
      </div>
      <div class="member-card-sub">${u.phone || '연락처 없음'}</div>
    </div>
    <div class="member-card-balance">${u.credit_balance.toLocaleString()}원</div>
  `;
  return div;
}

function renderMemberFeed() {
  const feed = document.getElementById("search-member-feed");
  if (!feed) return;
  const query = (document.getElementById("member-search-input")?.value || "").trim().toLowerCase();

  const filtered = !query ? users : users.filter(u => {
    const haystack = [u.name, u.phone].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query);
  });

  feed.innerHTML = "";
  if (filtered.length === 0) {
    feed.innerHTML = `<p style="text-align:center; color: var(--text-muted); padding: 2rem 0;">${query ? '검색 결과가 없습니다.' : '등록된 회원이 없습니다.'}</p>`;
    return;
  }
  filtered.forEach(u => feed.appendChild(renderMemberFeedCard(u)));
}

function renderHomeRecentMembers() {
  const feed = document.getElementById("home-recent-members");
  if (!feed) return;
  feed.innerHTML = "";
  const recent = [...users].sort((a, b) => b.id - a.id).slice(0, 5);
  if (recent.length === 0) {
    feed.innerHTML = `<p style="text-align:center; color: var(--text-muted); padding: 1rem 0;">등록된 회원이 없습니다.</p>`;
    return;
  }
  recent.forEach(u => feed.appendChild(renderMemberFeedCard(u)));
}

// ============ 회원 상세 페이지 ============

function openMemberDetail(userId) {
  const activeTab = document.querySelector(".admin-tab-btn.active");
  if (activeTab) detailReturnView = activeTab.dataset.view;

  currentDetailUserId = userId;
  switchAdminView("member-detail");
  renderMemberDetail();
}

function closeMemberDetail() {
  currentDetailUserId = null;
  switchAdminView(detailReturnView);
}

function renderMemberDetail() {
  const user = users.find(u => u.id === currentDetailUserId);
  if (!user) return;

  const isActive = user.status === "ACTIVE";
  document.getElementById("detail-member-name").innerText = user.name;
  const avatarEl = document.getElementById("detail-member-avatar");
  avatarEl.innerText = avatarInitialFor(user.name);
  avatarEl.style.background = avatarColorFor(user.name);
  const badge = document.getElementById("detail-member-badge");
  badge.innerText = user.user_type === 'SENIOR' ? '👵👴 시니어' : '👦 일반';
  badge.className = `badge-tag ${user.user_type === 'SENIOR' ? 'badge-senior' : 'badge-general'}`;
  const statusEl = document.getElementById("detail-member-status");
  statusEl.innerText = isActive ? "🟢 활성" : "🔴 정지됨";
  statusEl.style.color = isActive ? "var(--accent-emerald)" : "var(--accent-danger)";
  document.getElementById("detail-member-balance").innerText = `${user.credit_balance.toLocaleString()}원`;
  document.getElementById("detail-member-phone").innerText = user.phone || "-";

  const statusBtn = document.getElementById("detail-status-btn");
  statusBtn.innerText = isActive ? "정지" : "재활성화";
  statusBtn.style.background = isActive ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)";
  statusBtn.style.color = isActive ? "#fca5a5" : "#6ee7b7";

  renderDetailCardSlots();
  renderDetailHistory();
}

function renderDetailCardSlots() {
  renderCardSlot("NFC", "detail-card-nfc-slot", "💳 NFC 카드");
  renderCardSlot("QR_CODE", "detail-card-qr-slot", "📷 QR 코드");
}

function renderCardSlot(cardType, containerId, label) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const card = cards.find(c => c.user_id === currentDetailUserId && c.card_type === cardType);

  if (card) {
    container.innerHTML = `
      <div class="card-slot">
        <div>
          <div class="card-slot-type">${label}</div>
          <div class="card-slot-uid">${card.card_uid}</div>
        </div>
        <div style="display:flex; gap:0.4rem;">
          <button class="btn-action" style="width:auto; padding:0.4rem 0.7rem; font-size:0.82rem; background: rgba(59,130,246,0.2); color:#93c5fd;" onclick="openScannerModal('REGISTER', {userId: currentDetailUserId, cardType: '${cardType}'})">교체</button>
          <button class="btn-action" style="width:auto; padding:0.4rem 0.7rem; font-size:0.82rem; background: rgba(239,68,68,0.2); color:#fca5a5;" onclick="deleteDetailCard(${card.id})">삭제</button>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="card-slot">
        <div class="card-slot-type" style="color: var(--text-muted);">${label} - 미등록</div>
        <button class="btn-action btn-primary" style="width:auto; padding:0.4rem 0.9rem; font-size:0.82rem;" onclick="openScannerModal('REGISTER', {userId: currentDetailUserId, cardType: '${cardType}'})">발급하기</button>
      </div>
    `;
  }
}

async function deleteDetailCard(cardId) {
  if (!(await showConfirmModal("이 카드를 삭제하시겠습니까? 삭제된 식별자는 즉시 결제에 사용할 수 없게 됩니다."))) return;
  try {
    const res = await adminFetch(`${API_BASE}/admin/cards/${cardId}`, { method: "DELETE" });
    if (res.ok) {
      await loadAdminCards();
      renderDetailCardSlots();
    } else {
      const data = await res.json().catch(() => ({}));
      await showAlertModal(`삭제 실패: ${data.detail || '오류 발생'}`);
    }
  } catch (err) {
    console.error("deleteDetailCard error:", err);
  }
}

async function toggleDetailUserStatus() {
  const user = users.find(u => u.id === currentDetailUserId);
  if (!user) return;
  const newStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  const label = newStatus === "SUSPENDED" ? "정지" : "재활성화";
  if (!(await showConfirmModal(`${user.name}님을 ${label}하시겠습니까? 정지된 회원은 즉시 결제가 차단됩니다.`))) return;

  try {
    const res = await adminFetch(`${API_BASE}/admin/users/${user.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      await loadAdminUsers();
      renderMemberDetail();
    } else {
      const data = await res.json().catch(() => ({}));
      await showAlertModal(`처리 실패: ${data.detail || '오류 발생'}`);
    }
  } catch (err) {
    console.error("toggleDetailUserStatus error:", err);
  }
}

async function submitDetailRecharge(btn) {
  const amount = parseInt(document.getElementById("detail-recharge-amount").value);
  const memo = document.getElementById("detail-recharge-memo").value;

  if (!amount || amount <= 0) {
    await showAlertModal("충전 금액을 올바르게 입력하세요.");
    return;
  }

  await withButtonLock(btn, async () => {
    try {
      const res = await adminFetch(`${API_BASE}/admin/recharge-credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentDetailUserId,
          amount: amount,
          memo: memo || "관리자 직권 충전"
        })
      });

      if (res.ok) {
        const data = await res.json();
        await showAlertModal(data.message);
        document.getElementById("detail-recharge-memo").value = "";
        await loadAdminUsers();
        await loadDepositHistories();
        await loadStatsSummary();
        renderMemberDetail();
      } else {
        const data = await res.json().catch(() => ({}));
        await showAlertModal(`충전 실패: ${data.detail ? JSON.stringify(data.detail) : '오류 발생'}`);
      }
    } catch (err) {
      console.error("Detail recharge error:", err);
    }
  });
}

async function renderDetailHistory() {
  const box = document.getElementById("detail-history-list");
  if (!box) return;
  box.innerHTML = `<p style="color: var(--text-muted);">불러오는 중...</p>`;

  const deposits = depositHistories
    .filter(h => h.user_id === currentDetailUserId)
    .map(h => ({ type: "충전", amount: h.amount, label: h.deposit_type, memo: h.memo, created_at: h.created_at }));

  let payments = [];
  try {
    const res = await adminFetch(`${API_BASE}/payments?user_id=${currentDetailUserId}&limit=20`);
    if (res.ok) {
      const txs = await res.json();
      payments = txs.map(t => ({ type: "결제", amount: -t.amount, label: t.status, memo: t.product_details, created_at: t.created_at }));
    }
  } catch (err) {
    console.error("Failed to load payment history:", err);
  }

  const combined = [...deposits, ...payments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (combined.length === 0) {
    box.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 1rem 0;">이력이 없습니다.</p>`;
    return;
  }

  box.innerHTML = combined.slice(0, 30).map(h => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
      <div>
        <span class="badge-tag ${h.type === '충전' ? 'badge-general' : 'badge-senior'}" style="font-size:0.68rem;">${h.type}</span>
        <span style="margin-left: 0.4rem; color: var(--text-muted); font-size: 0.78rem;">${new Date(h.created_at).toLocaleString()}</span>
        <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.1rem;">${h.memo || h.label || '-'}</div>
      </div>
      <div style="font-weight: 800; color: ${h.amount >= 0 ? 'var(--accent-emerald)' : 'var(--accent-danger)'};">${h.amount >= 0 ? '+' : ''}${h.amount.toLocaleString()}원</div>
    </div>
  `).join("");
}

// ============ 충전함 (Recharge Inbox) ============

async function loadRechargeQueue() {
  try {
    const res = await adminFetch(`${API_BASE}/admin/recharge-requests?status=PENDING`);
    if (!res.ok) return;
    rechargeQueue = await res.json();
    renderRechargeQueueTable();
  } catch (err) {
    console.error("Failed to load recharge queue:", err);
  }
}

function renderRechargeQueueTable() {
  const tbody = document.getElementById("admin-recharge-queue-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (rechargeQueue.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">대기 중인 충전 신청이 없습니다.</td></tr>`;
    return;
  }

  rechargeQueue.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(r.created_at).toLocaleString()}</td>
      <td><strong>${r.user_name}</strong></td>
      <td style="color: var(--accent-emerald); font-weight: bold;">${r.requested_amount.toLocaleString()}원</td>
      <td style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
        <button class="btn-action btn-emerald" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; width: auto;" onclick="approveRechargeRequest(${r.id})">입금 확인, 승인</button>
        <button class="btn-action" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; width: auto; background: rgba(239,68,68,0.2); color: #fca5a5;" onclick="rejectRechargeRequest(${r.id})">반려</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function approveRechargeRequest(requestId) {
  if (!(await showConfirmModal("입금을 확인하셨습니까? 승인하면 회원에게 즉시 충전됩니다."))) return;
  try {
    const res = await adminFetch(`${API_BASE}/admin/recharge-requests/${requestId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    if (res.ok) {
      const data = await res.json();
      await showAlertModal(data.message);
      loadAdminUsers();
      loadDepositHistories();
      loadRechargeQueue();
      loadStatsSummary();
    } else {
      const data = await res.json().catch(() => ({}));
      await showAlertModal(`승인 실패: ${data.detail || '오류 발생'}`);
    }
  } catch (err) {
    console.error("approveRechargeRequest error:", err);
  }
}

async function rejectRechargeRequest(requestId) {
  if (!(await showConfirmModal("이 충전 신청을 반려하시겠습니까?"))) return;
  try {
    const res = await adminFetch(`${API_BASE}/admin/recharge-requests/${requestId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    if (res.ok) {
      loadRechargeQueue();
      loadStatsSummary();
    } else {
      const data = await res.json().catch(() => ({}));
      await showAlertModal(`반려 실패: ${data.detail || '오류 발생'}`);
    }
  } catch (err) {
    console.error("rejectRechargeRequest error:", err);
  }
}

// 계좌이체 입금 등록 공통 로직 - 수동 입력 폼과 SMS 자동감지가 함께 쓴다.
// silent=true면 매번 확인이 필요한 알림 모달 대신 조용한 토스트만 띄운다(SMS 자동감지는
// 무인 상태에서도 계속 들어올 수 있어 확인 모달을 띄우면 오히려 방해가 된다).
async function registerBankTransaction(depositorName, amount, { externalTxnIdPrefix = "MANUAL", silent = false } = {}) {
  try {
    const res = await adminFetch(`${API_BASE}/admin/bank-transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        external_txn_id: `${externalTxnIdPrefix}_${Date.now()}`,
        amount: amount,
        depositor_name: depositorName
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = `등록 실패: ${data.detail || '오류 발생'}`;
      if (silent) { showToast(`❌ ${msg}`); } else { await showAlertModal(msg); }
      return false;
    }

    const matched = data.status === "MATCHED";
    loadAdminUsers();
    loadDepositHistories();
    loadRechargeQueue();
    loadStatsSummary();

    if (silent) {
      showToast(matched
        ? `✅ 문자 자동감지: ${depositorName} ${amount.toLocaleString()}원 - 충전 완료`
        : `🏦 문자 자동감지: ${depositorName} ${amount.toLocaleString()}원 - 입금 등록됨`);
    } else {
      const matchedLabel = matched ? "\n\n✅ 대기 중이던 충전 신청과 자동으로 매칭되어 즉시 충전되었습니다!" : "\n\n대기 중인 충전 신청이 없어 입금 원장에만 등록했습니다. 회원이 신청하면 자동으로 매칭됩니다.";
      await showAlertModal(`🎉 입금 확인 등록 완료\n입금자명: ${depositorName}\n금액: ${amount.toLocaleString()}원${matchedLabel}`);
    }
    return true;
  } catch (err) {
    console.error("registerBankTransaction error:", err);
    if (silent) showToast("❌ 문자 자동감지 등록 중 오류가 발생했습니다.");
    return false;
  }
}

async function submitBankTransaction(btn) {
  const depositorName = document.getElementById("sim-depositor-name").value.trim();
  const amount = parseInt(document.getElementById("sim-amount").value);

  if (!depositorName || !amount || amount <= 0) {
    await showAlertModal("입금자명과 입금 금액을 입력하세요.");
    return;
  }

  await withButtonLock(btn, async () => {
    const ok = await registerBankTransaction(depositorName, amount, { externalTxnIdPrefix: "MANUAL" });
    if (ok) document.getElementById("sim-depositor-name").value = "";
  });
}

// ============ 입금 문자 자동감지 (SMS) ============
// 네이티브(SmsReceiver, android_kiosk - 관리자 앱 전용)가 은행 문자를 원본 그대로
// window.onSmsReceived(sender, body)로 넘기면, 여기서 저장된 발신번호 필터/정규식으로 파싱해서
// 위 registerBankTransaction()을 그대로 호출한다. 파싱 규칙을 은행 문자 포맷에 맞춰 바꿀 때마다
// 앱을 다시 빌드/배포할 필요가 없도록 일부러 이 계층(웹)에 둔다.
const SMS_DETECT_SENDER_KEY = "sms_detect_sender";
const SMS_DETECT_REGEX_KEY = "sms_detect_regex";

// NH농협 알림 문자(발신 1588-2100) 실제 포맷 기준 기본값 - 예)
// "농협 입금63,000원\n04/09 19:46 815110-52-\n****14 피파웃\n잔액2,190,941원"
// 다른 은행이면 관리자가 화면에서 값을 바꾸면 되고, 저장하기 전(로컬스토리지가 비어있는 상태)
// 에도 이 기본값으로 바로 동작하도록 저장값 조회 시 항상 이 값으로 폴백한다.
const SMS_DETECT_SENDER_DEFAULT = "1588-2100";
const SMS_DETECT_REGEX_DEFAULT = "입금\\s*(?<amount>[\\d,]+)원[\\s\\S]*?\\*{4}\\d+\\s+(?<name>[가-힣]{2,10})";

function loadSmsDetectSettings() {
  const senderEl = document.getElementById("sms-detect-sender");
  const regexEl = document.getElementById("sms-detect-regex");
  if (senderEl) senderEl.value = localStorage.getItem(SMS_DETECT_SENDER_KEY) ?? SMS_DETECT_SENDER_DEFAULT;
  if (regexEl) regexEl.value = localStorage.getItem(SMS_DETECT_REGEX_KEY) ?? SMS_DETECT_REGEX_DEFAULT;
}

async function saveSmsDetectSettings(btn) {
  const sender = document.getElementById("sms-detect-sender").value.trim();
  const regexStr = document.getElementById("sms-detect-regex").value.trim();

  if (regexStr) {
    try {
      new RegExp(regexStr);
    } catch (e) {
      await showAlertModal(`정규식이 올바르지 않습니다: ${e.message}`);
      return;
    }
  }

  localStorage.setItem(SMS_DETECT_SENDER_KEY, sender);
  localStorage.setItem(SMS_DETECT_REGEX_KEY, regexStr);
  showToast("✅ 문자 자동감지 설정을 저장했습니다.");
}

// SIM이 없는 테스트 기기에서도 실제 수신 시와 동일한 코드 경로(window.onSmsReceived)를 그대로
// 타게 해서, "테스트에서 되던 게 실기기에서 안 된다"는 괴리가 생기지 않도록 한다.
function triggerSimulatedSms(btn) {
  const sender = document.getElementById("sms-test-sender").value.trim();
  const body = document.getElementById("sms-test-body").value.trim();
  if (!body) {
    showAlertModal("테스트할 문자 본문을 입력하세요.");
    return;
  }
  window.onSmsReceived(sender, body);
}

// 네이티브 SmsReceiver가 문자 수신 시 호출하는 콜백 (AndroidInterface와 반대 방향의 브릿지 -
// 네이티브 → 웹). PIN 인증 전에는 백엔드 호출 자체가 의미 없으니 무시한다.
window.onSmsReceived = function (sender, body) {
  if (!isAdminAuthenticated) return;

  const filterSender = (localStorage.getItem(SMS_DETECT_SENDER_KEY) ?? SMS_DETECT_SENDER_DEFAULT).trim();
  if (filterSender && !(sender || "").includes(filterSender)) {
    return; // 지정한 발신번호/발신자가 아니면 무시
  }

  const regexStr = (localStorage.getItem(SMS_DETECT_REGEX_KEY) ?? SMS_DETECT_REGEX_DEFAULT).trim();
  if (!regexStr) {
    showToast("⚠️ 문자를 받았지만 파싱 정규식이 설정되지 않았습니다. (충전함 > 자동감지 설정)");
    return;
  }

  let match;
  try {
    match = body.match(new RegExp(regexStr));
  } catch (e) {
    showToast(`⚠️ 정규식 오류: ${e.message}`);
    return;
  }

  if (!match || !match.groups || !match.groups.name || !match.groups.amount) {
    showToast("⚠️ 문자를 받았지만 이름/금액을 추출하지 못했습니다. 정규식을 확인하세요.");
    return;
  }

  const depositorName = match.groups.name.trim();
  const amount = parseInt(match.groups.amount.replace(/[,\s]/g, ""), 10);
  if (!depositorName || !amount || amount <= 0) {
    showToast("⚠️ 문자에서 추출한 이름/금액이 올바르지 않습니다.");
    return;
  }

  registerBankTransaction(depositorName, amount, { externalTxnIdPrefix: "SMS", silent: true });
};

// ============ 가벼운 토스트 알림 (매번 확인이 필요 없는 자동 처리 결과 통지용) ============
let toastHideTimer = null;
function showToast(message) {
  let toast = document.getElementById("admin-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "admin-toast";
    document.body.appendChild(toast);
  }
  toast.innerText = message;
  toast.classList.add("show");
  clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(() => toast.classList.remove("show"), 4000);
}

// ============ 회원 등록 (FAB 모달) ============

function openProxyRegisterModal() {
  showModal("proxy-register-modal");
}
function closeProxyRegisterModal() {
  hideModal("proxy-register-modal");
}

async function submitProxyRegister(btn) {
  const name = document.getElementById("reg-name").value.trim();
  const phone = document.getElementById("reg-phone").value.trim();
  const userType = document.getElementById("reg-type").value;
  const credit = parseInt(document.getElementById("reg-credit").value) || 0;

  if (!name) {
    await showAlertModal("성명을 입력하세요. 동명이인이 이미 있다면 구분되는 이름(예: 홍길동B)을 입력해 주세요.");
    return;
  }
  if (!phone) {
    await showAlertModal("연락처(로그인 ID로 사용됩니다)를 입력하세요.");
    return;
  }

  await withButtonLock(btn, async () => {
    try {
      const res = await adminFetch(`${API_BASE}/admin/register-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          phone: phone,
          user_type: userType,
          initial_credit: credit
        })
      });

      if (res.ok) {
        const newUser = await res.json();
        closeProxyRegisterModal();
        document.getElementById("reg-name").value = "";
        document.getElementById("reg-phone").value = "";
        document.getElementById("reg-credit").value = "0";
        await loadAdminUsers();
        await loadStatsSummary();
        await showAlertModal("신규 회원이 대리 등록되었습니다!");
        openMemberDetail(newUser.id);
      } else {
        const data = await res.json().catch(() => ({}));
        await showAlertModal(`등록 실패: ${data.detail || '오류 발생'}`);
      }
    } catch (err) {
      console.error("Proxy register error:", err);
    }
  });
}

// ============ 회원 정보 수정 모달 ============

function openEditUserModal(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return;
  editingUserId = userId;

  document.getElementById("admin-user-edit-name").innerText =
    `${user.name} (${user.user_type === 'SENIOR' ? '시니어' : '일반'} · 잔액 ${user.credit_balance.toLocaleString()}원)`;
  document.getElementById("edit-user-name").value = user.name || "";
  document.getElementById("edit-user-phone").value = user.phone || "";
  document.getElementById("edit-user-password").value = "";

  showModal("admin-user-edit-modal");
}

let editingUserId = null;

function closeEditUserModal() {
  editingUserId = null;
  hideModal("admin-user-edit-modal");
}

async function submitUserInfoEdit(btn) {
  if (!editingUserId) return;
  const name = document.getElementById("edit-user-name").value.trim();
  const phone = document.getElementById("edit-user-phone").value.trim();
  const newPassword = document.getElementById("edit-user-password").value.trim();

  if (!name) {
    await showAlertModal("이름을 입력하세요.");
    return;
  }

  await withButtonLock(btn, async () => {
    try {
      const res = await adminFetch(`${API_BASE}/admin/users/${editingUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          phone: phone,
          new_password: newPassword || null
        })
      });

      if (res.ok) {
        closeEditUserModal();
        await loadAdminUsers();
        if (currentDetailUserId === editingUserId) renderMemberDetail();
      } else {
        const data = await res.json().catch(() => ({}));
        await showAlertModal(`수정 실패: ${data.detail || '오류 발생'}`);
      }
    } catch (err) {
      console.error("submitUserInfoEdit error:", err);
      await showAlertModal("서버 연결에 실패했습니다.");
    }
  });
}

// ============ 메뉴(상품) 관리 ============

function renderProductsTable() {
  const tbody = document.getElementById("admin-product-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  products.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${p.name}</strong></td>
      <td>${p.price_general.toLocaleString()}원</td>
      <td style="color: var(--accent-amber); font-weight: bold;">${p.price_senior.toLocaleString()}원</td>
      <td><span style="color: var(--accent-emerald);">판매중</span></td>
      <td style="display: flex; gap: 0.4rem;">
        <button class="btn-action" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; width: auto; background: rgba(59,130,246,0.2); color: #93c5fd;" onclick="editAdminProduct(${p.id})">수정</button>
        <button class="btn-action" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; width: auto; background: rgba(239,68,68,0.2); color: #fca5a5;" onclick="deleteAdminProduct(${p.id})">삭제</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

let editingProductId = null;

function editAdminProduct(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;
  editingProductId = id;
  document.getElementById("prod-name").value = product.name;
  document.getElementById("prod-price-gen").value = product.price_general;
  document.getElementById("prod-price-sen").value = product.price_senior;
  const submitBtn = document.getElementById("prod-submit-btn");
  if (submitBtn) submitBtn.innerText = "메뉴 수정 완료";
  const cancelBtn = document.getElementById("prod-cancel-btn");
  if (cancelBtn) cancelBtn.style.display = "inline-flex";
  document.getElementById("prod-name").scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelAdminProductEdit() {
  editingProductId = null;
  document.getElementById("prod-name").value = "";
  document.getElementById("prod-price-gen").value = "";
  document.getElementById("prod-price-sen").value = "";
  const submitBtn = document.getElementById("prod-submit-btn");
  if (submitBtn) submitBtn.innerText = "메뉴 추가";
  const cancelBtn = document.getElementById("prod-cancel-btn");
  if (cancelBtn) cancelBtn.style.display = "none";
}

async function deleteAdminProduct(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;
  if (!(await showConfirmModal(`"${product.name}" 메뉴를 정말 삭제하시겠습니까?`))) return;

  try {
    const res = await adminFetch(`${API_BASE}/products/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (editingProductId === id) cancelAdminProductEdit();
      loadAdminProducts();
    } else {
      const data = await res.json().catch(() => ({}));
      await showAlertModal(`삭제 실패: ${data.detail || '오류 발생'}`);
    }
  } catch (err) {
    console.error("Delete product error:", err);
  }
}

async function submitAddProduct(btn) {
  const name = document.getElementById("prod-name").value.trim();
  const genPrice = parseInt(document.getElementById("prod-price-gen").value);
  const senPrice = parseInt(document.getElementById("prod-price-sen").value);

  if (!name || isNaN(genPrice)) {
    await showAlertModal("메뉴 이름과 일반 가격을 입력하세요.");
    return;
  }

  await withButtonLock(btn, async () => {
    try {
      const payload = {
        name: name,
        price_general: genPrice,
        price_senior: isNaN(senPrice) ? genPrice : senPrice
      };
      const res = editingProductId !== null
        ? await adminFetch(`${API_BASE}/products/${editingProductId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          })
        : await adminFetch(`${API_BASE}/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

      if (res.ok) {
        cancelAdminProductEdit();
        loadAdminProducts();
      } else {
        const data = await res.json().catch(() => ({}));
        await showAlertModal(`처리 실패: ${data.detail || '오류 발생'}`);
      }
    } catch (err) {
      console.error("Add/edit product error:", err);
    }
  });
}
