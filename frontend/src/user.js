const API_BASE = "/api";

let userToken = null;
let loggedInUser = null;

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
  document.getElementById("charge-guide-section").style.display = "none";
  document.getElementById("user-info-section").style.display = "none";
  document.getElementById("login-phone").value = "";
  document.getElementById("login-password").value = "";
}

function onLoginSuccess(user) {
  document.getElementById("user-login-section").style.display = "none";
  document.getElementById("user-card-box").style.display = "block";
  document.getElementById("charge-guide-section").style.display = "block";
  document.getElementById("user-info-section").style.display = "block";

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

// ============ 실시간 갱신 (WebSocket) ============
// 관리자가 대신 충전해주거나, 계좌이체가 뒤늦게 매칭되거나, 키오스크에서 결제하는 등
// 다른 경로로 내 잔액/신청 상태가 바뀌면 새로고침 없이 반영한다.
let userWs = null;
let userWsReconnectTimer = null;

function connectUserWebSocket() {
  if (!userToken) return;
  if (userWs && userWs.readyState <= 1) return;

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  userWs = new WebSocket(`${protocol}//${location.host}/ws/user?token=${encodeURIComponent(userToken)}`);

  userWs.onmessage = (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch (e) { return; }
    if (data.type !== "refresh") return;
    if ((data.scopes || []).includes("me")) {
      refreshMyInfo();
      loadMyDeposits();
    }
  };

  userWs.onclose = () => {
    userWs = null;
    if (!userToken) return; // 로그아웃으로 인한 정상 종료면 재연결 안 함
    clearTimeout(userWsReconnectTimer);
    userWsReconnectTimer = setTimeout(connectUserWebSocket, 3000);
  };

  userWs.onerror = () => {
    if (userWs) userWs.close();
  };
}

function disconnectUserWebSocket() {
  clearTimeout(userWsReconnectTimer);
  if (userWs) {
    userWs.close();
    userWs = null;
  }
}

async function refreshMyInfo() {
  const res = await authFetch(`${API_BASE}/users/me`);
  if (res.ok) {
    loggedInUser = await res.json();
    document.getElementById("display-user-balance").innerText = `${loggedInUser.credit_balance.toLocaleString()}원`;
  }
}

// ============ 계좌이체 충전 안내 & 확인된 입금 내역 ============

// 클립보드에 복사할 계좌번호 원본(하이픈 없는 순수 숫자) - 은행 앱들의 클립보드 자동인식
// 파서가 계좌번호를 숫자로만 정규식 매칭하는 경우가 많아, 복사본은 표시용 문구가 아니라
// 이 값을 써야 다른 은행 앱에 붙여넣었을 때 인식된다.
let _chargeGuideAccountDigits = "";

async function loadChargeGuide() {
  try {
    const res = await authFetch(`${API_BASE}/settings/charge-guide`);
    if (!res.ok) return;
    const guide = await res.json();
    document.getElementById("charge-guide-account").innerText = `${guide.bank_name} ${guide.account_number} (예금주: ${guide.account_holder})`;
    document.getElementById("charge-guide-depositor-name").innerText = guide.depositor_name;
    _chargeGuideAccountDigits = String(guide.account_number || "").replace(/\D/g, "");
  } catch (err) {
    console.error("loadChargeGuide error:", err);
  }
}

async function copyAccountNumber(btn) {
  if (!_chargeGuideAccountDigits) return;
  try {
    await navigator.clipboard.writeText(_chargeGuideAccountDigits);
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

// 회원 본인 이름으로 자동 매칭된 입금 내역(대기 중 + 과거 처리분 히스토리 포함).
// PENDING 건만 탭하면 확인 모달을 거쳐 본인 충전으로 확정할 수 있다.
const DEPOSIT_STATUS_LABEL = {
  PENDING: { text: "대기 (눌러서 충전)", cls: "status-pending" },
  CREDITED: { text: "충전 완료", cls: "status-done" },
  CREDITED_MANUAL: { text: "충전 완료(관리자 처리)", cls: "status-done" },
  OTHER: { text: "처리 보류(관리자 문의)", cls: "status-rejected" },
};

let _myDeposits = [];

async function loadMyDeposits() {
  const box = document.getElementById("my-deposits-list");
  if (!box) return;
  try {
    const res = await authFetch(`${API_BASE}/bank-transactions/me`);
    if (!res.ok) return;
    _myDeposits = await res.json();
    renderMyDeposits();
  } catch (err) {
    console.error("loadMyDeposits error:", err);
  }
}

function depositRowHtml(d) {
  const label = DEPOSIT_STATUS_LABEL[d.status] || { text: d.status, cls: "status-pending" };
  const clickable = d.status === "PENDING";
  return `
    <div style="background: var(--surface-2); border-radius: 10px; padding: 0.8rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; ${clickable ? "cursor: pointer; border: 1px solid rgba(245, 158, 11, 0.4);" : ""}"
         ${clickable ? `onclick="openDepositClaimModal(${d.id})"` : ""}>
      <div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${new Date(d.created_at).toLocaleString()}</div>
        <span class="activity-status ${label.cls}">${label.text}</span>
      </div>
      <div style="font-weight: 800; color: var(--accent-emerald); font-size: 1.05rem;">${d.amount.toLocaleString()}원</div>
    </div>
  `;
}

// 현재 확정을 기다리는 대기 건과, 이미 처리가 끝난 과거 히스토리를 한 목록에 섞어 보여주면
// 어떤 걸 눌러야 하는지 구분이 안 된다(#14) - 두 그룹으로 나눠 각각 소제목을 붙인다.
function renderMyDeposits() {
  const box = document.getElementById("my-deposits-list");
  if (!box) return;
  if (_myDeposits.length === 0) {
    box.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 0.5rem 0;">아직 확인된 입금 내역이 없습니다.</p>`;
    return;
  }
  const pending = _myDeposits.filter(d => d.status === "PENDING");
  const history = _myDeposits.filter(d => d.status !== "PENDING");

  let html = "";
  if (pending.length > 0) {
    html += `<div style="font-size: 0.8rem; font-weight: 700; color: var(--accent-amber); margin-bottom: -0.15rem;">충전 대기 중</div>`;
    html += pending.map(depositRowHtml).join("");
  }
  if (history.length > 0) {
    html += `<div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-top: ${pending.length > 0 ? "0.4rem" : "0"}; margin-bottom: -0.15rem;">지난 내역</div>`;
    html += history.map(depositRowHtml).join("");
  }
  box.innerHTML = html;
}

let _pendingClaimId = null;

function openDepositClaimModal(id) {
  const deposit = _myDeposits.find(d => d.id === id);
  if (!deposit) return;
  _pendingClaimId = id;
  document.getElementById("deposit-claim-message").innerText = `${deposit.amount.toLocaleString()}원 입금 건을 본인 충전으로 확정하시겠습니까?`;
  showModal("deposit-claim-modal");
}

function closeDepositClaimModal() {
  _pendingClaimId = null;
  hideModal("deposit-claim-modal");
}

async function confirmDepositClaim(btn) {
  if (!_pendingClaimId || btn.disabled) return;
  btn.disabled = true;
  try {
    const res = await authFetch(`${API_BASE}/bank-transactions/${_pendingClaimId}/claim`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    closeDepositClaimModal();
    if (!res.ok) {
      await showAlertModal(`충전 실패: ${data.detail || '오류 발생'}`);
      return;
    }
    await showAlertModal(data.message, "🎉 충전 완료");
    await refreshMyInfo();
    await loadMyDeposits();
  } catch (err) {
    console.error("confirmDepositClaim error:", err);
  } finally {
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
