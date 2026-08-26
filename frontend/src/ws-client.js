// 관리자/회원/키오스크 세 화면이 쓰는 WebSocket 재연결 + 화면복귀(resume) 로직을 한 곳에
// 모아둔 공유 모듈. 페이지별로 다른 부분(연결 URL, 재연결 허용 조건, 메시지 처리, 화면
// 복귀 시 강제 재조회)만 config로 주입받는다. 번들러가 없는 구조라 IIFE/모듈로 감싸지
// 않고 top-level 함수 하나만 선언해 이후 로드되는 admin.js/user.js/kiosk.js에서 그대로
// 호출한다.
function createRealtimeClient({
  buildUrl,           // () => string|null - 연결할 WS URL. 아직 연결 준비가 안 됐으면(토큰/디바이스UUID 없음) null 반환
  shouldReconnect,    // () => boolean - 끊겼을 때 재연결을 시도해도 되는 상태인지 (로그아웃/미인증이면 false)
  onMessage,          // (data: object) => void - JSON.parse된 메시지 전체를 그대로 전달 (type/scopes 판별은 호출부 책임)
  onResume,           // (선택) () => void - 화면이 다시 보일 때(visibilitychange/pageshow/online) 놓쳤을 갱신을 잡기 위한 강제 재조회
  reconnectDelayMs = 3000,
}) {
  let socket = null;
  let reconnectTimer = null;

  function connect() {
    if (socket && socket.readyState <= 1) return; // 이미 연결(중)이면 중복 연결 안 함
    const url = buildUrl();
    if (!url) return; // 아직 연결 준비가 안 됐으면 이번 시도는 건너뜀

    socket = new WebSocket(url);

    socket.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch (e) { return; }
      onMessage(data);
    };

    socket.onclose = () => {
      socket = null;
      if (!shouldReconnect()) return;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, reconnectDelayMs);
    };

    socket.onerror = () => {
      if (socket) socket.close();
    };
  }

  function disconnect() {
    clearTimeout(reconnectTimer);
    if (socket) {
      socket.close();
      socket = null;
    }
  }

  // 모바일 브라우저/WebView는 화면이 꺼지거나 백그라운드로 가면 WS 연결을 조용히 끊어버리는데
  // onclose가 늦게(또는 안) 불려서 재연결 타이머가 안 걸리는 경우가 있다(#18) - 화면을 다시
  // 보는 시점에 소켓 상태를 점검해 필요하면 즉시 재연결하고, 놓쳤을 갱신도 바로 잡는다.
  function resume() {
    if (!shouldReconnect()) return;
    if (!socket || socket.readyState >= 2) connect(); // CLOSING(2) 또는 CLOSED(3)
    if (onResume) onResume();
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resume();
  });
  window.addEventListener("pageshow", resume);
  window.addEventListener("online", resume);

  return { connect, disconnect, resume };
}
