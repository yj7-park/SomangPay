const API_BASE = "/api";

let users = [];
let loggedInUser = null;

document.addEventListener("DOMContentLoaded", () => {
  loadUsers();
  
  // Check session login
  const savedUser = sessionStorage.getItem("logged_in_user");
  if (savedUser) {
    try {
      loggedInUser = JSON.parse(savedUser);
      onLoginSuccess(loggedInUser);
    } catch (e) {
      sessionStorage.removeItem("logged_in_user");
    }
  }
});

async function userLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!username || !password) {
    alert("아이디와 비밀번호를 입력해주세요.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`[로그인 실패] ${data.detail || '아이디 또는 비밀번호 오류'}`);
      return;
    }

    loggedInUser = data;
    sessionStorage.setItem("logged_in_user", JSON.stringify(loggedInUser));
    onLoginSuccess(loggedInUser);
    alert(`🎉 [로그인 성공] ${loggedInUser.name}님 환영합니다!`);
  } catch (err) {
    console.error("Login Error:", err);
    alert("서버 연결에 실패했습니다.");
  }
}

function userLogout() {
  sessionStorage.removeItem("logged_in_user");
  loggedInUser = null;
  document.getElementById("user-login-section").style.display = "block";
  document.getElementById("user-card-section").style.display = "none";
  document.getElementById("recharge-section").style.display = "none";
  document.getElementById("user-info-section").style.display = "none";
  document.getElementById("login-username").value = "";
  document.getElementById("login-password").value = "";
}

function onLoginSuccess(user) {
  document.getElementById("user-login-section").style.display = "none";
  document.getElementById("user-card-section").style.display = "block";
  document.getElementById("recharge-section").style.display = "block";
  document.getElementById("user-info-section").style.display = "block";

  // Render User Balance Card
  document.getElementById("user-display-name").innerText = `${user.name} 님 [${user.user_type === 'SENIOR' ? '시니어' : '일반'}]`;
  document.getElementById("user-credit-balance").innerText = `${user.credit_balance.toLocaleString()} 원`;
  document.getElementById("user-bank-info").innerText = `${user.bank_name || '농협'} ${user.account_number || '등록계좌 없음'}`;

  // Populate Edit Info Inputs
  document.getElementById("edit-user-phone").value = user.phone || "";
  document.getElementById("edit-user-bank").value = user.bank_name || "농협";
  document.getElementById("edit-user-account").value = user.account_number || "";
  document.getElementById("edit-user-password").value = "";

  // Render QR Code
  generateUserQrCode(user);

  // Fetch Read-only Registered Physical Cards
  fetchUserCards(user.id);
}

async function loadUsers() {
  try {
    // 전체 회원 목록(전화번호/계좌번호/잔액 등 PII 포함)은 관리자 전용이라, 이 계정 선택
    // 드롭다운은 이름/구분/아이디만 내려주는 공개 최소 정보 엔드포인트를 쓴다.
    const res = await fetch(`${API_BASE}/users/public`);
    users = await res.json();
    renderUserSelectOptions();
  } catch (err) {
    console.error("Failed to load users:", err);
  }
}

function renderUserSelectOptions() {
  const select = document.getElementById("user-select");
  if (!select) return;
  select.innerHTML = `<option value="">-- 접속할 회원을 선택하세요 --</option>`;

  users.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.innerText = `${u.name} (${u.user_type === 'SENIOR' ? '시니어' : '일반'}) - ${u.username}`;
    select.appendChild(opt);
  });
}

