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
  users: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="7.5" r="3.2"/><path d="M2.5 20c1-3.5 3.4-5.4 6-5.4s5 1.9 6 5.4"/><circle cx="17" cy="8.2" r="2.5"/><path d="M15.3 11.9c2.2.4 3.9 2.1 4.7 4.9"/></svg>',
  refresh: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.3-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.3 6.3L3 16"/><path d="M3 21v-5h5"/></svg>',
  "chevron-down": '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  trash: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M10 11v6M14 11v6"/></svg>',
  x: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  plus: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>',
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
    localStorage.removeItem("admin_auth");
    localStorage.removeItem("admin_token");
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
  updateFixedViewLayoutMetrics(); // PIN 인증 전에도 --header-h/뷰 높이를 미리 맞춰 둔다
  initAdminTheme();

  // APK 다운로드 링크는 웹 브라우저에서만 의미가 있다 - 이미 설치된 네이티브 앱
  // 안(AndroidInterface 있음)에서는 굳이 보여줄 필요가 없어 숨긴다.
  if (window.AndroidInterface) {
    const downloadSection = document.getElementById("app-download-links");
    if (downloadSection) downloadSection.style.display = "none";

    // 앱 안에서만: 처음 설치해서 PIN 모달을 처음 보는 순간부터 "로그인 = 실시간 자동감지 켜짐"
    // 이라는 걸 안내한다 - 웹 브라우저 세션에서는 백그라운드 자동감지 자체가 의미 없어 숨긴다.
    const detectNotice = document.getElementById("admin-pin-detect-notice");
    if (detectNotice) detectNotice.style.display = "block";
  }

  // admin_token/admin_auth는 (sessionStorage가 아니라) localStorage에 저장한다 - 입금 문자/알림
  // 자동감지는 관리자가 화면을 보고 있지 않아도 계속 동작해야 하는데, sessionStorage는 앱
  // 프로세스가 죽었다가(백그라운드에서 OS가 회수, 최근 앱에서 스와이프 등) 다시 뜨면 비워져서
  // 매번 PIN을 다시 입력하기 전까지 감지가 멈춰버렸다. 토큰 자체도 백엔드
  // ADMIN_TOKEN_TTL_SECONDS가 사실상 무기한(10년)이라, 한 번 로그인하면 관리자가 직접
  // 로그아웃하지 않는 한 앱이 재시작돼도 인증 상태가 계속 유지된다(그래도 서버가 401을 주는
  // 경우 - 시크릿 키 교체 등 - 는 여전히 정상적으로 다시 PIN을 요구한다. 위 adminFetch의 401
  // 처리 참고).
  const savedToken = localStorage.getItem("admin_token");
  if (savedToken && localStorage.getItem("admin_auth") === "true") {
    adminToken = savedToken;
    isAdminAuthenticated = true;
    hideModal("admin-pin-modal");
    initAdminDashboard();
    syncAdminTokenToNative();
  } else {
    showModal("admin-pin-modal");
  }
});

// ============ 화면 테마(시스템/라이트/다크) - kiosk.js와 동일한 패턴 ============
const ADMIN_THEME_KEY = "admin_theme_pref";

function setAdminTheme(pref) {
  // body에 건다 - 모달들이 .admin-shell의 자식이 아니라 body 바로 아래 형제로 마크업돼
  // 있어서, 래퍼에만 스코프를 걸면 모달 내부가 테마를 안 탄다.
  if (pref === "system") {
    localStorage.removeItem(ADMIN_THEME_KEY);
    document.body.removeAttribute("data-theme");
  } else {
    localStorage.setItem(ADMIN_THEME_KEY, pref);
    document.body.setAttribute("data-theme", pref);
  }
  updateAdminThemeButtonsUI(pref);
  updateAdminThemeColorMeta();
}

function initAdminTheme() {
  updateAdminThemeButtonsUI(localStorage.getItem(ADMIN_THEME_KEY) || "system");
  updateAdminThemeColorMeta();
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", updateAdminThemeColorMeta);
  }
}

function updateAdminThemeColorMeta() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const pref = localStorage.getItem(ADMIN_THEME_KEY) || "system";
  const isLight = pref === "light" || (pref === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
  meta.setAttribute("content", isLight ? "#eef1f7" : "#000000");
}

function updateAdminThemeButtonsUI(activePref) {
  const buttons = {
    system: document.getElementById("a-theme-system-btn"),
    light: document.getElementById("a-theme-light-btn"),
    dark: document.getElementById("a-theme-dark-btn"),
  };
  Object.entries(buttons).forEach(([pref, btn]) => {
    if (!btn) return;
    const active = pref === activePref;
    btn.style.background = active ? "var(--accent-cyan)" : "var(--surface-1)";
    btn.style.color = active ? "#001318" : "var(--text-main)";
  });
}

// 네이티브 앱 안(DepositAutoDetector)이 웹뷰 없이도 입금을 직접 등록할 수 있도록 로그인 토큰을
// SharedPreferences로도 미러링한다 - 로그인 직후와, 저장돼 있던 토큰으로 자동 로그인됐을 때
// (위 DOMContentLoaded) 둘 다 호출한다. 일반 브라우저에서는 AndroidInterface가 없어 아무 일도
// 안 한다.
function syncAdminTokenToNative() {
  if (window.AndroidInterface && typeof window.AndroidInterface.saveAdminToken === "function") {
    window.AndroidInterface.saveAdminToken(adminToken);
  }
}

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
      localStorage.setItem("admin_auth", "true");
      localStorage.setItem("admin_token", adminToken);
      isAdminAuthenticated = true;
      hideModal("admin-pin-modal");
      initAdminDashboard();
      syncAdminTokenToNative();
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
  updateFixedViewLayoutMetrics(); // 첫 로드 시 기본 활성 뷰(홈)는 switchAdminView를 안 거치므로 직접 호출
  loadAdminUsers();
  loadAdminProducts();
  loadDepositHistories();
  loadAdminCards();
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

// 모바일 브라우저/WebView는 화면이 꺼지거나 앱이 백그라운드로 가면 WS 연결을 조용히 끊어버리는데,
// onclose가 늦게(또는 안) 불려서 3초 재연결 타이머가 안 걸리는 경우가 실제로 있다(user.js와 동일한
// #18 케이스 - 관리자 앱도 android_kiosk의 admin 플레이버로 휴대폰 WebView에서 돈다) - 화면을
// 다시 보는 시점(visibilitychange/pageshow)에 소켓 상태를 점검해 필요하면 즉시 재연결하고, 그
// 사이 놓쳤을 수 있는 갱신을 잡기 위해 최신 데이터도 바로 한 번 더 불러온다.
function resumeAdminRealtime() {
  if (!isAdminAuthenticated) return;
  if (!adminWs || adminWs.readyState >= 2) { // CLOSING(2) 또는 CLOSED(3)
    connectAdminWebSocket();
  }
  handleAdminRefreshEvent(["users", "cards", "deposit_queue", "stats", "deposits"])
    .catch(err => console.error("Resume refresh error:", err));
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) resumeAdminRealtime();
});
window.addEventListener("pageshow", resumeAdminRealtime);
window.addEventListener("online", resumeAdminRealtime);

async function handleAdminRefreshEvent(scopes) {
  const tasks = [];
  if (scopes.includes("users")) tasks.push(loadAdminUsers());
  if (scopes.includes("cards")) tasks.push(loadAdminCards());
  if (scopes.includes("deposit_queue")) tasks.push(loadBankTransactions());
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

function switchAdminView(viewName, inboxFilter) {
  document.querySelectorAll(".admin-view").forEach(el => el.classList.remove("active"));
  const target = document.getElementById(`admin-view-${viewName}`);
  if (target) target.classList.add("active");

  const tabViews = ["home", "search", "inbox", "kiosk", "settings"];
  if (tabViews.includes(viewName)) {
    document.querySelectorAll(".admin-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === viewName);
    });
    if (viewName === "search") { renderMemberFeed(); updateFixedViewLayoutMetrics(); }
    if (viewName === "kiosk") renderKioskList();
    if (viewName === "inbox") {
      if (inboxFilter) {
        inboxDepositFilter = inboxFilter;
        inboxFilterOpen = false;
      }
      activityFeedLimit = ACTIVITY_PAGE_SIZE;
      updateFixedViewLayoutMetrics();
      renderInboxFilterSelector();
      renderInboxActivityFeed();
    }
  }
}

// 홈/회원 관리/충전함 탭 공용: "헤더/하단 탭바를 제외한 나머지 공간"만 차지하고 그 안에서만
// 스크롤되는 레이아웃(style.css의 #admin-view-*.active)에 필요한 실제 렌더된 높이를 잰다.
// 뷰가 display:none이면 getBoundingClientRect가 0을 주므로 활성 상태인 뷰만 계산한다.
//
// 하단 여백은 탭바 높이를 따로 재지 않고 .admin-main의 padding-bottom을 그대로 쓴다 -
// 그 값 자체가 이미 "모바일은 하단 고정 탭바에 안 가리게 5.5rem, 데스크톱(>=900px)은
// 탭바가 왼쪽 사이드바로 바뀌어 1.5rem"로 튜닝되어 있어(style.css 참고), 탭바 높이를 따로
// 재서 빼면 이 padding-bottom과 이중으로 겹쳐 계산되어 실제로는 페이지가 그만큼 더 길어져
// 바깥 스크롤이 살짝 생기는 문제가 있었다(테스트 렌더로 확인).
const FIXED_HEIGHT_VIEWS = [
  { id: "admin-view-search", cssVar: "--search-view-h" },
  { id: "admin-view-inbox", cssVar: "--inbox-view-h" },
];

