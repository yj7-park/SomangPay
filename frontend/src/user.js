const API_BASE = "/api";

let userToken = null;
let loggedInUser = null;

// 관리자가 입력한 키오스크명/상품명 등 신뢰할 수 없는 텍스트를 innerHTML에 꽂을 때 XSS를 막는 이스케이프.
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

// 홈 잔액 카드 숫자(#redesign) - "원" 단위를 숫자보다 가늘게(font-weight 낮춤) 둬서 숫자
// 자체가 더 도드라지게 한다. onLoginSuccess/refreshMyInfo 둘 다 여기로 통일.
function renderUserBalance(amount) {
  const el = document.getElementById("display-user-balance");
  if (!el) return;
  el.innerHTML = `${amount.toLocaleString()}<span class="user-balance-unit">원</span>`;
}

document.addEventListener("DOMContentLoaded", () => {
  const savedToken = localStorage.getItem("user_token");
  if (savedToken) {
    userToken = savedToken;
    restoreSession();
  }
  initUserTheme();
});

// 상단 고정 바 실제 높이 → --header-h(#redesign) - .admin-shell의 min-height 계산이
// 이 값을 쓴다(style.css, admin.js의 동명 로직과 동일한 이유). 로그인 전엔 헤더가
// display:none이라 0을 재게 되므로, onLoginSuccess가 헤더를 보여준 직후에도 한 번 더
// 불러야 한다(user.js의 onLoginSuccess 참고).
function updateUserHeaderHeightVar() {
  const header = document.getElementById("user-header");
  if (header && header.style.display !== "none") {
    document.documentElement.style.setProperty("--header-h", `${header.getBoundingClientRect().height}px`);
  }
}
window.addEventListener("resize", () => {
  clearTimeout(window._userHeaderResizeTimer);
  window._userHeaderResizeTimer = setTimeout(updateUserHeaderHeightVar, 150);
});

// ============ 화면 테마(시스템/라이트/다크) - kiosk.js와 동일한 패턴 ============
const USER_THEME_KEY = "user_theme_pref";

function setUserTheme(pref) {
  // body에 건다 - 모달들이 .mobile-wrapper의 자식이 아니라 body 바로 아래 형제로 마크업돼
  // 있어서, 래퍼에만 스코프를 걸면 모달 내부가 테마를 안 탄다.
  if (pref === "system") {
    localStorage.removeItem(USER_THEME_KEY);
    document.body.removeAttribute("data-theme");
  } else {
    localStorage.setItem(USER_THEME_KEY, pref);
    document.body.setAttribute("data-theme", pref);
  }
  updateUserThemeButtonsUI(pref);
  updateUserThemeColorMeta();
}

function initUserTheme() {
  updateUserThemeButtonsUI(localStorage.getItem(USER_THEME_KEY) || "system");
  updateUserThemeColorMeta();
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", updateUserThemeColorMeta);
  }
}

function updateUserThemeColorMeta() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  // 홈 화면에 설치된 PWA(WebAPK)에서는 실제 상태바 배경색이 설치 시점 매니페스트의
  // theme_color(검정)로 고정돼 이후 여기서 밝은 값을 줘도 안 바뀌는데, OS는 이 메타
  // 태그 값만 보고 아이콘 밝기(시계/배터리)를 어둡게 골라버려 검정 배경 위 검정
  // 아이콘이 되어 완전히 안 보이는 버그가 생긴다(wifi adb로 실기기 재현/검증 완료,
  // 라이트 테마일 때 admin.html도 동일 증상). 일반 브라우저 탭(주소창 틴트)에서는
  // 실제로 밝은 배경이 되므로 거기서만 라이트 테마를 따라간다.
  const isStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  if (isStandalone) {
    meta.setAttribute("content", "#000000");
    return;
  }
  const pref = localStorage.getItem(USER_THEME_KEY) || "system";
  const isLight = pref === "light" || (pref === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
  meta.setAttribute("content", isLight ? "#eef1f7" : "#000000");
}

function updateUserThemeButtonsUI(activePref) {
  const buttons = {
    system: document.getElementById("u-theme-system-btn"),
    light: document.getElementById("u-theme-light-btn"),
    dark: document.getElementById("u-theme-dark-btn"),
  };
  Object.entries(buttons).forEach(([pref, btn]) => {
    if (!btn) return;
    btn.classList.toggle("is-on", pref === activePref);
  });
}

