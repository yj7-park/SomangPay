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
}

function closeUserSettingsModal() {
  hideModal("user-settings-modal");
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

// 모바일 브라우저는 화면이 꺼지거나 탭이 백그라운드로 가면 WS 연결을 조용히 끊어버리는데,
// onclose가 늦게(또는 안) 불려서 3초 재연결 타이머가 안 걸리는 경우가 실제로 있다(#18) -
// 화면을 다시 보는 시점(visibilitychange/pageshow)에 소켓 상태를 점검해 필요하면 즉시
// 재연결하고, 그 사이 놓쳤을 수 있는 갱신을 잡기 위해 최신 데이터도 바로 한 번 더 불러온다.
function resumeUserRealtime() {
  if (!userToken) return;
  if (!userWs || userWs.readyState >= 2) { // CLOSING(2) 또는 CLOSED(3)
    connectUserWebSocket();
  }
  refreshMyInfo();
  loadMyDeposits();
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) resumeUserRealtime();
});
window.addEventListener("pageshow", resumeUserRealtime);
window.addEventListener("online", resumeUserRealtime);

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
    document.getElementById("charge-guide-account").innerText = `${guide.bank_name} ${guide.account_number} (예금주: ${guide.account_holder})`;
    document.getElementById("charge-guide-depositor-name").innerText = guide.depositor_name;
    // 복사 문구는 "NH농협"처럼 통신사/제휴 접두어가 붙은 은행명이어도 접두어를 떼고
    // "농협 <번호>"만 담는다(#18) - 표시용 텍스트는 원래 은행명을 그대로 유지.
    const copyBankName = guide.bank_name.replace(/^NH\s*/, "");
    _chargeGuideAccountCopyText = `${copyBankName} ${guide.account_number}`;
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

// 회원 본인 이름으로 자동 매칭된 입금 내역(대기 중 + 과거 처리분 히스토리 포함).
// PENDING 건은 "이용 내역" 목록이 아니라 메인 카드 바로 아래 별도 강조 카드
// (#pending-deposit-card, renderPendingDepositCard)로 분리해서 보여준다(#18) -
// 처리해야 할 일과 지난 기록이 한 목록에 섞이면 뭘 눌러야 하는지 구분이 안 됐다(#14).
// 좌상단 종류 배지 - 실제 크레딧 반영 여부와 무관하게 "충전"으로 뭉뚱그리면 미반영건(OTHER)이
// 충전된 것처럼 보이므로 그 경우만 "보류"로 따로 표시한다(#19).
function depositTypeInfo(d) {
  if (d.status === "OTHER") return { text: "보류", cls: "status-rejected" };
  return { text: "충전", cls: "status-done" };
}

// 좌하단 사유 - 백엔드가 DepositHistory.memo에 남기는 문구와 맞춰 자기 확인/관리자 대신
// 처리/보류 사유를 구분한다(main.py의 claim_bank_transaction / admin_resolve_bank_transaction 참고).
function depositReason(d) {
  if (d.status === "CREDITED") return "본인 확인 후 충전";
  if (d.status === "CREDITED_MANUAL") return d.resolution_memo || "관리자가 대신 충전 처리";
  if (d.status === "OTHER") return d.resolution_memo || "처리 보류(관리자 문의)";
  return "-";
}

let _myDeposits = [];
let _myPayments = [];

async function loadMyDeposits() {
  const box = document.getElementById("my-deposits-list");
  if (!box) return;
  try {
    const [depRes, payRes] = await Promise.all([
      authFetch(`${API_BASE}/bank-transactions/me`),
      authFetch(`${API_BASE}/payments/me`),
    ]);
    _myDeposits = depRes.ok ? await depRes.json() : [];
    _myPayments = payRes.ok ? await payRes.json() : [];
    renderPendingDepositCard();
    renderMyDeposits();
  } catch (err) {
    console.error("loadMyDeposits error:", err);
  }
}

// 이력 카드 레이아웃(#19): 좌상단 종류 배지 + 날짜, 좌하단 사유, 우상단 금액, 우하단 잔액.
// 어드민 회원상세의 renderDetailHistory()와 동일한 마크업/클래스(.history-item*)를 쓴다.
function depositRowHtml(d) {
  const type = depositTypeInfo(d);
  const amountCls = type.text === "보류" ? "amount-neutral" : "amount-positive";
  const amountText = type.text === "보류" ? `${d.amount.toLocaleString()}원` : `+${d.amount.toLocaleString()}원`;
  return `
    <div class="history-item">
      <div class="history-item-left">
        <div class="history-item-top">
          <span class="activity-status ${type.cls}">${type.text}</span>
          <span class="history-item-date">${new Date(d.created_at).toLocaleString()}</span>
        </div>
        <div class="history-item-reason">${escapeHtml(depositReason(d))}</div>
      </div>
      <div class="history-item-right">
        <div class="history-item-amount ${amountCls}">${amountText}</div>
        ${d.balance_after != null ? `<div class="history-item-balance">잔액 ${d.balance_after.toLocaleString()}원</div>` : ""}
      </div>
    </div>
  `;
}

// 회원 본인의 키오스크 결제 내역(#15) - 충전과 반대로 잔액이 빠져나간 건이라 지난 내역
// 안에서 금액을 빨간색 마이너스로 표시해 충전(+)과 한눈에 구분되게 한다. SUCCESS는
// status-done(초록, 충전 완료와 동일)이 아니라 status-payment(파랑)를 써서 충전 완료와도
// 구분되고(#17), FAILED는 실제 차감이 없었던 시도이므로 별도의 "실패" 종류로 나눈다(#19).
function paymentRowHtml(p) {
  const isFailed = p.status === "FAILED";
  const type = isFailed ? { text: "실패", cls: "status-rejected" } : { text: "결제", cls: "status-payment" };
  const reason = isFailed
    ? (p.failure_reason || "결제 실패")
    : ([p.kiosk_name, p.product_details].filter(Boolean).join(" · ") || "-");
  return `
    <div class="history-item">
      <div class="history-item-left">
        <div class="history-item-top">
          <span class="activity-status ${type.cls}">${type.text}</span>
          <span class="history-item-date">${new Date(p.created_at).toLocaleString()}</span>
        </div>
        <div class="history-item-reason">${escapeHtml(reason)}</div>
      </div>
      <div class="history-item-right">
        <div class="history-item-amount ${isFailed ? "amount-neutral" : "amount-negative"}">-${p.amount.toLocaleString()}원</div>
        <div class="history-item-balance">잔액 ${p.balance_after.toLocaleString()}원</div>
      </div>
    </div>
  `;
}

// 이미 끝난 과거 내역(충전 완료 + 결제)만 시간순으로 함께 보여준다(#15). 대기 중인 건은
// #pending-deposit-card가 따로 담당한다(#18).
function renderMyDeposits() {
  const box = document.getElementById("my-deposits-list");
  if (!box) return;
  const history = [
    ..._myDeposits.filter(d => d.status !== "PENDING").map(d => ({ at: d.created_at, html: depositRowHtml(d) })),
    ..._myPayments.map(p => ({ at: p.created_at, html: paymentRowHtml(p) })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  if (history.length === 0) {
    box.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 0.5rem 0;">아직 이용 내역이 없습니다.</p>`;
    return;
  }
  box.innerHTML = history.map(h => h.html).join("");
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
