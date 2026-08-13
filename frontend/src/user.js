const API_BASE = "/api";

let userToken = null;
let loggedInUser = null;

document.addEventListener("DOMContentLoaded", () => {
  const savedToken = localStorage.getItem("user_token");
  if (savedToken) {
    userToken = savedToken;
    restoreSession();
  }
});

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
  document.getElementById("display-user-badge").innerText = user.user_type === 'SENIOR' ? '👵👴 시니어' : '👦 일반';
  document.getElementById("display-user-badge").className = `badge-tag ${user.user_type === 'SENIOR' ? 'badge-senior' : 'badge-general'}`;
  document.getElementById("display-user-balance").innerText = `${user.credit_balance.toLocaleString()}원`;
  document.getElementById("display-user-phone").value = user.phone || "-";

  loadChargeGuide();
  loadMyRechargeRequests();
  connectUserWebSocket();
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
      loadMyRechargeRequests();
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

// ============ 계좌이체 충전 안내 & 신청 ============

async function loadChargeGuide() {
  try {
    const res = await authFetch(`${API_BASE}/settings/charge-guide`);
    if (!res.ok) return;
    const guide = await res.json();
    document.getElementById("charge-guide-account").innerText = `${guide.bank_name} ${guide.account_number} (예금주: ${guide.account_holder})`;
    document.getElementById("charge-guide-depositor-name").innerText = guide.depositor_name;
  } catch (err) {
    console.error("loadChargeGuide error:", err);
  }
}

async function submitRechargeRequest(btn) {
  const amount = parseInt(document.getElementById("recharge-request-amount").value);
  if (!amount || amount <= 0) {
    await showAlertModal("입금하신 금액을 올바르게 입력해주세요.");
    return;
  }

  if (btn.disabled) return;
  btn.disabled = true;
  try {
    const res = await authFetch(`${API_BASE}/recharge-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await showAlertModal(`충전 신청 실패: ${data.detail || '오류 발생'}`);
      return;
    }

    await showAlertModal(data.message, data.status === "MATCHED" ? "🎉 충전 완료" : "신청 접수됨");
    document.getElementById("recharge-request-amount").value = "";
    await refreshMyInfo();
    await loadMyRechargeRequests();
  } catch (err) {
    console.error("submitRechargeRequest error:", err);
  } finally {
    btn.disabled = false;
  }
}

async function loadMyRechargeRequests() {
  const box = document.getElementById("recharge-request-history");
  if (!box) return;
  try {
    const res = await authFetch(`${API_BASE}/recharge-requests/me`);
    if (!res.ok) return;
    const list = await res.json();
    const pending = list.filter(r => r.status === "PENDING");
    if (pending.length === 0) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = "⏳ 확인 대기 중인 신청: " + pending.map(r => `${r.requested_amount.toLocaleString()}원`).join(", ");
  } catch (err) {
    console.error("loadMyRechargeRequests error:", err);
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