function updateFixedViewLayoutMetrics() {
  // .app-header는 .admin-shell 바깥의 형제 요소라 style.css가 --header-h로 실제 높이를
  // 받아써야 .admin-shell의 min-height(고정 헤더 아래 남은 전체 화면 높이)가 정확해진다 -
  // 하드코딩된 추정치(60px)는 safe-area-inset-top이 있는 기기 등에서 어긋나 아래 admin-main이
  // (flex:1로) 필요 이상 늘어나 바깥 스크롤이 생기는 원인이었다.
  const header = document.querySelector(".app-header");
  if (header) {
    document.documentElement.style.setProperty("--header-h", `${header.getBoundingClientRect().height}px`);
  }

  const main = document.querySelector(".admin-main");
  const mainPaddingBottom = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
  FIXED_HEIGHT_VIEWS.forEach(({ id, cssVar }) => {
    const view = document.getElementById(id);
    if (!view || !view.classList.contains("active")) return;
    const top = view.getBoundingClientRect().top;
    const available = Math.max(280, window.innerHeight - top - mainPaddingBottom);
    view.style.setProperty(cssVar, `${available}px`);
  });
}

window.addEventListener("resize", () => {
  clearTimeout(window._fixedViewLayoutResizeTimer);
  window._fixedViewLayoutResizeTimer = setTimeout(updateFixedViewLayoutMetrics, 150);
});

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
  const nativeGuide = document.getElementById("admin-qr-native-guide");

  if (mode === "NFC") {
    nfcBtn.className = "btn-action btn-primary";
    qrBtn.className = "btn-action";
    qrBtn.style.background = "var(--surface-1)";
    qrBtn.style.color = "var(--text-main)";
    nfcView.style.display = "block";
    qrView.style.display = "none";
    if (nativeGuide) nativeGuide.style.display = "none";
    stopAdminCameraScanner();
    stopNativeQrScanIfActive();
    initAdminNfcReader();
  } else {
    qrBtn.className = "btn-action btn-primary";
    nfcBtn.className = "btn-action";
    nfcBtn.style.background = "var(--surface-1)";
    nfcBtn.style.color = "var(--text-main)";
    qrView.style.display = "block";
    nfcView.style.display = "none";

    const nativePanel = document.getElementById("admin-qr-native-panel");
    const webPanel = document.getElementById("admin-qr-web-panel");
    if (hasNativeQrBridge()) {
      // http로 접속하는 관리자/회원 앱은 비보안 컨텍스트라 브라우저 getUserMedia(카메라)가
      // OS 권한을 이미 줬어도 아예 막힌다 - 대신 네이티브 카메라를 이 점선 박스 안(전체화면이
      // 아님)에 그대로 겹쳐서 띄운다(window.onAndroidQrScanned로 결과가 돌아옴). "카메라 켜기"
      // 버튼 없이 QR 모드로 전환하는 즉시 카메라가 뜨게 한다.
      if (nativePanel) nativePanel.style.display = "block";
      if (webPanel) webPanel.style.display = "none";
      if (nativeGuide) nativeGuide.style.display = "block";
      startNativeQrScanForCurrentViewport();
    } else {
      if (nativePanel) nativePanel.style.display = "none";
      if (webPanel) webPanel.style.display = "block";
      if (nativeGuide) nativeGuide.style.display = "none";
      // "카메라 켜기" 버튼을 따로 누르지 않아도 QR 모드로 전환하는 즉시 카메라가 켜지게 한다.
      if (!adminCameraScanning) startAdminCameraScanner();
    }
  }
}

// 관리자 앱 안(AndroidInterface에 startQrScan이 있는 경우)인지 판별 - 일반 브라우저는
// 이 메서드 자체가 없으므로 기존 getUserMedia 경로를 그대로 쓴다.
function hasNativeQrBridge() {
  return !!(window.AndroidInterface && typeof window.AndroidInterface.startQrScan === "function");
}

// 네이티브 카메라 프리뷰를 #admin-qr-native-camera-slot과 정확히 같은 화면 위치/크기에 겹쳐
// 띄운다 - getBoundingClientRect()는 CSS px(WebView에서는 Android dp와 동일) 기준이라, 실 픽셀
// 변환(density 곱셈)은 네이티브(MainActivity.startNativeQrScan) 쪽에서 처리한다.
function startNativeQrScanForCurrentViewport() {
  if (!hasNativeQrBridge()) return;
  const slot = document.getElementById("admin-qr-native-camera-slot");
  if (!slot) return;
  const rect = slot.getBoundingClientRect();
  window.AndroidInterface.startQrScan(rect.left, rect.top, rect.width, rect.height);
}

function stopNativeQrScanIfActive() {
  if (window.AndroidInterface && typeof window.AndroidInterface.stopQrScan === "function") {
    window.AndroidInterface.stopQrScan();
  }
}

// 화면 회전 등으로 슬롯 위치/크기가 바뀌면 네이티브 카메라 프리뷰도 다시 맞춰준다.
window.addEventListener("resize", () => {
  const modal = document.getElementById("card-scanner-modal");
  if (!modal || !modal.classList.contains("active") || adminScanMode !== "QR") return;
  startNativeQrScanForCurrentViewport();
});

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

  maybeAutoConfirmDetection();
}

// ---------------- 자동 식별 (검색 모드에서 스캔 즉시 "검색하기"를 누른 것처럼 동작) ----------------
// 단말기(브라우저)별로 켜둔 상태를 기억한다 - 기본값은 켜짐.
const ADMIN_AUTO_DETECT_KEY = "admin_auto_detect_enabled";

function loadAdminAutoDetectPref() {
  const toggle = document.getElementById("admin-auto-detect-toggle");
  if (!toggle) return;
  const stored = localStorage.getItem(ADMIN_AUTO_DETECT_KEY);
  toggle.checked = stored === null ? true : stored === "true";
}

function saveAdminAutoDetectPref(checked) {
  localStorage.setItem(ADMIN_AUTO_DETECT_KEY, checked ? "true" : "false");
}

