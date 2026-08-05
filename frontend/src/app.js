const API_BASE = "http://localhost:8000/api";

// State
let products = [];
let users = [];
let cards = [];
let cart = {}; // { productId: quantity }
let currentTab = "kiosk";

// Initial Load
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  loadProducts();
  loadUsers();
  loadCards();
  loadDepositHistories();

  // Web NFC setup if available
  initWebNFC();
});

// Navigation Tabs
function initTabs() {
  const tabs = document.querySelectorAll(".nav-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      currentTab = tab.dataset.tab;
      document.querySelectorAll(".tab-content").forEach(c => c.style.display = "none");
      document.getElementById(`tab-${currentTab}`).style.display = "block";

      if (currentTab === "kiosk") loadProducts();
      if (currentTab === "admin") {
        loadUsers();
        loadCards();
        loadDepositHistories();
      }
    });
  });
}

// Fetch APIs
async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    products = await res.json();
    renderKioskProducts();
    renderAdminProducts();
  } catch (err) {
    console.error("Failed to load products:", err);
  }
}

async function loadUsers() {
  try {
    const res = await fetch(`${API_BASE}/users`);
    users = await res.json();
    renderUserSelectOptions();
    renderAdminUsers();
  } catch (err) {
    console.error("Failed to load users:", err);
  }
}

async function loadCards() {
  try {
    const res = await fetch(`${API_BASE}/cards`);
    cards = await res.json();
    renderAdminCards();
  } catch (err) {
    console.error("Failed to load cards:", err);
  }
}

async function loadDepositHistories() {
  try {
    const res = await fetch(`${API_BASE}/histories/deposits`);
    const histories = await res.json();
    renderAdminDepositHistories(histories);
  } catch (err) {
    console.error("Failed to load deposit histories:", err);
  }
}

// ================= KIOSK LOGIC =================
function renderKioskProducts() {
  const container = document.getElementById("kiosk-products-container");
  if (!container) return;
  container.innerHTML = "";

  products.forEach(p => {
    const qty = cart[p.id] || 0;
    const card = document.createElement("div");
    card.className = `product-card ${qty > 0 ? 'selected' : ''}`;
    card.innerHTML = `
      <div>
        <div class="product-name">${p.name}</div>
        <div class="price-tag">일반: ${p.price_general.toLocaleString()}원</div>
        <div class="price-senior-tag">시니어: ${p.price_senior.toLocaleString()}원</div>
      </div>
      <div class="qty-control" onclick="event.stopPropagation()">
        <button class="qty-btn" onclick="updateCart(${p.id}, -1)">-</button>
        <span class="qty-num">${qty}</span>
        <button class="qty-btn" onclick="updateCart(${p.id}, 1)">+</button>
      </div>
    `;
    container.appendChild(card);
  });

  updateKioskTotal();
}

function updateCart(productId, delta) {
  const current = cart[productId] || 0;
  const next = Math.max(0, current + delta);
  if (next === 0) delete cart[productId];
  else cart[productId] = next;

  renderKioskProducts();
}

function updateKioskTotal() {
  let totalMin = 0;
  let totalMax = 0;
  let items = [];

  for (const [pid, qty] of Object.entries(cart)) {
    const product = products.find(p => p.id === parseInt(pid));
    if (product) {
      totalMax += product.price_general * qty;
      totalMin += product.price_senior * qty;
      items.push(`${product.name} x${qty}`);
    }
  }

  const totalDisplay = document.getElementById("kiosk-total-price");
  const summaryDisplay = document.getElementById("kiosk-items-summary");

  if (items.length === 0) {
    totalDisplay.innerText = "0원";
    summaryDisplay.innerText = "선택된 메뉴가 없습니다.";
  } else if (totalMin === totalMax) {
    totalDisplay.innerText = `${totalMax.toLocaleString()}원`;
    summaryDisplay.innerText = items.join(", ");
  } else {
    totalDisplay.innerText = `${totalMax.toLocaleString()}원 (시니어: ${totalMin.toLocaleString()}원)`;
    summaryDisplay.innerText = items.join(", ");
  }
}

