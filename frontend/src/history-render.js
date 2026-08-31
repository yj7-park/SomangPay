// ============ 이용 내역 카드 렌더링 (admin.js 회원상세/키오스크상세 / user.js 마이페이지 공통, #33) ============
// 세 화면이 같은 백엔드 커서 페이지네이션(app/services/history.py, /history/me·/admin/history·
// /admin/kiosks/:id/history)을 쓰면서도 각자 historyItemHtml을 따로 들고 있어 카드 마크업이
// 갈라지기 쉬웠다 - 여기 하나로 합쳐서 세 화면이 항상 같은 모양을 보여주게 한다. 페이지별
// 커서/스크롤 상태(_historyCursor류)는 여기서 관리하지 않고 호출하는 쪽(admin.js/user.js)이
// 각자 들고 있는다 - 화면마다 새로고침 시점(로그인 직후 vs 회원상세 진입)이 달라서다.

// 카드에 찍히는 시간 표기 - "오전/오후 h:mm" (날짜는 별도 구분선으로 뺀다).
function formatHistoryTime(date) {
  let h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "오전" : "오후";
  h = h % 12 || 12;
  return `${ampm} ${h}:${m}`;
}

// 날짜 구분선 표기(#history-redesign) - 예전엔 "2026년 8월 30일 일요일"처럼 항상 풀 문장을
// 가운데 정렬로 찍었는데, 카드 안에서는 장황하다. 대기 입금 카드 등 다른 곳의 "오늘/어제"
// 표기(formatDateTimeKST)와 같은 기준으로 오늘/어제는 그 단어만, 그 외엔 "n월 n일 (요일)"로
// 줄인다.
function formatHistoryDateDivider(date) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (historyDateKey(date) === historyDateKey(now)) return "오늘";
  if (historyDateKey(date) === historyDateKey(yesterday)) return "어제";
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  const md = `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekday})`;
  return date.getFullYear() === now.getFullYear() ? md : `${date.getFullYear()}. ${md}`;
}

function historyDateKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// 공용 날짜·시각 표기 - new Date(x).toLocaleString()이 브라우저 로캘에 따라
// "8/30/2026, 9:09:16 PM"처럼 영어로 새는 걸 막고, ADMIN 충전함 행·입금 처리 모달과
// USER 대기 카드가 전부 "오늘 오후 9:09 / 8월 30일 오후 9:09" 형태로 통일되게 한다.
function formatDateTimeKST(value) {
  if (value == null || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  let datePart;
  if (historyDateKey(d) === historyDateKey(now)) datePart = "오늘";
  else if (historyDateKey(d) === historyDateKey(yesterday)) datePart = "어제";
  else if (d.getFullYear() === now.getFullYear()) datePart = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  else datePart = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
  return `${datePart} ${formatHistoryTime(d)}`;
}

// 카테고리별 좌측 원형 아이콘(#history-redesign) - label만으로는 계좌이체 자동충전과
// 관리자 직권충전이 둘 다 "금액 충전"이라 구분이 안 돼, 백엔드가 내려주는 item.category로
// 아이콘 모양(path)과 틴트(cls, .history-item-icon에 붙는 보조 클래스)를 고른다.
// 색 자체는 상태(성공/실패/보류)가 아니라 "누가 일으킨 이벤트인가"를 나타낸다 - 정상 결제는
// 무채색, 계좌이체 자동충전만 초록(입금), 관리자 개입(충전/차감)은 브랜드 액센트/빨강으로
// 눈에 띄게 한다. 아이콘 svg 자체는 다른 곳(admin.html/user.html)의 icon-line 세트와 같은
// 스타일(viewBox 24, stroke 1.7, round cap/join)로 맞췄다.
const HISTORY_ICON_PATHS = {
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 1.95-1.57L23 6H6"/>',
  in: '<path d="M12 5v13"/><path d="M6 13l6 6 6-6"/>',
  out: '<path d="M12 19V6"/><path d="M6 12l6-6 6 6"/>',
  gift: '<path d="M20 12v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
};
const HISTORY_CATEGORY_META = {
  payment: { icon: "cart", cls: "" },
  payment_failed: { icon: "cart", cls: "danger" },
  bank_charge: { icon: "in", cls: "pos" },
  pending: { icon: "clock", cls: "warn" },
  admin_charge: { icon: "gift", cls: "accent" },
  admin_deduct: { icon: "out", cls: "danger" },
};

function historyIconHtml(category) {
  const meta = HISTORY_CATEGORY_META[category] || { icon: "cart", cls: "" };
  return `
    <div class="history-item-icon ${meta.cls}">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${HISTORY_ICON_PATHS[meta.icon]}</svg>
    </div>
  `;
}

// 결제류(payment/payment_failed)는 카드 제목에 이미 "무엇을 샀는지/왜 실패했는지"가
// reason으로 들어있어 그걸 그대로 제목으로 쓰고 시간만 부제로 둔다. 충전/차감류는 반대로
// label("계좌이체 충전"/"관리자 충전" 등)을 제목으로, reason(매칭 계좌·메모)과 시간을
// 부제 한 줄에 합쳐서 보여준다(#history-redesign, 리뷰 목업 참고).
function historyTitleParts(item, timeText) {
  if (item.category === "payment" || item.category === "payment_failed") {
    return { title: item.reason, subtitle: timeText };
  }
  return { title: item.label, subtitle: item.reason ? `${item.reason} · ${timeText}` : timeText };
}

// 이력 행 레이아웃(#19, #history-redesign): 좌측 카테고리 아이콘 + 제목/부제, 우측 금액 +
// 잔액. 예전엔 카드마다 --surface-2로 배경을 다시 채워 바깥 카드 안에 카드가 겹쳐 보였는데
// (#33 이후 리뷰 지적), flat한 hairline 구분 행으로 바꿨다 - 감싸는 쪽(user.html/admin.html)
// 이 이미 .glass-container 카드 하나로 화면 전체를 감싸고 있으니 행 자체엔 배경을 안 준다.
// 금액 색도 "지출까지 빨강이면 전부 빨강이라 불안하다"는 지적에 따라 입금(amount-positive)만
// 초록으로 두고 나머지는 기본 잉크색(.history-item-amount 기본값)에 맡긴다 - amount_class는
// 계속 그대로 꽂아두되 CSS 쪽에서 amount-positive만 색을 준다.
// 백엔드가 label/badge_class/category/amount_text/amount_class를 이미 계산해서 내려주므로
// 여기선 그대로 조합만 한다. 날짜별로 행을 묶어 구분선(.history-date-divider)을 넣고, 행
// 자체에는 시간만 표시한다(#33) - dateState({last})는 호출하는 쪽이 목록을 새로 그릴 때마다
// {last: null}로 리셋해서 넘겨줘야 하고, 페이지네이션으로 이어 불러올 때는 같은 객체를
// 계속 재사용해야 날짜가 바뀔 때만 구분선이 새로 찍힌다.
function historyItemHtml(item, dateState) {
  const date = new Date(item.event_time);
  const dateKey = historyDateKey(date);
  let html = "";
  if (dateKey !== dateState.last) {
    html += `<div class="history-date-divider">${formatHistoryDateDivider(date)}</div>`;
    dateState.last = dateKey;
  }
  const { title, subtitle } = historyTitleParts(item, formatHistoryTime(date));
  html += `
    <div class="history-item">
      ${historyIconHtml(item.category)}
      <div class="history-item-left">
        <div class="history-item-title">${escapeHtml(title)}</div>
        <div class="history-item-subtitle">${escapeHtml(subtitle)}</div>
      </div>
      <div class="history-item-right">
        <div class="history-item-amount ${item.amount_class}">${item.amount_text}</div>
        ${item.balance_after != null ? `<div class="history-item-balance">잔액 ${item.balance_after.toLocaleString()}원</div>` : ""}
      </div>
    </div>
  `;
  return html;
}

// 빈 상태(#history-redesign) - 회색 텍스트 한 줄이던 걸 아이콘 + 친근한 카피로 바꿨다.
// message는 화면마다 다른 문구("아직 이용 내역이 없습니다." / "이력이 없습니다." /
// "결제 이력이 없습니다.")를 그대로 받아서 쓴다.
function historyEmptyStateHtml(message) {
  return `
    <div class="history-empty">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14l2 2 4-4"/><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/></svg>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}