// 회원 찾기(SEARCH) 모드에 한해 - 카드 등록(REGISTER)은 실수로 잘못된 카드를 회원에게
// 잘못 등록할 위험이 있어 자동 식별 대상에서 제외하고 항상 수동 확인을 받는다.
function maybeAutoConfirmDetection() {
  if (scannerMode !== "SEARCH") return;
  const modal = document.getElementById("card-scanner-modal");
  if (!modal || !modal.classList.contains("active")) return;
  const toggle = document.getElementById("admin-auto-detect-toggle");
  if (!toggle || !toggle.checked) return;
  handleScannerConfirm();
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

// 네이티브 QR 스캔(startNativeQrScan) 결과 콜백 - MainActivity.onNativeQrDecoded가 호출한다.
// 함수명을 바꾸면 안 된다. 카메라가 계속 켜져 있는 채로 프레임마다 계속 디코딩되므로(예전
// 전체화면 1회성 스캔과 달리), 웹 카메라 경로(scanAdminQrFrame)와 동일한 쿨다운을 공유해
// 같은 QR을 반복 인식해 진동/사운드가 연달아 울리지 않게 한다.
window.onAndroidQrScanned = function (text) {
  const modal = document.getElementById("card-scanner-modal");
  if (!modal || !modal.classList.contains("active") || adminQrCooldown) return;
  adminQrCooldown = true;
  document.getElementById("admin-card-uid-input").value = text;
  triggerDetectionFeedback();
  console.log("⚡ [Android Native App] 네이티브 QR 스캔 성공:", text);
  setTimeout(() => { adminQrCooldown = false; }, 2000);
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
    await showAlertModal("카메라에 접근할 수 없습니다. 카메라 권한을 확인하거나 NFC 태깅을 이용해 주세요.");
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
    toggleBtn.style.background = "rgba(103,129,192,0.2)";
    toggleBtn.style.color = "var(--accent-cyan)";
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
  loadAdminAutoDetectPref();
  const autoDetectRow = document.getElementById("admin-auto-detect-row");
  if (autoDetectRow) autoDetectRow.style.display = mode === "SEARCH" ? "flex" : "none";

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
  stopNativeQrScanIfActive();
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
  document.getElementById("stat-users-with-balance").innerText = `${stats.users_with_balance.toLocaleString()}명`;
  document.getElementById("stat-today-deposit").innerText = `${stats.today.deposit_amount.toLocaleString()}원`;
  document.getElementById("stat-today-payment").innerText = `${stats.today.payment_amount.toLocaleString()}원`;
  document.getElementById("stat-month-deposit").innerText = `${stats.this_month.deposit_amount.toLocaleString()}원`;
  document.getElementById("stat-month-payment").innerText = `${stats.this_month.payment_amount.toLocaleString()}원`;
  document.getElementById("stat-pending-deposit").innerText = `${stats.pending_deposit_count}건`;
  document.getElementById("stat-error-deposit").innerText = `${stats.error_deposit_count}건`;

  document.getElementById("attention-pending-deposit").classList.toggle("has-items", stats.pending_deposit_count > 0);
  document.getElementById("attention-error-deposit").classList.toggle("has-items", stats.error_deposit_count > 0);

  const badgeCount = stats.pending_deposit_count + stats.error_deposit_count;
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

// 사용자 관리 탭 - 돋보기 버튼을 누르면 검색창/스캔 버튼 카드가 제목줄 바로 아래로
// 펼쳐진다(키오스크 선택기와 같은 위치/느낌의 드롭다운 - fitDropdownVertically 참고).
let memberSearchOpen = false;
function toggleMemberSearchPanel() {
  memberSearchOpen = !memberSearchOpen;
  const panel = document.getElementById("member-search-panel");
  if (!panel) return;
  panel.classList.toggle("open", memberSearchOpen);
  if (memberSearchOpen) {
    fitDropdownVertically(panel);
    document.getElementById("member-search-input")?.focus();
  }
}

// 패널 바깥(회원 카드, 탭바 등)을 누르면 드롭다운을 닫는다(#26) - 토글 버튼 클릭은
// toggleMemberSearchPanel이 이미 처리하므로 여기서 다시 닫지 않도록 제외한다.
document.addEventListener("click", (e) => {
  if (!memberSearchOpen) return;
  const panel = document.getElementById("member-search-panel");
  const toggle = document.getElementById("member-search-toggle");
  if (panel?.contains(e.target) || toggle?.contains(e.target)) return;
  memberSearchOpen = false;
  panel.classList.remove("open");
});

// 입력칸 오른쪽 X 버튼(#26) - 검색어를 지우고 목록/하이라이팅을 원래대로 되돌린다.
function clearMemberSearchInput() {
  const input = document.getElementById("member-search-input");
  if (!input) return;
  input.value = "";
  renderMemberFeed();
  input.focus();
}

function renderMemberFeed() {
  const feed = document.getElementById("search-member-feed");
  if (!feed) return;
  const query = (document.getElementById("member-search-input")?.value || "").trim().toLowerCase();
  document.getElementById("member-search-toggle")?.classList.toggle("filter-active", !!query);
  document.getElementById("member-search-input-wrap")?.classList.toggle("has-value", !!query);

  const filtered = !query ? users : users.filter(u => {
    const haystack = [u.name, u.phone].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query);
  });

  // 필터가 걸려 있으면 목록 맨 위에 "필터 해제" 버튼을 둔다(#26) - 검색 패널을 다시 열지
  // 않고도 목록만 빠르게 전체로 되돌릴 수 있게.
  const clearFilterHtml = query
    ? `<button type="button" class="member-search-clear-filter" onclick="clearMemberSearchInput()">필터 해제 (${filtered.length}건 검색됨)</button>`
    : "";

  if (filtered.length === 0) {
    feed.innerHTML = clearFilterHtml + `<p style="text-align:center; color: var(--text-muted); padding: 2rem 0;">${query ? '검색 결과가 없습니다.' : '등록된 회원이 없습니다.'}</p>`;
    return;
  }
  feed.innerHTML = clearFilterHtml;
  filtered.forEach(u => feed.appendChild(renderMemberFeedCard(u)));
}

// 홈 "최근 처리 내역" - 계좌 입금(bankTransactions) 전체를 시간순으로 보여주는 실시간
// 피드. 카드를 누르면 openDepositDetailModal로 상세/처리 모달이 뜬다(카드 자체에는
// 이름/시각+상태/금액만 보여준다). 고정 높이 영역(.activity-feed-scroll) 안에서만
// 스크롤되고, 스크롤이 바닥에 가까워지면 setupActivityFeedInfiniteScroll이 다음 페이지를
// 이어서 그린다.
const ACTIVITY_PAGE_SIZE = 15;
let activityFeedLimit = ACTIVITY_PAGE_SIZE;
let activityFeedMergedCache = [];

const DEPOSIT_STATUS_META = {
  PENDING: { text: "대기", cls: "status-pending" },
  ERROR: { text: "오류", cls: "status-rejected" },
  CREDITED: { text: "완료", cls: "status-done" },
  CREDITED_MANUAL: { text: "완료(예외)", cls: "status-done" },
  OTHER: { text: "기타", cls: "status-other" },
};

// 충전함 제목 옆 필터 - 키오스크 선택기와 같은 드롭다운 패턴(toggleKioskSelector 참고).
const INBOX_FILTERS = ["ALL", "PENDING", "ERROR"];
const INBOX_FILTER_LABEL = { ALL: "전체", PENDING: "대기 중인 계좌 입금", ERROR: "매칭 오류 계좌 입금" };
let inboxDepositFilter = "ALL";
let inboxFilterOpen = false;

function toggleInboxFilterSelector() {
  inboxFilterOpen = !inboxFilterOpen;
  renderInboxFilterSelector();
}

function selectInboxFilter(filter) {
  inboxDepositFilter = filter;
  inboxFilterOpen = false;
  activityFeedLimit = ACTIVITY_PAGE_SIZE;
  renderInboxFilterSelector();
  renderInboxActivityFeed();
}

function renderInboxFilterSelector() {
  const label = document.getElementById("inbox-filter-label");
  const arrow = document.getElementById("inbox-filter-arrow");
  const list = document.getElementById("inbox-filter-list");
  if (!label || !list) return;

  label.innerText = INBOX_FILTER_LABEL[inboxDepositFilter];
  if (arrow) arrow.style.transform = inboxFilterOpen ? "rotate(180deg)" : "rotate(0deg)";

  list.style.display = inboxFilterOpen ? "flex" : "none";
  if (!inboxFilterOpen) return;

  list.innerHTML = INBOX_FILTERS.map(f => `
    <button type="button" class="kiosk-selector-item-main ${f === inboxDepositFilter ? 'active' : ''}" onclick="selectInboxFilter('${f}')">
      <span class="kiosk-selector-item-name">${INBOX_FILTER_LABEL[f]}</span>
    </button>
  `).join('');
  fitDropdownVertically(list);
}

function buildDepositEvents() {
  return bankTransactions
    .filter(t => inboxDepositFilter === "ALL" || t.status === inboxDepositFilter)
    .map(t => {
    // "SIM_" 접두사(processDepositDetection 참고)는 수신 시뮬레이션 버튼으로 등록된 테스트
    // 건이다 - 실제 입금과 겉모습이 똑같으면 관리자가 실제 수신으로 착각할 수 있어(실제로
    // 겪은 문제) 목록에서부터 표시를 다르게 한다.
    const isSimulated = (t.external_txn_id || "").startsWith("SIM_");
    const meta = DEPOSIT_STATUS_META[t.status] || { text: t.status, cls: "status-pending" };
    const name = t.matched_user_name || t.depositor_name;
    return {
      id: t.id,
      time: t.created_at,
      icon: icon("bank"),
      title: (isSimulated ? "🧪 " : "") + (t.status === "ERROR" ? `⚠️ ${name}` : name),
      amount: t.amount,
      status: meta.text,
      statusClass: meta.cls,
    };
  }).sort((a, b) => new Date(b.time) - new Date(a.time));
}

function renderActivityLine(ev) {
  return `
    <span class="activity-icon">${ev.icon}</span>
    <div class="activity-info">
      <div class="activity-title">${ev.title}</div>
      <div class="activity-sub">${new Date(ev.time).toLocaleString()}</div>
      <span class="activity-status ${ev.statusClass}">${ev.status}</span>
    </div>
    <div class="activity-amount-col">
      <div class="activity-amount">${ev.amount.toLocaleString()}원</div>
    </div>
  `;
}

function renderActivityCard(ev) {
  const div = document.createElement("div");
  div.className = "glass-container activity-row";
  div.style.cursor = "pointer";
  div.onclick = () => openDepositDetailModal(ev.id);
  div.innerHTML = renderActivityLine(ev);
  return div;
}

function renderInboxActivityFeed() {
  const feed = document.getElementById("inbox-activity-feed");
  if (!feed) return;

  activityFeedMergedCache = buildDepositEvents();

  feed.innerHTML = "";
  if (activityFeedMergedCache.length === 0) {
    feed.innerHTML = `<p style="text-align:center; color: var(--text-muted); padding: 1rem 0;">처리 내역이 없습니다.</p>`;
    return;
  }

  activityFeedMergedCache.slice(0, activityFeedLimit).forEach(ev => feed.appendChild(renderActivityCard(ev)));
}

// 스크롤이 하단 80px 이내로 들어오면 다음 페이지를 이어서 그린다 (드래그/휠 스크롤 모두 대응).
function setupActivityFeedInfiniteScroll() {
  const scrollBox = document.getElementById("inbox-activity-feed-scroll");
  if (!scrollBox || scrollBox.dataset.scrollWired) return;
  scrollBox.dataset.scrollWired = "1";
  scrollBox.addEventListener("scroll", () => {
    if (activityFeedLimit >= activityFeedMergedCache.length) return;
    if (scrollBox.scrollTop + scrollBox.clientHeight >= scrollBox.scrollHeight - 80) {
      activityFeedLimit += ACTIVITY_PAGE_SIZE;
      renderInboxActivityFeed();
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
  document.getElementById("detail-member-birth-date").innerText = user.birth_date || "-";

  renderDetailCardSlots();
  renderDetailHistory();
}

// #27: 정지/삭제가 정보수정 모달 안으로 옮겨가면서, 계정 정지 버튼 상태(라벨/색/비활성화)는
// 모달을 열 때(openEditUserModal)와 정지 토글 성공 직후(모달을 닫지 않고 바로 반영) 둘 다에서
// 갱신해야 해 별도 함수로 뺐다.
function renderEditModalStatusButton(user) {
  const statusBtn = document.getElementById("edit-user-status-btn");
  if (!statusBtn) return;
  const isActive = user.status === "ACTIVE";
  const isAdminUser = user.role === "ADMIN";
  statusBtn.innerText = isActive ? "계정 정지" : "계정 활성";
  statusBtn.style.background = isActive ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)";
  statusBtn.style.color = isActive ? "var(--icon-danger)" : "var(--accent-emerald)";
  statusBtn.disabled = isActive && isAdminUser;
  statusBtn.style.opacity = statusBtn.disabled ? "0.4" : "1";
  statusBtn.title = statusBtn.disabled ? "관리자 계정은 정지할 수 없습니다." : "";
}

// 잔액이 남아있어도 삭제는 허용한다(관리자의 명시적 선택). 다만 결제/입금/충전 이력이
// 있는 회원은 그 기록들이 삭제된 회원을 참조하게 되어 정합성이 깨지므로 백엔드가 거부한다
// (admin_delete_user 참고) - 그런 회원은 "정지"를 대신 안내받는다.
async function deleteDetailUser() {
  const user = users.find(u => u.id === currentDetailUserId);
  if (!user) return;
  if (!(await showConfirmModal(`${user.name}님을 정말 삭제하시겠습니까? 되돌릴 수 없습니다.\n(잔액이 남아있어도 삭제됩니다. 단, 결제/입금/충전 이력이 있는 회원은 삭제할 수 없습니다 - 그런 경우 "정지"를 이용하세요.)`))) return;

  try {
    const res = await adminFetch(`${API_BASE}/admin/users/${currentDetailUserId}`, { method: "DELETE" });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      closeEditUserModal();
      closeMemberDetail();
      await loadAdminUsers();
      await loadStatsSummary();
      showToast(`✅ ${data.message || "회원을 삭제했습니다."}`);
    } else {
      const data = await res.json().catch(() => ({}));
      await showAlertModal(`삭제 실패: ${data.detail || "오류 발생"}`);
    }
  } catch (err) {
    console.error("deleteDetailUser error:", err);
    await showAlertModal("서버 연결에 실패했습니다.");
  }
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
          <button class="btn-action" style="width:auto; padding:0.4rem 0.7rem; font-size:0.82rem; background: rgba(239,68,68,0.2); color: var(--icon-danger);" onclick="deleteDetailCard(${card.id})">삭제</button>
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
  const label = newStatus === "SUSPENDED" ? "정지" : "활성화";
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
      const updatedUser = users.find(u => u.id === user.id);
      if (updatedUser) renderEditModalStatusButton(updatedUser);
    } else {
      const data = await res.json().catch(() => ({}));
      await showAlertModal(`처리 실패: ${data.detail || '오류 발생'}`);
    }
  } catch (err) {
    console.error("toggleDetailUserStatus error:", err);
  }
}

