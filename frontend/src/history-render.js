// ============ 이용 내역 카드 렌더링 (admin.js 회원상세 / user.js 마이페이지 공통, #33) ============
// 두 화면이 같은 백엔드 커서 페이지네이션(app/services/history.py, /history/me·/admin/history)을
// 쓰면서도 각자 historyItemHtml을 따로 들고 있어 카드 마크업이 갈라지기 쉬웠다 - 여기 하나로
// 합쳐서 두 화면이 항상 같은 모양을 보여주게 한다. 페이지별 커서/스크롤 상태(_historyCursor류)는
// 여기서 관리하지 않고 호출하는 쪽(admin.js/user.js)이 각자 들고 있는다 - 화면마다 새로고침
// 시점(로그인 직후 vs 회원상세 진입)이 달라서다.

// 카드에 찍히는 시간 표기 - "오전/오후 h:mm" (날짜는 별도 구분선으로 뺀다).
function formatHistoryTime(date) {
  let h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "오전" : "오후";
  h = h % 12 || 12;
  return `${ampm} ${h}:${m}`;
}

function formatHistoryDateDivider(date) {
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${weekday}요일`;
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

// 이력 카드 레이아웃(#19): 좌상단 종류 배지 + 시간, 좌하단 사유, 우상단 금액, 우하단 잔액.
// 백엔드가 label/badge_class/amount_text/amount_class를 이미 계산해서 내려주므로 여기선
// 그대로 꽂기만 한다. 날짜별로 카드를 묶어 구분선(.history-date-divider)을 넣고, 카드
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
  html += `
    <div class="history-item">
      <div class="history-item-left">
        <div class="history-item-top">
          <span class="activity-status ${item.badge_class}">${item.label}</span>
          <span class="history-item-date">${formatHistoryTime(date)}</span>
        </div>
        <div class="history-item-reason">${escapeHtml(item.reason)}</div>
      </div>
      <div class="history-item-right">
        <div class="history-item-amount ${item.amount_class}">${item.amount_text}</div>
        ${item.balance_after != null ? `<div class="history-item-balance">잔액 ${item.balance_after.toLocaleString()}원</div>` : ""}
      </div>
    </div>
  `;
  return html;
}
