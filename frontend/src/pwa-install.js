// 회원 앱 "홈 화면에 앱 설치" 버튼(2026-11-15, #pwa-install).
// 가장 많은 피드백이 "PWA 설치가 안 된다"였다. 운영 /user는 크롬 설치 조건을 통과하므로(설치 오류 없음,
// beforeinstallprompt 발생 확인) 막히는 건 대개 환경 쪽이다 - 카카오톡/네이버/밴드 같은 앱 안 브라우저(설치 불가),
// 아이폰(자동 설치 창이 없어 공유 → 홈 화면에 추가를 직접 해야 함), 삼성 인터넷/크롬에서 메뉴를 못 찾는 경우.
// 그래서 버튼 하나로: 설치 창을 띄울 수 있으면 바로 띄우고, 아니면 지금 환경에 맞는 방법(외부 브라우저로 열기,
// 메뉴 위치)을 안내한다. 이미 설치된 앱(standalone)이나 회원 APK 안에서는 버튼을 숨긴다.
(function () {
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isKakao = /KAKAOTALK/i.test(ua);
  const isInApp = isKakao || /NAVER\(inapp|Line\/|Instagram|FBAN|FBAV|BAND\/|DaumApps|everytimeApp|; wv\)/i.test(ua);
  const isSamsung = /SamsungBrowser/i.test(ua);
  // 진짜 Chrome인지 - 삼성 인터넷/엣지/웨일 등도 UA에 "Chrome/"이 들어 있다.
  const isRealChrome = isAndroid && /Chrome\/\d+/.test(ua) && !isInApp &&
    !/SamsungBrowser|EdgA|OPR\/|YaBrowser|Whale|DuckDuckGo|Firefox|Vivaldi|MiuiBrowser|HuaweiBrowser/i.test(ua);
  const installUrl = location.origin + "/user";

  let deferredPrompt = null;
  // 이미 설치했는지 - 크롬 getInstalledRelatedApps(manifest related_applications) 또는 이 기기에서 설치된 앱으로
  // 한 번이라도 열렸던 기록(같은 출처라 브라우저 탭과 저장소를 같이 쓴다). 크롬이 설치 창 신호
  // (beforeinstallprompt)를 보내면 설치 안 된 것이라 기록을 지운다.
  const INSTALLED_KEY = "somang_pwa_installed";
  let knownInstalled = false;
  function storeInstalled(v) {
    try { v ? localStorage.setItem(INSTALLED_KEY, "1") : localStorage.removeItem(INSTALLED_KEY); } catch (e) { /* 저장 불가 */ }
  }
  function readInstalled() {
    try { return localStorage.getItem(INSTALLED_KEY) === "1"; } catch (e) { return false; }
  }

  function isInstalledContext() {
    if (window.AndroidInterface) return true;
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
    return window.navigator.standalone === true;
  }

  function setVisible(show) {
    document.querySelectorAll("[data-pwa-install]").forEach((el) => {
      el.style.display = show ? "" : "none";
    });
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // 크롬 기본 미니 배너 대신 우리 버튼으로 띄운다
    deferredPrompt = e;
    storeInstalled(false);
    setInstalledUi(false);
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    storeInstalled(true);
    setVisible(false);
    hideGuide();
    if (typeof showAlertModal === "function") {
      showAlertModal("홈 화면에 소망페이가 설치됐어요.\n이제 홈 화면 아이콘으로 열어 주세요.", "설치 완료");
    }
  });

  function setInstalledUi(installed) {
    knownInstalled = installed;
    const loginBtn = document.querySelector(".ig-login-install-btn");
    if (loginBtn) {
      loginBtn.innerHTML = installed
        ? '<span aria-hidden="true">✅</span> 앱이 이미 설치돼 있어요'
        : '<span aria-hidden="true">📲</span> 홈 화면에 앱 설치하기';
    }
    const rowBtn = document.querySelector(".user-install-row-btn");
    if (rowBtn) rowBtn.textContent = installed ? "설치됨" : "설치하기";
  }

  function hideGuide() {
    if (typeof hideModal === "function") hideModal("pwa-guide-modal");
  }

  function showGuide(title, steps, extraButton) {
    document.getElementById("pwa-guide-title").textContent = title;
    const list = document.getElementById("pwa-guide-steps");
    list.innerHTML = "";
    steps.forEach((s) => {
      const li = document.createElement("li");
      li.innerHTML = s; // 고정 문구만 넣는다(사용자 입력 없음)
      list.appendChild(li);
    });
    const extra = document.getElementById("pwa-guide-extra");
    if (extraButton) {
      extra.textContent = extraButton.label;
      extra.onclick = extraButton.onClick;
      extra.style.display = "";
    } else {
      extra.style.display = "none";
      extra.onclick = null;
    }
    if (typeof showModal === "function") showModal("pwa-guide-modal");
  }

  // Chrome이 없으면 browser_fallback_url(같은 주소, ?chrome 없이)로 지금 브라우저에서 그대로 연다 - 다시 넘기는 반복 없음.
  function openInChrome() {
    const u = new URL(installUrl);
    location.href = `intent://${u.host}${u.pathname}#Intent;scheme=https;package=com.android.chrome;` +
      `S.browser_fallback_url=${encodeURIComponent(installUrl)};end`;
  }

  // QR/링크에 ?chrome=1을 붙이면(2026-11-19) 안드로이드에서 Chrome이 아닌 곳(삼성 인터넷, 카카오톡 등 앱 안 브라우저)에서
  // 열렸을 때 Chrome으로 다시 연다. QR 자체로는 브라우저를 고를 수 없어서(카메라가 기본 브라우저로 연다) 페이지가 넘긴다.
  // Chrome에서 열렸으면 주소에서 표시만 지운다.
  function handleChromeParam() {
    const params = new URLSearchParams(location.search);
    if (!params.has("chrome")) return;
    if (isAndroid && !isRealChrome && !isInstalledContext()) {
      openInChrome();
      return;
    }
    params.delete("chrome");
    const q = params.toString();
    try { history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash); } catch (e) { /* 무시 */ }
  }

  window.copyPwaInstallUrl = async function (btn) {
    try {
      await navigator.clipboard.writeText(installUrl);
      if (btn) { btn.textContent = "복사됨"; setTimeout(() => { btn.textContent = "주소 복사"; }, 1500); }
    } catch (err) {
      if (typeof showAlertModal === "function") showAlertModal(`주소: ${installUrl}`, "주소");
    }
  };

  window.startPwaInstall = async function (skipInstalledCheck) {
    if (!deferredPrompt && knownInstalled && !skipInstalledCheck) {
      showGuide("이미 설치돼 있어요", [
        "홈 화면이나 앱 목록에서 <strong>소망페이</strong> 아이콘을 찾아 열어 주세요.",
        "앱을 지웠다면 아래 <strong>다시 설치하기</strong>를 눌러 주세요.",
      ], { label: "다시 설치하기", onClick: () => { hideGuide(); window.startPwaInstall(true); } });
      return;
    }
    if (deferredPrompt) {
      const p = deferredPrompt;
      deferredPrompt = null; // 한 번만 쓸 수 있다
      try {
        await p.prompt();
        await p.userChoice;
      } catch (err) {
        console.error("pwa install prompt error:", err);
      }
      return;
    }

    if (isKakao && isAndroid) {
      // 안드로이드 카카오톡은 Chrome으로 바로 넘긴다(2026-11-19 사용자 요청) - openExternal은 "기본 브라우저"라
      // 갤럭시에선 삼성 인터넷이 열리는데, 삼성 인터넷 PWA는 설치 경로가 헷갈리고 푸시도 말썽이었다.
      // 카카오톡 인앱 브라우저는 intent:// 를 처리한다. Chrome이 없으면 아래 "다른 브라우저로 열기".
      openInChrome();
      showGuide("Chrome에서 설치해 주세요", [
        "카카오톡 안에서는 앱을 설치할 수 없어요.",
        "<strong>Chrome</strong>이 열리면 거기서 다시 <strong>앱 설치</strong>를 눌러 주세요.",
        "Chrome이 안 열리면 아래 <strong>다른 브라우저로 열기</strong>를 눌러 주세요.",
      ], { label: "다른 브라우저로 열기", onClick: () => {
        location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(installUrl);
      } });
      return;
    }

    if (isKakao) {
      // 아이폰 카카오톡 - 기본 브라우저(Safari)로 넘긴다.
      location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(installUrl);
      showGuide("Safari에서 설치해 주세요", [
        "카카오톡 안에서는 앱을 설치할 수 없어요.",
        "<strong>Safari</strong>가 열리면 거기서 다시 <strong>앱 설치</strong>를 눌러 주세요.",
        "브라우저가 안 열리면 <strong>주소 복사</strong> 후 Safari 주소창에 붙여 넣어 주세요.",
      ]);
      return;
    }

    if (isInApp) {
      if (isAndroid) {
        showGuide("Chrome에서 설치해 주세요", [
          "이 앱 안의 브라우저에서는 설치할 수 없어요.",
          "아래 <strong>Chrome으로 열기</strong>를 누르고, 열린 화면에서 다시 <strong>앱 설치</strong>를 눌러 주세요.",
        ], { label: "Chrome으로 열기", onClick: openInChrome });
      } else {
        showGuide("Safari에서 설치해 주세요", [
          "이 앱 안의 브라우저에서는 설치할 수 없어요.",
          "화면의 <strong>⋯</strong> 또는 공유 메뉴에서 <strong>Safari로 열기</strong>를 눌러 주세요.",
          "Safari에서 다시 <strong>앱 설치</strong>를 눌러 주세요.",
        ]);
      }
      return;
    }

    if (isIOS) {
      showGuide("아이폰에 설치하기", [
        "<strong>Safari</strong>에서 이 화면을 열어 주세요.",
        "아래(또는 위) 막대의 <strong>공유 버튼</strong>(네모에서 화살표가 위로 나온 모양)을 눌러 주세요.",
        "목록을 내려 <strong>홈 화면에 추가</strong>를 누르고, 오른쪽 위 <strong>추가</strong>를 눌러 주세요.",
      ]);
      return;
    }

    if (isSamsung) {
      // 삼성 인터넷의 "현재 페이지 추가 → 홈 화면"은 앱 설치가 아니라 바로가기만 만든다(2026-11-16 사용자 확인).
      showGuide("삼성 인터넷에서 설치하기", [
        "주소창 오른쪽에 <strong>설치 아이콘</strong>(아래 화살표)이 보이면 눌러서 <strong>설치</strong>를 눌러 주세요.",
        "아이콘이 없으면 아래 막대 오른쪽 <strong>메뉴(≡)</strong> → <strong>현재 페이지 추가</strong> → <strong>빠른 실행</strong>을 눌러 주세요.",
        "<strong>홈 화면</strong>은 앱이 아니라 바로가기만 만들어져요.",
        "Chrome이 있으면 아래 <strong>Chrome으로 열기</strong>로 설치하는 게 더 쉬워요.",
      ], { label: "Chrome으로 열기", onClick: openInChrome });
      return;
    }

    if (isAndroid) {
      showGuide("Chrome에서 설치하기", [
        "오른쪽 위 <strong>⋮</strong> 메뉴를 눌러 주세요.",
        "<strong>앱 설치</strong>를 누르고 <strong>설치</strong>를 눌러 주세요. (<strong>홈 화면에 추가</strong>의 '바로가기 만들기'는 앱이 아니에요)",
        "메뉴에 없으면 이미 설치된 거예요. 홈 화면이나 앱 목록에서 <strong>소망페이</strong>를 찾아 주세요.",
      ]);
      return;
    }

    showGuide("컴퓨터에서 설치하기", [
      "Chrome이나 Edge 주소창 오른쪽의 <strong>설치 아이콘</strong>을 눌러 주세요.",
      "휴대폰에서 쓰시려면 휴대폰 브라우저로 이 주소를 열어 주세요.",
    ]);
  };

  window.hidePwaGuide = hideGuide;

  // 삼성 인터넷으로 설치한 PWA는 상태바/내비게이션 바 밑까지 그리면서 env(safe-area-inset-*)를 0으로 준다
  // (2026-11-16 실기기 진단: standalone, inner 411x891 @2.625 = 화면 전체, safe-area 0). 그때만 여백을 직접 준다 -
  // 상태바 32px(실측), 아래 16px(제스처 바). 3버튼 내비게이션이면 아래가 조금 모자랄 수 있다.
  function applySamsungInsetFallback() {
    const standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
    if (!isSamsung || !standalone) return;
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);";
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const hasInsets = parseFloat(cs.paddingTop) > 0 || parseFloat(cs.paddingBottom) > 0;
    probe.remove();
    if (!hasInsets) document.documentElement.classList.add("pwa-inset-fallback");
  }

  async function detectInstalled() {
    if (isInstalledContext()) {
      if (!window.AndroidInterface) storeInstalled(true);
      return;
    }
    let installed = readInstalled();
    try {
      if (navigator.getInstalledRelatedApps) {
        const apps = await navigator.getInstalledRelatedApps();
        if (apps && apps.length) installed = true;
      }
    } catch (e) { /* 미지원 */ }
    if (installed && !deferredPrompt) setInstalledUi(true);
  }

  function init() {
    handleChromeParam();
    setVisible(!isInstalledContext());
    applySamsungInsetFallback();
    detectInstalled();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
