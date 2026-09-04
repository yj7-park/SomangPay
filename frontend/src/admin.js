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
  "arrow-left": '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  backspace: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9l-7-8Z"/><path d="M14.5 9.5l4 5M18.5 9.5l-4 5"/></svg>',
  trash: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M10 11v6M14 11v6"/></svg>',
  x: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  plus: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>',
  copy: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  alert: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.7 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  // "개발자 메뉴" 헤더 - 예전엔 🔔(벨) 아이콘이라 은유가 안 맞았다(#settings-redesign, 리뷰 지적).
  wrench: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94Z"/></svg>',
  // 앱 다운로드 리스트 행 우측 화살표(#settings-redesign) - 풀폭 pill 버튼 3개 대신.
  download: '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg>',
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

// 설정 탭 "앱 다운로드" 행의 버전/용량 텍스트(#settings-redesign, 리뷰 지적: "풀폭 pill 3개
// → 플랫폼 · 버전 · 용량 리스트") - href/download 속성 자체는 release-apk.yml이 릴리스마다
// sed로 직접 덮어쓰는 값이라 여기서 건드리지 않고, download="SomangPayKiosk-1.0.40.apk"
// 형태에서 버전만 정규식으로 뽑아 쓴다. 용량은 정적 파일 HEAD 요청의 Content-Length로
// 구한다 - 실패해도(오프라인 등) 버전 텍스트는 남는다.
async function hydrateApkDownloadMeta() {
  const rows = document.querySelectorAll(".settings-dl-row");
  for (const row of rows) {
    const metaEl = row.querySelector(".settings-dl-meta");
    if (!metaEl) continue;
    const m = /-(.+)\.apk$/.exec(row.getAttribute("download") || "");
    const version = m ? m[1] : null;
    metaEl.textContent = version ? `버전 ${version}` : "";
    try {
      const res = await fetch(row.getAttribute("href"), { method: "HEAD", cache: "no-store" });
      const len = res.headers.get("Content-Length");
      if (len) {
        const mb = (parseInt(len, 10) / (1024 * 1024)).toFixed(1);
        metaEl.textContent = version ? `버전 ${version} · ${mb}MB` : `${mb}MB`;
      }
    } catch (err) {
      // 오프라인 등 - 버전만 표시된 채로 둔다
    }
  }
}

// 설정 "앱 정보" 카드의 "웹 버전" 행(admin.html) - 네이티브 APK 버전(update-widget-root,
// 네이티브 브리지 있을 때만 채워짐)과 별개로, 지금 이 화면이 실제로 받아서 실행 중인 코드가
// 몇 버전인지 확인할 방법이 필요하다는 요청으로 추가했다(kiosk.js hydrateKioskWebVersionText와
// 동일). 새 배포마다 올리는 캐시버스팅 쿼리(<script src="src/admin.js?v=YYYYMMDD_HHMM">)를
// 그대로 읽어서 보여준다.
function hydrateAdminWebVersionText() {
  const el = document.getElementById("admin-web-version-text");
  if (!el) return;
  const scriptEl = document.querySelector('script[src*="admin.js"]');
  const m = scriptEl && /[?&]v=([^&]+)/.exec(scriptEl.src);
  el.textContent = m ? m[1] : "-";
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
    disconnectAdminWebSocket();
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
  hydrateAdminWebVersionText();
  updateFixedViewLayoutMetrics(); // PIN 인증 전에도 --header-h/뷰 높이를 미리 맞춰 둔다
  initAdminTheme();
  initAdminPinKeypad();

  // APK 다운로드 링크는 웹 브라우저에서만 의미가 있다 - 이미 설치된 네이티브 앱
  // 안(AndroidInterface 있음)에서는 굳이 보여줄 필요가 없어 숨긴다.
  if (window.AndroidInterface) {
    const downloadSection = document.getElementById("app-download-links");
    if (downloadSection) downloadSection.style.display = "none";

    // 앱 안에서만: 처음 설치해서 PIN 모달을 처음 보는 순간부터 "로그인 = 실시간 자동감지 켜짐"
    // 이라는 걸 안내한다 - 웹 브라우저 세션에서는 백그라운드 자동감지 자체가 의미 없어 숨긴다.
    const detectNotice = document.getElementById("admin-pin-detect-notice");
    if (detectNotice) detectNotice.style.display = "block";
  } else {
    hydrateApkDownloadMeta();
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
    checkNativeNotificationDeepLink();
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
  // 홈 화면에 설치된 PWA(WebAPK)에서는 실제 상태바 배경색이 설치 시점 매니페스트의
  // theme_color(검정)로 고정돼 이후 여기서 밝은 값을 줘도 안 바뀌는데, OS는 이 메타
  // 태그 값만 보고 아이콘 밝기(시계/배터리)를 어둡게 골라버려 검정 배경 위 검정
  // 아이콘이 되어 완전히 안 보이는 버그가 생긴다(wifi adb로 실기기 재현/검증 완료).
  // 일반 브라우저 탭(주소창 틴트)에서는 실제로 밝은 배경이 되므로 거기서만 라이트
  // 테마를 따라간다.
  const isStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  if (isStandalone) {
    meta.setAttribute("content", "#000000");
    return;
  }
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
    btn.classList.toggle("is-on", pref === activePref);
  });
}

// ============ 푸시 알림 구독 (항목별 on/off) ============
// user.js의 푸시 구독 로직과 거의 같지만, 관리자는 3가지 카테고리를 개별로 켜고 끌 수 있다
// (app/services/push.py의 ADMIN_CATEGORY_COLUMNS와 이름을 맞춤).
const ADMIN_PUSH_CATEGORIES = ["deposit_error", "deposit_credited", "payment"];

function adminPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

// 네이티브 앱(AndroidInterface 있음)이나 홈 화면에 설치된 PWA(display-mode: standalone)에서만
// true. 일반 브라우저 탭은 설치된 PWA와 완전히 같은 origin+scope의 서비스워커/푸시 구독을
// 공유해서, 한쪽에서 알림을 켜고 끄면 다른 쪽 구독까지 같이 흔들리는 충돌이 있었다 - 그래서
// 일반 브라우저 탭에서는 푸시 알림 UI 자체를 숨겨 애초에 두 곳에서 켤 수 없게 한다.
function isInstalledAdminAppContext() {
  if (window.AndroidInterface) return true;
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.navigator.standalone === true) return true; // iOS Safari 홈 화면 추가
  return false;
}

// user.js의 USER_PUSH_ENABLED_KEY와 동일한 목적 - "켜짐" 의도를 저장해두고, 로그인/화면복귀
// 시마다 ensureAdminPushSubscriptionFresh()가 조용히 재구독을 시도해 만료를 스스로 복구한다.
const ADMIN_PUSH_ENABLED_KEY = "admin_push_enabled";