function openDetailRechargeModal() {
  document.getElementById("detail-recharge-amount").value = 5000;
  document.getElementById("detail-recharge-memo").value = "";
  showModal("detail-recharge-modal");
}
function closeDetailRechargeModal() {
  hideModal("detail-recharge-modal");
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
          memo: memo || "현금 수령 후 충전 처리"
        })
      });

      if (res.ok) {
        const data = await res.json();
        closeDetailRechargeModal();
        await showAlertModal(data.message);
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

function openDetailDeductModal() {
  document.getElementById("detail-deduct-amount").value = 5000;
  document.getElementById("detail-deduct-memo").value = "";
  showModal("detail-deduct-modal");
}
function closeDetailDeductModal() {
  hideModal("detail-deduct-modal");
}

async function submitDetailDeduct(btn) {
  const amount = parseInt(document.getElementById("detail-deduct-amount").value);
  const memo = document.getElementById("detail-deduct-memo").value;

  if (!amount || amount <= 0) {
    await showAlertModal("차감 금액을 올바르게 입력하세요.");
    return;
  }

  await withButtonLock(btn, async () => {
    try {
      const res = await adminFetch(`${API_BASE}/admin/deduct-credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentDetailUserId,
          amount: amount,
          memo: memo || "잘못 충전됨"
        })
      });

      if (res.ok) {
        const data = await res.json();
        closeDetailDeductModal();
        await showAlertModal(data.message);
        await loadAdminUsers();
        await loadDepositHistories();
        await loadStatsSummary();
        renderMemberDetail();
      } else {
        const data = await res.json().catch(() => ({}));
        await showAlertModal(`차감 실패: ${data.detail ? JSON.stringify(data.detail) : '오류 발생'}`);
      }
    } catch (err) {
      console.error("Detail deduct error:", err);
    }
  });
}

// 이력 카드 레이아웃(#19): 좌상단 종류 배지(충전/결제/실패) + 날짜, 좌하단 사유(충전 메모 /
// 결제 목록 / 실패 사유), 우상단 금액(+/-), 우하단 잔액. 유저 앱 이용 내역(user.js의
// depositRowHtml/paymentRowHtml)과 동일한 .history-item* 마크업/클래스를 쓴다.
async function renderDetailHistory() {
  const box = document.getElementById("detail-history-list");
  if (!box) return;
  box.innerHTML = `<p style="color: var(--text-muted);">불러오는 중...</p>`;

  const deposits = depositHistories
    .filter(h => h.user_id === currentDetailUserId)
    .map(h => {
      const isDeduct = h.deposit_type === "ADMIN_MANUAL_DEDUCT";
      return {
        type: isDeduct ? "금액 차감" : "금액 충전", cls: isDeduct ? "status-rejected" : "status-done",
        amount: h.amount, balance_after: h.balance_after,
        reason: h.memo || (isDeduct ? "관리자 직권 차감" : "관리자 직권 충전"), created_at: h.created_at,
      };
    });

  let payments = [];
  try {
    const res = await adminFetch(`${API_BASE}/payments?user_id=${currentDetailUserId}&limit=20`);
    if (res.ok) {
      const txs = await res.json();
      payments = txs.map(t => {
        const isFailed = t.status === "FAILED";
        return {
          type: isFailed ? "결제 실패" : "결제 성공", cls: isFailed ? "status-rejected" : "status-payment",
          amount: -t.amount, balance_after: t.balance_after,
          reason: isFailed ? (t.failure_reason || "결제 실패") : (t.product_details || "-"),
          created_at: t.created_at,
        };
      });
    }
  } catch (err) {
    console.error("Failed to load payment history:", err);
  }

  const combined = [...deposits, ...payments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (combined.length === 0) {
    box.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 1rem 0;">이력이 없습니다.</p>`;
    return;
  }

  box.innerHTML = combined.slice(0, 30).map(h => {
    const amountCls = h.type === "결제 실패" ? "amount-neutral" : (h.amount >= 0 ? "amount-positive" : "amount-negative");
    return `
    <div class="history-item">
      <div class="history-item-left">
        <div class="history-item-top">
          <span class="activity-status ${h.cls}">${h.type}</span>
          <span class="history-item-date">${new Date(h.created_at).toLocaleString()}</span>
        </div>
        <div class="history-item-reason">${escapeHtml(h.reason)}</div>
      </div>
      <div class="history-item-right">
        <div class="history-item-amount ${amountCls}">${h.amount >= 0 ? '+' : ''}${h.amount.toLocaleString()}원</div>
        ${h.balance_after != null ? `<div class="history-item-balance">잔액 ${h.balance_after.toLocaleString()}원</div>` : ""}
      </div>
    </div>
  `;
  }).join("");
}

// ============ 계좌 입금 목록 (충전함 - 전체) ============
// stats.pending_deposit_count/error_deposit_count는 이 목록 중 status===PENDING/ERROR
// 건수와 같다 - 충전함 탭 배지 숫자가 이 둘의 합이다.
async function loadBankTransactions() {
  try {
    const res = await adminFetch(`${API_BASE}/admin/bank-transactions`);
    if (!res.ok) return;
    bankTransactions = await res.json();
    renderInboxActivityFeed();
    if (_depositDetailTxn) {
      _depositDetailTxn = bankTransactions.find(t => t.id === _depositDetailTxn.id) || null;
      if (_depositDetailTxn) renderDepositDetailModal();
    }
  } catch (err) {
    console.error("Failed to load bank transactions:", err);
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

    const matched = data.status === "PENDING";
    loadBankTransactions();
    loadStatsSummary();

    if (silent) {
      showToast(matched
        ? `🏦 문자 자동감지: ${depositorName} ${amount.toLocaleString()}원 - 회원 매칭됨(충전 대기)`
        : `⚠️ 문자 자동감지: ${depositorName} ${amount.toLocaleString()}원 - 매칭 오류(등록 회원 이름과 불일치)`);
    } else {
      const matchedLabel = matched ? "\n\n✅ 등록 회원과 자동으로 매칭되어 회원 앱에 표시됩니다." : "\n\n⚠️ 입금자명이 등록 회원과 일치하지 않아 매칭 오류로 등록했습니다. 충전함에서 회원을 지정해주세요.";
      await showAlertModal(`🎉 입금 확인 등록 완료\n입금자명: ${depositorName}\n금액: ${amount.toLocaleString()}원${matchedLabel}`);
    }
    return true;
  } catch (err) {
    console.error("registerBankTransaction error:", err);
    if (silent) showToast("❌ 문자 자동감지 등록 중 오류가 발생했습니다.");
    return false;
  }
}

// ============ 계좌 입금 상세 모달 (회원 지정 처리 / 기타 처리) ============
let _depositDetailTxn = null;
let _depositDetailSelectedUserId = null;

function openDepositDetailModal(txnId) {
  const txn = bankTransactions.find(t => t.id === txnId);
  if (!txn) return;
  _depositDetailTxn = txn;
  _depositDetailSelectedUserId = txn.matched_user_id || null;
  renderDepositDetailModal();
  showModal("deposit-detail-modal");
}

function closeDepositDetailModal() {
  _depositDetailTxn = null;
  _depositDetailSelectedUserId = null;
  hideModal("deposit-detail-modal");
}

function renderDepositDetailModal() {
  const t = _depositDetailTxn;
  if (!t) return;

  document.getElementById("dd-depositor-name").innerText = t.depositor_name;
  document.getElementById("dd-amount").innerText = `${t.amount.toLocaleString()}원`;
  document.getElementById("dd-transaction-at").innerText = new Date(t.transaction_at).toLocaleString();
  document.getElementById("dd-txn-id").innerText = t.external_txn_id;

  const meta = DEPOSIT_STATUS_META[t.status] || { text: t.status, cls: "status-pending" };
  const statusEl = document.getElementById("dd-status");
  statusEl.innerText = meta.text;
  statusEl.className = `activity-status ${meta.cls}`;

  const infoBox = document.getElementById("dd-resolution-info");
  const infoLines = [];
  if (t.matched_user_name) infoLines.push(`매칭 회원: ${escapeHtml(t.matched_user_name)}`);
  if (t.resolved_by_admin_name) infoLines.push(`처리자: ${escapeHtml(t.resolved_by_admin_name)}`);
  if (t.resolved_at) infoLines.push(`처리 시각: ${new Date(t.resolved_at).toLocaleString()}`);
  if (t.resolution_memo) infoLines.push(`메모: ${escapeHtml(t.resolution_memo)}`);
  if (infoLines.length > 0) {
    infoBox.style.display = "block";
    infoBox.innerHTML = infoLines.join("<br>");
  } else {
    infoBox.style.display = "none";
  }

  const resolveSection = document.getElementById("dd-resolve-section");
  const resolvable = t.status === "PENDING" || t.status === "ERROR";
  resolveSection.style.display = resolvable ? "block" : "none";
  if (resolvable) {
    document.getElementById("dd-user-search").value = "";
    document.getElementById("dd-resolve-memo").value = "";
    document.getElementById("dd-other-reason").value = "";
    renderDepositUserOptions();
  }
}

function renderDepositUserOptions() {
  const box = document.getElementById("dd-user-options");
  if (!box) return;
  const query = (document.getElementById("dd-user-search").value || "").trim().toLowerCase();
  const matches = users.filter(u => !query || u.name.toLowerCase().includes(query) || (u.phone || "").includes(query)).slice(0, 20);

  if (matches.length === 0) {
    box.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">일치하는 회원이 없습니다.</p>`;
    return;
  }

  box.innerHTML = matches.map(u => {
    const selected = u.id === _depositDetailSelectedUserId;
    return `
      <div onclick="selectDepositUser(${u.id})" style="display:flex; justify-content:space-between; align-items:center; padding: 0.5rem 0.7rem; border-radius: 8px; cursor:pointer; background: ${selected ? "rgba(16,185,129,0.15)" : "var(--surface-2)"}; border: 1px solid ${selected ? "var(--accent-emerald)" : "transparent"};">
        <span>${renderTruncatedName(u.name)} <span style="color: var(--text-muted); font-size: 0.78rem;">${escapeHtml(u.phone || "")}</span></span>
        ${selected ? `<span data-icon="check" style="color: var(--accent-emerald);"></span>` : ""}
      </div>
    `;
  }).join("");
  hydrateIconPlaceholders(box);
}

function selectDepositUser(userId) {
  _depositDetailSelectedUserId = userId;
  renderDepositUserOptions();
}

async function submitDepositResolve(btn) {
  if (!_depositDetailTxn) return;
  if (!_depositDetailSelectedUserId) {
    await showAlertModal("충전 처리할 회원을 선택해주세요.");
    return;
  }
  const memo = document.getElementById("dd-resolve-memo").value.trim();

  await withButtonLock(btn, async () => {
    try {
      const res = await adminFetch(`${API_BASE}/admin/bank-transactions/${_depositDetailTxn.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: _depositDetailSelectedUserId, memo: memo || null })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await showAlertModal(`처리 실패: ${data.detail || '오류 발생'}`);
        return;
      }
      closeDepositDetailModal();
      showToast(`✅ ${data.matched_user_name || ''}님에게 ${data.amount.toLocaleString()}원 충전 처리했습니다.`);
      loadAdminUsers();
      loadDepositHistories();
      loadBankTransactions();
      loadStatsSummary();
    } catch (err) {
      console.error("submitDepositResolve error:", err);
    }
  });
}

async function submitDepositMarkOther(btn) {
  if (!_depositDetailTxn) return;
  const reason = document.getElementById("dd-other-reason").value.trim();
  if (!reason) {
    await showAlertModal("사유를 입력해주세요.");
    return;
  }
  if (!(await showConfirmModal("이 입금 건을 충전 대상이 아닌 것으로 처리하시겠습니까? 크레딧이 반영되지 않습니다."))) return;

  await withButtonLock(btn, async () => {
    try {
      const res = await adminFetch(`${API_BASE}/admin/bank-transactions/${_depositDetailTxn.id}/mark-other`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await showAlertModal(`처리 실패: ${data.detail || '오류 발생'}`);
        return;
      }
      closeDepositDetailModal();
      showToast("🗂️ 기타로 처리했습니다.");
      loadBankTransactions();
      loadStatsSummary();
    } catch (err) {
      console.error("submitDepositMarkOther error:", err);
    }
  });
}

// ============ 입금 알림 자동감지 (SMS + 푸시 알림/RCS) ============
// 네이티브가 은행 입금 알림을 두 경로로 원본 그대로 넘긴다:
//   - SmsReceiver → window.onSmsReceived(sender, body)                       (일반 SMS만 잡음)
//   - BankNotificationListener → window.onNotificationReceived(pkg, title, text)
//     (SMS/RCS/은행 앱 자체 푸시 등 화면에 뜨는 모든 알림을 잡음 - SmsReceiver의 사각지대를 메움.
//      "알림 접근" 권한은 사용자가 설정 화면에서 직접 켜야 동작한다.)
// 여기서 저장된 발신번호 필터(SMS 전용)/알림 앱 패키지·제목 필터(PUSH 전용)/정규식(공용)으로
// 파싱해서 registerBankTransaction()을 그대로 호출한다. 파싱 규칙을 은행 알림 포맷에 맞춰
// 바꿀 때마다 앱을 다시 빌드/배포할 필요가 없도록 일부러 이 계층(웹)에 둔다.
//
// 같은 실제 입금이 두 경로로 동시에 들어올 수 있다(진짜 SMS는 알림창에도 함께 뜬다) - 이름/
// 금액/날짜/시각/잔액이 모두 같은 조합이 다시 감지되면 중복으로 보고 두 번째부터는 등록하지
// 않는다 (isDuplicateDetection 참고).
const SMS_DETECT_SENDER_KEY = "sms_detect_sender";
const SMS_DETECT_REGEX_KEY = "sms_detect_regex";
const SMS_DETECT_PUSH_PACKAGE_KEY = "sms_detect_push_package";
const SMS_DETECT_PUSH_TITLE_KEY = "sms_detect_push_title";

// NH농협 알림 문자(발신 1588-2100) 실제 포맷 기준 기본값 - 예)
// "농협 입금10,000원\n08/13 12:12 301-****-7807-01 박용준 잔액2,165,746원"
// 다른 은행이면 관리자가 화면에서 값을 바꾸면 되고, 저장하기 전(로컬스토리지가 비어있는 상태)
// 에도 이 기본값으로 바로 동작하도록 저장값 조회 시 항상 이 값으로 폴백한다.
const SMS_DETECT_SENDER_DEFAULT = "1588-2100";
// name/amount 외에 date/time/balance도 이름의 캡처 그룹으로 함께 뽑는다 - 중복 감지 키
// (buildDetectionKey)가 이 값들을 쓴다. 커스텀 정규식에 이 그룹들이 없어도 에러 없이 그냥
// undefined로 빠지니(중복 감지가 이름+금액만으로 헐거워질 뿐) 필수는 아니다.
const SMS_DETECT_REGEX_DEFAULT = "입금\\s*(?<amount>[\\d,]+)원[\\s\\S]*?(?<date>\\d{2}/\\d{2})\\s+(?<time>\\d{2}:\\d{2})\\s+(?<account>301-\\*+-7807-01)\\s+(?<name>[가-힣]{2,10})\\s*잔액(?<balance>[\\d,]+)원";
// PUSH 경로(알림 접근 권한)는 기기에 뜨는 모든 알림을 다 보므로, 필터가 없으면 카카오톡/브라우저
// 등 은행과 무관한 알림까지 전부 로그에 쌓여 정작 입금 알림을 찾기 어려워진다 - 삼성 기본 문자
// 앱으로 오는 NH농협 알림 기준 기본값을 둔다. 두 값 다 비워두면 필터 없이 전체 허용.
const SMS_DETECT_PUSH_PACKAGE_DEFAULT = "com.samsung.android.messaging";
const SMS_DETECT_PUSH_TITLE_DEFAULT = "NH농협";

function loadSmsDetectSettings() {
  const senderEl = document.getElementById("sms-detect-sender");
  const regexEl = document.getElementById("sms-detect-regex");
  const pushPackageEl = document.getElementById("sms-detect-push-package");
  const pushTitleEl = document.getElementById("sms-detect-push-title");
  if (senderEl) senderEl.value = localStorage.getItem(SMS_DETECT_SENDER_KEY) ?? SMS_DETECT_SENDER_DEFAULT;
  if (regexEl) regexEl.value = localStorage.getItem(SMS_DETECT_REGEX_KEY) ?? SMS_DETECT_REGEX_DEFAULT;
  if (pushPackageEl) pushPackageEl.value = localStorage.getItem(SMS_DETECT_PUSH_PACKAGE_KEY) ?? SMS_DETECT_PUSH_PACKAGE_DEFAULT;
  if (pushTitleEl) pushTitleEl.value = localStorage.getItem(SMS_DETECT_PUSH_TITLE_KEY) ?? SMS_DETECT_PUSH_TITLE_DEFAULT;
  renderSmsLog();
  refreshNotificationAccessStatus();
  syncDetectSettingsToNative(); // 처음 설치해서 아직 한 번도 "설정 저장"을 안 눌렀어도(기본값
  // 그대로) 네이티브가 최신 설정을 갖고 있도록, 화면에 값을 채울 때마다 같이 밀어준다.
}

// 네이티브 앱 안(DepositAutoDetector)이 웹뷰 없이도 같은 필터/정규식으로 판단할 수 있도록
// 현재 유효한 설정값(로컬스토리지 저장값 또는 기본값)을 SharedPreferences로도 미러링한다.
// loadSmsDetectSettings()(최초 로드/초기화 후) 및 saveSmsDetectSettings()(저장 시)에서 호출.
function syncDetectSettingsToNative() {
  if (!window.AndroidInterface || typeof window.AndroidInterface.saveDetectSettings !== "function") return;
  const sender = (localStorage.getItem(SMS_DETECT_SENDER_KEY) ?? SMS_DETECT_SENDER_DEFAULT).trim();
  const regexStr = (localStorage.getItem(SMS_DETECT_REGEX_KEY) ?? SMS_DETECT_REGEX_DEFAULT).trim();
  const pushPackage = (localStorage.getItem(SMS_DETECT_PUSH_PACKAGE_KEY) ?? SMS_DETECT_PUSH_PACKAGE_DEFAULT).trim();
  const pushTitle = (localStorage.getItem(SMS_DETECT_PUSH_TITLE_KEY) ?? SMS_DETECT_PUSH_TITLE_DEFAULT).trim();
  window.AndroidInterface.saveDetectSettings(sender, regexStr, pushPackage, pushTitle);
}

// ---------------- 개발자 모드 섹션 접기/펼치기 (기본은 접힌 상태) ----------------
function toggleDevModeSection() {
  const body = document.getElementById("dev-mode-body");
  const arrow = document.getElementById("dev-mode-arrow");
  if (!body) return;
  const wasOpen = body.style.display !== "none";
  body.style.display = wasOpen ? "none" : "block";
  if (arrow) arrow.style.transform = wasOpen ? "rotate(0deg)" : "rotate(180deg)";
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
  const pushPackage = document.getElementById("sms-detect-push-package").value.trim();
  const pushTitle = document.getElementById("sms-detect-push-title").value.trim();

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
  localStorage.setItem(SMS_DETECT_PUSH_PACKAGE_KEY, pushPackage);
  localStorage.setItem(SMS_DETECT_PUSH_TITLE_KEY, pushTitle);
  syncDetectSettingsToNative();
  showToast("✅ 문자 자동감지 설정을 저장했습니다.");
}

// 감지 발신번호/정규식/알림 필터를 기본값으로 되돌린다 - 로컬스토리지에 남아있는 예전 값이
// 최신 기본값(SMS_DETECT_*_DEFAULT)을 계속 가리는 문제를 화면에서 바로 해결할 수 있게 한다.
async function resetSmsDetectSettings() {
  if (!(await showConfirmModal("입금 문자 자동감지 설정을 기본값으로 되돌리시겠습니까?"))) return;
  localStorage.removeItem(SMS_DETECT_SENDER_KEY);
  localStorage.removeItem(SMS_DETECT_REGEX_KEY);
  localStorage.removeItem(SMS_DETECT_PUSH_PACKAGE_KEY);
  localStorage.removeItem(SMS_DETECT_PUSH_TITLE_KEY);
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
// 함께 뜬다) - 이름+금액만으로는 우연히 같은 사람이 짧은 시간 안에 같은 금액을 두 번 입금하는
// 정상적인 케이스와 구분이 안 돼서 시간 제한(30초)을 뒀었는데, 그래도 여전히 오탐 가능성이
// 있었다. 대신 문자/알림 본문에서 이름·금액뿐 아니라 날짜·시각·잔액까지 함께 추출해 그
// 조합으로 키를 만든다 - 은행 잔액은 거래마다 값이 달라지므로 이 5개가 모두 같다는 건
// "같은 거래를 SMS/알림 두 경로로 동시에 받은 것"이라고 사실상 확정할 수 있어, 시간 제한
// 없이 같은 키를 한 번이라도 봤으면 계속 중복으로 처리해도 안전하다(날짜·시각·잔액을 못 뽑는
// 정규식이면 그만큼 키가 헐거워지므로, 기본 정규식은 이 값들도 캡처하도록 해뒀다 - 아래
// SMS_DETECT_REGEX_DEFAULT 참고).
const seenDetectionKeys = new Set();

function buildDetectionKey(groups) {
  return [groups.name, groups.amount, groups.date, groups.time, groups.balance]
    .map((v) => (v ?? "").trim())
    .join("|");
}

function isDuplicateDetection(key) {
  const isDup = seenDetectionKeys.has(key);
  if (!isDup) seenDetectionKeys.add(key);
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
  // 발신번호/알림 패키지·제목 필터에 안 맞아 무시된 건도 이제 로그에 남는다(DepositAutoDetector
  // 참고) - "원래 되던 수신이 안 된다"를 원본 내용 없이는 진단할 수 없었던 문제 대응.
  filtered: { label: "필터 불일치", cls: "status-pending" },
  duplicate: { label: "중복 감지", cls: "status-pending" },
  no_regex: { label: "정규식 미설정", cls: "status-rejected" },
  regex_error: { label: "정규식 오류", cls: "status-rejected" },
  parse_fail: { label: "파싱 실패", cls: "status-rejected" },
  invalid_value: { label: "추출값 이상", cls: "status-rejected" },
  register_fail: { label: "등록 실패", cls: "status-rejected" },
  network_error: { label: "네트워크 오류", cls: "status-rejected" },
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

  const countEl = document.getElementById("sms-log-count");
  if (countEl) countEl.textContent = log.length > 0 ? `(${log.length}/${SMS_LOG_MAX}건)` : "";

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
        <div style="font-size: 0.8rem; white-space: pre-wrap; word-break: break-all; font-family: monospace; color: var(--text-main); background: var(--surface-2); padding: 0.5rem 0.6rem; border-radius: 8px;">${escapeHtml(entry.body || "")}</div>
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

  if (isDuplicateDetection(buildDetectionKey(match.groups))) {
    logSmsEvent(Object.assign({}, logBase, {
      outcome: "duplicate",
      detail: `${depositorName} / ${amount.toLocaleString()}원 - 이름·금액·날짜·시각·잔액이 동일한 내용이 이미 처리되어 건너뜀 (SMS/알림 중복 수신)`,
    }));
    return;
  }

  logSmsEvent(Object.assign({}, logBase, { outcome: "success", detail: `${depositorName} / ${amount.toLocaleString()}원으로 등록 시도` }));
  // 이 함수(processDepositDetection)는 이제 시뮬레이션 버튼(triggerSimulatedSms/
  // triggerSimulatedNotification)에서만 호출된다(위 window.onSmsReceived 주석 참고) - 실제
  // 수신은 전부 네이티브(DepositAutoDetector)가 처리해 PUSH_NATIVE_/SMS_NATIVE_로 등록된다.
  // 그래서 여기서 만드는 건은 항상 테스트 건이라 "SIM_" 접두사로 명확히 표시한다 - 안 그러면
  // 충전함 목록에서 실제 수신 건과 구분이 안 돼서, 테스트로 클릭한 걸 실제 입금으로 착각하기
  // 쉽다(renderInboxActivityFeed의 "🧪 테스트" 표시가 이 접두사를 보고 판단한다).
  registerBankTransaction(depositorName, amount, { externalTxnIdPrefix: "SIM_" + source, silent: true });
}

// 문자 수신 시뮬레이션(SIM 없는 테스트, triggerSimulatedSms) 전용 진입점 - 실제 기기에서 온
// 문자는 더 이상 여기로 오지 않는다. 예전에는 네이티브 SmsReceiver가 원본을 그대로 여기로
// 넘기고 여기서 파싱/등록까지 했었는데, 그러면 웹뷰(이 페이지)가 떠 있을 때만 동작해서 앱이
// 완전히 꺼져 있으면 입금이 실시간으로 반영되지 않았다. 지금은 DepositAutoDetector(네이티브,
// Java)가 웹뷰 생존 여부와 무관하게 직접 파싱/등록까지 끝내고, 그 결과만
// window.onNativeDetectionLogged로 화면에 보여준다(아래) - 실제로 충전을 등록하는 경우뿐
// 아니라 필터/정규식 때문에 조용히 무시되는 경우까지 전부 logSmsEvent로 남겨야 "문자는 왔는데
// 처리가 안 됐다"를 화면에서 진단할 수 있다는 원칙은 그대로다.
window.onSmsReceived = function (sender, body) {
  // 필터를 인증 여부보다 먼저 본다 - 어차피 감지 대상이 아닌 문자까지 "인증 전 무시"로 로그에
  // 남기면, 정작 놓치면 안 되는(감지 대상인데 인증이 안 돼서 놓친) 건과 섞여 로그에서 원인을
  // 찾기 어려워진다. 감지 대상이 아닌 건 무조건 조용히 무시(로그도 안 남김), 감지 대상인데
  // 인증 전이라 못 넘긴 경우만 auth_skip으로 남긴다.
  const filterSender = (localStorage.getItem(SMS_DETECT_SENDER_KEY) ?? SMS_DETECT_SENDER_DEFAULT).trim();
  if (filterSender && !(sender || "").includes(filterSender)) return;

  if (!isAdminAuthenticated) {
    logSmsEvent({ source: "SMS", sender, body, outcome: "auth_skip", detail: "관리자 인증 전이라 무시됨" });
    return;
  }

  processDepositDetection("SMS", body, { sender });
};

// 푸시 알림 수신 시뮬레이션(triggerSimulatedNotification) 전용 진입점 - 위 onSmsReceived와
// 동일한 이유로 실제 기기 알림은 더 이상 여기로 오지 않는다(DepositAutoDetector가 직접 처리).
window.onNotificationReceived = function (packageName, title, text) {
  // 패키지/제목 필터를 인증 여부보다 먼저 본다 - "알림 접근"은 기기에 뜨는 모든 알림을 다
  // 넘기므로(카카오톡/날씨/배터리 알림 등), 감지 대상도 아닌 걸 인증 여부부터 확인해서
  // "인증 전 무시"로 로그에 남기면 그 무관한 알림들로 로그가 뒤덮여 정작 봐야 할 입금 알림
  // 로그를 찾기 어려워진다. 감지 대상이 아니면 로그도 안 남기고 무조건 조용히 무시하고,
  // 감지 대상인데 인증 전이라 못 넘긴 경우만 auth_skip으로 남긴다.
  // 부분 일치(includes)로 걸러내면 예를 들어 제목을 "NH농협2"로 걸어둔 앱이 필터 "NH농협"에
  // 잘못 걸려 통과해버릴 수 있어(실제로 확인된 문제) 정확히 일치할 때만 통과시킨다.
  const filterPackage = (localStorage.getItem(SMS_DETECT_PUSH_PACKAGE_KEY) ?? SMS_DETECT_PUSH_PACKAGE_DEFAULT).trim();
  if (filterPackage && packageName !== filterPackage) return;

  const filterTitle = (localStorage.getItem(SMS_DETECT_PUSH_TITLE_KEY) ?? SMS_DETECT_PUSH_TITLE_DEFAULT).trim();
  if (filterTitle && title !== filterTitle) return;

  const body = title ? `${title}\n${text}` : text;

  if (!isAdminAuthenticated) {
    logSmsEvent({ source: "PUSH", packageName, body, outcome: "auth_skip", detail: "관리자 인증 전이라 무시됨" });
    return;
  }

  processDepositDetection("PUSH", body, { packageName });
};

// DepositAutoDetector(네이티브)가 문자/알림을 직접 처리(등록/필터링/실패 등)한 뒤 그 결과를
// 알려주는 콜백 - 앱이 완전히 꺼져 있는 동안 처리된 것도 다음에 앱을 열면(대기열 drain) 여기로
// 한꺼번에 들어온다. 실제 백엔드 등록은 네이티브에서 이미 끝난 뒤이므로, 여기서는 로그에
// 표시만 하고 processDepositDetection처럼 다시 등록을 시도하면 안 된다(중복 등록됨).
window.onNativeDetectionLogged = function (entryJson) {
  let entry;
  try {
    entry = JSON.parse(entryJson);
  } catch (e) {
    console.error("네이티브 감지 로그 파싱 실패:", e);
    return;
  }

  logSmsEvent(entry);

  if (entry.outcome === "success") {
    showToast(`✅ ${entry.detail || "입금이 자동 등록되었습니다."}`);
    loadAdminUsers();
    loadDepositHistories();
    loadBankTransactions();
    loadStatsSummary();
  }
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
  const birthDate = document.getElementById("reg-birth-date").value;
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
          birth_date: birthDate || null,
          initial_credit: credit
        })
      });

      if (res.ok) {
        const newUser = await res.json();
        closeProxyRegisterModal();
        document.getElementById("reg-name").value = "";
        document.getElementById("reg-phone").value = "";
        document.getElementById("reg-birth-date").value = "";
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
  document.getElementById("edit-user-type").value = user.user_type === "SENIOR" ? "SENIOR" : "GENERAL";
  document.getElementById("edit-user-birth-date").value = user.birth_date || "";
  document.getElementById("edit-user-password").value = "";
  renderEditModalStatusButton(user);

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
  const userType = document.getElementById("edit-user-type").value;
  const birthDate = document.getElementById("edit-user-birth-date").value; // "" -> 지움
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
          user_type: userType,
          birth_date: birthDate || null,
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
// 등록된 키오스크 중 하나를 골라 노출 메뉴 배정·메뉴별 매출만 다룬다(메뉴는 키오스크마다
// 다르게 노출될 수 있어 전역 메뉴 편집 화면을 여기 두지 않는다). 단말기가 늘어도 화면이
// 한없이 길어지지 않도록 제목 옆 선택기로 한 번에 하나만 펼쳐서 보여준다.

let kiosks = [];
let selectedKioskId = null;
let kioskSelectorOpen = false;
let kioskSalesPeriod = "today";
let kioskSalesPeriodOpen = false;

async function loadKiosks() {
  try {
    const res = await adminFetch(`${API_BASE}/admin/kiosks`);
    if (!res.ok) return;
    kiosks = await res.json();
    // 선택된 키오스크가 없거나(최초 진입) 지워졌다면 "선택하세요" 상태 대신 맨 위 키오스크를
    // 기본으로 선택해 둔다.
    if (!kiosks.some(k => k.id === selectedKioskId)) {
      selectedKioskId = kiosks.length > 0 ? kiosks[0].id : null;
    }
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
      <td>${escapeHtml(r.product_name)}</td>
      <td>${r.quantity.toLocaleString()}개</td>
      <td style="color: var(--accent-emerald); font-weight: bold;">${r.amount.toLocaleString()}원</td>
    </tr>
  `).join('');
}

const KIOSK_SALES_PERIODS = ["today", "this_week", "this_month", "all_time"];
const KIOSK_SALES_PERIOD_LABEL = { today: "오늘", this_week: "이번주", this_month: "이번달", all_time: "전체" };

// 키오스크 선택기와 같은 패턴 - 버튼을 누르면 바로 아래에 드롭다운으로 목록이 펼쳐진다.
function toggleKioskSalesPeriodSelector() {
  kioskSalesPeriodOpen = !kioskSalesPeriodOpen;
  renderKioskSalesPeriodSelector();
}

function selectKioskSalesPeriod(period) {
  kioskSalesPeriod = period;
  kioskSalesPeriodOpen = false;
  renderKioskSalesPeriodSelector();
  const k = kiosks.find(x => x.id === selectedKioskId);
  const tbody = document.querySelector(".kiosk-sales-table tbody");
  if (k && tbody) tbody.innerHTML = renderKioskSalesRows(k.sales[period]);
}

// 화면 아래쪽에서 열면 목록이 하단 탭바에 가려질 수 있어, 펼친 뒤 실제 위치를 재보고
// 안 맞으면 위로 펼치도록(drop-up) 뒤집는다 (키오스크 선택기와 매출 기간 선택기 공용).
function fitDropdownVertically(list) {
  list.classList.remove("drop-up");
  const rect = list.getBoundingClientRect();
  const tabbar = document.querySelector(".admin-tabbar");
  const bottomLimit = window.innerHeight - (tabbar ? tabbar.getBoundingClientRect().height : 0);
  if (rect.bottom > bottomLimit) list.classList.add("drop-up");
}

function renderKioskSalesPeriodSelector() {
  const label = document.getElementById("kiosk-sales-period-label");
  const arrow = document.getElementById("kiosk-sales-period-arrow");
  const list = document.getElementById("kiosk-sales-period-list");
  if (!label || !list) return;

  label.innerText = KIOSK_SALES_PERIOD_LABEL[kioskSalesPeriod];
  if (arrow) arrow.style.transform = kioskSalesPeriodOpen ? "rotate(180deg)" : "rotate(0deg)";

  list.style.display = kioskSalesPeriodOpen ? "flex" : "none";
  if (!kioskSalesPeriodOpen) return;

  list.innerHTML = KIOSK_SALES_PERIODS.map(period => `
    <button type="button" class="kiosk-selector-item-main ${period === kioskSalesPeriod ? 'active' : ''}" onclick="selectKioskSalesPeriod('${period}')">
      <span class="kiosk-selector-item-name">${KIOSK_SALES_PERIOD_LABEL[period]}</span>
    </button>
  `).join('');
  fitDropdownVertically(list);
}

// ---------- 상단 선택기: "키오스크를 선택하세요" 옆 화살표를 누르면 목록이 펼쳐진다 ----------
function toggleKioskSelector() {
  kioskSelectorOpen = !kioskSelectorOpen;
  renderKioskSelector();
}

function selectKiosk(id) {
  selectedKioskId = id;
  kioskSelectorOpen = false;
  kioskSalesPeriod = "today";
  kioskSalesPeriodOpen = false;
  renderKioskSelector();
  renderKioskDetail();
}

function renderKioskSelector() {
  const label = document.getElementById("kiosk-selector-label");
  const arrow = document.getElementById("kiosk-selector-arrow");
  const list = document.getElementById("kiosk-selector-list");
  if (!label || !list) return;

  const selected = kiosks.find(k => k.id === selectedKioskId);
  label.innerText = selected ? (selected.device_name || "이름 없는 단말기") : "등록된 키오스크가 없습니다";
  if (arrow) arrow.style.transform = kioskSelectorOpen ? "rotate(180deg)" : "rotate(0deg)";

  list.style.display = kioskSelectorOpen ? "flex" : "none";
  if (!kioskSelectorOpen) return;

  // 목록에는 이름만 보여준다 - UUID와 삭제 버튼은 상세 정보 쪽으로 옮겼다.
  list.innerHTML = kiosks.length === 0
    ? `<div class="kiosk-selector-empty">단말기에서 접속하면 자동으로 등록됩니다.</div>`
    : kiosks.map(k => `
      <button type="button" class="kiosk-selector-item-main ${k.id === selectedKioskId ? 'active' : ''}" onclick="selectKiosk(${k.id})">
        <span class="kiosk-selector-item-name">${escapeHtml(k.device_name || '이름 없는 단말기')}</span>
      </button>
    `).join('');
  fitDropdownVertically(list);
}

function renderKioskList() {
  renderKioskSelector();
  renderKioskDetail();
}

function renderKioskDetail() {
  const wrap = document.getElementById("admin-kiosk-detail");
  if (!wrap) return;

  const k = kiosks.find(x => x.id === selectedKioskId);
  if (!k) {
    wrap.innerHTML = "";
    return;
  }

  wrap.innerHTML = `
    <div class="glass-container" style="padding: 1.5rem; margin-bottom: 1.2rem;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; gap: 0.5rem;">
        <label class="form-label" style="margin-bottom: 0;">키오스크 이름</label>
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span id="kiosk-detail-save-status" style="font-size: 0.78rem; font-weight: bold; opacity: 0; transition: opacity 0.3s;"></span>
          <button type="button" class="btn-action" style="width: 32px; height: 32px; min-height: 32px; padding: 0; flex: none; background: rgba(239,68,68,0.15); color: var(--icon-danger, #fca5a5);" onclick="confirmDeleteKiosk(${k.id})" title="키오스크 삭제">
            <span data-icon="trash"></span>
          </button>
        </div>
      </div>
      <input type="text" class="form-control kiosk-name-input" value="${escapeHtml(k.device_name || '')}" style="margin-bottom: 0.8rem;"
        onblur="autoSaveKiosk(${k.id})" onkeyup="if(event.key==='Enter') this.blur();">

      <label class="form-label">키오스크 ID</label>
      <div class="kiosk-detail-uuid" style="margin-bottom: 1rem;">${escapeHtml(k.device_uuid)}</div>

      <label class="form-label">메뉴</label>
      <div class="kiosk-menu-assign-grid">
        ${products.length === 0 ? `<span style="font-size: 0.8rem; color: var(--text-muted);">등록된 메뉴가 없습니다.</span>` : products.map(p => `
          <div class="menu-card ${k.assigned_products.includes(p.id) ? 'assigned' : ''}" data-product-id="${p.id}" onclick="toggleKioskProduct(${k.id}, ${p.id})">
            <span class="menu-toggle-badge">${icon('check')}</span>
            <div>
              <div class="menu-name">${escapeHtml(p.name)}</div>
              <div class="menu-price">일반 ${p.price_general.toLocaleString()}원</div>
              <div class="menu-price-senior">시니어 ${p.price_senior.toLocaleString()}원</div>
            </div>
          </div>
        `).join('')}
      </div>

      <label class="form-label" style="display: block; margin-top: 1rem;">기본 결제 메뉴</label>
      <select class="form-control kiosk-default-product-select" style="margin-bottom: 0;" onchange="autoSaveKiosk(${k.id})">
        <option value="">-- 기본 결제 없음 --</option>
        ${products.map(p => `<option value="${p.id}" ${k.default_product_id === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
      </select>
    </div>

    <div class="glass-container" style="padding: 1.5rem; overflow: visible;">
      <div class="admin-page-title-row kiosk-title-row" style="margin-bottom: 0.8rem;">
        <span style="font-size: 0.85rem; color: var(--text-muted);">메뉴별 매출</span>
        <button type="button" class="kiosk-selector-btn" onclick="toggleKioskSalesPeriodSelector()">
          <span id="kiosk-sales-period-label">${KIOSK_SALES_PERIOD_LABEL[kioskSalesPeriod]}</span>
          <span id="kiosk-sales-period-arrow" class="kiosk-selector-arrow-icon" data-icon="chevron-down"></span>
        </button>
        <div id="kiosk-sales-period-list" class="kiosk-sales-period-list"></div>
      </div>
      <div style="overflow-x: auto;">
        <table class="table-custom kiosk-sales-table">
          <thead><tr><th>메뉴</th><th>판매 수량</th><th>매출</th></tr></thead>
          <tbody>${renderKioskSalesRows(k.sales[kioskSalesPeriod])}</tbody>
        </table>
      </div>
    </div>
  `;
  hydrateIconPlaceholders(wrap);
}

// 메뉴 카드를 누르면 체크박스+저장 버튼 없이 즉시 배정 상태를 뒤집고(activate/deactivate
// 토글 느낌) 바로 저장한다.
function toggleKioskProduct(kioskId, productId) {
  const k = kiosks.find(x => x.id === kioskId);
  if (!k) return;
  const idx = k.assigned_products.indexOf(productId);
  if (idx >= 0) k.assigned_products.splice(idx, 1);
  else k.assigned_products.push(productId);

  const card = document.querySelector(`.kiosk-menu-assign-grid [data-product-id="${productId}"]`);
  if (card) card.classList.toggle("assigned", k.assigned_products.includes(productId));

  autoSaveKiosk(kioskId);
}

// 저장 버튼 없이 이름 입력창에서 포커스가 빠지거나 / 메뉴를 토글하거나 / 기본 결제 메뉴를
// 바꾸면 즉시 자동 저장한다.
async function autoSaveKiosk(kioskId) {
  const wrap = document.getElementById("admin-kiosk-detail");
  const k = kiosks.find(x => x.id === kioskId);
  if (!wrap || !k) return;

  const nameInput = wrap.querySelector(".kiosk-name-input");
  const deviceName = nameInput ? nameInput.value.trim() : k.device_name;
  const defaultProductSelect = wrap.querySelector(".kiosk-default-product-select");
  const defaultProductVal = defaultProductSelect ? defaultProductSelect.value : "";

  try {
    const res = await adminFetch(`${API_BASE}/admin/kiosks/${kioskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_name: deviceName || null,
        assigned_products: k.assigned_products,
        default_product_id: defaultProductVal ? parseInt(defaultProductVal) : null,
      })
    });
    if (res.ok) {
      k.device_name = deviceName;
      k.default_product_id = defaultProductVal ? parseInt(defaultProductVal) : null;
      flashKioskSaveStatus(true);
      renderKioskSelector();
    } else {
      flashKioskSaveStatus(false);
    }
  } catch (err) {
    console.error("autoSaveKiosk error:", err);
    flashKioskSaveStatus(false);
  }
}

// 저장 버튼이 없는 대신 "키오스크 이름" 라벨 옆에 잠깐 뜨는 저장 결과 표시
// (kiosk.js의 flashDeviceSaveStatus와 동일한 패턴).
function flashKioskSaveStatus(success) {
  const el = document.getElementById("kiosk-detail-save-status");
  if (!el) return;
  el.innerText = success ? "저장됨" : "저장 실패";
  el.style.color = success ? "var(--accent-emerald)" : "var(--accent-danger)";
  el.style.opacity = "1";
  clearTimeout(window._kioskSaveStatusTimer);
  window._kioskSaveStatusTimer = setTimeout(() => { el.style.opacity = "0"; }, 1600);
}

async function confirmDeleteKiosk(id) {
  const k = kiosks.find(x => x.id === id);
  if (!k) return;
  if (!(await showConfirmModal(`"${k.device_name || '이름 없는 단말기'}" 키오스크를 삭제하시겠습니까?\n메뉴 배정 등 설정이 모두 사라지며 되돌릴 수 없습니다. (지난 결제 이력은 남습니다)`))) return;

  try {
    const res = await adminFetch(`${API_BASE}/admin/kiosks/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("키오스크를 삭제했습니다.");
      if (selectedKioskId === id) selectedKioskId = null;
      loadKiosks();
    } else {
      const data = await res.json().catch(() => ({}));
      await showAlertModal(`삭제 실패: ${data.detail || '오류 발생'}`);
    }
  } catch (err) {
    console.error("confirmDeleteKiosk error:", err);
  }
}