// Payment via NFC Tagging
async function triggerNFCAutoPayment(cardUid) {
  const items = [];
  for (const [pid, qty] of Object.entries(cart)) {
    if (qty > 0) items.push({ product_id: parseInt(pid), quantity: qty });
  }

  if (items.length === 0) {
    alert("결제하실 상품을 먼저 선택해주세요.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/payments/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_uid: cardUid,
        items: items,
        merchant_id: 1
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showPaymentResultModal(false, data.detail || "결제 실패");
      playTTS("잔액이 부족합니다.");
      return;
    }

    // Success
    showPaymentResultModal(true, data);
    playTTS("결제되었습니다.");

    // Clear Cart after payment
    cart = {};
    renderKioskProducts();
    loadUsers(); // Refresh balance
  } catch (err) {
    console.error("Payment error:", err);
    showPaymentResultModal(false, "서버 통신 오류가 발생했습니다.");
  }
}

// TTS (Text-to-Speech)
function playTTS(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // Stop current
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  }
}

// Payment Result Modal
function showPaymentResultModal(isSuccess, data) {
  const modal = document.getElementById("payment-modal");
  const modalBox = document.getElementById("modal-box");
  modal.style.display = "flex";

  if (isSuccess) {
    modalBox.className = "modal-content";
    modalBox.innerHTML = `
      <div style="font-size: 4rem; color: #10b981; margin-bottom: 0.5rem;">✅</div>
      <h2 style="font-size: 1.8rem; margin-bottom: 0.5rem;">결제 완료</h2>
      <div style="margin-bottom: 1rem;">
        <span class="badge ${data.user_type === '시니어' ? 'badge-senior' : 'badge-general'}">${data.user_type} 회원</span>
        <strong style="font-size: 1.3rem; margin-left: 0.5rem;">${data.user_name}님</strong>
      </div>
      <div style="background: rgba(15,23,42,0.8); padding: 1rem; border-radius: 12px; margin: 1rem 0;">
        <div style="color: #94a3b8;">결제 차감 금액</div>
        <div style="font-size: 1.6rem; font-weight: 800; color: #6366f1;">${data.total_amount.toLocaleString()}원</div>
        <div style="color: #94a3b8; margin-top: 0.5rem;">결제 후 남은 잔액</div>
        <div style="font-size: 1.4rem; font-weight: 800; color: #10b981;">${data.balance_after.toLocaleString()}원</div>
      </div>
      <p style="color: #94a3b8; font-size: 0.9rem;" id="modal-timer">3초 후 대기 화면으로 자동 전환됩니다.</p>
    `;
  } else {
    modalBox.className = "modal-content failed";
    modalBox.innerHTML = `
      <div style="font-size: 4rem; color: #f43f5e; margin-bottom: 0.5rem;">⚠️</div>
      <h2 style="font-size: 1.8rem; margin-bottom: 0.5rem; color: #f43f5e;">결제 실패</h2>
      <p style="font-size: 1.2rem; margin: 1rem 0;">${data}</p>
      <button class="btn btn-primary" onclick="closePaymentModal()">닫기</button>
    `;
  }

  // Auto close after 3s
  if (isSuccess) {
    let secondsLeft = 3;
    const timerInterval = setInterval(() => {
      secondsLeft--;
      const timerElem = document.getElementById("modal-timer");
      if (timerElem) timerElem.innerText = `${secondsLeft}초 후 대기 화면으로 자동 전환됩니다.`;
      if (secondsLeft <= 0) {
        clearInterval(timerInterval);
        closePaymentModal();
      }
    }, 1000);
  }
}

function closePaymentModal() {
  document.getElementById("payment-modal").style.display = "none";
}

// Web NFC Support (Chrome for Android)
function initWebNFC() {
  if ('NDEFReader' in window) {
    try {
      const ndef = new NDEFReader();
      ndef.scan().then(() => {
        console.log("Web NFC reader initialized.");
        ndef.onreading = event => {
          const serialNumber = event.serialNumber;
          console.log("NFC Tag read:", serialNumber);
          triggerNFCAutoPayment(serialNumber);
        };
      }).catch(err => {
        console.log("NFC scan error or permission denied:", err);
      });
    } catch (e) {
      console.log("Web NFC not supported in this browser environment.");
    }
  }
}