function urlBase64ToUint8ArrayAdmin(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// 알림 항목 3개(#a-push-cat-*)는 원래 <input type="checkbox">였는데(#settings-redesign,
// 리뷰 지적: "이모지 푸시 버튼 + 맨 체크박스 3개 → 스위치 행 그룹") USER 프로필 push
// 토글과 같은 .switch-toggle 버튼으로 통일했다 - .checked 대신 "is-on" 클래스로 켜짐/꺼짐을
// 표시한다.
function readAdminPushCategoryCheckboxes() {
  const result = {};
  ADMIN_PUSH_CATEGORIES.forEach((cat) => {
    const el = document.getElementById(`a-push-cat-${cat}`);
    result[`notify_${cat}`] = el ? el.classList.contains("is-on") : true;
  });
  return result;
}

function setAdminPushCategoryCheckboxesEnabled(enabled) {
  const wrap = document.getElementById("a-push-categories");
  if (wrap) wrap.style.opacity = enabled ? "1" : "0.5";
  ADMIN_PUSH_CATEGORIES.forEach((cat) => {
    const el = document.getElementById(`a-push-cat-${cat}`);
    if (el) el.disabled = !enabled;
  });
}

// 버튼은 HTML에 항상 is-on으로 박혀 있어서, 서버에 저장된 실제 값으로 동기화해주지
// 않으면 새로고침할 때마다 이전에 꺼둔 항목이 다시 켜진 것처럼 보인다.
function writeAdminPushCategoryCheckboxes(categories) {
  ADMIN_PUSH_CATEGORIES.forEach((cat) => {
    const el = document.getElementById(`a-push-cat-${cat}`);
    const value = categories[`notify_${cat}`];
    if (el && value !== undefined) {
      el.classList.toggle("is-on", !!value);
      el.setAttribute("aria-checked", value ? "true" : "false");
    }
  });
}

// 알림 항목 스위치 하나를 탭했을 때 - 즉시 시각 상태를 뒤집고 전체 상태를 저장한다
// (updateAdminPushCategories가 readAdminPushCategoryCheckboxes로 현재 3개 상태를 전부 다시
// 읽어 PUT하므로 여기선 클래스만 뒤집으면 된다).
function toggleAdminPushCategory(cat) {
  const el = document.getElementById(`a-push-cat-${cat}`);
  if (!el || el.disabled) return;
  const next = !el.classList.contains("is-on");
  el.classList.toggle("is-on", next);
  el.setAttribute("aria-checked", next ? "true" : "false");
  updateAdminPushCategories();
}

async function getCurrentAdminPushSubscription() {
  if (!adminPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function refreshAdminPushButtonUI() {
  const section = document.getElementById("a-push-section");
  const groupLabel = document.getElementById("a-push-group-label"); // 설정 그룹 캡션(#redesign) - 카드와 함께 숨김
  if (!isInstalledAdminAppContext()) {
    if (section) section.style.display = "none";
    if (groupLabel) groupLabel.style.display = "none";
    return;
  }
  if (section) section.style.display = "";
  if (groupLabel) groupLabel.style.display = "";

  // user.js의 refreshPushButtonUI()와 동일 - 화면을 열 때마다 먼저 자가복구를 한 번 시도한다.
  // 구독이 이미 살아있으면 스로틀에 걸려 즉시 반환되어 비용이 없고, 새로고침/버전업 등으로
  // 끊겨 있었다면 여기서 바로 복구된다.
  await ensureAdminPushSubscriptionFresh();

  const btn = document.getElementById("a-push-toggle-btn");
  const status = document.getElementById("a-push-status");
  if (!btn) return;
  if (!adminPushSupported()) {
    btn.disabled = true;
    btn.classList.remove("is-on");
    btn.setAttribute("aria-checked", "false");
    if (status) status.innerText = "미지원 브라우저";
    setAdminPushCategoryCheckboxesEnabled(false);
    return;
  }
  const sub = await getCurrentAdminPushSubscription();
  btn.disabled = false;
  if (status) status.innerText = "";
  btn.classList.toggle("is-on", !!sub);
  btn.setAttribute("aria-checked", sub ? "true" : "false");
  setAdminPushCategoryCheckboxesEnabled(!!sub);
  if (sub) {
    try {
      const res = await adminFetch(`${API_BASE}/admin/push/subscribe/categories?endpoint=${encodeURIComponent(sub.endpoint)}`);
      if (res.ok) writeAdminPushCategoryCheckboxes(await res.json());
    } catch (err) {
      console.error("관리자 푸시 항목 설정 조회 오류:", err);
    }
  }
}

async function toggleAdminPushNotifications() {
  const btn = document.getElementById("a-push-toggle-btn");
  const status = document.getElementById("a-push-status");
  if (btn) btn.disabled = true;
  if (status) status.innerText = "처리 중…";
  try {
    const sub = await getCurrentAdminPushSubscription();
    if (sub) {
      await unsubscribeAdminPush(sub);
    } else {
      await subscribeAdminPush();
    }
  } catch (err) {
    console.error("관리자 푸시 알림 토글 오류:", err);
    await showAlertModal(`푸시 알림 처리 중 오류가 발생했습니다.\n(${err && err.message ? err.message : err})`);
  }
  refreshAdminPushButtonUI();
}

async function subscribeAdminPush() {
  if (!adminPushSupported()) {
    await showAlertModal("이 브라우저는 푸시 알림을 지원하지 않습니다.");
    return;
  }
  if (Notification.permission === "denied") {
    await showAlertModal("알림이 차단되어 있습니다. 브라우저 주소창 왼쪽 아이콘(사이트 설정)에서 알림 권한을 허용으로 바꾼 뒤 다시 시도해주세요.");
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      await showAlertModal("알림 권한이 허용되지 않았습니다. 다시 켜기를 눌러 권한을 허용해주세요.");
      return;
    }
    const keyRes = await fetch(`${API_BASE}/push/vapid-public-key`);
    if (!keyRes.ok) throw new Error(`vapid-public-key ${keyRes.status}`);
    const { publicKey } = await keyRes.json();
    if (!publicKey) throw new Error("서버에 VAPID 공개키가 설정되어 있지 않습니다.");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8ArrayAdmin(publicKey),
    });
    const subJson = sub.toJSON();
    const res = await adminFetch(`${API_BASE}/admin/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign(
        { endpoint: subJson.endpoint, keys: subJson.keys },
        readAdminPushCategoryCheckboxes(),
      )),
    });
    if (!res.ok) throw new Error(`admin/push/subscribe ${res.status}`);
    localStorage.setItem(ADMIN_PUSH_ENABLED_KEY, "true");
  } catch (err) {
    console.error("관리자 푸시 구독 오류:", err);
    await showAlertModal(`푸시 알림 등록에 실패했습니다.\n(${err && err.message ? err.message : err})`);
  }
}

// getSubscription()이 뭔가를 돌려준다고 해서 실제로 유효한 건 아니다(user.js의
// ensurePushSubscriptionFresh() 설명 참고) - 먼저 해지한 뒤 다시 구독해 강제로 새 유효한
// 구독을 받아온다. 항목별 on/off는 여기서 같이 보내지 않는다 - 서버가 None(미전송)을
// "기존 값 유지"로 처리하므로, 체크박스 DOM 상태가 아직 서버 값과 동기화되기 전이라도
// 저장된 설정이 실수로 기본값(전체 on)으로 덮어써지지 않는다.
const ADMIN_PUSH_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6시간
const ADMIN_PUSH_LAST_REFRESH_KEY = "admin_push_last_refresh_at";

// user.js의 _userPushRefreshInFlight와 동일한 이유 - initAdminDashboard와 adminRealtime의
// onResume이 첫 로드 시 거의 동시에 발화해서 이 함수가 중복 호출되면 해지→재구독이 서로
// 경쟁하게 된다. 실제 production에서 이것 때문에 짧게는 몇 초, 운 나쁘면 그보다 길게
// 관리자 구독이 통째로 사라지는 게 로그로 확인됨(POST/DELETE가 연달아 여러 번 찍히고
// 마지막이 DELETE로 끝나버림) - 그 사이 결제 알림이 와도 보낼 대상 자체가 없어서 조용히
// 유실됐던 것. 진행 중인 실행이 있으면 그 결과를 그대로 기다리게 해서 항상 한 번에 하나만.
let _adminPushRefreshInFlight = null;

// 로그인 직후/화면 복귀(resume) 시마다 호출.
function ensureAdminPushSubscriptionFresh() {
  if (!_adminPushRefreshInFlight) {
    _adminPushRefreshInFlight = _doEnsureAdminPushSubscriptionFresh().finally(() => {
      _adminPushRefreshInFlight = null;
    });
  }
  return _adminPushRefreshInFlight;
}

async function _doEnsureAdminPushSubscriptionFresh() {
  if (!isInstalledAdminAppContext() || !adminPushSupported()) return;
  if (Notification.permission !== "granted") return;
  const existingSub = await getCurrentAdminPushSubscription();
  if (localStorage.getItem(ADMIN_PUSH_ENABLED_KEY) !== "true" && !existingSub) return;

  // user.js의 _doEnsurePushSubscriptionFresh()와 동일 - 스로틀은 이미 살아있는 구독을 너무
  // 자주 갈아치우지 않기 위함이지, 구독이 아예 없는 상태를 6시간 동안 방치하라는 뜻이 아니다.
  const lastRefresh = Number(localStorage.getItem(ADMIN_PUSH_LAST_REFRESH_KEY) || 0);
  if (existingSub && Date.now() - lastRefresh < ADMIN_PUSH_REFRESH_INTERVAL_MS) return;

  try {
    const oldEndpoint = existingSub ? existingSub.endpoint : null;
    if (existingSub) await existingSub.unsubscribe();
    const keyRes = await fetch(`${API_BASE}/push/vapid-public-key`);
    if (!keyRes.ok) return;
    const { publicKey } = await keyRes.json();
    if (!publicKey) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8ArrayAdmin(publicKey),
    });
    const subJson = sub.toJSON();
    await adminFetch(`${API_BASE}/admin/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
    });
    if (oldEndpoint && oldEndpoint !== subJson.endpoint) {
      adminFetch(`${API_BASE}/admin/push/subscribe`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: oldEndpoint }),
      }).catch(() => {});
    }
    localStorage.setItem(ADMIN_PUSH_ENABLED_KEY, "true");
    localStorage.setItem(ADMIN_PUSH_LAST_REFRESH_KEY, String(Date.now()));
  } catch (err) {
    console.error("관리자 푸시 구독 갱신 오류:", err);
  }
}

// user.js의 registerPeriodicPushRefresh()와 동일 - 지원 브라우저에서는 앱을 안 열어도
// sw.js의 periodicsync 핸들러가 주기적으로 구독을 갱신해준다. best-effort라 실패해도 무시.
async function registerAdminPeriodicPushRefresh() {
  if (!isInstalledAdminAppContext() || !adminPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!("periodicSync" in reg)) return;
    const status = await navigator.permissions.query({ name: "periodic-background-sync" });
    if (status.state !== "granted") return;
    await reg.periodicSync.register("push-subscription-refresh", {
      minInterval: 12 * 60 * 60 * 1000,
    });
  } catch (err) {
    console.error("Periodic Background Sync 등록 실패(미지원이거나 조건 미충족):", err);
  }
}

async function unsubscribeAdminPush(sub) {
  localStorage.removeItem(ADMIN_PUSH_ENABLED_KEY);
  try {
    await adminFetch(`${API_BASE}/admin/push/subscribe`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  } catch (err) {
    console.error("관리자 푸시 구독 해지 오류:", err);
  }
}

// 체크박스 하나 바꿀 때마다 - 아직 구독 전이면(체크박스가 비활성 상태라 사실 못 누르지만
// 방어적으로) 아무것도 안 하고, 구독 중이면 서버에 항목별 on/off만 갱신한다(재구독 불필요).
async function updateAdminPushCategories() {
  const sub = await getCurrentAdminPushSubscription();
  if (!sub) return;
  try {
    const res = await adminFetch(`${API_BASE}/admin/push/subscribe/categories`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ endpoint: sub.endpoint }, readAdminPushCategoryCheckboxes())),
    });
    if (!res.ok) throw new Error(`categories update ${res.status}`);
  } catch (err) {
    console.error("관리자 푸시 항목 설정 오류:", err);
    await showAlertModal("알림 항목 설정 저장에 실패했습니다.");
  }
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

// 관리자 알림(AdminAlertService의 네이티브 알림, 또는 PWA/브라우저 웹푸시)을 탭해 앱이 열렸을
// 때 처리 화면 정보를 가져와 해당 화면으로 이동한다. 세 경로 모두 여기로 모인다:
//  1) 네이티브 APK 콜드 스타트/이미 켜져 있던 경우 - AndroidInterface.consumePendingDeepLink()
//     (MainActivity.java 참고, 이미 켜져 있던 경우엔 네이티브가 직접 이 함수를 호출)
//  2) PWA/브라우저 콜드 스타트 - sw.js가 새 탭을 열 때 실어보낸 URL 쿼리스트링
//     (?category=&entity_id=, send_push_to_admins()가 붙인다)
// 로그인 완료 시점(자동 로그인/PIN 성공)에 1)+2)를 확인한다. 일반 브라우저에는 AndroidInterface가
// 없어 1)은 조용히 건너뛴다.
// 3) PWA에서 이미 열려있던 탭을 sw.js가 새로고침 없이 포커스만 한 경우는 아래
//    navigator.serviceWorker "message" 리스너가 별도로 처리한다(로그인 여부와 무관하게 그
//    시점에 이미 로그인돼 있어야 의미가 있으므로 리스너 안에서 다시 isAdminAuthenticated를 본다).
window.checkNativeNotificationDeepLink = function () {
  if (!isAdminAuthenticated) return;
  const link = consumeNativeDeepLink() || consumeUrlDeepLink();
  if (link) routeNotificationDeepLink(link.category, link.entityId);
};

function consumeNativeDeepLink() {
  if (!window.AndroidInterface || typeof window.AndroidInterface.consumePendingDeepLink !== "function") return null;
  let raw;
  try {
    raw = window.AndroidInterface.consumePendingDeepLink();
  } catch (err) {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return { category: parsed.category, entityId: parsed.entityId != null ? parsed.entityId : null };
  } catch (err) {
    return null;
  }
}