// 로그인 토큰이 남아있으면 서버에 다시 확인해 최신 정보로 자동 로그인한다.
// (localStorage에 저장돼 있어 로그아웃 전까지 브라우저 재시작에도 유지된다)
async function restoreSession() {
  try {
    const res = await authFetch(`${API_BASE}/users/me`);
    if (res.ok) {
      loggedInUser = await res.json();
      onLoginSuccess(loggedInUser);
    } else {
      userLogout();
    }
  } catch (err) {
    console.error("Session restore error:", err);
  }
}

// 회원 자기 서비스 API 호출 공통 헬퍼 - Authorization 헤더 자동 부착, 401이면 로그아웃 처리.
async function authFetch(url, options = {}) {
  const headers = Object.assign({}, options.headers || {}, userToken ? { "Authorization": `Bearer ${userToken}` } : {});
  const res = await fetch(url, Object.assign({}, options, { headers }));
  if (res.status === 401) {
    userLogout();
    await showAlertModal("세션이 만료되었습니다. 다시 로그인해 주세요.");
  }
  return res;
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
function showModal(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; el.classList.add("active"); }
}
function hideModal(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'none'; el.classList.remove("active"); }
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

async function userLogin() {
  const phone = document.getElementById("login-phone").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!phone || !password) {
    await showAlertModal("휴대폰 번호와 비밀번호를 입력해주세요.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password })
    });

    const data = await res.json();
    if (!res.ok) {
      await showAlertModal(`[로그인 실패] ${data.detail || '휴대폰 번호 또는 비밀번호 오류'}`);
      return;
    }

    userToken = data.token;
    localStorage.setItem("user_token", userToken);
    loggedInUser = data;
    onLoginSuccess(loggedInUser);
  } catch (err) {
    console.error("Login Error:", err);
    await showAlertModal("서버 연결에 실패했습니다.");
  }
}

function userLogout() {
  localStorage.removeItem("user_token");
  userToken = null;
  loggedInUser = null;
  disconnectUserWebSocket();
  document.getElementById("user-login-wrapper").style.display = "flex";
  document.getElementById("user-shell").style.display = "none";
  document.getElementById("pending-deposit-card").style.display = "none";
  document.getElementById("charge-guide-section").style.display = "none";
  switchUserView("home");
  document.getElementById("login-phone").value = "";
  document.getElementById("login-password").value = "";
}

// 마이프로필 "로그아웃" 버튼 전용(#redesign, 사용자 피드백: "로그아웃 버튼은 컨펌 모달이
// 필요해") - 세션 만료(401)/복원 실패 시 자동 로그아웃(위 userLogout() 직접 호출, 두 곳)은
// 사용자 조작이 아니라 확인 없이 바로 처리해야 하므로 그대로 두고, 사람이 직접 누르는
// 경우에만 이 래퍼를 거치게 한다.
async function confirmUserLogout() {
  if (!(await showConfirmModal("로그아웃 하시겠습니까?"))) return;
  userLogout();
}

// ============ 탭 전환(홈/충전/QR결제/이용내역/마이프로필) - admin.js switchAdminView()와 같은 패턴 ============
// 상단 고정 바 제목(#redesign) - USER는 뒤로가기가 필요한 드릴다운 화면이 없는 평면 탭
// 5개뿐이라 ADMIN의 updateAdminHeader와 달리 제목만 갱신하면 된다.
const USER_HEADER_TITLES = {
  home: "소망페이",
  charge: "충전",
  history: "이용 내역",
  qr: "QR 결제",
  profile: "마이 프로필",
};

