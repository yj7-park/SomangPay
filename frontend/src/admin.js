const API_BASE = "/api";

let users = [];
let products = [];
let isAdminAuthenticated = false;
let adminToken = null;

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
    alert("관리자 세션이 만료되었습니다. 다시 인증해 주세요.");
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
    alert("PIN 번호를 입력하세요.");
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
      alert(data.detail || "PIN 시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요.");
    } else {
      alert("관리자 PIN 번호가 올바르지 않습니다.");
      if (pinInput) pinInput.value = "";
    }
  } catch (err) {
    console.error("PIN Auth error:", err);
    alert("서버 연결 오류. 잠시 후 다시 시도하세요.");
  }
}

function initAdminDashboard() {
  loadAdminUsers();
  loadAdminProducts();
  loadDepositHistories();
  loadAdminCards();
  initAdminNfcReader();
}

let adminScanMode = "NFC";
let adminCameraScanning = false;
let adminVideoStream = null;
let adminAnimFrameId = null;
let adminFacingMode = "user"; // 기본 전면 카메라
let adminQrCooldown = false; // 연속 스캔 방지 쿨다운
let adminNfcCooldown = false; // NFC 연속 태깅 방지 쿨다운
let adminNdefReader = null; // 중복 NDEFReader 생성 방지용 글로벌 레퍼런스

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

async function initAdminNfcReader() {
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
    console.log("Web NFC Auto Scan Activated.");
  } catch (e) {
    console.log("Web NFC Access/Scan Error:", e);
    adminNdefReader = null; // 실패 시 재시도 가능하게 초기화
  }
}

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
    alert("카메라에 접근할 수 없습니다. 실시간 QR 스캔 시뮬레이션 버튼을 이용해 주세요.");
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

async function loadAdminUsers() {
  try {
    const res = await adminFetch(`${API_BASE}/users`);
    if (!res.ok) return;
    users = await res.json();
    renderUsersTable();
    renderUserSelectDropdown();
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
    const histories = await res.json();
    renderDepositHistoriesTable(histories);
  } catch (err) {
    console.error("Failed to load deposit histories:", err);
  }
}

let cards = [];

async function loadAdminCards() {
  try {
    const res = await adminFetch(`${API_BASE}/cards`);
    if (!res.ok) return;
    cards = await res.json();
    renderCardsTable();
  } catch (err) {
    console.error("Failed to load cards:", err);
  }
}