function consumeUrlDeepLink() {
  const params = new URLSearchParams(location.search);
  const category = params.get("category");
  if (!category) return null;
  const rawEntityId = params.get("entity_id");
  // 새로고침해도 같은 화면으로 계속 되돌아가지 않도록 쿼리스트링은 소비 즉시 지운다.
  history.replaceState(null, "", location.pathname);
  return { category, entityId: rawEntityId != null ? Number(rawEntityId) : null };
}

async function routeNotificationDeepLink(category, entityId) {
  if (category === "deposit_error" || category === "deposit_credited") {
    await loadBankTransactions();
    switchAdminView("inbox", category === "deposit_error" ? "ERROR" : "ALL");
    if (entityId != null) openDepositDetailModal(entityId);
  } else if (category === "payment" && entityId != null) {
    await loadAdminUsers();
    openMemberDetail(entityId);
  }
}

// PWA 탭이 이미 열려있어 sw.js의 notificationclick이 새로 열지 않고 포커스만 한 경우 -
// 쿼리스트링을 다시 읽을 새로고침이 없으므로 sw.js가 postMessage로 직접 전달해준다.
if (window.navigator && navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (!isAdminAuthenticated) return;
    if (event.data && event.data.type === "admin-notification-deeplink") {
      routeNotificationDeepLink(event.data.category, event.data.entityId);
    }
  });
}

// PIN 화면 숫자 키패드(#redesign) - 텍스트 입력칸(admin-pin-input)에 직접 쓰는 대신
// 탭으로 채울 수 있게 한다. 백엔드가 PIN 길이를 고정하지 않아(verify-pin이 문자열을 그대로
// 검증) 자동 제출 대신 입력칸과 똑같이 maxlength까지 채우고 "인증하기"로 넘긴다 - 물리
// 키보드로 입력칸에 직접 타이핑하는 것도 계속 그대로 동작한다(데스크톱 사이드바 레이아웃).
function initAdminPinKeypad() {
  const keypad = document.getElementById("admin-pin-keypad");
  if (!keypad) return;
  keypad.querySelectorAll(".pin-key[data-digit]").forEach(btn => {
    btn.addEventListener("click", () => appendAdminPinDigit(btn.dataset.digit));
  });
  document.getElementById("admin-pin-backspace")?.addEventListener("click", removeAdminPinDigit);
}

function appendAdminPinDigit(digit) {
  const input = document.getElementById("admin-pin-input");
  if (!input) return;
  const max = Number(input.getAttribute("maxlength")) || 8;
  if (input.value.length >= max) return;
  input.value += digit;
}

function removeAdminPinDigit() {
  const input = document.getElementById("admin-pin-input");
  if (!input) return;
  input.value = input.value.slice(0, -1);
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
      checkNativeNotificationDeepLink();
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
  loadAdminCards();
  loadBankTransactions();
  loadStatsSummary();
  loadSmsDetectSettings();
  loadKiosks();
  connectAdminWebSocket();
  setupActivityFeedInfiniteScroll();
  ensureAdminPushSubscriptionFresh();
  registerAdminPeriodicPushRefresh();
}

