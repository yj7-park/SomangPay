// 화면 크기 진단(2026-11-16) - 삼성 인터넷으로 설치한 PWA에서 위아래가 잘리는 문제를 실기기 값으로 보려고 둔다.
// 상단 제목(로그인 화면은 로고)을 3초 안에 5번 누르면 값이 뜨고, 그 창을 누르면 닫힌다.
(function () {
  function probeInsets() {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;left:0;top:0;visibility:hidden;" +
      "padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);" +
      "padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);";
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const r = { top: cs.paddingTop, bottom: cs.paddingBottom, left: cs.paddingLeft, right: cs.paddingRight };
    el.remove();
    return r;
  }

  function show() {
    const ins = probeInsets();
    const vv = window.visualViewport;
    const header = document.getElementById("user-header");
    const tab = document.querySelector(".admin-tabbar");
    const hr = header ? header.getBoundingClientRect() : null;
    const tr = tab ? tab.getBoundingClientRect() : null;
    const mode = ["fullscreen", "standalone", "minimal-ui", "browser"].find(
      (m) => window.matchMedia && window.matchMedia(`(display-mode: ${m})`).matches) || "?";
    const vpMeta = (document.querySelector('meta[name="viewport"]') || {}).content || "";
    const lines = [
      `display-mode: ${mode}`,
      `inner: ${window.innerWidth} x ${window.innerHeight}`,
      `visualViewport: ${vv ? Math.round(vv.width) + " x " + Math.round(vv.height) + " (offTop " + Math.round(vv.offsetTop) + ")" : "-"}`,
      `screen: ${screen.width} x ${screen.height} / avail ${screen.availWidth} x ${screen.availHeight}`,
      `dpr: ${window.devicePixelRatio}`,
      `docEl client: ${document.documentElement.clientWidth} x ${document.documentElement.clientHeight}`,
      `scrollY: ${Math.round(window.scrollY)} / scrollH ${document.documentElement.scrollHeight}`,
      `safe-area: T ${ins.top} B ${ins.bottom} L ${ins.left} R ${ins.right}`,
      `header: ${hr ? Math.round(hr.top) + " ~ " + Math.round(hr.bottom) : "-"}`,
      `tabbar: ${tr ? Math.round(tr.top) + " ~ " + Math.round(tr.bottom) : "-"}`,
      `viewport meta: ${vpMeta}`,
      `css: ${[...document.querySelectorAll('link[rel=stylesheet]')].map((l) => (l.href.split("v=")[1] || "")).join(", ")}`,
      `ua: ${navigator.userAgent}`,
    ];
    let box = document.getElementById("vp-debug-box");
    if (!box) {
      box = document.createElement("pre");
      box.id = "vp-debug-box";
      box.style.cssText = "position:fixed;left:8px;right:8px;top:30%;z-index:99999;margin:0;padding:12px;" +
        "background:rgba(0,0,0,.88);color:#7CFC9A;font:12px/1.45 monospace;white-space:pre-wrap;word-break:break-all;border-radius:10px;";
      box.onclick = () => box.remove();
      document.body.appendChild(box);
    }
    box.textContent = lines.join("\n");
  }

  let taps = [];
  function onTap() {
    const now = Date.now();
    taps = taps.filter((t) => now - t < 3000);
    taps.push(now);
    if (taps.length >= 5) { taps = []; show(); }
  }

  function bind() {
    ["user-header-title"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", onTap);
    });
    const logo = document.querySelector(".ig-login-logo");
    if (logo) logo.addEventListener("click", onTap);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
  window.showViewportDebug = show;
})();