function renderCardsTable() {
  const tbody = document.getElementById("admin-card-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (cards.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">등록된 카드가 없습니다.</td></tr>`;
    return;
  }

  cards.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${c.user_name || '-'}</strong></td>
      <td style="font-family: monospace;">${c.card_uid}</td>
      <td>${c.card_type === 'QR_CODE' ? '📷 QR' : '💳 NFC'}</td>
      <td>${c.card_name || '-'}</td>
      <td>${c.is_active
        ? '<span style="color: var(--accent-emerald); font-weight: bold;">활성</span>'
        : '<span style="color: #ef4444; font-weight: bold;">비활성</span>'}</td>
      <td>
        ${c.is_active
          ? `<button class="btn-action" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; width: auto; background: rgba(239,68,68,0.2); color: #fca5a5;" onclick="setCardActive(${c.id}, false)">비활성화</button>`
          : `<button class="btn-action" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; width: auto; background: rgba(16,185,129,0.2); color: #6ee7b7;" onclick="setCardActive(${c.id}, true)">재활성화</button>`}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function setCardActive(cardId, active) {
  if (!confirm(active ? "이 카드를 다시 활성화하시겠습니까?" : "이 카드를 비활성화하시겠습니까? 분실/도난 카드는 즉시 결제에 사용할 수 없게 됩니다.")) return;
  try {
    const res = await adminFetch(`${API_BASE}/cards/${cardId}/${active ? 'activate' : 'deactivate'}`, { method: "POST" });
    if (res.ok) {
      loadAdminCards();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(`처리 실패: ${data.detail || '오류 발생'}`);
    }
  } catch (err) {
    console.error("setCardActive error:", err);
  }
}

async function toggleUserStatus(userId, currentStatus) {
  const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  const label = newStatus === "SUSPENDED" ? "정지" : "재활성화";
  if (!confirm(`이 회원을 ${label}하시겠습니까? 정지된 회원은 즉시 결제가 차단됩니다.`)) return;

  try {
    const res = await adminFetch(`${API_BASE}/admin/users/${userId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      loadAdminUsers();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(`처리 실패: ${data.detail || '오류 발생'}`);
    }
  } catch (err) {
    console.error("toggleUserStatus error:", err);
  }
}

function renderUsersTable() {
  const tbody = document.getElementById("admin-user-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  users.forEach(u => {
    const tr = document.createElement("tr");
    const isActive = u.status === "ACTIVE";
    tr.innerHTML = `
      <td><strong>${u.name}</strong></td>
      <td><span class="badge-tag ${u.user_type === 'SENIOR' ? 'badge-senior' : 'badge-general'}">${u.user_type}</span></td>
      <td>${u.phone || '-'}</td>
      <td>${u.account_number || '-'}</td>
      <td style="color: var(--accent-emerald); font-weight: bold; font-size: 1.1rem;">${u.credit_balance.toLocaleString()}원</td>
      <td>${isActive
        ? '<span style="color: var(--accent-emerald); font-weight: bold;">활성</span>'
        : '<span style="color: #ef4444; font-weight: bold;">정지됨</span>'}</td>
      <td style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
        <button class="btn-action btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; width: auto;" onclick="quickRecharge(${u.id})">충전</button>
        <button class="btn-action" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; width: auto; background: ${isActive ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}; color: ${isActive ? '#fca5a5' : '#6ee7b7'};" onclick="toggleUserStatus(${u.id}, '${u.status}')">${isActive ? '정지' : '재활성화'}</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderUserSelectDropdown() {
  const select = document.getElementById("recharge-user-select");
  if (select) {
    select.innerHTML = users.map(u => `<option value="${u.id}">${u.name} (${u.user_type === 'SENIOR' ? '시니어' : '일반'}) - 잔액: ${u.credit_balance.toLocaleString()}원</option>`).join("");
  }
  
  const cardSelect = document.getElementById("admin-card-user-select");
  if (cardSelect) {
    cardSelect.innerHTML = '<option value="">-- 대리 발급 대상 회원 선택 --</option>' + users.map(u => `<option value="${u.id}">[${u.user_type === 'SENIOR' ? '시니어' : '일반'}] ${u.name} (${u.phone || u.account_number || '연락처없음'})</option>`).join("");
  }
}

// Admin Register Physical NFC Card or Church Member QR Code For User
async function adminRegisterCardForUser() {
  const userId = document.getElementById("admin-card-user-select").value;
  const cardType = adminScanMode === "QR" ? "QR_CODE" : "NFC";
  const cardUid = document.getElementById("admin-card-uid-input").value.trim();

  if (!userId) {
    alert("발급 대상 회원을 선택해 주세요.");
    return;
  }
  if (!cardUid) {
    alert("NFC 카드를 태그하시거나 교인증 QR 코드를 카메라에 스캔해 주세요.");
    return;
  }

  try {
    const res = await adminFetch(`${API_BASE}/cards/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_uid: cardUid,
        card_name: cardType === 'QR_CODE' ? "대리 등록 교인증 QR 코드" : "대리 발급 실물 NFC 카드",
        card_type: cardType,
        user_id: parseInt(userId)
      })
    });

    if (res.ok) {
      alert(`🎉 [관리자 식별자 대리 발급 성공!]\n유형: ${cardType === 'QR_CODE' ? '📷 교인증 QR 코드' : '💳 실물 NFC 카드'}\n식별 코드: ${cardUid}\n선택하신 회원 계정에 1:1 대리 발급이 완료되었습니다.`);
      document.getElementById("admin-card-uid-input").value = "";
      loadAdminUsers();
      loadAdminCards();
    } else {
      const errData = await res.json();
      alert(`식별자 대리 발급 실패: ${errData.detail || '오류 발생'}`);
    }
  } catch (err) {
    console.error("Admin register card error:", err);
    alert("서버 통신 중 에러가 발생했습니다.");
  }
}

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
    `;
    tbody.appendChild(tr);
  });
}

function renderDepositHistoriesTable(histories) {
  const tbody = document.getElementById("admin-deposit-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  histories.forEach(h => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(h.created_at).toLocaleString()}</td>
      <td><strong>${h.user_name}</strong></td>
      <td style="color: var(--accent-emerald); font-weight: bold;">+${h.amount.toLocaleString()}원</td>
      <td><span class="badge-tag badge-general">${h.deposit_type}</span></td>
      <td>${h.source_account || '-'}</td>
      <td>${h.memo || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function runNHBankDepositSimulation() {
  const account = document.getElementById("sim-account").value;
  const amount = parseInt(document.getElementById("sim-amount").value);

  if (!account || !amount || amount <= 0) {
    alert("계좌번호와 입금 금액을 입력하세요.");
    return;
  }

  try {
    const res = await adminFetch(`${API_BASE}/nhbank/mock-deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_account: account, amount: amount })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`[매칭 실패] ${data.detail}`);
      return;
    }

    alert(`🎉 [NH농협 입금 자동 충전 성공!]\n${data.message}`);
    loadAdminUsers();
    loadDepositHistories();
  } catch (err) {
    console.error("Simulation error:", err);
  }
}

async function submitProxyRegister() {
  const name = document.getElementById("reg-name").value;
  const phone = document.getElementById("reg-phone").value;
  const userType = document.getElementById("reg-type").value;
  const account = document.getElementById("reg-account").value;
  const credit = parseInt(document.getElementById("reg-credit").value) || 0;

  if (!name) {
    alert("성명을 입력하세요.");
    return;
  }

  try {
    const res = await adminFetch(`${API_BASE}/admin/register-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        phone: phone,
        user_type: userType,
        account_number: account,
        initial_credit: credit
      })
    });

    if (res.ok) {
      alert("신규 회원이 대리 등록되었습니다!");
      document.getElementById("reg-name").value = "";
      document.getElementById("reg-phone").value = "";
      document.getElementById("reg-account").value = "";
      document.getElementById("reg-credit").value = "0";
      loadAdminUsers();
    }
  } catch (err) {
    console.error("Proxy register error:", err);
  }
}

async function submitManualRecharge() {
  const userId = document.getElementById("recharge-user-select").value;
  const amount = parseInt(document.getElementById("recharge-amount").value);
  const memo = document.getElementById("recharge-memo").value;

  if (!userId || !amount || amount <= 0) {
    alert("충전 대상 및 금액을 올바르게 입력하세요.");
    return;
  }

  try {
    const res = await adminFetch(`${API_BASE}/admin/recharge-credit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: parseInt(userId),
        amount: amount,
        memo: memo || "관리자 직권 충전"
      })
    });

    if (res.ok) {
      const data = await res.json();
      alert(data.message);
      loadAdminUsers();
      loadDepositHistories();
    }
  } catch (err) {
    console.error("Manual recharge error:", err);
  }
}

function quickRecharge(userId) {
  document.getElementById("recharge-user-select").value = userId;
  document.getElementById("recharge-amount").focus();
}

async function submitAddProduct() {
  const name = document.getElementById("prod-name").value;
  const genPrice = parseInt(document.getElementById("prod-price-gen").value);
  const senPrice = parseInt(document.getElementById("prod-price-sen").value);

  if (!name || !genPrice) {
    alert("메뉴 이름과 일반 가격을 입력하세요.");
    return;
  }

  try {
    const res = await adminFetch(`${API_BASE}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        price_general: genPrice,
        price_senior: senPrice || genPrice
      })
    });

    if (res.ok) {
      alert("신규 메뉴가 추가되었습니다!");
      document.getElementById("prod-name").value = "";
      document.getElementById("prod-price-gen").value = "";
      document.getElementById("prod-price-sen").value = "";
      loadAdminProducts();
    }
  } catch (err) {
    console.error("Add product error:", err);
  }
}