function onUserChange() {
  const userId = document.getElementById("user-select").value;
  const userCard = document.getElementById("user-card-box");
  const rechargeSec = document.getElementById("recharge-section");
  const accSec = document.getElementById("account-info-section");
  const nfcSec = document.getElementById("nfc-section");

  if (!userId) {
    userCard.style.display = "none";
    rechargeSec.style.display = "none";
    accSec.style.display = "none";
    nfcSec.style.display = "none";
    return;
  }

  const user = users.find(u => u.id === parseInt(userId));
  if (user) {
    userCard.style.display = "block";
    rechargeSec.style.display = "block";
    accSec.style.display = "block";
    nfcSec.style.display = "block";

    document.getElementById("display-user-name").innerText = user.name;
    document.getElementById("display-user-badge").innerText = user.user_type === 'SENIOR' ? '👵👴 시니어' : '👦 일반';
    document.getElementById("display-user-badge").className = `badge-tag ${user.user_type === 'SENIOR' ? 'badge-senior' : 'badge-general'}`;
    document.getElementById("display-user-balance").innerText = `${user.credit_balance.toLocaleString()}원`;
    document.getElementById("display-user-account").innerText = user.account_number || "등록된 계좌 없음";
  }
}

function setPresetAmt(amt) {
  document.getElementById("recharge-amt-input").value = amt;
}

