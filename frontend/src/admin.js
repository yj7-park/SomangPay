const API_BASE = "/api";

// ============ 아이콘 (인스타그램류의 단색 라인 아이콘) ============
// 컬러풀한 이모지 대신 currentColor 스트로크의 단순한 선 아이콘을 쓴다. width/height를
// 1em으로 둬서 담는 요소의 font-size를 그대로 아이콘 크기로 쓴다(별도 크기 CSS 불필요).
const ICON_SVGS = {
  home: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1V9.5"/></svg>',
  search: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  bell: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  monitor: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  settings: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
  bank: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 12 4l9 6"/><path d="M4 10h16v9H4z"/><path d="M4 19h16M8 13v4M12 13v4M16 13v4"/></svg>',
  receipt: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12v19l-3-2-3 2-3-2-3 2Z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
  camera: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8a2 2 0 0 1 2-2h1.2l1-1.5h7.6l1 1.5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  nfc: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16a6 6 0 0 1 0-8"/><path d="M4 19a10.5 10.5 0 0 1 0-14"/><circle cx="15" cy="12" r="2"/><path d="M15 6a6 6 0 0 1 0 12"/></svg>',
  check: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 6 6L20 6"/></svg>',
  edit: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  lock: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  card: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19"/></svg>',
  user: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>',
  refresh: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.3-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.3 6.3L3 16"/><path d="M3 21v-5h5"/></svg>',
};
function icon(name) {
  return ICON_SVGS[name] || "";
}
// admin.html에 <span data-icon="home"></span> 형태로 심어둔 자리에 위 아이콘을 채워 넣는다.
// 뱃지 등 자식 요소를 가진 아이콘 자리는 안전하게 건드리지 않도록 innerHTML을 통째로
// 지우지 않고 아이콘 span 자신만 채운다.
function hydrateIconPlaceholders(root) {
  (root || document).querySelectorAll("[data-icon]").forEach(el => {
    el.innerHTML = icon(el.dataset.icon);
  });
}

// 외부(수신 문자 본문 등 신뢰할 수 없는) 텍스트를 innerHTML에 꽂을 때 XSS를 막는 이스케이프.
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

// 표에서 "등록일시/신청일시" 칸이 한 줄로 길게 나오면 모바일 폭을 다 잡아먹어 스크롤이
// 생긴다 - 날짜/시간을 두 줄로 나눠 칸 폭을 줄인다.
function formatDateTimeTwoLine(dateStr) {
  const d = new Date(dateStr);
  return `<div style="white-space: nowrap;">${d.toLocaleDateString()}</div>` +
    `<div style="white-space: nowrap; color: var(--text-muted); font-size: 0.85em;">${d.toLocaleTimeString()}</div>`;
}

// 입금자명/회원명이 길면(동명이인 구분용으로 "홍길동B" 이상 붙이는 경우 등) 표 폭을 넓혀버려서
// 5자까지만 그대로 보여주고, 그보다 길면 4자+"..."로 줄인다. 전체 이름은 title 속성으로 유지해
// 길게 눌러/마우스 올려서 확인할 수 있다.
function renderTruncatedName(name) {
  const safe = name || "";
  const display = safe.length <= 5 ? safe : `${safe.slice(0, 4)}...`;
  return `<span title="${escapeHtml(safe)}">${escapeHtml(display)}</span>`;
}

let users = [];
let products = [];
let cards = [];
let depositHistories = [];
let rechargeQueue = [];
let bankTransactions = [];
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
  hydrateIconPlaceholders();
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
  loadBankTransactions();
  loadStatsSummary();
  loadSmsDetectSettings();
  loadKiosks();
  connectAdminWebSocket();
  setupActivityFeedInfiniteScroll();
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
  if (scopes.includes("stats")) { tasks.push(loadStatsSummary()); tasks.push(loadBankTransactions()); tasks.push(loadKiosks()); }
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

  const tabViews = ["home", "search", "inbox", "kiosk", "settings"];
  if (tabViews.includes(viewName)) {
    document.querySelectorAll(".admin-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === viewName);
    });
    if (viewName === "search") renderMemberFeed();
    if (viewName === "home") { activityFeedLimit = ACTIVITY_PAGE_SIZE; renderHomeActivityFeed(); }
    if (viewName === "kiosk") renderKioskList();
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
      toggleBtn.innerText = "카메라 끄기";
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
    toggleBtn.innerText = "카메라 켜기";
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
    title.innerHTML = `${icon("card")} NFC/QR 태그로 회원 찾기`;
    desc.innerHTML = "회원의 <strong>NFC 카드를 태그</strong>하거나 <strong>QR 코드를 카메라에 비추면</strong> 해당 회원 상세 페이지로 바로 이동합니다.";
    confirmBtn.innerText = "검색하기";
    switchAdminScanMode("NFC");
  } else {
    const typeLabel = context.cardType === "QR_CODE" ? "QR 코드" : "NFC 카드";
    title.innerHTML = `${icon("card")} ${typeLabel} 등록`;
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
    renderMemberFeed();
  } catch (err) {
    console.error("Failed to load users:", err);
  }
}