// ================= USER MOBILE VIEW =================
function renderUserSelectOptions() {
  const userSelect = document.getElementById("mobile-user-select");
  if (!userSelect) return;
  userSelect.innerHTML = `<option value="">-- 회원을 선택하세요 --</option>`;

  users.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.innerText = `${u.name} (${u.user_type === 'SENIOR' ? '시니어' : '일반'}) - ${u.username}`;
    userSelect.appendChild(opt);
  });
}

function onUserSelectChange() {
  const userId = document.getElementById("mobile-user-select").value;
  const detailsBox = document.getElementById("user-details-box");

  if (!userId) {
    detailsBox.style.display = "none";
    return;
  }

  const user = users.find(u => u.id === parseInt(userId));
  if (user) {
    detailsBox.style.display = "block";
    document.getElementById("user-name-display").innerText = user.name;
    document.getElementById("user-type-badge").innerText = user.user_type === 'SENIOR' ? '👵👴 시니어 회원' : '👦 일반 회원';
    document.getElementById("user-balance-display").innerText = `${user.credit_balance.toLocaleString()}원`;
    document.getElementById("user-account-display").innerText = user.account_number || "등록된 계좌 없음";
  }
}

function selectPresetAmount(amt) {
  document.getElementById("user-recharge-amount-input").value = amt;
}

// Trigger Toss or KakaoPay App Deeplink Easy Recharge
async function triggerPayDeeplink(provider) {
  const userId = document.getElementById("mobile-user-select").value;
  const amount = parseInt(document.getElementById("user-recharge-amount-input").value);

  if (!userId || !amount || amount <= 0) {
    alert("회원을 선택하고 올바른 충전 금액을 입력해주세요.");
    return;
  }

  try {
    // 1. Get Deeplink URL from backend
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

    // 2. Open App Deeplink (Toss / KakaoPay App Trigger)
    console.log(`Opening ${data.app_name} Deeplink:`, data.deeplink_url);

    // Try executing native app scheme
    window.location.href = data.deeplink_url;

    // 3. Auto-Confirm Simulation for Web Testing
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
        loadUsers(); // Refresh balance
        onUserSelectChange();
      }
    }, 1500);

  } catch (err) {
    console.error("Deeplink error:", err);
  }
}

// Register Mobile NFC Card
async function registerUserNFC() {
  const userId = document.getElementById("mobile-user-select").value;
  const cardUidInput = document.getElementById("user-nfc-input").value;

  if (!userId || !cardUidInput) {
    alert("회원 선택 및 NFC UID를 입력해주세요.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/cards/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_uid: cardUidInput.trim(),
        card_name: "사용자 본인 스마트폰/카드 NFC",
        user_id: parseInt(userId)
      })
    });

    if (res.ok) {
      alert("NFC 카드가 성공적으로 등록되었습니다!");
      document.getElementById("user-nfc-input").value = "";
      loadCards();
    }
  } catch (err) {
    console.error("NFC Register error:", err);
  }
}

// ================= ADMIN DASHBOARD LOGIC =================