function switchUserView(viewName) {
  document.querySelectorAll("#user-shell .admin-view").forEach(el => el.classList.remove("active"));
  const target = document.getElementById(`user-view-${viewName}`);
  if (target) target.classList.add("active");
  document.querySelectorAll("#user-shell .admin-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
  const titleEl = document.getElementById("user-header-title");
  if (titleEl && USER_HEADER_TITLES[viewName]) titleEl.innerText = USER_HEADER_TITLES[viewName];
  if (viewName === "profile") refreshPushButtonUI();
}

function onLoginSuccess(user) {
  document.getElementById("user-login-wrapper").style.display = "none";
  document.getElementById("user-header").style.display = "grid"; // 로그인 전엔 숨겨둔 상단 고정 바(#redesign)
  updateUserHeaderHeightVar();
  document.getElementById("user-shell").style.display = "flex";
  document.getElementById("charge-guide-section").style.display = "block";

  document.getElementById("display-user-name").innerText = user.name;
  document.getElementById("display-user-badge").innerText = user.user_type === 'SENIOR' ? '시니어' : '일반';
  document.getElementById("display-user-badge").className = `badge-tag ${user.user_type === 'SENIOR' ? 'badge-senior' : 'badge-general'}`;
  renderUserBalance(user.credit_balance);
  // 마이 프로필 상단 이름+유형 배지 헤더(#redesign) - 홈 카드와 같은 정보, 별도 엘리먼트.
  document.getElementById("profile-display-name").innerText = user.name;
  document.getElementById("profile-display-badge").innerText = user.user_type === 'SENIOR' ? '시니어' : '일반';
  document.getElementById("profile-display-badge").className = `badge-tag ${user.user_type === 'SENIOR' ? 'badge-senior' : 'badge-general'}`;
  document.getElementById("display-user-phone").innerText = user.phone || "-"; // #redesign - 비활성 input → 읽기전용 행

  loadChargeGuide();
  loadMyDeposits();
  loadUserQrCard();
  connectUserWebSocket();
  ensurePushSubscriptionFresh();
  registerPeriodicPushRefresh();
}

// ============ 등록된 QR 카드(있으면) 표시 ============
// card_uid 문자열 자체는 서버가 이미 알고 있는 값이라 클라이언트에서 QR 이미지로 그리기만
// 하면 된다 - qrcode-generator.js(자체 호스팅, 외부 CDN 의존 없음)로 생성. 하단 탭바
// "QR결제" 탭(#user-update)을 누르면 팝업 없이 바로 이 이미지를 보여주는 전용 페이지로
// 전환된다(switchUserView('qr'), user.html의 #user-view-qr).
let _userQrDataUrl = null;

async function loadUserQrCard() {
  try {
    const res = await authFetch(`${API_BASE}/users/me/qr-card`);
    if (!res.ok) { _userQrDataUrl = null; return; }
    const data = await res.json();
    if (!data.card_uid) { _userQrDataUrl = null; return; }

    const qr = qrcode(0, "M");
    qr.addData(data.card_uid);
    qr.make();
    _userQrDataUrl = qr.createDataURL(6, 4);
  } catch (err) {
    console.error("QR 카드 조회 오류:", err);
    _userQrDataUrl = null;
  } finally {
    renderUserQrView();
  }
}

// QR 결제 탭의 내용을 현재 _userQrDataUrl 상태에 맞게 그린다 - 로그인 직후 카드 조회가
// 끝났을 때(loadUserQrCard)와 탭이 아직 로딩 전이었다가 다시 그려야 할 때 모두 이 함수
// 하나로 처리한다.
function renderUserQrView() {
  const img = document.getElementById("user-qr-page-img");
  const empty = document.getElementById("user-qr-page-empty");
  if (!img || !empty) return;
  const head = document.getElementById("user-qr-card-head");
  const guide = document.getElementById("user-qr-guide");
  const nameEl = document.getElementById("user-qr-name");
  if (nameEl && loggedInUser) nameEl.innerText = loggedInUser.name || "";
  if (_userQrDataUrl) {
    img.src = _userQrDataUrl;
    img.style.display = "block";
    empty.style.display = "none";
    if (head) head.style.display = "block";
    if (guide) guide.style.display = "block";
  } else {
    img.style.display = "none";
    empty.style.display = "block";
    if (head) head.style.display = "none";
    if (guide) guide.style.display = "none";
  }
}

// ============ 푸시 알림 구독 ============
// 서비스워커의 PushManager를 통해 구독하고, 서버(app/services/push.py)가 이후
// 잔액이 바뀌는 시점(입금 확인/충전 완료)에 이 구독으로 알림을 보낸다.
function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

// 네이티브 앱(AndroidInterface 있음)이나 홈 화면에 설치된 PWA(display-mode: standalone)에서만
// true. 일반 브라우저 탭은 설치된 PWA와 완전히 같은 origin+scope의 서비스워커/푸시 구독을
// 공유해서, 한쪽에서 알림을 켜고 끄면 다른 쪽 구독까지 같이 흔들리는 충돌이 있었다 - 그래서
// 일반 브라우저 탭에서는 푸시 알림 UI 자체를 숨겨 애초에 두 곳에서 켤 수 없게 한다.
function isInstalledUserAppContext() {
  if (window.AndroidInterface) return true;
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.navigator.standalone === true) return true; // iOS Safari 홈 화면 추가
  return false;
}