// 전체 메뉴 카탈로그 - 키오스크 탭의 "노출 메뉴 배정" 체크리스트를 그리는 데 쓰인다.
// 메뉴 자체의 CRUD는 각 단말기 관리자 패널에서 하므로 여기서는 조회만 한다.
async function loadAdminProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    products = await res.json();
    renderKioskList();
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

function renderMemberFeedCard(u) {
  const isActive = u.status === "ACTIVE";
  const div = document.createElement("div");
  div.className = "glass-container member-card";
  div.onclick = () => openMemberDetail(u.id);
  div.innerHTML = `
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

// 홈 "최근 처리 내역" - 계좌 입금(bankTransactions)과 충전 신청(rechargeQueue)을
// 시간순으로 합쳐서 보여주는 실시간 피드. 두 배열 모두 이제 상태 무관 전체 목록을
// 담고 있으므로(충전함 탭과 동일 데이터 재사용) 별도 API 호출이 필요 없다.
//
// 입금과 충전 신청이 서로 매칭된 건(recharge.matched_bank_transaction_id)은 두 개의
// 별도 카드 대신 한 카드 안에 시간순 2줄로 합쳐서 보여준다. 고정 높이 영역
// (.activity-feed-scroll) 안에서만 스크롤되고, 스크롤이 바닥에 가까워지면
// setupActivityFeedInfiniteScroll이 다음 페이지를 이어서 그린다.
const ACTIVITY_PAGE_SIZE = 15;
let activityFeedLimit = ACTIVITY_PAGE_SIZE;
let activityFeedMergedCache = [];

function buildMergedActivityEvents() {
  const usedBankTxnIds = new Set();
  const events = [];

  rechargeQueue.forEach(r => {
    let status = "대기", statusClass = "status-pending";
    if (r.status === "MATCHED") { status = "완료"; statusClass = "status-done"; }
    else if (r.status === "REJECTED") { status = "반려"; statusClass = "status-rejected"; }

    const matchedTxn = r.matched_bank_transaction_id
      ? bankTransactions.find(t => t.id === r.matched_bank_transaction_id)
      : null;

    if (matchedTxn) {
      usedBankTxnIds.add(matchedTxn.id);
      const lines = [
        {
          time: matchedTxn.created_at, icon: icon("bank"),
          title: `계좌 입금 - ${matchedTxn.depositor_name}`, amount: matchedTxn.amount,
          status: "완료", statusClass: "status-done",
        },
        {
          time: r.created_at, icon: icon("receipt"),
          title: `충전 신청 - ${r.user_name}`, amount: r.requested_amount,
          status, statusClass,
        },
      ].sort((a, b) => new Date(a.time) - new Date(b.time));
      events.push({
        kind: "paired",
        time: lines[lines.length - 1].time,
        lines,
      });
    } else {
      events.push({
        kind: "single",
        time: r.created_at,
        icon: icon("receipt"),
        title: `충전 신청 - ${r.user_name}`,
        amount: r.requested_amount,
        status, statusClass,
      });
    }
  });

  bankTransactions.forEach(t => {
    if (usedBankTxnIds.has(t.id)) return;
    events.push({
      kind: "single",
      time: t.created_at,
      icon: icon("bank"),
      title: `계좌 입금 - ${t.depositor_name}`,
      amount: t.amount,
      status: t.status === "MATCHED" ? "완료" : "대기",
      statusClass: t.status === "MATCHED" ? "status-done" : "status-pending",
    });
  });

  return events.sort((a, b) => new Date(b.time) - new Date(a.time));
}

function renderActivityLine(line) {
  return `
    <span class="activity-icon">${line.icon}</span>
    <div class="activity-info">
      <div class="activity-title">${line.title}</div>
      <div class="activity-sub">${new Date(line.time).toLocaleString()}</div>
      <span class="activity-status ${line.statusClass}">${line.status}</span>
    </div>
    <div class="activity-amount">${line.amount.toLocaleString()}원</div>
  `;
}

function renderActivityCard(ev) {
  const div = document.createElement("div");
  if (ev.kind === "paired") {
    div.className = "glass-container activity-row activity-row-paired";
    div.innerHTML = ev.lines.map(line => `<div class="activity-pair-line">${renderActivityLine(line)}</div>`).join("");
  } else {
    div.className = "glass-container activity-row";
    div.innerHTML = renderActivityLine(ev);
  }
  return div;
}

function renderHomeActivityFeed() {
  const feed = document.getElementById("home-activity-feed");
  if (!feed) return;

  activityFeedMergedCache = buildMergedActivityEvents();

  feed.innerHTML = "";
  if (activityFeedMergedCache.length === 0) {
    feed.innerHTML = `<p style="text-align:center; color: var(--text-muted); padding: 1rem 0;">처리 내역이 없습니다.</p>`;
    return;
  }

  activityFeedMergedCache.slice(0, activityFeedLimit).forEach(ev => feed.appendChild(renderActivityCard(ev)));
}

// 스크롤이 하단 80px 이내로 들어오면 다음 페이지를 이어서 그린다 (드래그/휠 스크롤 모두 대응).
function setupActivityFeedInfiniteScroll() {
  const scrollBox = document.getElementById("home-activity-feed-scroll");
  if (!scrollBox || scrollBox.dataset.scrollWired) return;
  scrollBox.dataset.scrollWired = "1";
  scrollBox.addEventListener("scroll", () => {
    if (activityFeedLimit >= activityFeedMergedCache.length) return;
    if (scrollBox.scrollTop + scrollBox.clientHeight >= scrollBox.scrollHeight - 80) {
      activityFeedLimit += ACTIVITY_PAGE_SIZE;
      renderHomeActivityFeed();
    }
  });
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
  const badge = document.getElementById("detail-member-badge");
  badge.innerText = user.user_type === 'SENIOR' ? '시니어' : '일반';
  badge.className = `badge-tag ${user.user_type === 'SENIOR' ? 'badge-senior' : 'badge-general'}`;
  const statusEl = document.getElementById("detail-member-status");
  statusEl.innerHTML = isActive
    ? '<span class="status-dot"></span>활성'
    : '<span class="status-dot suspended"></span>정지됨';
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
  renderCardSlot("NFC", "detail-card-nfc-slot", `${icon("card")} NFC 카드`);
  renderCardSlot("QR_CODE", "detail-card-qr-slot", `${icon("camera")} QR 코드`);
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
    const res = await adminFetch(`${API_BASE}/admin/recharge-requests`);
    if (!res.ok) return;
    rechargeQueue = await res.json();
    renderRechargeQueueTable();
    renderHomeActivityFeed();
  } catch (err) {
    console.error("Failed to load recharge queue:", err);
  }
}

const RECHARGE_STATUS_LABEL = { PENDING: "대기", MATCHED: "완료", REJECTED: "반려" };
const RECHARGE_STATUS_CLASS = { PENDING: "status-pending", MATCHED: "status-done", REJECTED: "status-rejected" };

function renderRechargeQueueTable() {
  const tbody = document.getElementById("admin-recharge-queue-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (rechargeQueue.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">충전 신청 내역이 없습니다.</td></tr>`;
    return;
  }

  rechargeQueue.forEach(r => {
    const tr = document.createElement("tr");
    const actions = r.status === "PENDING"
      ? `<button class="btn-action btn-emerald" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; width: auto;" onclick="approveRechargeRequest(${r.id})">입금 확인, 승인</button>
         <button class="btn-action" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; width: auto; background: rgba(239,68,68,0.2); color: #fca5a5;" onclick="rejectRechargeRequest(${r.id})">반려</button>`
      : `<span style="color: var(--text-muted); font-size: 0.8rem;">-</span>`;
    tr.innerHTML = `
      <td>${formatDateTimeTwoLine(r.created_at)}</td>
      <td><strong>${renderTruncatedName(r.user_name)}</strong></td>
      <td style="color: var(--accent-emerald); font-weight: bold;">${r.requested_amount.toLocaleString()}원</td>
      <td><span class="activity-status ${RECHARGE_STATUS_CLASS[r.status] || 'status-pending'}">${RECHARGE_STATUS_LABEL[r.status] || r.status}</span></td>
      <td style="display: flex; gap: 0.4rem; flex-wrap: wrap;">${actions}</td>
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
      loadBankTransactions();
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

// ============ 계좌 입금 목록 (전체 - 대기/완료) ============
// stats.unmatched_deposit_count는 이 중 status===UNMATCHED 건수와 같다 - 충전함 탭 배지 숫자가
// 이 표의 대기 건과 recharge-requests 표(신청 대기) 두 개의 합이라 반드시 둘 다 같이 보여줘야 한다.
async function loadBankTransactions() {
  try {
    const res = await adminFetch(`${API_BASE}/admin/bank-transactions`);
    if (!res.ok) return;
    bankTransactions = await res.json();
    renderBankTransactionsTable();
    renderHomeActivityFeed();
  } catch (err) {
    console.error("Failed to load bank transactions:", err);
  }
}

function renderBankTransactionsTable() {
  const tbody = document.getElementById("admin-bank-transactions-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (bankTransactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">계좌 입금 내역이 없습니다.</td></tr>`;
    return;
  }

  bankTransactions.forEach(t => {
    const tr = document.createElement("tr");
    const isUnmatched = t.status === "UNMATCHED";
    const actions = isUnmatched
      ? `<button class="btn-action" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; width: auto; background: rgba(239,68,68,0.2); color: #fca5a5;" onclick="deleteUnmatchedDeposit(${t.id})">삭제</button>`
      : `<span style="color: var(--text-muted); font-size: 0.8rem;">-</span>`;
    tr.innerHTML = `
      <td>${formatDateTimeTwoLine(t.created_at)}</td>
      <td><strong>${renderTruncatedName(t.depositor_name)}</strong></td>
      <td style="color: var(--accent-emerald); font-weight: bold;">${t.amount.toLocaleString()}원</td>
      <td><span class="activity-status ${isUnmatched ? 'status-pending' : 'status-done'}">${isUnmatched ? '대기' : '완료'}</span></td>
      <td>${actions}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function deleteUnmatchedDeposit(txnId) {
  if (!(await showConfirmModal("이 은행거래를 삭제하시겠습니까? (테스트/오입력 건 정리용 - 나중에 회원이 신청하면 더 이상 자동 매칭되지 않습니다)"))) return;
  try {
    const res = await adminFetch(`${API_BASE}/admin/bank-transactions/${txnId}`, { method: "DELETE" });
    if (res.ok) {
      loadBankTransactions();
      loadStatsSummary();
    } else {
      const data = await res.json().catch(() => ({}));
      await showAlertModal(`삭제 실패: ${data.detail || '오류 발생'}`);
    }
  } catch (err) {
    console.error("deleteUnmatchedDeposit error:", err);
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
    loadBankTransactions();
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

// ============ 입금 알림 자동감지 (SMS + 푸시 알림/RCS) ============
// 네이티브가 은행 입금 알림을 두 경로로 원본 그대로 넘긴다:
//   - SmsReceiver → window.onSmsReceived(sender, body)                       (일반 SMS만 잡음)
//   - BankNotificationListener → window.onNotificationReceived(pkg, title, text)
//     (SMS/RCS/은행 앱 자체 푸시 등 화면에 뜨는 모든 알림을 잡음 - SmsReceiver의 사각지대를 메움.
//      "알림 접근" 권한은 사용자가 설정 화면에서 직접 켜야 동작한다.)
// 여기서 저장된 발신번호 필터(SMS 전용)/정규식(공용)으로 파싱해서 registerBankTransaction()을
// 그대로 호출한다. 파싱 규칙을 은행 알림 포맷에 맞춰 바꿀 때마다 앱을 다시 빌드/배포할 필요가
// 없도록 일부러 이 계층(웹)에 둔다.
//
// 같은 실제 입금이 두 경로로 동시에 들어올 수 있다(진짜 SMS는 알림창에도 함께 뜬다) - 짧은
// 시간 안에 같은 입금자명+금액이 다시 감지되면 중복으로 보고 두 번째부터는 등록하지 않는다
// (isDuplicateDetection).
const SMS_DETECT_SENDER_KEY = "sms_detect_sender";
const SMS_DETECT_REGEX_KEY = "sms_detect_regex";

// NH농협 알림 문자(발신 1588-2100) 실제 포맷 기준 기본값 - 예)
// "농협 입금10,000원\n08/13 12:12 301-****-7807-01 박용준 잔액2,165,746원"
// 다른 은행이면 관리자가 화면에서 값을 바꾸면 되고, 저장하기 전(로컬스토리지가 비어있는 상태)
// 에도 이 기본값으로 바로 동작하도록 저장값 조회 시 항상 이 값으로 폴백한다.
const SMS_DETECT_SENDER_DEFAULT = "1588-2100";
const SMS_DETECT_REGEX_DEFAULT = "입금\\s*(?<amount>[\\d,]+)원[\\s\\S]*?(?<name>[가-힣]{2,10})\\s*잔액";

function loadSmsDetectSettings() {
  const senderEl = document.getElementById("sms-detect-sender");
  const regexEl = document.getElementById("sms-detect-regex");
  if (senderEl) senderEl.value = localStorage.getItem(SMS_DETECT_SENDER_KEY) ?? SMS_DETECT_SENDER_DEFAULT;
  if (regexEl) regexEl.value = localStorage.getItem(SMS_DETECT_REGEX_KEY) ?? SMS_DETECT_REGEX_DEFAULT;
  renderSmsLog();
  refreshNotificationAccessStatus();
}

// ---------------- 알림 접근 권한 (BankNotificationListener용) ----------------
// AndroidInterface가 없는 일반 브라우저(관리자 앱이 아닌 곳)에서는 아무것도 하지 않는다
// (kiosk.js의 initWebNFC()와 동일한 판단 방식) - 이 권한은 관리자 앱에서만 의미가 있다.
function refreshNotificationAccessStatus() {
  const statusEl = document.getElementById("notif-access-status");
  const btn = document.getElementById("notif-access-open-btn");
  if (!statusEl) return;

  if (!window.AndroidInterface || typeof window.AndroidInterface.isNotificationAccessGranted !== "function") {
    statusEl.textContent = "이 브라우저에서는 상태를 확인할 수 없습니다 (관리자 앱에서만 사용 가능).";
    statusEl.style.color = "var(--text-muted)";
    if (btn) btn.style.display = "none";
    return;
  }

  const granted = window.AndroidInterface.isNotificationAccessGranted();
  statusEl.textContent = granted
    ? "알림 접근 권한이 켜져 있습니다 - 문자/RCS/푸시 알림을 모두 감지합니다."
    : "알림 접근 권한이 꺼져 있습니다 - SMS만 감지되고 RCS/푸시 알림은 놓칠 수 있습니다.";
  statusEl.style.color = granted ? "var(--accent-emerald)" : "var(--accent-danger)";
  if (btn) btn.style.display = granted ? "none" : "inline-flex";
}

function openNotificationAccessSettingsFromWeb() {
  if (window.AndroidInterface && typeof window.AndroidInterface.openNotificationAccessSettings === "function") {
    window.AndroidInterface.openNotificationAccessSettings();
  }
}

// 설정 화면에서 권한을 켜고 앱으로 돌아왔을 때 상태를 바로 반영
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshNotificationAccessStatus();
});

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

// 감지 발신번호/정규식을 기본값으로 되돌린다 - 로컬스토리지에 남아있는 예전 값이 최신
// 기본값(SMS_DETECT_*_DEFAULT)을 계속 가리는 문제를 화면에서 바로 해결할 수 있게 한다.
async function resetSmsDetectSettings() {
  if (!(await showConfirmModal("입금 문자 자동감지 설정을 기본값으로 되돌리시겠습니까?"))) return;
  localStorage.removeItem(SMS_DETECT_SENDER_KEY);
  localStorage.removeItem(SMS_DETECT_REGEX_KEY);
  loadSmsDetectSettings();
  showToast("✅ 기본값으로 초기화했습니다.");
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

// 푸시 알림(RCS/은행 앱 자체 알림) 경로도 문자와 동일하게 시뮬레이션 가능 (실제 알림 없이 테스트)
function triggerSimulatedNotification(btn) {
  const packageName = document.getElementById("notif-test-package").value.trim();
  const title = document.getElementById("notif-test-title").value.trim();
  const text = document.getElementById("notif-test-text").value.trim();
  if (!text) {
    showAlertModal("테스트할 알림 본문을 입력하세요.");
    return;
  }
  window.onNotificationReceived(packageName, title, text);
}

// ---------------- 중복 감지 방지 ----------------
// 같은 실제 입금이 SMS와 푸시 알림 두 경로로 동시에 들어올 수 있다(진짜 SMS는 알림창에도
// 함께 뜬다) - 짧은 시간 안에 같은 입금자명+금액 조합이 다시 감지되면 이미 처리한 것으로
// 보고 두 번째부터는 건너뛴다.
const DEDUP_WINDOW_MS = 30000;
let recentDetections = []; // [{ key, time }]

function isDuplicateDetection(depositorName, amount) {
  const now = Date.now();
  recentDetections = recentDetections.filter((d) => now - d.time < DEDUP_WINDOW_MS);
  const key = `${depositorName}|${amount}`;
  const isDup = recentDetections.some((d) => d.key === key);
  if (!isDup) recentDetections.push({ key, time: now });
  return isDup;
}

// ---------------- 수신 로그 (필터링/파싱 실패/중복 포함 전체 이벤트) ----------------
// "문자/알림은 왔는데 왜 자동 충전이 안 됐지?"를 화면에서 바로 진단할 수 있도록, 실제로
// 성공한 건만이 아니라 두 콜백으로 넘어온 모든 호출을 사유와 함께 기록해 둔다.
const SMS_LOG_KEY = "sms_detect_log";
const SMS_LOG_MAX = 50;
const SMS_LOG_OUTCOME_META = {
  success: { label: "감지 성공", cls: "status-done" },
  auth_skip: { label: "인증 전 무시", cls: "status-pending" },
  sender_filtered: { label: "발신자 불일치", cls: "status-pending" },
  duplicate: { label: "중복 감지", cls: "status-pending" },
  no_regex: { label: "정규식 미설정", cls: "status-rejected" },
  regex_error: { label: "정규식 오류", cls: "status-rejected" },
  parse_fail: { label: "파싱 실패", cls: "status-rejected" },
  invalid_value: { label: "추출값 이상", cls: "status-rejected" },
};
const SMS_LOG_SOURCE_LABEL = { SMS: "문자", PUSH: "알림" };

function getSmsLog() {
  try {
    return JSON.parse(localStorage.getItem(SMS_LOG_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function logSmsEvent(entry) {
  try {
    const log = getSmsLog();
    log.unshift(Object.assign({ time: new Date().toISOString() }, entry));
    while (log.length > SMS_LOG_MAX) log.pop();
    localStorage.setItem(SMS_LOG_KEY, JSON.stringify(log));
  } catch (e) {
    console.error("SMS 로그 저장 실패:", e);
  }
  renderSmsLog();
}

function clearSmsLog() {
  localStorage.removeItem(SMS_LOG_KEY);
  renderSmsLog();
}

function renderSmsLog() {
  const container = document.getElementById("sms-log-list");
  if (!container) return;
  const log = getSmsLog();

  if (log.length === 0) {
    container.innerHTML = `<p style="text-align:center; color: var(--text-muted); padding: 1rem 0; font-size: 0.85rem;">아직 수신된 문자/알림이 없습니다.</p>`;
    return;
  }

  container.innerHTML = log.map(entry => {
    const meta = SMS_LOG_OUTCOME_META[entry.outcome] || { label: entry.outcome, cls: "status-pending" };
    const sourceLabel = SMS_LOG_SOURCE_LABEL[entry.source] || "문자";
    const origin = entry.source === "PUSH"
      ? `${sourceLabel} · ${escapeHtml(entry.packageName || "(패키지명 없음)")}`
      : `${sourceLabel} · ${escapeHtml(entry.sender || "(발신번호 없음)")}`;
    return `
      <div class="glass-container" style="padding: 0.7rem 0.9rem;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; margin-bottom: 0.35rem; flex-wrap: wrap;">
          <span style="font-size: 0.75rem; color: var(--text-muted);">${new Date(entry.time).toLocaleString()} · ${origin}</span>
          <span class="activity-status ${meta.cls}">${meta.label}</span>
        </div>
        ${entry.detail ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.35rem;">${escapeHtml(entry.detail)}</div>` : ""}
        <div style="font-size: 0.8rem; white-space: pre-wrap; word-break: break-all; font-family: monospace; color: var(--text-main); background: rgba(0,0,0,0.3); padding: 0.5rem 0.6rem; border-radius: 8px;">${escapeHtml(entry.body || "")}</div>
      </div>
    `;
  }).join("");
}

// SMS/푸시 알림 공용 파싱-등록 로직 - onSmsReceived/onNotificationReceived 둘 다 여기로 모인다.
// source: "SMS" | "PUSH". originMeta: SMS면 {sender}, PUSH면 {packageName}.
function processDepositDetection(source, body, originMeta) {
  const logBase = Object.assign({ source, body }, originMeta);

  const regexStr = (localStorage.getItem(SMS_DETECT_REGEX_KEY) ?? SMS_DETECT_REGEX_DEFAULT).trim();
  if (!regexStr) {
    logSmsEvent(Object.assign({}, logBase, { outcome: "no_regex", detail: "파싱 정규식이 설정되지 않음" }));
    showToast("⚠️ 문자/알림을 받았지만 파싱 정규식이 설정되지 않았습니다. (설정 탭 > 자동감지 설정)");
    return;
  }

  let match;
  try {
    match = body.match(new RegExp(regexStr));
  } catch (e) {
    logSmsEvent(Object.assign({}, logBase, { outcome: "regex_error", detail: e.message }));
    showToast(`⚠️ 정규식 오류: ${e.message}`);
    return;
  }

  if (!match || !match.groups || !match.groups.name || !match.groups.amount) {
    logSmsEvent(Object.assign({}, logBase, { outcome: "parse_fail", detail: "정규식이 이름/금액 캡처 그룹과 일치하는 부분을 찾지 못함" }));
    showToast("⚠️ 문자/알림을 받았지만 이름/금액을 추출하지 못했습니다. 정규식을 확인하세요.");
    return;
  }

  const depositorName = match.groups.name.trim();
  const amount = parseInt(match.groups.amount.replace(/[,\s]/g, ""), 10);
  if (!depositorName || !amount || amount <= 0) {
    logSmsEvent(Object.assign({}, logBase, { outcome: "invalid_value", detail: `추출된 값이 올바르지 않음 (이름: "${depositorName}", 금액: ${amount})` }));
    showToast("⚠️ 문자/알림에서 추출한 이름/금액이 올바르지 않습니다.");
    return;
  }

  if (isDuplicateDetection(depositorName, amount)) {
    logSmsEvent(Object.assign({}, logBase, {
      outcome: "duplicate",
      detail: `${depositorName} / ${amount.toLocaleString()}원 - 같은 내용이 최근(${DEDUP_WINDOW_MS / 1000}초 이내)에 이미 처리되어 건너뜀 (SMS/알림 중복 수신)`,
    }));
    return;
  }

  logSmsEvent(Object.assign({}, logBase, { outcome: "success", detail: `${depositorName} / ${amount.toLocaleString()}원으로 등록 시도` }));
  registerBankTransaction(depositorName, amount, { externalTxnIdPrefix: source, silent: true });
}

// 네이티브 SmsReceiver가 문자 수신 시 호출하는 콜백 (AndroidInterface와 반대 방향의 브릿지 -
// 네이티브 → 웹). 실제로 충전을 등록하는 경우뿐 아니라, 필터/정규식 때문에 조용히 무시되는
// 경우까지 전부 logSmsEvent로 남겨야 "문자는 왔는데 처리가 안 됐다"를 화면에서 진단할 수 있다.
window.onSmsReceived = function (sender, body) {
  if (!isAdminAuthenticated) {
    logSmsEvent({ source: "SMS", sender, body, outcome: "auth_skip", detail: "관리자 인증 전이라 무시됨" });
    return;
  }

  const filterSender = (localStorage.getItem(SMS_DETECT_SENDER_KEY) ?? SMS_DETECT_SENDER_DEFAULT).trim();
  if (filterSender && !(sender || "").includes(filterSender)) {
    logSmsEvent({ source: "SMS", sender, body, outcome: "sender_filtered", detail: `감지할 발신번호 설정("${filterSender}")과 일치하지 않음` });
    return; // 지정한 발신번호/발신자가 아니면 무시
  }

  processDepositDetection("SMS", body, { sender });
};

// 네이티브 BankNotificationListener가 알림 감지 시 호출하는 콜백 - SMS_RECEIVED 브로드캐스트가
// 발생하지 않는 RCS/은행 앱 자체 푸시까지 잡기 위한 두 번째 경로("알림 접근" 권한이 켜져 있어야
// 호출된다). 발신번호 필터는 SMS 전용이라 여기서는 적용하지 않는다 - 패키지명 필터를 따로 두지
// 않은 이유는, 정규식이 이미 "입금...원...잔액" 형태로 충분히 구체적이라 오탐 위험이 낮고, 은행
// 알림이 뜨는 앱(메시지 앱/은행 앱 등)이 기기마다 달라 필터를 두면 오히려 놓치기 쉽기 때문.
window.onNotificationReceived = function (packageName, title, text) {
  if (!isAdminAuthenticated) {
    logSmsEvent({ source: "PUSH", packageName, body: `${title}\n${text}`, outcome: "auth_skip", detail: "관리자 인증 전이라 무시됨" });
    return;
  }

  const body = title ? `${title}\n${text}` : text;
  processDepositDetection("PUSH", body, { packageName });
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

// ============ 키오스크 관리 ============
// 메뉴 자체의 생성/수정/삭제는 각 키오스크 단말기의 관리자 패널에서 하고, 여기서는
// 등록된 키오스크 목록·단말기별 노출 메뉴 배정·메뉴별 매출만 다룬다(메뉴는 키오스크마다
// 다르게 노출될 수 있어 전역 메뉴 편집 화면을 여기 두지 않는다).

let kiosks = [];

async function loadKiosks() {
  try {
    const res = await adminFetch(`${API_BASE}/admin/kiosks`);
    if (!res.ok) return;
    kiosks = await res.json();
    renderKioskList();
  } catch (err) {
    console.error("Failed to load kiosks:", err);
  }
}

function renderKioskSalesRows(rows) {
  if (!rows || rows.length === 0) {
    return `<tr><td colspan="3" style="text-align:center; color: var(--text-muted);">판매 내역이 없습니다.</td></tr>`;
  }
  return rows.map(r => `
    <tr>
      <td>${r.product_name}</td>
      <td>${r.quantity.toLocaleString()}개</td>
      <td style="color: var(--accent-emerald); font-weight: bold;">${r.amount.toLocaleString()}원</td>
    </tr>
  `).join('');
}

function renderKioskSalesTable(kioskId, period) {
  const k = kiosks.find(x => x.id === kioskId);
  if (!k) return;
  const tbody = document.querySelector(`.kiosk-sales-table[data-kiosk-sales-id="${kioskId}"] tbody`);
  if (!tbody) return;
  tbody.innerHTML = renderKioskSalesRows(k.sales[period]);
}

function renderKioskList() {
  const container = document.getElementById("admin-kiosk-list");
  if (!container) return;
  container.innerHTML = "";

  if (kiosks.length === 0) {
    container.innerHTML = `<p style="text-align:center; color: var(--text-muted); padding: 2rem 0;">등록된 키오스크가 없습니다. 단말기에서 접속하면 자동으로 등록됩니다.</p>`;
    return;
  }

  kiosks.forEach(k => {
    const div = document.createElement("div");
    div.className = "glass-container kiosk-card";
    div.dataset.kioskId = k.id;
    div.style.marginBottom = "1.2rem";
    div.innerHTML = `
      <div style="margin-bottom: 0.8rem;">
        <div style="font-size: 1.05rem; font-weight: 800;">${k.device_name || '이름 없는 단말기'}</div>
        <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">${k.device_uuid}${k.merchant_name ? ' · ' + k.merchant_name : ''}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">최근 동기화: ${new Date(k.updated_at).toLocaleString()}</div>
      </div>

      <div style="margin-bottom: 0.8rem;">
        <label class="form-label">단말기 명칭</label>
        <input type="text" class="form-control kiosk-name-input" value="${k.device_name || ''}" style="margin-bottom: 0;">
      </div>

      <div style="margin-bottom: 0.8rem;">
        <label class="form-label">노출 메뉴 (체크한 메뉴만 이 단말기에 표시됩니다 - 전부 해제하면 전체 메뉴가 표시됩니다)</label>
        <div class="kiosk-product-checklist" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.4rem;">
          ${products.length === 0 ? `<span style="font-size: 0.8rem; color: var(--text-muted);">등록된 메뉴가 없습니다. 단말기 관리자 패널에서 메뉴를 먼저 추가하세요.</span>` : products.map(p => `
            <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; background: rgba(255,255,255,0.06); padding: 0.35rem 0.6rem; border-radius: 8px; cursor: pointer;">
              <input type="checkbox" value="${p.id}" ${k.assigned_products.includes(p.id) ? 'checked' : ''}>
              ${p.name}
            </label>
          `).join('')}
        </div>
      </div>

      <div class="admin-form-grid admin-form-grid-3" style="margin-bottom: 1rem;">
        <div>
          <label class="form-label">기본 결제 메뉴</label>
          <select class="form-control kiosk-default-product-select" style="margin-bottom: 0;">
            <option value="">-- 기본 결제 없음 --</option>
            ${products.map(p => `<option value="${p.id}" ${k.default_product_id === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">기본 수량</label>
          <input type="number" class="form-control kiosk-default-qty-input" value="${k.default_quantity || 1}" min="1" style="margin-bottom: 0;">
        </div>
        <button class="btn-action btn-primary" style="height: 52px;" onclick="saveKioskAssignment(${k.id}, this)">저장</button>
      </div>

      <div>
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem;">
          <span style="font-size: 0.85rem; color: var(--text-muted);">메뉴별 매출</span>
          <select class="form-control" style="width: auto; margin-bottom: 0; padding: 0.3rem 0.5rem; font-size: 0.8rem;" onchange="renderKioskSalesTable(${k.id}, this.value)">
            <option value="today">오늘</option>
            <option value="this_month">이번달</option>
            <option value="all_time">전체</option>
          </select>
        </div>
        <div style="overflow-x: auto;">
          <table class="table-custom kiosk-sales-table" data-kiosk-sales-id="${k.id}">
            <thead><tr><th>메뉴</th><th>판매 수량</th><th>매출</th></tr></thead>
            <tbody>${renderKioskSalesRows(k.sales.today)}</tbody>
          </table>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

async function saveKioskAssignment(kioskId, btn) {
  const card = document.querySelector(`.kiosk-card[data-kiosk-id="${kioskId}"]`);
  if (!card) return;

  const deviceName = card.querySelector(".kiosk-name-input").value.trim();
  const assignedProducts = Array.from(card.querySelectorAll(".kiosk-product-checklist input:checked")).map(cb => parseInt(cb.value));
  const defaultProductVal = card.querySelector(".kiosk-default-product-select").value;
  const defaultQty = parseInt(card.querySelector(".kiosk-default-qty-input").value) || 1;

  await withButtonLock(btn, async () => {
    try {
      const res = await adminFetch(`${API_BASE}/admin/kiosks/${kioskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_name: deviceName || null,
          assigned_products: assignedProducts,
          default_product_id: defaultProductVal ? parseInt(defaultProductVal) : null,
          default_quantity: defaultQty
        })
      });
      if (res.ok) {
        showToast("✅ 키오스크 설정을 저장했습니다.");
        loadKiosks();
      } else {
        const data = await res.json().catch(() => ({}));
        await showAlertModal(`저장 실패: ${data.detail || '오류 발생'}`);
      }
    } catch (err) {
      console.error("saveKioskAssignment error:", err);
    }
  });
}