function renderAdminUsers() {
  const tbody = document.getElementById("admin-user-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  users.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${u.name}</strong></td>
      <td><span class="badge ${u.user_type === 'SENIOR' ? 'badge-senior' : 'badge-general'}">${u.user_type}</span></td>
      <td>${u.phone || '-'}</td>
      <td>${u.account_number || '-'}</td>
      <td style="color: #10b981; font-weight: bold;">${u.credit_balance.toLocaleString()}원</td>
      <td>
        <button class="btn btn-primary" style="padding: 0.3rem 0.8rem; font-size: 0.85rem;" onclick="openRechargeModal(${u.id}, '${u.name}')">충전</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Admin recharge dropdown
  const rechargeSelect = document.getElementById("admin-recharge-user-select");
  if (rechargeSelect) {
    rechargeSelect.innerHTML = users.map(u => `<option value="${u.id}">${u.name} (잔액: ${u.credit_balance.toLocaleString()}원)</option>`).join("");
  }
}

function renderAdminCards() {
  const tbody = document.getElementById("admin-card-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  cards.forEach(c => {
    const owner = users.find(u => u.id === c.user_id);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><code>${c.card_uid}</code></td>
      <td>${c.card_name || 'NFC 카드'}</td>
      <td>${owner ? owner.name : 'Unknown'}</td>
      <td><span style="color: #10b981;">활성</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdminProducts() {
  const tbody = document.getElementById("admin-product-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  products.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${p.name}</strong></td>
      <td>${p.price_general.toLocaleString()}원</td>
      <td style="color: #f59e0b;">${p.price_senior.toLocaleString()}원</td>
      <td><span style="color: #10b981;">판매중</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdminDepositHistories(histories) {
  const tbody = document.getElementById("admin-deposit-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  histories.forEach(h => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(h.created_at).toLocaleString()}</td>
      <td><strong>${h.user_name}</strong></td>
      <td style="color: #10b981; font-weight: bold;">+${h.amount.toLocaleString()}원</td>
      <td><span class="badge badge-general">${h.deposit_type}</span></td>
      <td>${h.source_account || '-'}</td>
      <td>${h.memo || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Admin Proxy Register User
async function submitAdminProxyRegister() {
  const name = document.getElementById("admin-reg-name").value;
  const phone = document.getElementById("admin-reg-phone").value;
  const userType = document.getElementById("admin-reg-type").value;
  const account = document.getElementById("admin-reg-account").value;
  const initialCredit = parseInt(document.getElementById("admin-reg-credit").value) || 0;

  if (!name) {
    alert("이름을 입력해주세요.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/register-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        phone: phone,
        user_type: userType,
        account_number: account,
        initial_credit: initialCredit
      })
    });

    if (res.ok) {
      alert("회원이 성공적으로 생성되었습니다!");
      document.getElementById("admin-reg-name").value = "";
      document.getElementById("admin-reg-phone").value = "";
      document.getElementById("admin-reg-account").value = "";
      document.getElementById("admin-reg-credit").value = "0";
      loadUsers();
    }
  } catch (err) {
    console.error("Admin proxy register error:", err);
  }
}

// Admin Manual Recharge
async function submitAdminRecharge() {
  const userId = document.getElementById("admin-recharge-user-select").value;
  const amount = parseInt(document.getElementById("admin-recharge-amount").value);
  const memo = document.getElementById("admin-recharge-memo").value;

  if (!userId || !amount || amount <= 0) {
    alert("올바른 회원 및 충전 금액을 입력하세요.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/recharge-credit`, {
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
      loadUsers();
      loadDepositHistories();
    }
  } catch (err) {
    console.error("Admin recharge error:", err);
  }
}

// NH Bank Mock Deposit Simulator
async function simulateNHBankDeposit() {
  const account = document.getElementById("sim-account-input").value;
  const amount = parseInt(document.getElementById("sim-amount-input").value);

  if (!account || !amount || amount <= 0) {
    alert("출처 계좌번호와 입금 금액을 입력해주세요.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/nhbank/mock-deposit?source_account=${encodeURIComponent(account)}&amount=${amount}`, {
      method: "POST"
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`[매칭 실패] ${data.detail}`);
      return;
    }

    alert(`🎉 [NH농협 입금 자동 충전 성공!]\n${data.message}`);
    loadUsers();
    loadDepositHistories();
  } catch (err) {
    console.error("NH Deposit Simulator error:", err);
  }
}

// Admin Add Product
async function submitAdminAddProduct() {
  const name = document.getElementById("prod-name").value;
  const generalPrice = parseInt(document.getElementById("prod-price-gen").value);
  const seniorPrice = parseInt(document.getElementById("prod-price-sen").value);

  if (!name || !generalPrice) {
    alert("메뉴 이름과 일반 가격을 입력하세요.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        price_general: generalPrice,
        price_senior: seniorPrice || generalPrice
      })
    });

    if (res.ok) {
      alert("신규 메뉴가 등록되었습니다.");
      document.getElementById("prod-name").value = "";
      document.getElementById("prod-price-gen").value = "";
      document.getElementById("prod-price-sen").value = "";
      loadProducts();
    }
  } catch (err) {
    console.error("Add product error:", err);
  }
}