// 사용자가 "켜짐"으로 선택했다는 의도를 저장해두는 키. 실제 구독 여부(getSubscription())만
// 믿으면, 브라우저/푸시서비스가 백그라운드에서 조용히 구독을 만료시켰을 때(디바이스가 오래
// 꺼져있었거나 등) 다시 켜기 전까지 알림이 안 오는데도 사용자는 알 방법이 없다 - 이 의도
// 플래그가 켜져 있는 동안은 로그인/화면복귀 시마다 ensurePushSubscriptionFresh()가 조용히
// 재구독을 시도해서 만료를 스스로 복구한다.
const USER_PUSH_ENABLED_KEY = "user_push_enabled";

// VAPID 공개키를 서비스워커가 요구하는 Uint8Array 형태로 변환 (표준 스니펫).
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function getCurrentPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function refreshPushButtonUI() {
  // #redesign - u-push-section이 이제 캡션+카드를 함께 감싸는 바깥 래퍼라(그룹 전체를
  // 숨기기 위함, user.html 참고) 항상 block 레이아웃이면 된다 - 실제 가로 정렬(flex)은
  // 안쪽 행에 별도 style로 고정돼 있어 이 wrapper의 display 값과 무관하다.
  const section = document.getElementById("u-push-section");
  if (!isInstalledUserAppContext()) {
    if (section) section.style.display = "none";
    return;
  }
  if (section) section.style.display = "block";

  // 화면을 열 때마다 먼저 자가복구를 한 번 시도한다 - 구독이 이미 살아있으면 스로틀에 걸려
  // 즉시 반환되니 비용이 없고, 뭔가로 인해 끊겨 있었다면(새로고침/버전업 등) 여기서 바로
  // 복구되어 "꺼짐"으로 보이는 채 방치되지 않는다. ensurePushSubscriptionFresh()가 이미
  // 진행 중이던 갱신과도 중복 실행 없이 합쳐진다.
  await ensurePushSubscriptionFresh();

  const btn = document.getElementById("u-push-toggle-btn");
  const status = document.getElementById("u-push-status");
  if (!btn) return;
  if (!pushSupported()) {
    btn.disabled = true;
    btn.classList.remove("is-on");
    btn.setAttribute("aria-checked", "false");
    if (status) status.innerText = "미지원 브라우저";
    return;
  }
  const sub = await getCurrentPushSubscription();
  btn.disabled = false;
  if (status) status.innerText = "";
  btn.classList.toggle("is-on", !!sub);
  btn.setAttribute("aria-checked", sub ? "true" : "false");
}

async function togglePushNotifications() {
  const btn = document.getElementById("u-push-toggle-btn");
  const status = document.getElementById("u-push-status");
  if (btn) btn.disabled = true;
  if (status) status.innerText = "처리 중…";
  try {
    const sub = await getCurrentPushSubscription();
    if (sub) {
      await unsubscribeFromPush(sub);
    } else {
      await subscribeToPush();
    }
  } catch (err) {
    // subscribeToPush/unsubscribeFromPush 내부에서 이미 처리 못한 예기치 못한 예외 방지용 - 여기서
    // 놓치면 버튼이 "처리 중..."에 멈춘 채로 남아 클릭해도 아무 반응 없는 것처럼 보이게 된다.
    console.error("푸시 알림 토글 오류:", err);
    await showAlertModal(`푸시 알림 처리 중 오류가 발생했습니다.\n(${err && err.message ? err.message : err})`);
  }
  refreshPushButtonUI();
}

