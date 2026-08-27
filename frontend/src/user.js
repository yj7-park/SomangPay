const API_BASE = "/api";

let userToken = null;
let loggedInUser = null;

// 관리자가 입력한 키오스크명/상품명 등 신뢰할 수 없는 텍스트를 innerHTML에 꽂을 때 XSS를 막는 이스케이프.
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

document.addEventListener("DOMContentLoaded", () => {
  const savedToken = localStorage.getItem("user_token");
  if (savedToken) {
    userToken = savedToken;
    restoreSession();
  }
  initUserTheme();
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
    const active = pref === activePref;
    btn.style.background = active ? "var(--accent-cyan)" : "var(--surface-1)";
    btn.style.color = active ? "#001318" : "var(--text-main)";
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
  document.getElementById("user-login-section").style.display = "block";
  document.getElementById("user-card-box").style.display = "none";
  document.getElementById("pending-deposit-card").style.display = "none";
  document.getElementById("charge-guide-section").style.display = "none";
  hideModal("user-settings-modal");
  document.getElementById("login-phone").value = "";
  document.getElementById("login-password").value = "";
}

function onLoginSuccess(user) {
  document.getElementById("user-login-section").style.display = "none";
  document.getElementById("user-card-box").style.display = "block";
  document.getElementById("charge-guide-section").style.display = "block";

  document.getElementById("display-user-name").innerText = user.name;
  document.getElementById("display-user-badge").innerText = user.user_type === 'SENIOR' ? '시니어' : '일반';
  document.getElementById("display-user-badge").className = `badge-tag ${user.user_type === 'SENIOR' ? 'badge-senior' : 'badge-general'}`;
  document.getElementById("display-user-balance").innerText = `${user.credit_balance.toLocaleString()}원`;
  document.getElementById("display-user-phone").value = user.phone || "-";

  loadChargeGuide();
  loadMyDeposits();
  loadUserQrCard();
  connectUserWebSocket();
}

// ============ 등록된 QR 카드(있으면) 표시 ============
// card_uid 문자열 자체는 서버가 이미 알고 있는 값이라 클라이언트에서 QR 이미지로 그리기만
// 하면 된다 - qrcode-generator.js(자체 호스팅, 외부 CDN 의존 없음)로 생성.
let _userQrDataUrl = null;

async function loadUserQrCard() {
  const thumb = document.getElementById("user-qr-thumb");
  if (!thumb) return;
  try {
    const res = await authFetch(`${API_BASE}/users/me/qr-card`);
    if (!res.ok) { thumb.style.display = "none"; return; }
    const data = await res.json();
    if (!data.card_uid) { thumb.style.display = "none"; return; }

    const qr = qrcode(0, "M");
    qr.addData(data.card_uid);
    qr.make();
    _userQrDataUrl = qr.createDataURL(6, 4);
    thumb.src = _userQrDataUrl;
    thumb.style.display = "block";
  } catch (err) {
    console.error("QR 카드 조회 오류:", err);
    thumb.style.display = "none";
  }
}

function openUserQrModal() {
  if (!_userQrDataUrl) return;
  document.getElementById("user-qr-modal-img").src = _userQrDataUrl;
  showModal("user-qr-modal");
}

function closeUserQrModal() {
  hideModal("user-qr-modal");
}

// ============ 설정 모달(내 정보/테마/로그아웃) ============
function openUserSettingsModal() {
  showModal("user-settings-modal");
  refreshPushButtonUI();
}

function closeUserSettingsModal() {
  hideModal("user-settings-modal");
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
  // u-push-section은 원래 style="display: flex"인 행이라, 다시 보여줄 때 ""로 지우면
  // display 자체가 인라인 스타일에서 빠지면서 flex 레이아웃도 같이 사라진다 - "flex"로 명시.
  const section = document.getElementById("u-push-section");
  if (!isInstalledUserAppContext()) {
    if (section) section.style.display = "none";
    return;
  }
  if (section) section.style.display = "flex";

  const btn = document.getElementById("u-push-toggle-btn");
  if (!btn) return;
  if (!pushSupported()) {
    btn.innerText = "🔕 미지원 브라우저";
    btn.disabled = true;
    return;
  }
  const sub = await getCurrentPushSubscription();
  btn.disabled = false;
  btn.innerText = sub ? "🔔 켜짐" : "🔕 꺼짐";
}

async function togglePushNotifications() {
  const btn = document.getElementById("u-push-toggle-btn");
  if (btn) { btn.disabled = true; btn.innerText = "⏳ 처리 중..."; }
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
  } catch (err) {
    console.error("푸시 구독 오류:", err);
    await showAlertModal(`푸시 알림 등록에 실패했습니다.\n(${err && err.message ? err.message : err})`);
  }
}

async function unsubscribeFromPush(sub) {
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
  },
});

function connectUserWebSocket() { userRealtime.connect(); }
function disconnectUserWebSocket() { userRealtime.disconnect(); }

async function refreshMyInfo() {
  const res = await authFetch(`${API_BASE}/users/me`);
  if (res.ok) {
    loggedInUser = await res.json();
    document.getElementById("display-user-balance").innerText = `${loggedInUser.credit_balance.toLocaleString()}원`;
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
        box.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 0.5rem 0;">아직 이용 내역이 없습니다.</p>`;
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
        <div class="pending-deposit-row-date">${new Date(d.created_at).toLocaleString()}</div>
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
