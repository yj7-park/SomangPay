// 배포로 코드가 바뀌어도, 이미 열려서 실행 중인 화면은 브라우저가 실제로 새 요청을 하기
// 전까지는 계속 예전 코드로 동작한다 - 화면 안의 탭(홈/검색/충전함 등) 전환은 이미 받아온
// JS 안에서 DOM만 바꾸는 것이라 이 문제를 해결해주지 못한다. 이 스크립트는 주기적으로
// 정적 파일의 Last-Modified 값을 확인해서 바뀐 게 감지되면 새로고침(또는 배너로 알림)한다.
//
// admin.html/kiosk.html/user.html/index.html 네 화면이 각자 아래 data-* 옵션으로 로드한다.
//   data-mode="auto"   : 사람이 계속 지켜보지 않는 화면(키오스크) - 안전한 시점에 조용히 자동 새로고침
//   data-mode="prompt" : 사람이 조작 중인 화면(관리자/회원) - 배너로 알리고 눌러야 새로고침
//                        (기본값 - data-mode를 생략하면 prompt로 동작)
//   data-check="url,url" : 감지에 쓸 정적 리소스 목록(콤마 구분, 하나라도 바뀌면 업데이트로 판단)
//   data-idle-check="전역함수이름" : auto 모드에서 "지금 새로고침해도 안전한가"를 판단하는 함수.
//       생략하면 열린 모달이 없는 상태만을 안전 상태로 본다. 함수를 주면 그 결과와 모달-닫힘
//       조건을 함께(AND) 만족해야 새로고침한다 (예: 키오스크는 장바구니가 비어있고 결제 중이
//       아닐 때만 - kiosk.js의 window.isKioskIdleForReload 참고).
(function () {
  const scriptEl = document.currentScript;
  const mode = (scriptEl && scriptEl.dataset.mode) || "prompt";
  const checkUrls = ((scriptEl && scriptEl.dataset.check) || location.pathname)
    .split(",").map((s) => s.trim()).filter(Boolean);
  const idleCheckFnName = scriptEl && scriptEl.dataset.idleCheck;
  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5분마다 확인
  const RETRY_INTERVAL_MS = 5000; // auto 모드에서 지금 당장은 안전하지 않을 때 재시도 간격

  let baseline = null; // 각 리소스의 Last-Modified/ETag 초기값 (감지에 쓸 "서명")
  let updateAvailable = false;

  async function fetchSignature(url) {
    try {
      const res = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (!res.ok) return null;
      return res.headers.get("Last-Modified") || res.headers.get("ETag") || null;
    } catch (e) {
      return null; // 오프라인/네트워크 오류 - 이번 확인은 건너뛴다
    }
  }

  function captureBaseline() {
    return Promise.all(checkUrls.map(fetchSignature)).then((sigs) => { baseline = sigs; });
  }

  function noModalOpen() {
    return !document.querySelector(".modal-overlay.active");
  }

  function isSafeToReload() {
    if (!noModalOpen()) return false;
    if (idleCheckFnName && typeof window[idleCheckFnName] === "function") {
      try { return !!window[idleCheckFnName](); } catch (e) { return false; }
    }
    return true;
  }

  function showUpdateBanner() {
    if (document.getElementById("version-check-banner")) return;

    const style = document.createElement("style");
    style.textContent = `
      #version-check-banner {
        position: fixed; left: 50%; bottom: 5.5rem; transform: translateX(-50%) translateY(20px);
        background: #16181c; color: #fff; border: 1px solid rgba(255,255,255,0.16);
        padding: 0.55rem 0.6rem 0.55rem 1rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600;
        display: flex; align-items: center; gap: 0.7rem; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        z-index: 100000; opacity: 0; pointer-events: none;
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      #version-check-banner.show { opacity: 1; transform: translateX(-50%) translateY(0); pointer-events: auto; }
      #version-check-banner button {
        background: #6781c0; color: #fff; border: none; border-radius: 9999px;
        padding: 0.35rem 0.85rem; font-size: 0.8rem; font-weight: 700; cursor: pointer;
      }
      @media screen and (min-width: 900px) {
        #version-check-banner { bottom: 1.5rem; }
      }
    `;
    document.head.appendChild(style);

    const banner = document.createElement("div");
    banner.id = "version-check-banner";
    banner.innerHTML = '<span>새 버전이 있습니다</span><button type="button">새로고침</button>';
    document.body.appendChild(banner);
    banner.querySelector("button").addEventListener("click", () => window.location.reload());
    requestAnimationFrame(() => banner.classList.add("show"));
  }

  function tryAutoReload() {
    if (isSafeToReload()) {
      window.location.reload();
      return;
    }
    // 지금은(결제 중이거나 모달이 열려있는 등) 안전하지 않으니, 안전해질 때까지 짧은 주기로 재확인.
    const retryTimer = setInterval(() => {
      if (isSafeToReload()) {
        clearInterval(retryTimer);
        window.location.reload();
      }
    }, RETRY_INTERVAL_MS);
  }

  async function checkForUpdate() {
    if (updateAvailable || baseline === null) return;
    const current = await Promise.all(checkUrls.map(fetchSignature));
    const changed = current.some((sig, i) => sig && baseline[i] && sig !== baseline[i]);
    if (!changed) return;

    updateAvailable = true;
    if (mode === "auto") {
      tryAutoReload();
    } else {
      showUpdateBanner();
    }
  }

  function init() {
    captureBaseline().then(() => {
      setInterval(checkForUpdate, CHECK_INTERVAL_MS);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