async function triggerDeeplink(provider) {
  if (!loggedInUser) {
    alert("로그인이 필요합니다.");
    return;
  }
  const userId = loggedInUser.id;
  const amount = parseInt(document.getElementById("recharge-amt-input").value);

  if (!userId || !amount || amount <= 0) {
    alert("회원을 선택하고 올바른 충전 금액을 입력해주세요.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/payments/deeplink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: parseInt(userId),
        amount: amount,
        provider: provider
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.detail || "딥링크 생성 실패");
      return;
    }

    console.log(`Executing ${data.app_name} Deeplink:`, data.deeplink_url);
    window.location.href = data.deeplink_url;

    // Simulation Auto Confirm for Demo
    setTimeout(async () => {
      const confirmRes = await fetch(`${API_BASE}/payments/deeplink-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: parseInt(userId),
          amount: amount,
          provider: provider
        })
      });

      if (confirmRes.ok) {
        const confirmData = await confirmRes.json();
        alert(confirmData.message);
        await loadUsers();
        onUserChange();
      }
    }, 1500);

  } catch (err) {
    console.error("Deeplink error:", err);
  }
}

function openSelfRegisterModal() {
  const el = document.getElementById("self-reg-modal");
  if (el) {
    el.style.display = 'flex';
    el.classList.add("active");
  }
}

function closeSelfRegisterModal() {
  const el = document.getElementById("self-reg-modal");
  if (el) {
    el.style.display = 'none';
    el.classList.remove("active");
  }
}

async function submitSelfRegister() {
  const username = document.getElementById("self-reg-username").value.trim();
  const name = document.getElementById("self-reg-name").value.trim();
  const phone = document.getElementById("self-reg-phone").value.trim();
  const userType = document.getElementById("self-reg-type").value;
  const account = document.getElementById("self-reg-account").value.trim();

  if (!username || !name) {
    alert("아이디와 성명을 입력하세요.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username,
        name: name,
        phone: phone,
        user_type: userType,
        account_number: account
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.detail || "회원가입 실패");
      return;
    }

    alert(`🎉 회원가입이 완료되었습니다!환영합니다, ${data.name}님.`);
    closeSelfRegisterModal();
    await loadUsers();

    // Auto-select newly created user
    document.getElementById("user-select").value = data.id;
    onUserChange();
  } catch (err) {
    console.error("Self register error:", err);
  }
}

// Scan & Register Physical NFC Card
async function scanAndRegisterPhysicalCard() {
  const userId = document.getElementById("user-select").value;
  const statusElem = document.getElementById("nfc-scan-status");

  if (!userId) {
    alert("회원을 먼저 선택해주세요.");
    return;
  }

  statusElem.style.display = "block";
  statusElem.innerText = "📡 스마트폰 뒷면에 실물 카드를 접촉해 주세요...";

  if ('NDEFReader' in window) {
    try {
      const ndef = new NDEFReader();
      await ndef.scan();

      ndef.onreading = async (event) => {
        const physicalUid = event.serialNumber;
        if (!physicalUid) {
          alert("카드의 고유 시리얼(UID)을 읽을 수 없습니다. 다시 접촉해 주세요.");
          return;
        }
        statusElem.innerText = `💳 실물 카드 감지 성공! UID: ${physicalUid}`;
        await saveNfcUidToBackend(userId, physicalUid, "스마트폰 셀프 등록 실물 NFC 카드");
      };
      return;
    } catch (err) {
      console.error("NDEF scan error:", err);
      alert(`NFC 센서 활성화 실패: ${err.message || err}. 카드 번호를 직접 입력해 주세요.`);
    }
  } else {
    alert("현재 브라우저는 Web NFC를 지원하지 않습니다. 아래 입력창에 카드 번호(UID)를 입력해주세요.");
  }
}

// Register Manual Card UID
async function registerManualCardUid() {
  const userId = document.getElementById("user-select").value;
  const cardUid = document.getElementById("manual-card-uid-input").value.trim();

  if (!userId) {
    alert("회원을 먼저 선택해주세요.");
    return;
  }
  if (!cardUid) {
    alert("카드 고유 번호(UID)를 입력해 주세요.");
    return;
  }

  await saveNfcUidToBackend(userId, cardUid, "수동 입력 실물 NFC 카드");
  document.getElementById("manual-card-uid-input").value = "";
}

async function fetchUserCards(userId) {
  const box = document.getElementById("user-registered-cards-box");
  const ul = document.getElementById("user-registered-cards-ul");
  ul.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/cards/user/${userId}`);
    if (res.ok) {
      const cards = await res.json();
      if (cards.length > 0) {
        box.style.display = "block";
        cards.forEach(c => {
          const li = document.createElement("li");
          li.innerText = `💳 ${c.card_name} (UID: ${c.card_uid})`;
          ul.appendChild(li);
        });
      } else {
        box.style.display = "none";
      }
    }
  } catch (e) {
    console.error("fetchUserCards error:", e);
  }
}

async function saveNfcUidToBackend(userId, cardUid, cardName) {
  const statusElem = document.getElementById("nfc-scan-status");
  try {
    const res = await fetch(`${API_BASE}/cards/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_uid: cardUid,
        card_name: cardName,
        user_id: parseInt(userId)
      })
    });

    if (res.ok) {
      if (statusElem) statusElem.innerText = `✅ 카드가 등록되었습니다! (UID: ${cardUid})`;
      await fetchUserCards(userId);
    } else {
      const err = await res.json().catch(() => ({}));
      if (statusElem) statusElem.innerText = `❌ 카드 등록 실패: ${err.detail || '오류 발생'}`;
    }
  } catch (e) {
    console.error("saveNfcUidToBackend error:", e);
    if (statusElem) statusElem.innerText = "❌ 서버 연결에 실패했습니다.";
  }
}

// Save User Info Edit (Phone, Bank, Account, Password)
async function saveUserInfoEdit() {
  if (!loggedInUser) return;

  const phone = document.getElementById("edit-user-phone").value.trim();
  const bankName = document.getElementById("edit-user-bank").value.trim();
  const accountNumber = document.getElementById("edit-user-account").value.trim();
  const newPassword = document.getElementById("edit-user-password").value.trim();

  try {
    const res = await fetch(`${API_BASE}/users/${loggedInUser.id}/info`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone,
        bank_name: bankName,
        account_number: accountNumber,
        new_password: newPassword || null
      })
    });

    if (res.ok) {
      const updated = await res.json();
      loggedInUser = updated;
      sessionStorage.setItem("logged_in_user", JSON.stringify(loggedInUser));
      onLoginSuccess(loggedInUser);
      alert("🎉 회원 정보 및 비밀번호가 성공적으로 수정되었습니다!");
    } else {
      const err = await res.json();
      alert(`정보 수정 실패: ${err.detail || '오류 발생'}`);
    }
  } catch (e) {
    console.error("saveUserInfoEdit error:", e);
    alert("서버 연결에 실패했습니다.");
  }
}