// ============ 실시간 갱신 (WebSocket) ============
// DB가 바뀌면(다른 관리자 세션, 회원의 충전 신청, 키오스크 결제 등) 서버가 "이 범위가
// 바뀌었다"는 신호만 보내고, 실제 반영은 이미 있는 REST 로드 함수를 그대로 재사용한다.
// 재연결/화면복귀(resume) 로직 자체는 src/ws-client.js에 공유돼 있고(user.js/kiosk.js와
// 동일), 여기서는 admin 전용 설정(URL/인증 상태/메시지 처리/강제 재조회)만 주입한다.
const adminRealtime = createRealtimeClient({
  buildUrl: () => {
    if (!adminToken) return null;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${location.host}/ws/admin?token=${encodeURIComponent(adminToken)}`;
  },
  shouldReconnect: () => isAdminAuthenticated, // 로그아웃/세션만료로 인한 정상 종료면 재연결 안 함
  onMessage: (data) => {
    if (data.type !== "refresh") return;
    handleAdminRefreshEvent(data.scopes || []).catch(err => console.error("Refresh event error:", err));
  },
  onResume: () => {
    handleAdminRefreshEvent(["users", "cards", "deposit_queue", "stats", "deposits"])
      .catch(err => console.error("Resume refresh error:", err));
    ensureAdminPushSubscriptionFresh();
  },
  // 실시간 연결 상태(#redesign) - 예전엔 상단 고정 바가 있었을 때만 보이던 정보였는데,
  // 지금은 탭바가 유일한 전 화면 공용 요소라 거기 점 하나로 옮겼다(updateAdminWsStatusDot).
  onStatusChange: (status) => updateAdminWsStatusDot(status),
});

function updateAdminWsStatusDot(status) {
  const dot = document.getElementById("admin-ws-status-dot");
  if (!dot) return;
  dot.className = `ws-status-dot ws-status-${status}`;
  dot.title = status === "open" ? "실시간 연결됨" : status === "connecting" ? "연결 중..." : "실시간 연결 끊김 - 재연결 시도 중";
}

function connectAdminWebSocket() { adminRealtime.connect(); }
function disconnectAdminWebSocket() { adminRealtime.disconnect(); }

async function handleAdminRefreshEvent(scopes) {
  const tasks = [];
  if (scopes.includes("users")) tasks.push(loadAdminUsers());
  if (scopes.includes("cards")) tasks.push(loadAdminCards());
  if (scopes.includes("deposit_queue")) tasks.push(loadBankTransactions());
  if (scopes.includes("stats")) { tasks.push(loadStatsSummary()); tasks.push(loadBankTransactions()); tasks.push(loadKiosks()); }
  await Promise.all(tasks);

  // 지금 열려 있는 회원 상세도 최신 데이터(users/cards/deposits)로 다시 그린다.
  if (currentDetailUserId && (scopes.includes("users") || scopes.includes("cards") || scopes.includes("deposits"))) {
    renderMemberDetail();
  }
}

// ============ 상단 고정 바 (#redesign) ============
// 뷰마다 제목/뒤로가기/우측 액션이 다르므로 정적 마크업 대신 switchAdminView가 뷰를 바꿀
// 때마다 여기서 다시 채운다. member-detail/kiosk-detail은 제목이 동적(회원 이름/키오스크
// 이름)이라 여기 없고 각각 renderMemberDetail()/renderKioskDetail()이 따로 채운다
// (#admin-header-title 직접 갱신).
const ADMIN_HEADER_CONFIG = {
  home: { title: "소망페이 관리자" },
  search: {
    title: "사용자 관리",
    actions: [
      { icon: "nfc", label: "NFC/QR 검색", onclick: "openScannerModal('SEARCH')" },
      { icon: "plus", label: "회원 등록", onclick: "openProxyRegisterModal()" },
    ],
  },
  inbox: { title: "충전함 관리" },
  kiosk: { title: "키오스크 관리" },
  settings: { title: "설정" },
  "member-detail": { back: true },
  "kiosk-detail": { back: true },
};

function updateAdminHeader(viewName) {
  const config = ADMIN_HEADER_CONFIG[viewName] || {};

  const titleEl = document.getElementById("admin-header-title");
  if (titleEl && config.title !== undefined) titleEl.innerText = config.title;

  const backBtn = document.getElementById("admin-header-back-btn");
  if (backBtn) backBtn.classList.toggle("is-visible", !!config.back);

  const actionsEl = document.getElementById("admin-header-actions");
  if (actionsEl) {
    actionsEl.innerHTML = (config.actions || []).map(a =>
      `<button type="button" class="admin-page-title-action" onclick="${a.onclick}" title="${a.label}" aria-label="${a.label}"><span data-icon="${a.icon}"></span></button>`
    ).join("");
    hydrateIconPlaceholders(actionsEl);
  }
}

// 뒤로가기 버튼(#admin-header-back-btn) 하나를 모든 상세 화면이 같이 쓰므로, 지금 열린
// 상세가 어느 목록으로 돌아가야 하는지는 이 핸들러로 넘긴다 - open*Detail()이 진입할 때
// 자기 close 함수로 갈아끼운다.
let currentBackHandler = closeMemberDetail;
function adminHeaderBack() {
  if (currentBackHandler) currentBackHandler();
}

// ============ 탭 내비게이션 (트위터 스타일) ============
let currentDetailUserId = null;
let detailReturnView = "search";

function switchAdminView(viewName, inboxFilter) {
  stopKioskListPolling(); // 키오스크 탭을 벗어나면 목록 폴링을 멈춘다 (아래에서 kiosk 탭이면 다시 켬)
  document.querySelectorAll(".admin-view").forEach(el => el.classList.remove("active"));
  const target = document.getElementById(`admin-view-${viewName}`);
  if (target) target.classList.add("active");
  updateAdminHeader(viewName);

  const tabViews = ["home", "search", "inbox", "kiosk", "settings"];
  if (tabViews.includes(viewName)) {
    document.querySelectorAll(".admin-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === viewName);
    });
    if (viewName === "search") { renderMemberFeed(); updateFixedViewLayoutMetrics(); }
    if (viewName === "kiosk") { renderKioskList(); loadKiosks(); startKioskListPolling(); }
    if (viewName === "settings") refreshAdminPushButtonUI();
    if (viewName === "inbox") {
      if (inboxFilter) inboxDepositFilter = inboxFilter;
      activityFeedLimit = ACTIVITY_PAGE_SIZE;
      renderInboxFilterSelector();
      renderInboxActivityFeed();
    }
  }
}

// 회원 관리 탭 전용: "헤더/하단 탭바를 제외한 나머지 공간"만 차지하고 그 안에서만 스크롤되는
// 레이아웃(style.css의 #admin-view-search.active)에 필요한 실제 렌더된 높이를 잰다. 뷰가
// display:none이면 getBoundingClientRect가 0을 주므로 활성 상태인 뷰만 계산한다.
//
// 충전함/키오스크 탭도 한때 같은 방식(전용 스크롤 박스 + 고정 높이)을 썼는데, 이 높이
// 계산이 탭 전환 시점의 스크롤 위치나 뷰포트 변화에 따라 미세하게 어긋나면 바깥 페이지
// 스크롤과 안쪽 목록 스크롤이 동시에 생기는 "2단 스크롤"이 됐다(#redesign3, 사용자 리포트).
// 회원 상세/키오스크 상세처럼 전용 스크롤 박스 없이 그냥 window(페이지 전체)가 스크롤되게
// 바꿔서 애초에 이중 스크롤 컨테이너가 생길 여지를 없앴다 - 아래 목록은 이제 이 함수가
// 다루지 않는다.
//
// 하단 여백은 탭바 높이를 따로 재지 않고 .admin-main의 padding-bottom을 그대로 쓴다 -
// 그 값 자체가 이미 "모바일은 하단 고정 탭바에 안 가리게 5.5rem, 데스크톱(>=900px)은
// 탭바가 왼쪽 사이드바로 바뀌어 1.5rem"로 튜닝되어 있어(style.css 참고), 탭바 높이를 따로
// 재서 빼면 이 padding-bottom과 이중으로 겹쳐 계산되어 실제로는 페이지가 그만큼 더 길어져
// 바깥 스크롤이 살짝 생기는 문제가 있었다(테스트 렌더로 확인).
const FIXED_HEIGHT_VIEWS = [
  { id: "admin-view-search", cssVar: "--search-view-h" },
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

        // 1초 동안 동일 혹은 연속 접촉으로 인한 중복 동작 방지
        setTimeout(() => {
          adminNfcCooldown = false;
        }, 1000);
      }
    });

    // 비NDEF/스마트폰 HCE 접촉 감지 리스너
    adminNdefReader.addEventListener("readingerror", () => {
      if (adminNfcCooldown) return;
      adminNfcCooldown = true;
      setTimeout(() => {
        adminNfcCooldown = false;
      }, 1000);

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
  setTimeout(() => { adminNfcCooldown = false; }, 1000);

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
  // REGISTER는 이제 NFC 카드 전용(QR은 자동 발급) - 카메라 QR 모드 토글은 회원 검색
  // 때만 의미가 있으므로 등록 모드에서는 숨긴다.
  const qrModeBtn = document.getElementById("admin-mode-qr-btn");
  if (qrModeBtn) qrModeBtn.style.display = mode === "SEARCH" ? "" : "none";

  if (mode === "SEARCH") {
    title.innerHTML = `${icon("card")} NFC/QR 태그로 회원 찾기`;
    desc.innerHTML = "회원의 <strong>NFC 카드를 태그</strong>하거나 <strong>QR 코드를 카메라에 비추면</strong> 해당 회원 상세 페이지로 바로 이동합니다.";
    confirmBtn.innerText = "검색하기";
    switchAdminScanMode("NFC");
  } else {
    title.innerHTML = `${icon("card")} NFC 카드 등록`;
    desc.innerHTML = `<strong>NFC 카드</strong>를 태그하면 이 회원에게 등록(또는 교체)됩니다.`;
    confirmBtn.innerText = "등록하기";
    switchAdminScanMode("NFC");
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

  // REGISTER 모드 (NFC 카드 전용 - QR은 회원가입 시 자동 발급되며 유출 시 "재발급" 버튼으로만 교체)
  const { userId } = scannerContext;
  try {
    const res = await adminFetch(`${API_BASE}/admin/cards`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_uid: cardUid, card_type: "NFC", user_id: userId })
    });

    if (res.ok) {
      closeScannerModal();
      await loadAdminCards();
      if (currentDetailUserId === userId) renderDetailCardSlots();
      await showAlertModal("🎉 NFC 카드가 등록(또는 교체)되었습니다.");
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
    renderSuspendedUserList();
  } catch (err) {
    console.error("Failed to load users:", err);
  }
}

// 전체 메뉴 카탈로그 - 키오스크 탭의 "노출 메뉴 배정" 체크리스트와 "메뉴 관리" 모달을
// 그리는 데 쓰인다. 메뉴 자체의 CRUD(추가/삭제)도 이 카탈로그를 대상으로 여기서 이뤄진다.
async function loadAdminProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    products = await res.json();
    renderKioskList();
  } catch (err) {
    console.error("Failed to load products:", err);
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

// 통계 숫자는 800 웨이트라 "5,400,000원"이 타일 폭을 넘으면 통째로 줄바꿈됐다 - 단위("원"/"명")를
// 작은 <small>로 떼어내고 CSS에서 nowrap/tabular-nums를 걸어 숫자 줄만 붙여 쓴다.
function statAmountHtml(value, unit = "원") {
  return `${Number(value).toLocaleString()}<small class="stat-unit">${unit}</small>`;
}

// 홈 탭 기간 통계(오늘/이번달) 토글(#redesign) - stats.today/stats.this_month는 이미 한 번의
// /admin/stats/summary 응답에 같이 오므로, 토글은 재조회 없이 캐시해둔 stats만 다시 그린다.
let _lastDashboardStats = null;
let homeStatsPeriod = "today";

function selectHomeStatsPeriod(period) {
  homeStatsPeriod = period;
  renderHomePeriodStats();
}

function renderHomePeriodStats() {
  document.getElementById("home-period-today-btn")?.classList.toggle("is-on", homeStatsPeriod === "today");
  document.getElementById("home-period-month-btn")?.classList.toggle("is-on", homeStatsPeriod === "this_month");
  if (!_lastDashboardStats) return;
  const period = _lastDashboardStats[homeStatsPeriod];
  document.getElementById("stat-period-deposit").innerHTML = statAmountHtml(period.deposit_amount);
  document.getElementById("stat-period-payment").innerHTML = statAmountHtml(period.payment_amount);
}

function renderDashboard(stats) {
  _lastDashboardStats = stats;
  document.getElementById("stat-total-balance").innerHTML = statAmountHtml(stats.total_balance);
  document.getElementById("stat-users-with-balance").innerHTML = statAmountHtml(stats.users_with_balance, "명");
  renderHomePeriodStats();

  // 처리 대기 배너 - 0건이면 조용히 숨긴다(#redesign). 대기/오류가 섞여 있으면 둘 다
  // 소계로 보여줘서 배너 하나만 봐도 어느 쪽이 몇 건인지 알 수 있게 한다.
  const pendingCount = stats.pending_deposit_count;
  const errorCount = stats.error_deposit_count;
  const totalCount = pendingCount + errorCount;
  const banner = document.getElementById("pending-action-banner");
  if (banner) {
    banner.style.display = totalCount > 0 ? "flex" : "none";
    if (totalCount > 0) {
      document.getElementById("pending-action-title").innerText = `처리 대기 ${totalCount}건`;
      const subParts = [];
      if (pendingCount > 0) subParts.push(`대기 ${pendingCount}건`);
      if (errorCount > 0) subParts.push(`오류 ${errorCount}건`);
      document.getElementById("pending-action-sub").innerText = subParts.join(" · ");
    }
  }

  const badgeCount = totalCount;
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

// 입력칸 오른쪽 X 버튼(#26) - 검색어를 지우고 목록/하이라이팅을 원래대로 되돌린다.
function clearMemberSearchInput() {
  const input = document.getElementById("member-search-input");
  if (!input) return;
  input.value = "";
  renderMemberFeed();
  input.focus();
}

// 정지 회원은 검색/목록에서 숨긴다(#28) - "개발자 메뉴" 안의 정지 유저 목록에서만 보인다.
function renderMemberFeed() {
  const feed = document.getElementById("search-member-feed");
  if (!feed) return;
  const query = (document.getElementById("member-search-input")?.value || "").trim().toLowerCase();
  document.getElementById("member-search-input-wrap")?.classList.toggle("has-value", !!query);

  const activeUsers = users.filter(u => u.status !== "SUSPENDED");
  const filtered = !query ? activeUsers : activeUsers.filter(u => {
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

// "개발자 메뉴" 안의 정지 유저 목록 - renderMemberFeed에서 숨긴 정지 회원을 여기서만 보여준다.
// 카드를 누르면 기존 회원 상세(openMemberDetail)로 그대로 진입해 재활성화/삭제를 할 수 있다.
function renderSuspendedUserList() {
  const list = document.getElementById("suspended-user-list");
  if (!list) return;
  const suspended = users.filter(u => u.status === "SUSPENDED");

  const countEl = document.getElementById("suspended-user-count");
  if (countEl) countEl.innerText = suspended.length ? `(${suspended.length}건)` : "";

  if (suspended.length === 0) {
    list.innerHTML = `<p style="text-align:center; color: var(--text-muted); padding: 1rem 0; font-size: 0.85rem;">정지된 회원이 없습니다.</p>`;
    return;
  }
  list.innerHTML = "";
  suspended.forEach(u => list.appendChild(renderMemberFeedCard(u)));
}

// 홈 "최근 처리 내역" - 계좌 입금(bankTransactions) 전체를 시간순으로 보여주는 실시간
// 피드. 카드를 누르면 openDepositDetailModal로 상세/처리 모달이 뜬다(카드 자체에는
// 이름/시각+상태/금액만 보여준다). 회원상세/키오스크상세처럼 전용 스크롤 박스 없이
// window(페이지 전체)가 스크롤되고, 바닥에 가까워지면 setupActivityFeedInfiniteScroll이
// 다음 페이지를 이어서 그린다(#redesign3 - 예전엔 .activity-feed-scroll 안에서만 스크롤하는
// 고정 높이 레이아웃이었는데, "2단 스크롤" 문제가 있어 다른 상세 뷰들과 같은 방식으로 통일).
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

// 충전함 제목 옆 필터 - 예전엔 키오스크 선택기와 같은 드롭다운(눌러야 펼쳐짐)이었는데(#26),
// 값이 3개뿐이라 펼치고 고르는 동작 자체가 불필요한 클릭이었다. 대기/오류처럼 "지금 몇 건
// 처리할 게 있는지"가 중요한 화면이라 각 칩에 건수를 같이 보여주는 상시 노출 칩 행으로
// 바꿨다(#redesign) - bankTransactions가 커서 없이 전체를 한 번에 불러오므로(loadBankTransactions)
// 로컬 배열 길이를 세는 것만으로 카운트가 정확하다.
const INBOX_FILTERS = ["ALL", "PENDING", "ERROR"];
const INBOX_FILTER_LABEL = { ALL: "전체", PENDING: "대기", ERROR: "오류" };
let inboxDepositFilter = "ALL";

function selectInboxFilter(filter) {
  inboxDepositFilter = filter;
  activityFeedLimit = ACTIVITY_PAGE_SIZE;
  renderInboxFilterSelector();
  renderInboxActivityFeed();
}

function renderInboxFilterSelector() {
  const row = document.getElementById("inbox-filter-chips");
  if (!row) return;

  const counts = { ALL: bankTransactions.length, PENDING: 0, ERROR: 0 };
  bankTransactions.forEach(t => { if (t.status === "PENDING" || t.status === "ERROR") counts[t.status]++; });

  row.innerHTML = INBOX_FILTERS.map(f => `
    <button type="button" class="filter-chip ${f === "ERROR" ? "filter-chip-danger" : f === "PENDING" ? "filter-chip-amber" : ""} ${f === inboxDepositFilter ? "active" : ""}" onclick="selectInboxFilter('${f}')">
      ${INBOX_FILTER_LABEL[f]}<span class="filter-chip-count">${counts[f]}</span>
    </button>
  `).join('');
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
      title: name,
      isSimulated,
      amount: t.amount,
      status: meta.text,
      statusClass: meta.cls,
      isCredited: t.status === "CREDITED" || t.status === "CREDITED_MANUAL",
      needsAction: t.status === "PENDING" || t.status === "ERROR",
    };
  }).sort((a, b) => new Date(b.time) - new Date(a.time));
}

// 심각도 우선(#redesign) - "전체" 필터에서는 처리 대기/오류가 먼저 정렬돼야 처리된 건들
// 사이에 섞여 아래로 밀려나지 않는다. PENDING/ERROR만 보는 필터에서는 어차피 전부
// needsAction이라 순서가 그대로다 - 이 함수는 항상 안전하게 호출해도 된다.
function sortEventsBySeverity(events) {
  const needsAction = events.filter(e => e.needsAction);
  const resolved = events.filter(e => !e.needsAction);
  return [...needsAction, ...resolved];
}

function renderActivityLine(ev) {
  // 대기/오류 배지는 이름 아래 줄이 아니라 이름 오른쪽에 나란히(#redesign) - 상태를 보려고
  // 시선을 아래로 옮길 필요가 없게. 오류는 이미 이 배지 + 행 왼쪽 빨간 스트립(is-error)으로
  // 표시되므로 이름 앞 ⚠️ 이모지는 중복이라 뺐고, 시뮬레이션 건 표시(구 🧪 이모지)도 같은
  // 자리에 텍스트 배지로 바꿔 이 앱의 단색 라인 아이콘 컨셉과 안 맞는 이모지를 없앴다.
  return `
    <span class="activity-icon">${ev.icon}</span>
    <div class="activity-info">
      <div class="activity-title-row">
        <span class="activity-title">${ev.title}</span>
        <span class="activity-status ${ev.statusClass}">${ev.status}</span>
        ${ev.isSimulated ? '<span class="activity-status status-other">테스트</span>' : ""}
      </div>
      <div class="activity-sub">${formatDateTimeKST(ev.time)}</div>
    </div>
    <div class="activity-amount-col">
      <div class="activity-amount${ev.isCredited ? " is-credited" : ""}">${ev.isCredited ? "+" : ""}${ev.amount.toLocaleString()}원</div>
    </div>
  `;
}

function renderActivityCard(ev) {
  const div = document.createElement("div");
  // 심각도를 형태로(#redesign) - 대기/오류는 왼쪽 색 스트립으로 눈에 띄게, 처리된
  // 건(완료/기타)은 살짝 흐리고 촘촘하게 묶어서 시선이 위쪽(처리 대기)에 먼저 가게 한다.
  const severityClass = !ev.needsAction ? "is-resolved"
    : ev.statusClass === "status-rejected" ? "is-error" : "is-pending";
  div.className = `glass-container activity-row ${severityClass}`;
  div.style.cursor = "pointer";
  div.onclick = () => openDepositDetailModal(ev.id);
  div.innerHTML = renderActivityLine(ev);
  return div;
}

function renderInboxActivityFeed() {
  const feed = document.getElementById("inbox-activity-feed");
  if (!feed) return;

  // "전체" 필터에서는 처리 대기/오류를 먼저 보여준다 - PENDING/ERROR 단일 필터는 이미
  // 전부 needsAction이라 순서가 그대로 유지된다.
  activityFeedMergedCache = sortEventsBySeverity(buildDepositEvents());

  feed.innerHTML = "";
  if (activityFeedMergedCache.length === 0) {
    feed.innerHTML = `<p style="text-align:center; color: var(--text-muted); padding: 1rem 0;">처리 내역이 없습니다.</p>`;
    return;
  }

  const page = activityFeedMergedCache.slice(0, activityFeedLimit);
  let dividedShown = false;
  page.forEach((ev, i) => {
    // 대기/오류 묶음에서 처리됨 묶음으로 넘어가는 첫 지점에 한 번만 구분선을 꽂는다.
    if (!dividedShown && !ev.needsAction && i > 0 && page[i - 1].needsAction) {
      const divider = document.createElement("div");
      divider.className = "activity-resolved-divider";
      divider.textContent = "처리됨";
      feed.appendChild(divider);
      dividedShown = true;
    }
    feed.appendChild(renderActivityCard(ev));
  });
}

// window가 하단 80px 이내로 들어오면 다음 페이지를 이어서 그린다 - setupDetailHistoryInfiniteScroll/
// setupKioskDetailHistoryInfiniteScroll과 같은 패턴, 충전함 탭이 활성 상태일 때만 반응한다.
function setupActivityFeedInfiniteScroll() {
  if (window._activityFeedScrollWired) return;
  window._activityFeedScrollWired = true;
  window.addEventListener("scroll", () => {
    const view = document.getElementById("admin-view-inbox");
    if (!view || !view.classList.contains("active")) return;
    if (activityFeedLimit >= activityFeedMergedCache.length) return;
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 80) {
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
  currentBackHandler = closeMemberDetail;
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
  document.getElementById("admin-header-title").innerText = user.name; // 상단 고정 바 제목(#redesign)
  const badge = document.getElementById("detail-member-badge");
  badge.innerText = user.user_type === 'SENIOR' ? '시니어' : '일반';
  badge.className = `badge-tag ${user.user_type === 'SENIOR' ? 'badge-senior' : 'badge-general'}`;
  const statusEl = document.getElementById("detail-member-status");
  statusEl.textContent = isActive ? "활성" : "정지됨";
  statusEl.className = `detail-status-chip ${isActive ? "is-active" : "is-suspended"}`;
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

// 잔액이 남아있거나 결제/입금/충전 이력이 있는 회원은 삭제할 수 없다
// (자금 손실 방지 및 FK 정합성, admin_delete_user 참고) - 그런 경우 "정지"를 대신 안내받는다.
async function deleteDetailUser() {
  const user = users.find(u => u.id === currentDetailUserId);
  if (!user) return;
  if (!(await showConfirmModal(`${user.name}님을 정말 삭제하시겠습니까? 되돌릴 수 없습니다.\n(잔액이 남아있거나 결제/입금/충전 이력이 있는 회원은 삭제할 수 없습니다 - 그런 경우 "정지"를 이용하세요.)`))) return;

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
  renderQrCardSlot("detail-card-qr-slot", `${icon("camera")} QR 코드`);
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
          <button class="btn-action" style="width:auto; padding:0.4rem 0.7rem; font-size:0.82rem; background: var(--accent-danger-glow); color: var(--icon-danger);" onclick="deleteDetailCard(${card.id})">삭제</button>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="card-slot">
        <div class="card-slot-type" style="color: var(--text-muted);">${label} - 미등록</div>
        <button class="btn-action btn-primary" style="width:auto; padding:0.4rem 0.9rem; font-size:0.82rem;" onclick="openScannerModal('REGISTER', {userId: currentDetailUserId, cardType: '${cardType}'})">등록하기</button>
      </div>
    `;
  }
}

// QR은 실물 스캔으로 등록하지 않는다 - 회원가입 시 서버가 UUID를 자동 발급하므로, 여기서는
// 현재 값을 보여주고 유출 등 문제가 생겼을 때만 "재발급"(새 UUID로 교체)할 수 있게 한다.
function renderQrCardSlot(containerId, label) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const card = cards.find(c => c.user_id === currentDetailUserId && c.card_type === "QR_CODE");

  container.innerHTML = `
    <div class="card-slot">
      <div>
        <div class="card-slot-type">${label}</div>
        <div class="card-slot-uid">${card ? card.card_uid : `<span style="color: var(--text-muted);">미발급</span>`}</div>
      </div>
      <button class="btn-action btn-primary" style="width:auto; padding:0.4rem 0.9rem; font-size:0.82rem;" onclick="reissueQrCard(currentDetailUserId)">${card ? "재발급" : "발급하기"}</button>
    </div>
  `;
}