async function subscribeToPush() {
  if (!pushSupported()) {
    await showAlertModal("이 브라우저는 푸시 알림을 지원하지 않습니다.");
    return;
  }
  // 브라우저에서 이미 한 번 "차단"을 눌렀으면 requestPermission()이 브라우저 UI 없이 조용히
  // "denied"만 반환한다 - 이 경우를 구분해서 안내해야 사용자가 "눌러도 반응 없음"으로 오해하지 않는다.
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
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const subJson = sub.toJSON();
    const res = await authFetch(`${API_BASE}/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
    });
    if (!res.ok) throw new Error(`push/subscribe ${res.status}`);
    localStorage.setItem(USER_PUSH_ENABLED_KEY, "true");
  } catch (err) {
    console.error("푸시 구독 오류:", err);
    await showAlertModal(`푸시 알림 등록에 실패했습니다.\n(${err && err.message ? err.message : err})`);
  }
}

async function unsubscribeFromPush(sub) {
  localStorage.removeItem(USER_PUSH_ENABLED_KEY);
  try {
    await authFetch(`${API_BASE}/push/subscribe`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  } catch (err) {
    console.error("푸시 구독 해지 오류:", err);
  }
}

// getSubscription()이 뭔가를 돌려준다고 해서 실제로 유효한 건 아니다 - 푸시 서비스(FCM 등)가
// 서버 쪽에서 조용히 구독을 만료시켜도 브라우저는 실제 발송이 실패하기 전까진 이를 스스로
// 알아채지 못하고 죽은 구독 객체를 계속 "있음"으로 돌려준다. subscribe()를 다시 불러도
// applicationServerKey가 같으면 스펙상 기존 구독을 그대로 반환할 뿐이라 이것만으로는
// 갱신되지 않으므로, 먼저 해지한 뒤 다시 구독해 강제로 새 유효한 구독을 받아온다.
const USER_PUSH_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6시간 - 매 화면복귀마다 돌릴 필요는 없음
const USER_PUSH_LAST_REFRESH_KEY = "user_push_last_refresh_at";

// onLoginSuccess와 userRealtime의 onResume(pageshow/visibilitychange/online)이 첫 로드 시
// 거의 동시에 발화해서 ensurePushSubscriptionFresh()가 겹쳐 호출될 수 있다 - 스로틀 체크가
// "읽고 나중에 쓰는" 방식이라 두 호출 다 통과해버리면 해지→재구독이 동시에 두 번 돌면서
// 서로 경쟁하게 되고(한쪽이 해지한 직후를 다른 쪽이 "구독 없음"으로 잘못 보는 등), 실제로
// 이 때문에 구독이 일시적으로 완전히 사라지거나 중복 행이 쌓이는 게 확인됨. 진행 중인
// 실행이 있으면 새로 시작하지 않고 그 결과를 그대로 기다리게 해서 항상 한 번에 하나만 돈다.
let _userPushRefreshInFlight = null;

// 로그인 직후/화면 복귀(resume) 시마다 호출.
function ensurePushSubscriptionFresh() {
  if (!_userPushRefreshInFlight) {
    _userPushRefreshInFlight = _doEnsurePushSubscriptionFresh().finally(() => {
      _userPushRefreshInFlight = null;
    });
  }
  return _userPushRefreshInFlight;
}

async function _doEnsurePushSubscriptionFresh() {
  if (!isInstalledUserAppContext() || !pushSupported()) return;
  if (Notification.permission !== "granted") return;
  // USER_PUSH_ENABLED_KEY는 이번 변경으로 새로 생긴 플래그라 예전부터 켜둔 사용자는 저장된
  // 적이 없다 - 그런 기존 사용자도 놓치지 않도록 "지금 브라우저에 남아있는 구독"도 켜짐
  // 의도로 간주한다.
  const existingSub = await getCurrentPushSubscription();
  if (localStorage.getItem(USER_PUSH_ENABLED_KEY) !== "true" && !existingSub) return;

  // 스로틀은 "이미 살아있는 구독을 굳이 자주 갈아치우지 않기" 위한 것이지, 구독 자체가
  // 통째로 없는 상태(브라우저가 조용히 만료시켰거나, 이전 재구독 도중 새로고침 등으로
  // 끊긴 경우)까지 6시간 동안 방치하라는 뜻이 아니다 - existingSub가 없으면 즉시 재시도한다.
  const lastRefresh = Number(localStorage.getItem(USER_PUSH_LAST_REFRESH_KEY) || 0);
  if (existingSub && Date.now() - lastRefresh < USER_PUSH_REFRESH_INTERVAL_MS) return;

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
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const subJson = sub.toJSON();
    await authFetch(`${API_BASE}/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
    });
    if (oldEndpoint && oldEndpoint !== subJson.endpoint) {
      // 옛 구독 행이 만료된 채로 DB에 남아있지 않도록 정리 - 실패해도 어차피 다음 발송
      // 실패(404/410) 시 서버가 알아서 지우므로 best-effort로만 시도한다.
      authFetch(`${API_BASE}/push/subscribe`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: oldEndpoint }),
      }).catch(() => {});
    }
    localStorage.setItem(USER_PUSH_ENABLED_KEY, "true");
    localStorage.setItem(USER_PUSH_LAST_REFRESH_KEY, String(Date.now()));
  } catch (err) {
    console.error("푸시 구독 갱신 오류:", err);
  }
}

// 지원 브라우저(설치된 PWA + 사이트 참여도 조건 충족 시)에서는 앱을 아예 안 열어도 브라우저가
// 알아서 주기적으로 sw.js를 깨워 구독을 갱신해준다(sw.js의 periodicsync 핸들러 참고). 미지원
// 브라우저/조건 미충족이면 조용히 무시되는 best-effort라 실패해도 문제 삼지 않는다.
async function registerPeriodicPushRefresh() {
  if (!isInstalledUserAppContext() || !pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!("periodicSync" in reg)) return;
    const status = await navigator.permissions.query({ name: "periodic-background-sync" });
    if (status.state !== "granted") return;
    await reg.periodicSync.register("push-subscription-refresh", {
      minInterval: 12 * 60 * 60 * 1000, // 12시간 - 실제 주기는 브라우저가 기기 상태 보고 늘릴 수 있음
    });
  } catch (err) {
    console.error("Periodic Background Sync 등록 실패(미지원이거나 조건 미충족):", err);
  }
}

// ============ 실시간 갱신 (WebSocket) ============
// 관리자가 대신 충전해주거나, 계좌이체가 뒤늦게 매칭되거나, 키오스크에서 결제하는 등
// 다른 경로로 내 잔액/신청 상태가 바뀌면 새로고침 없이 반영한다.
// 재연결/화면복귀(resume) 로직 자체는 src/ws-client.js에 공유돼 있고(admin.js/kiosk.js와
// 동일), 여기서는 user 전용 설정(URL/인증 상태/메시지 처리/강제 재조회)만 주입한다.
const userRealtime = createRealtimeClient({
  buildUrl: () => {
    if (!userToken) return null;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${location.host}/ws/user?token=${encodeURIComponent(userToken)}`;
  },
  shouldReconnect: () => !!userToken, // 로그아웃으로 인한 정상 종료면 재연결 안 함
  onMessage: (data) => {
    if (data.type !== "refresh") return;
    if ((data.scopes || []).includes("me")) {
      refreshMyInfo();
      loadMyDeposits();
    }
  },
  onResume: () => {
    refreshMyInfo();
    loadMyDeposits();
    ensurePushSubscriptionFresh();
  },
});

function connectUserWebSocket() { userRealtime.connect(); }
function disconnectUserWebSocket() { userRealtime.disconnect(); }

async function refreshMyInfo() {
  const res = await authFetch(`${API_BASE}/users/me`);
  if (res.ok) {
    loggedInUser = await res.json();
    renderUserBalance(loggedInUser.credit_balance);
  }
}

// ============ 계좌이체 충전 안내 & 확인된 입금 내역 ============

// 클립보드에 복사할 문구 - "{은행명} {계좌번호}" 형태로 복사되게 해달라는 요청(#17)에 맞춰
// 표시용 텍스트("(예금주: ...)" 포함)와 별개로 은행명+계좌번호만 담아둔다.
let _chargeGuideAccountCopyText = "";

async function loadChargeGuide() {
  try {
    const res = await authFetch(`${API_BASE}/settings/charge-guide`);
    if (!res.ok) return;
    const guide = await res.json();
    // 표시/복사 문구 모두 "NH농협"처럼 통신사/제휴 접두어가 붙은 은행명이어도 접두어를
    // 떼고 "농협 <번호>"만 쓴다(#33) - 예금주는 라벨 없이 괄호 안에만 표기.
    const displayBankName = guide.bank_name.replace(/^NH\s*/, "");
    document.getElementById("charge-guide-account").innerText = `${displayBankName} ${guide.account_number} (${guide.account_holder})`;
    document.getElementById("charge-guide-depositor-name").innerText = guide.depositor_name;
    _chargeGuideAccountCopyText = `${displayBankName} ${guide.account_number}`;
  } catch (err) {
    console.error("loadChargeGuide error:", err);
  }
}

async function copyAccountNumber(btn) {
  if (!_chargeGuideAccountCopyText) return;
  try {
    await navigator.clipboard.writeText(_chargeGuideAccountCopyText);
  } catch (err) {
    console.error("copyAccountNumber error:", err);
    return;
  }
  const icon = document.getElementById("charge-guide-account-copy-icon");
  if (!icon) return;
  const original = icon.innerHTML;
  icon.innerHTML = '<svg class="icon-line" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 6 6L20 6"/></svg>';
  icon.style.color = "var(--accent-emerald)";
  clearTimeout(icon._resetTimer);
  icon._resetTimer = setTimeout(() => {
    icon.innerHTML = original;
    icon.style.color = "var(--text-muted)";
  }, 1500);
}

let _myDeposits = [];

// 회원 본인 이름으로 자동 매칭된 입금 내역(대기 중인 것 포함) - 대기중(PENDING) 카드용으로만
// 쓰인다. 지난 이용내역은 /api/history/me(백엔드가 계좌이체/결제/관리자충전을 통일된 형태로
// 병합해서 커서 페이지네이션으로 내려줌 - app/services/history.py)를 스크롤 시 이어서
// 불러온다(#history) - admin 회원상세(admin.js)와 완전히 같은 API/로직을 쓰므로 두 화면이
// 서로 다른 이력을 보여주는 일이 구조적으로 없다.
async function loadMyDeposits() {
  try {
    const depRes = await authFetch(`${API_BASE}/bank-transactions/me`);
    _myDeposits = depRes.ok ? await depRes.json() : [];
    renderPendingDepositCard();
  } catch (err) {
    console.error("loadMyDeposits error:", err);
  }
  setupHistoryInfiniteScroll();
  loadMoreHistory(true);
}

// ============ 이용 내역 (계좌이체/결제/관리자충전 통합, 스크롤 지연 로딩) ============
// 카드 렌더링(historyItemHtml 등)은 admin.js 회원상세와 공통으로 src/history-render.js에
// 있다 - 여기서는 이 페이지만의 커서/스크롤 상태만 관리한다.
let _historyCursor = null;
let _historyHasMore = true;
let _historyLoading = false;
let _historyDateState = { last: null };

async function loadMoreHistory(reset) {
  const box = document.getElementById("my-deposits-list");
  if (!box) return;
  if (reset) {
    _historyCursor = null;
    _historyHasMore = true;
    _historyDateState = { last: null };
    box.innerHTML = "";
  }
  if (!_historyHasMore || _historyLoading) return;
  _historyLoading = true;
  try {
    const url = `${API_BASE}/history/me?limit=20` + (_historyCursor ? `&before=${encodeURIComponent(_historyCursor)}` : "");
    const res = await authFetch(url);
    if (!res.ok) return;
    const data = await res.json();
    if (data.items.length === 0) {
      _historyHasMore = false;
      if (box.children.length === 0) {
        box.innerHTML = historyEmptyStateHtml("아직 이용 내역이 없습니다.");
      }
      return;
    }
    box.insertAdjacentHTML("beforeend", data.items.map((item) => historyItemHtml(item, _historyDateState)).join(""));
    _historyCursor = data.next_cursor;
  } catch (err) {
    console.error("loadMoreHistory error:", err);
  } finally {
    _historyLoading = false;
  }
}

// 이 페이지는 목록 전용 스크롤 박스가 따로 없이 페이지 전체(window)가 스크롤된다 - 하단
// 80px 이내로 들어오면 다음 페이지를 이어서 불러온다(admin.js 인박스 탭의 무한스크롤과
// 같은 임계값, 대상만 전용 스크롤 박스 대신 window로 다름).
function setupHistoryInfiniteScroll() {
  if (window._historyScrollWired) return;
  window._historyScrollWired = true;
  window.addEventListener("scroll", () => {
    if (!_historyHasMore || _historyLoading) return;
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 80) {
      loadMoreHistory(false);
    }
  });
}

// ============ 충전 대기 카드 - 행을 누르면 확정 버튼이 그 행 안에 오버레이된다(#18) ============
// 별도 확인 모달(과거 deposit-claim-modal) 대신, 카드 자체가 두 단계 상태(기본/확정 대기)를
// 갖는다. 한 번에 하나만 확정 대기 상태로 둔다 - 여러 건을 동시에 열어두면 실수로 엉뚱한
// 건을 확정할 위험이 있다.
let _armedDepositId = null;

function renderPendingDepositCard() {
  const card = document.getElementById("pending-deposit-card");
  const list = document.getElementById("pending-deposit-list");
  if (!card || !list) return;

  const pending = _myDeposits.filter(d => d.status === "PENDING");
  if (pending.length === 0) {
    card.style.display = "none";
    _armedDepositId = null;
    return;
  }
  if (!pending.some(d => d.id === _armedDepositId)) _armedDepositId = null;

  card.style.display = "block";
  list.innerHTML = pending.map(pendingDepositRowHtml).join("");
}

function pendingDepositRowHtml(d) {
  const armed = _armedDepositId === d.id;
  return `
    <div class="pending-deposit-row ${armed ? "armed" : ""}" onclick="event.stopPropagation(); armPendingDeposit(${d.id})">
      <div class="pending-deposit-row-info">
        <div class="pending-deposit-row-date">${formatDateTimeKST(d.created_at)}</div>
        <div class="pending-deposit-row-amount">+${d.amount.toLocaleString()}원</div>
      </div>
      <div class="pending-deposit-confirm-overlay" onclick="event.stopPropagation()">
        <span class="pending-deposit-confirm-text">${d.amount.toLocaleString()}원을 충전할까요?</span>
        <div class="pending-deposit-confirm-actions">
          <button class="btn-action" onclick="armPendingDeposit(null)">취소</button>
          <button class="btn-action btn-primary" onclick="confirmPendingDeposit(${d.id}, this)">확정</button>
        </div>
      </div>
    </div>
  `;
}

function armPendingDeposit(id) {
  _armedDepositId = (_armedDepositId === id) ? null : id;
  renderPendingDepositCard();
}

// 카드 바깥(또는 다른 대기 항목 바깥)을 누르면 확정 대기 상태를 취소한다 - 오버레이 버튼
// 클릭은 위에서 stopPropagation으로 여기까지 안 올라온다.
document.addEventListener("click", () => {
  if (_armedDepositId !== null) armPendingDeposit(null);
});

async function confirmPendingDeposit(id, btn) {
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    const res = await authFetch(`${API_BASE}/bank-transactions/${id}/claim`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await showAlertModal(`충전 실패: ${data.detail || '오류 발생'}`);
      btn.disabled = false;
      return;
    }
    _armedDepositId = null;
    await refreshMyInfo();
    await loadMyDeposits();
  } catch (err) {
    console.error("confirmPendingDeposit error:", err);
    await showAlertModal("서버 연결에 실패했습니다.");
    btn.disabled = false;
  }
}

// ============ 비밀번호 변경 ============

async function changePassword() {
  const newPassword = document.getElementById("edit-user-password").value.trim();
  if (!newPassword) {
    await showAlertModal("변경할 비밀번호를 입력해주세요.");
    return;
  }

  try {
    const res = await authFetch(`${API_BASE}/users/me/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_password: newPassword })
    });

    if (res.ok) {
      document.getElementById("edit-user-password").value = "";
      document.getElementById("change-password-btn").disabled = true; // #redesign - 값 비워졌으니 버튼도 같이 비활성화
      await showAlertModal("🎉 비밀번호가 변경되었습니다!");
    } else {
      const err = await res.json().catch(() => ({}));
      await showAlertModal(`비밀번호 변경 실패: ${err.detail || '오류 발생'}`);
    }
  } catch (e) {
    console.error("changePassword error:", e);
    await showAlertModal("서버 연결에 실패했습니다.");
  }
}