async function reissueQrCard(userId) {
  if (!(await showConfirmModal("QR 코드를 새로 발급하시겠습니까? 기존 QR은 즉시 결제에 사용할 수 없게 됩니다."))) return;
  try {
    const res = await adminFetch(`${API_BASE}/admin/cards/qr-reissue/${userId}`, { method: "POST" });
    if (res.ok) {
      await loadAdminCards();
      renderDetailCardSlots();
      await showAlertModal("🎉 QR 코드가 발급되었습니다.");
    } else {
      const data = await res.json().catch(() => ({}));
      await showAlertModal(`발급 실패: ${data.detail || "오류 발생"}`);
    }
  } catch (err) {
    console.error("reissueQrCard error:", err);
    await showAlertModal("서버 통신 중 에러가 발생했습니다.");
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

// 이력 카드 레이아웃(#19): 좌상단 종류 배지(충전/결제/실패) + 시간, 좌하단 사유(충전 메모 /
// 결제 목록 / 실패 사유), 우상단 금액(+/-), 우하단 잔액. /api/admin/history(계좌이체/결제/
// 관리자충전을 통일된 형태로 병합해서 커서 페이지네이션으로 내려줌 - app/services/history.py)를
// 스크롤 시 이어서 불러온다(#history). 카드 렌더링(historyItemHtml, 날짜 구분선 등)은 user
// 앱(user.js)과 완전히 같은 코드를 src/history-render.js에서 공유해서 쓰므로 두 화면이 서로
// 다른 모양/로직을 보여주는 일이 구조적으로 없다(#33) - 여기서는 회원상세만의 커서/스크롤
// 상태와 날짜 구분선 상태(_detailHistoryDateState)만 관리한다.
let _detailHistoryCursor = null;
let _detailHistoryHasMore = true;
let _detailHistoryLoading = false;
let _detailHistoryDateState = { last: null };

// 회원상세를 새로 열거나(renderMemberDetail) 잔액이 바뀌는 조작 직후 다시 그릴 때마다
// 첫 페이지부터 새로 불러온다.
function renderDetailHistory() {
  const box = document.getElementById("detail-history-list");
  if (!box) return;
  _detailHistoryCursor = null;
  _detailHistoryHasMore = true;
  _detailHistoryDateState = { last: null };
  box.innerHTML = "";
  setupDetailHistoryInfiniteScroll();
  loadMoreDetailHistory();
}

async function loadMoreDetailHistory() {
  const box = document.getElementById("detail-history-list");
  if (!box) return;
  if (!_detailHistoryHasMore || _detailHistoryLoading) return;
  _detailHistoryLoading = true;
  try {
    const url = `${API_BASE}/admin/history?user_id=${currentDetailUserId}&limit=20`
      + (_detailHistoryCursor ? `&before=${encodeURIComponent(_detailHistoryCursor)}` : "");
    const res = await adminFetch(url);
    if (!res.ok) return;
    const data = await res.json();
    if (data.items.length === 0) {
      _detailHistoryHasMore = false;
      if (box.children.length === 0) {
        box.innerHTML = historyEmptyStateHtml("이력이 없습니다.");
      }
      return;
    }
    box.insertAdjacentHTML("beforeend", data.items.map((item) => historyItemHtml(item, _detailHistoryDateState)).join(""));
    _detailHistoryCursor = data.next_cursor;
  } catch (err) {
    console.error("loadMoreDetailHistory error:", err);
  } finally {
    _detailHistoryLoading = false;
  }
}

// 회원상세 뷰는 전용 스크롤 박스가 없이 다른 탭들처럼 window가 스크롤된다(FIXED_HEIGHT_VIEWS는
// search/inbox 전용) - 하단 80px 이내 진입 시 다음 페이지, 단 회원상세 뷰가 활성 상태일 때만.
function setupDetailHistoryInfiniteScroll() {
  if (window._detailHistoryScrollWired) return;
  window._detailHistoryScrollWired = true;
  window.addEventListener("scroll", () => {
    const view = document.getElementById("admin-view-member-detail");
    if (!view || !view.classList.contains("active")) return;
    if (!_detailHistoryHasMore || _detailHistoryLoading) return;
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 80) {
      loadMoreDetailHistory();
    }
  });
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
    renderInboxFilterSelector(); // 칩 건수가 bankTransactions 기준이라 목록 새로고침마다 같이 갱신
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
  const amountEl = document.getElementById("dd-amount");
  amountEl.innerText = `${t.amount.toLocaleString()}원`;
  // 금액 초록은 "크레딧이 실제로 반영됨"에만 - 대기·오류·기타는 중립(잉크색)으로.
  amountEl.style.color = (t.status === "CREDITED" || t.status === "CREDITED_MANUAL")
    ? "var(--accent-emerald)" : "var(--text-main)";
  document.getElementById("dd-transaction-at").innerText = formatDateTimeKST(t.transaction_at);
  document.getElementById("dd-txn-id").innerText = t.external_txn_id;

  const meta = DEPOSIT_STATUS_META[t.status] || { text: t.status, cls: "status-pending" };
  const statusEl = document.getElementById("dd-status");
  statusEl.innerText = meta.text;
  statusEl.className = `activity-status ${meta.cls}`;
  statusEl.style.marginTop = "0";
  statusEl.style.marginLeft = "auto";

  const infoBox = document.getElementById("dd-resolution-info");
  const infoLines = [];
  if (t.matched_user_name) infoLines.push(`매칭 회원: ${escapeHtml(t.matched_user_name)}`);
  if (t.resolved_by_admin_name) infoLines.push(`처리자: ${escapeHtml(t.resolved_by_admin_name)}`);
  if (t.resolved_at) infoLines.push(`처리 시각: ${formatDateTimeKST(t.resolved_at)}`);
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
  // "기타로 처리"는 예외 경로 - 모달을 열 때마다 접힌 상태로 되돌린다.
  document.getElementById("dd-other-section").style.display = "none";
  if (resolvable) {
    // "매칭 오류"의 존재 이유가 입금자명인데 후보 목록이 빈 채로 시작했다 - 입금자명(동명이인
    // 구분용 꼬리 숫자는 떼고)으로 검색을 미리 채워 유사 회원이 바로 뜨게 한다.
    document.getElementById("dd-user-search").value = (t.depositor_name || "").replace(/\s*\d+\s*$/, "").trim();
    document.getElementById("dd-resolve-memo").value = "";
    document.getElementById("dd-other-reason").value = "";
    // 이미 매칭 회원(오류 재처리 등)이 있으면 그대로 두고, 없으면 가장 유력한 후보를
    // 자동 선택해 둔다 - 관리자가 매번 "이 사람 맞나요?"에 답만 하고 바로 처리 버튼을
    // 누를 수 있게(#redesign, s-deposit 리뷰: "정작 입금자명은 뻔히 있는데 후보 목록이
    // 빈 채로 시작한다").
    if (!_depositDetailSelectedUserId) {
      const best = bestDepositCandidate();
      if (best) _depositDetailSelectedUserId = best.id;
    }
    renderDepositUserOptions();
  }
}

// 입금자명(꼬리 숫자 뗀 검색어)과 회원 이름의 일치도를 대략적으로 가늠한다 - 정확한
// 문자열 유사도 알고리즘은 과하고, "완전 일치"와 "한쪽이 다른 쪽을 포함"만 구분해도
// 자동 선택/힌트 표시엔 충분하다.
function depositNameMatchQuality(name, query) {
  if (!query) return null;
  const n = (name || "").trim();
  const q = query.trim();
  if (!n) return null;
  if (n === q) return "exact";
  if (n.startsWith(q) || q.startsWith(n)) return "similar";
  return null;
}

function bestDepositCandidate() {
  const query = (document.getElementById("dd-user-search").value || "").trim();
  let best = null, bestRank = 0;
  // 정지 회원은 충전 대상으로 잘못 골라 붙이기 쉬우니 후보에서 아예 뺀다 - 사용자
  // 관리 탭 검색 목록과 같은 기준(users.js의 활성 회원 필터, admin.js 1560행 참고).
  for (const u of users) {
    if (u.status === "SUSPENDED") continue;
    const quality = depositNameMatchQuality(u.name, query);
    const rank = quality === "exact" ? 2 : quality === "similar" ? 1 : 0;
    if (rank > bestRank) { bestRank = rank; best = u; }
  }
  return best;
}

function renderDepositUserOptions() {
  const box = document.getElementById("dd-user-options");
  if (!box) return;
  const query = (document.getElementById("dd-user-search").value || "").trim();
  const queryLower = query.toLowerCase();
  const matchQualityRank = { exact: 2, similar: 1 };
  const matches = users
    .filter(u => u.status !== "SUSPENDED")
    .filter(u => !queryLower || u.name.toLowerCase().includes(queryLower) || (u.phone || "").includes(queryLower))
    .map(u => ({ u, quality: depositNameMatchQuality(u.name, query) }))
    .sort((a, b) => (matchQualityRank[b.quality] || 0) - (matchQualityRank[a.quality] || 0))
    // 후보를 소수로 좁혀 이 목록 자체는 스크롤 없이 한 화면에 들어오게 한다 - 모달
    // 전체 스크롤(.modal-body)과 겹치는 이중 스크롤을 피한다(#redesign, s-deposit 리뷰).
    .slice(0, 6);

  if (matches.length === 0) {
    box.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">일치하는 회원이 없습니다.</p>`;
    return;
  }

  box.innerHTML = matches.map(({ u, quality }) => {
    const selected = u.id === _depositDetailSelectedUserId;
    const hint = quality === "exact" ? "이름 일치" : quality === "similar" ? "이름 유사" : "";
    return `
      <div onclick="selectDepositUser(${u.id})" style="display:flex; align-items:center; gap: 0.6rem; padding: 0.5rem 0.7rem; border-radius: 8px; cursor:pointer; background: ${selected ? "rgba(16,185,129,0.15)" : "var(--surface-2)"}; border: 1px solid ${selected ? "var(--accent-emerald)" : "transparent"};">
        <span style="flex: 1 1 auto; min-width: 0;">
          <span style="font-weight: 600;">${escapeHtml(u.name || "")}</span>${hint ? `<span style="font-size: 0.72rem; color: var(--text-muted);"> · ${hint}</span>` : ""}
          <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 0.1rem;">${escapeHtml(u.phone || "")} · 잔액 ${u.credit_balance.toLocaleString()}원</div>
        </span>
        <span style="flex: 0 0 auto; width: 1rem; text-align: right;">${selected ? `<span data-icon="check" style="color: var(--accent-emerald);"></span>` : ""}</span>
      </div>
    `;
  }).join("");
  hydrateIconPlaceholders(box);

  const resolveBtn = document.getElementById("dd-resolve-btn");
  const selectedUser = matches.find(m => m.u.id === _depositDetailSelectedUserId)?.u
    || users.find(u => u.id === _depositDetailSelectedUserId);
  resolveBtn.innerText = selectedUser ? `${selectedUser.name} 회원으로 충전 처리` : "선택한 회원으로 충전 처리(완료)";
}

// "기타로 처리"는 예외 경로라 기본은 접어 두고, 눌렀을 때만 사유 입력을 펼친다
// (#redesign, s-deposit 리뷰: "스크롤 아래로 묻힘 → 하단 보조 링크로").
function toggleDepositOtherSection() {
  const section = document.getElementById("dd-other-section");
  section.style.display = section.style.display === "none" ? "block" : "none";
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
// AndroidInterface가 없는 일반 브라우저(관리자 앱이 아닌 곳)에서는 이 권한 자체가 의미
// 없으므로(#settings-redesign, 리뷰 지적: "미지원인 경우에는 안 표기되게") 문구를 남기지
// 않고 섹션 전체(캡션 포함)를 감춘다 - a-push-section이 isInstalledAdminAppContext()로
// 그룹째 숨기는 것과 같은 패턴.
function refreshNotificationAccessStatus() {
  const section = document.getElementById("notif-access-section");
  const statusEl = document.getElementById("notif-access-status");
  const btn = document.getElementById("notif-access-toggle-btn");
  const detailEl = document.getElementById("notif-access-detail");
  if (!section) return;

  if (!window.AndroidInterface || typeof window.AndroidInterface.isNotificationAccessGranted !== "function") {
    section.style.display = "none";
    return;
  }
  section.style.display = "block";

  const granted = window.AndroidInterface.isNotificationAccessGranted();
  if (statusEl) statusEl.innerText = "";
  if (btn) {
    btn.classList.toggle("is-on", granted);
    btn.setAttribute("aria-checked", granted ? "true" : "false");
  }
  if (detailEl) {
    detailEl.textContent = granted
      ? "문자/RCS/푸시 알림을 모두 감지합니다."
      : "SMS만 감지되고 RCS/푸시 알림은 놓칠 수 있습니다. 스위치를 탭해서 켜주세요.";
    detailEl.style.color = granted ? "var(--text-muted)" : "var(--accent-danger)";
  }
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
          <span style="font-size: 0.75rem; color: var(--text-muted);">${formatDateTimeKST(entry.time)} · ${origin}</span>
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
        await loadAdminCards();
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
// 메뉴 자체의 생성/삭제(전역 카탈로그 CRUD)는 "메뉴" 라벨 옆 수정 버튼 -> 메뉴 관리
// 모달(openMenuManageModal 이하)에서 하고, 여기 상세 화면의 카드 그리드는 그 카탈로그
// 중 이 키오스크에 노출할 항목만 고르는 배정 화면이다(메뉴는 키오스크마다 다르게 노출될
// 수 있다). 목록/상세는 회원 관리 탭과 같은 패턴(카드 목록 -> 탭하면 상세, 뒤로가기로
// 복귀)이라 단말기가 늘어도 목록 화면 자체는 카드 한 줄만큼씩만 늘어난다.

let kiosks = [];
// null이면 목록만 보이는 상태, 값이 있으면 그 키오스크의 상세 화면(admin-view-kiosk-detail)이
// 열려 있다는 뜻 - currentDetailUserId와 같은 역할.
let selectedKioskId = null;
let kioskSalesPeriod = "today";
let kioskSalesPeriodOpen = false;

// 키오스크 온라인 여부는 서버가 last_seen_at 하트비트(약 20초 주기)의 신선도로 판정한다
// (backend _kiosk_is_online). 키오스크가 조용히 죽으면 서버가 보내는 "stats" 갱신 신호가
// (uvicorn 워커가 여러 개라) 이 관리자 세션에 안 닿을 수 있어, 키오스크 탭을 보고 있는
// 동안만 주기적으로 목록을 다시 불러 온라인 점을 최신으로 유지한다. 탭을 벗어나면 멈춘다.
let kioskListPollTimer = null;
const KIOSK_LIST_POLL_MS = 30000;

function startKioskListPolling() {
  if (kioskListPollTimer) return;
  kioskListPollTimer = setInterval(() => {
    if (document.hidden) return;
    loadKiosks();
  }, KIOSK_LIST_POLL_MS);
}

function stopKioskListPolling() {
  clearInterval(kioskListPollTimer);
  kioskListPollTimer = null;
}

async function loadKiosks() {
  try {
    const res = await adminFetch(`${API_BASE}/admin/kiosks`);
    if (!res.ok) return;
    kiosks = await res.json();
    // 상세를 보고 있는 도중 그 키오스크가 사라졌다면(다른 관리자가 삭제하는 등) 목록으로
    // 되돌아간다 - 존재하지 않는 키오스크의 상세를 계속 붙들고 있을 수 없다.
    if (selectedKioskId && !kiosks.some(k => k.id === selectedKioskId)) {
      closeKioskDetail();
      return;
    }
    renderKioskList();
  } catch (err) {
    console.error("Failed to load kiosks:", err);
  }
}

// 메뉴별 매출 = 막대 리스트(#redesign) - 표는 숫자 세 개를 나란히 읽어야 해서 "뭐가 제일
// 잘 팔리는지"가 한눈에 안 들어왔다. 막대 길이를 이 기간 안 최고 매출 대비 비율로 그려서
// 순위가 바로 보이게 한다 - 매출액 기준으로 이미 내림차순 정렬해 1위가 맨 위에 오게 한다.
function renderKioskSalesRows(rows) {
  if (!rows || rows.length === 0) {
    return `<p style="text-align:center; color: var(--text-muted); padding: 1rem 0; margin: 0;">판매 내역이 없습니다.</p>`;
  }
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  const max = Math.max(...sorted.map(r => r.amount), 1);
  return sorted.map(r => `
    <div class="kiosk-sales-bar-row">
      <div class="kiosk-sales-bar-top">
        <span class="kiosk-sales-bar-name">${escapeHtml(r.product_name)}</span>
        <span class="kiosk-sales-bar-amount">${r.amount.toLocaleString()}원</span>
      </div>
      <div class="kiosk-sales-bar-track">
        <div class="kiosk-sales-bar-fill" style="width: ${Math.max(3, Math.round(r.amount / max * 100))}%"></div>
      </div>
      <div class="kiosk-sales-bar-qty">${r.quantity.toLocaleString()}개 판매</div>
    </div>
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
  const box = document.getElementById("kiosk-sales-bar-list");
  if (k && box) box.innerHTML = renderKioskSalesRows(k.sales[period]);
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

// ---------- 목록 -> 상세 (회원 관리 탭의 openMemberDetail/closeMemberDetail과 같은 패턴, #redesign2) ----------
function openKioskDetail(id) {
  const activeTab = document.querySelector(".admin-tab-btn.active");
  if (activeTab) detailReturnView = activeTab.dataset.view;

  selectedKioskId = id;
  kioskSalesPeriod = "today";
  kioskSalesPeriodOpen = false;
  currentBackHandler = closeKioskDetail;
  switchAdminView("kiosk-detail");
  renderKioskDetail();
}

function closeKioskDetail() {
  selectedKioskId = null;
  switchAdminView(detailReturnView);
}

// 카드에는 이름 + 온라인 상태 + 오늘 매출을 보여준다 - UUID와 삭제 버튼, 기간별 상세 매출은
// 상세 화면 쪽에 있다. 오늘 매출은 k.sales.today(메뉴별 배열, loadKiosks가 이미 받아온
// 데이터)를 그대로 합산 - 카드 목록만으로 오늘 뭐가 잘 되고 있는지 훑어볼 수 있게 한다.
function renderKioskFeed() {
  const feed = document.getElementById("kiosk-feed");
  if (!feed) return;

  feed.innerHTML = kiosks.length === 0
    ? `<div class="kiosk-selector-empty">단말기에서 접속하면 자동으로 등록됩니다.</div>`
    : kiosks.map(k => {
      const todaySales = (k.sales?.today || []).reduce((sum, row) => sum + row.amount, 0);
      return `
      <div class="glass-container kiosk-card" onclick="openKioskDetail(${k.id})">
        <div class="kiosk-card-info">
          <div class="kiosk-card-name">
            <span class="kiosk-online-dot ${k.is_online ? 'is-online' : ''}"></span>${escapeHtml(k.device_name || '이름 없는 단말기')}
          </div>
          <div class="kiosk-card-sub">${k.is_online ? '온라인' : (k.last_seen_at ? `마지막 접속 ${formatDateTimeKST(k.last_seen_at)}` : '접속 기록 없음')}</div>
        </div>
        <div class="kiosk-card-sales">
          <div class="kiosk-card-sales-label">오늘 매출</div>
          <div class="kiosk-card-sales-amount">${todaySales.toLocaleString()}원</div>
        </div>
      </div>
    `;
    }).join('');
}

// 목록은 항상 다시 그리고, 상세가 열려 있는 상태(selectedKioskId 있음)라면 그 상세도 최신
// 데이터로 같이 다시 그린다 - loadKiosks/loadAdminProducts 같은 백그라운드 새로고침 지점,
// "kiosk" 탭 진입(switchAdminView) 양쪽에서 이 함수 하나만 부르면 된다.
function renderKioskList() {
  renderKioskFeed();
  if (selectedKioskId) renderKioskDetail();
}

// UUID 복사 칩(#redesign) - user.js의 copyAccountNumber와 같은 패턴: 클립보드에 쓰고
// 아이콘을 잠깐 체크 표시로 바꿔 피드백을 준다.
async function copyKioskUuid(btn, uuid) {
  try {
    await navigator.clipboard.writeText(uuid);
  } catch (err) {
    console.error("copyKioskUuid error:", err);
    return;
  }
  const iconEl = btn.querySelector(".kiosk-detail-uuid-copy-icon");
  if (!iconEl) return;
  const original = iconEl.innerHTML;
  iconEl.innerHTML = icon("check");
  iconEl.style.color = "var(--accent-emerald)";
  clearTimeout(btn._copyResetTimer);
  btn._copyResetTimer = setTimeout(() => {
    iconEl.innerHTML = original;
    iconEl.style.color = "";
  }, 1200);
}

function renderKioskDetail() {
  const wrap = document.getElementById("admin-kiosk-detail");
  if (!wrap) return;

  const k = kiosks.find(x => x.id === selectedKioskId);
  if (!k) {
    wrap.innerHTML = "";
    return;
  }

  document.getElementById("admin-header-title").innerText = k.device_name || "이름 없는 단말기"; // 상단 고정 바 제목(#redesign2)

  wrap.innerHTML = `
    <div class="glass-container" style="padding: 1.5rem; margin-bottom: 1.2rem;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; gap: 0.5rem;">
        <label class="form-label" style="margin-bottom: 0;">키오스크 이름</label>
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span id="kiosk-detail-save-status" style="font-size: 0.78rem; font-weight: bold; opacity: 0; transition: opacity 0.3s;"></span>
          <button type="button" class="btn-action" style="width: 32px; height: 32px; min-height: 32px; padding: 0; flex: none; background: var(--accent-danger-glow, rgba(239,68,68,0.15)); color: var(--icon-danger, #fca5a5);" onclick="confirmDeleteKiosk(${k.id})" title="키오스크 삭제">
            <span data-icon="trash"></span>
          </button>
        </div>
      </div>
      <input type="text" class="form-control kiosk-name-input" value="${escapeHtml(k.device_name || '')}" style="margin-bottom: 0.6rem;"
        onblur="autoSaveKiosk(${k.id})" onkeyup="if(event.key==='Enter') this.blur();">

      <!-- 온라인 여부는 실시간(ws_manager 연결 유무), 오프라인일 때는 마지막으로 연결됐던
           시각을 대신 보여준다(#redesign) - admin_list_kiosks가 매 새로고침마다 계산해서 내려줌. -->
      <div class="kiosk-online-status" style="margin-bottom: 0.8rem;">
        <span class="kiosk-online-dot ${k.is_online ? 'is-online' : ''}"></span>
        ${k.is_online ? '온라인' : (k.last_seen_at ? `오프라인 · 마지막 접속 ${formatDateTimeKST(k.last_seen_at)}` : '오프라인 · 접속 기록 없음')}
      </div>

      <label class="form-label">키오스크 ID</label>
      <button type="button" class="kiosk-detail-uuid" style="margin-bottom: 1rem;" onclick="copyKioskUuid(this, '${k.device_uuid}')" title="눌러서 복사">
        <span class="kiosk-detail-uuid-text">${escapeHtml(k.device_uuid)}</span>
        <span class="kiosk-detail-uuid-copy-icon" data-icon="copy"></span>
      </button>

      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.2rem;">
        <label class="form-label" style="margin-bottom: 0;">메뉴</label>
        <button type="button" class="btn-action" style="width: 28px; height: 28px; min-height: 28px; padding: 0; flex: none; background: none; color: var(--text-muted);" onclick="openMenuManageModal()" title="메뉴 관리">
          <span data-icon="edit"></span>
        </button>
      </div>
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
      <!-- 옵션에 가격도 같이 표시(#redesign, 사용자 요청: "kiosk처럼 가격도 옆에 같이
           보여주는게 좋겠어 - 둘이 똑같게") - kiosk.js의 k-default-product-select
           렌더링(populateKioskMenuData)과 동일한 문구 포맷으로 맞춘다. -->
      <select class="form-control kiosk-default-product-select" style="margin-bottom: 0;" onchange="autoSaveKiosk(${k.id})">
        <option value="">-- 기본 결제 없음 (메뉴 선택 필수) --</option>
        ${products.map(p => `<option value="${p.id}" ${k.default_product_id === p.id ? 'selected' : ''}>${escapeHtml(p.name)} (일반: ${p.price_general.toLocaleString()}원 / 시니어: ${p.price_senior.toLocaleString()}원)</option>`).join('')}
      </select>
    </div>

    <div class="glass-container" style="padding: 1.5rem; overflow: visible; margin-bottom: 1.2rem;">
      <div class="admin-page-title-row kiosk-title-row" style="margin-bottom: 0.8rem;">
        <span style="font-size: 0.85rem; color: var(--text-muted);">메뉴별 매출</span>
        <button type="button" class="kiosk-selector-btn" onclick="toggleKioskSalesPeriodSelector()">
          <span id="kiosk-sales-period-label">${KIOSK_SALES_PERIOD_LABEL[kioskSalesPeriod]}</span>
          <span id="kiosk-sales-period-arrow" class="kiosk-selector-arrow-icon" data-icon="chevron-down"></span>
        </button>
        <div id="kiosk-sales-period-list" class="kiosk-sales-period-list"></div>
      </div>
      <div id="kiosk-sales-bar-list">${renderKioskSalesRows(k.sales[kioskSalesPeriod])}</div>
    </div>

    <div class="glass-container" style="padding: 1.5rem;">
      <div class="admin-page-title-row kiosk-title-row" style="margin-bottom: 0.8rem;">
        <span style="font-size: 0.85rem; color: var(--text-muted);">결제 이력</span>
      </div>
      <div id="kiosk-detail-history-list"></div>
    </div>
  `;
  hydrateIconPlaceholders(wrap);
  renderKioskDetailHistory(k.id);
}

// 키오스크별 결제 이력 - 회원상세 이용내역(renderDetailHistory/loadMoreDetailHistory)과 같은
// 커서 페이지네이션 패턴이되, 백엔드 응답이 KioskPaymentHistoryItem(누가 결제했는지가 핵심
// 정보)이라 HistoryItemResponse와 필드가 달라 historyItemHtml이 기대하는 모양으로 직접
// 매핑해서 넘긴다(카드 모양 자체는 이용내역과 동일하게 재사용).
let _kioskHistoryDeviceId = null;
let _kioskHistoryCursor = null;
let _kioskHistoryHasMore = true;
let _kioskHistoryLoading = false;
let _kioskHistoryDateState = { last: null };

function renderKioskDetailHistory(deviceId) {
  const box = document.getElementById("kiosk-detail-history-list");
  if (!box) return;
  _kioskHistoryDeviceId = deviceId;
  _kioskHistoryCursor = null;
  _kioskHistoryHasMore = true;
  _kioskHistoryDateState = { last: null };
  box.innerHTML = "";
  setupKioskDetailHistoryInfiniteScroll();
  loadMoreKioskDetailHistory();
}

async function loadMoreKioskDetailHistory() {
  const box = document.getElementById("kiosk-detail-history-list");
  if (!box) return;
  if (!_kioskHistoryHasMore || _kioskHistoryLoading) return;
  const deviceId = _kioskHistoryDeviceId;
  _kioskHistoryLoading = true;
  try {
    const url = `${API_BASE}/admin/kiosks/${deviceId}/history?limit=20`
      + (_kioskHistoryCursor ? `&before=${encodeURIComponent(_kioskHistoryCursor)}` : "");
    const res = await adminFetch(url);
    if (!res.ok) return;
    if (deviceId !== _kioskHistoryDeviceId) return; // 응답 오는 사이 다른 키오스크로 전환됨
    const data = await res.json();
    if (data.items.length === 0) {
      _kioskHistoryHasMore = false;
      if (box.children.length === 0) {
        box.innerHTML = historyEmptyStateHtml("결제 이력이 없습니다.");
      }
      return;
    }
    const mapped = data.items.map(item => ({
      label: "결제",
      badge_class: "status-payment",
      category: "payment",
      reason: `${item.user_name} (${item.user_type})${item.product_details ? " · " + item.product_details : ""}`,
      amount: -item.amount,
      amount_text: `-${item.amount.toLocaleString()}원`,
      amount_class: "amount-negative",
      balance_after: item.balance_after,
      event_time: item.event_time,
    }));
    box.insertAdjacentHTML("beforeend", mapped.map((item) => historyItemHtml(item, _kioskHistoryDateState)).join(""));
    _kioskHistoryCursor = data.next_cursor;
  } catch (err) {
    console.error("loadMoreKioskDetailHistory error:", err);
  } finally {
    _kioskHistoryLoading = false;
  }
}

// 키오스크 상세도 회원상세처럼 전용 스크롤 박스가 없이 window가 스크롤된다.
function setupKioskDetailHistoryInfiniteScroll() {
  if (window._kioskHistoryScrollWired) return;
  window._kioskHistoryScrollWired = true;
  window.addEventListener("scroll", () => {
    // 상세 화면은 admin-view-kiosk-detail이다(목록 화면 admin-view-kiosk와 분리된 뒤로
    // 여기 참조도 같이 바뀌었어야 했는데 빠져 있었다 - #redesign2 후속 수정, 지금까지는
    // 이 조건이 항상 false라 스크롤해도 다음 페이지가 안 불러와졌다).
    const view = document.getElementById("admin-view-kiosk-detail");
    if (!view || !view.classList.contains("active")) return;
    if (!_kioskHistoryHasMore || _kioskHistoryLoading) return;
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 80) {
      loadMoreKioskDetailHistory();
    }
  });
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
      document.getElementById("admin-header-title").innerText = k.device_name || "이름 없는 단말기";
      renderKioskFeed();
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
      // 삭제 버튼은 상세 화면 안에만 있으므로 항상 그 키오스크를 보고 있는 중 - 목록으로
      // 돌아간 뒤 최신 목록을 다시 받아온다.
      closeKioskDetail();
      loadKiosks();
    } else {
      const data = await res.json().catch(() => ({}));
      await showAlertModal(`삭제 실패: ${data.detail || '오류 발생'}`);
    }
  } catch (err) {
    console.error("confirmDeleteKiosk error:", err);
  }
}

// ============ 메뉴 관리 모달 (전역 메뉴 카탈로그 추가/삭제) ============
// 메뉴 선택 배정 그리드(.kiosk-menu-assign-grid)와 같은 카드형 UI를 재사용하되, 여기서는
// 카드를 눌러도 배정이 토글되지 않고 카드 우측 상단 휴지통 버튼으로만 삭제하며, 마지막
// 칸에는 "+" 카드를 둬서 누르면 별도의 작은 입력 모달(admin-menu-add-modal)이 뜬다.
function openMenuManageModal() {
  renderMenuManageGrid();
  showModal("admin-menu-manage-modal");
}

function closeMenuManageModal() {
  hideModal("admin-menu-manage-modal");
}

function renderMenuManageGrid() {
  const grid = document.getElementById("admin-menu-manage-grid");
  if (!grid) return;

  grid.innerHTML = products.map(p => `
    <div class="menu-card">
      <button type="button" class="menu-delete-btn" onclick="deleteMenuItem(${p.id})" title="메뉴 삭제">
        <span data-icon="trash"></span>
      </button>
      <div>
        <div class="menu-name">${escapeHtml(p.name)}</div>
        <div class="menu-price">일반 ${p.price_general.toLocaleString()}원</div>
        <div class="menu-price-senior">시니어 ${p.price_senior.toLocaleString()}원</div>
      </div>
    </div>
  `).join('') + `
    <div class="menu-card menu-card-add" onclick="openMenuAddModal()" title="메뉴 추가">${icon('plus')}</div>
  `;
  hydrateIconPlaceholders(grid);
}

async function deleteMenuItem(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  if (!(await showConfirmModal(`"${p.name}" 메뉴를 삭제하시겠습니까?\n모든 키오스크의 노출 메뉴 배정에서도 함께 제거됩니다.`))) return;

  try {
    const res = await adminFetch(`${API_BASE}/products/${productId}`, { method: "DELETE" });
    if (res.ok) {
      showToast(`"${p.name}" 메뉴를 삭제했습니다.`);
      await loadAdminProducts();
      renderMenuManageGrid();
    } else {
      const data = await res.json().catch(() => ({}));
      await showAlertModal(`삭제 실패: ${data.detail || '오류 발생'}`);
    }
  } catch (err) {
    console.error("deleteMenuItem error:", err);
  }
}

function openMenuAddModal() {
  document.getElementById("admin-menu-add-name").value = "";
  document.getElementById("admin-menu-add-price-general").value = "";
  document.getElementById("admin-menu-add-price-senior").value = "";
  showModal("admin-menu-add-modal");
}

function closeMenuAddModal() {
  hideModal("admin-menu-add-modal");
}

async function saveMenuAdd(btn) {
  const name = document.getElementById("admin-menu-add-name").value.trim();
  const genPrice = parseInt(document.getElementById("admin-menu-add-price-general").value);
  const senPrice = parseInt(document.getElementById("admin-menu-add-price-senior").value);

  if (!name || isNaN(genPrice)) {
    await showAlertModal("메뉴 이름과 일반 가격을 입력하세요.");
    return;
  }

  await withButtonLock(btn, async () => {
    try {
      const res = await adminFetch(`${API_BASE}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          price_general: genPrice,
          price_senior: isNaN(senPrice) ? genPrice : senPrice,
        })
      });
      if (res.ok) {
        showToast(`"${name}" 메뉴를 추가했습니다.`);
        closeMenuAddModal();
        await loadAdminProducts();
        renderMenuManageGrid();
      } else {
        const data = await res.json().catch(() => ({}));
        await showAlertModal(`추가 실패: ${data.detail || '오류 발생'}`);
      }
    } catch (err) {
      console.error("saveMenuAdd error:", err);
    }
  });
}
