// 앱 자동/수동 업데이트 위젯 - kiosk.html/admin.html/user.html 세 페이지가 공통으로 로드한다.
// 네이티브 Android 셸(AndroidInterface, android_kiosk/UpdateManager.java) 안에서 실행될 때만
// 의미가 있으므로, 일반 브라우저(AndroidInterface 없음)에서는 아무것도 렌더링하지 않는다
// (kiosk.js의 initWebNFC()와 동일한 판단 방식).
//
// 헤더의 "#update-widget-root" 컨테이너에 배지 버튼 + 설정 모달을 주입하고, 이후 상태 변화는
// UpdateManager가 window.onUpdateXxx 콜백을 호출해 알려준다.

(function () {
  var updateInfo = { available: false, currentVersionCode: null, latestVersionCode: null, latestVersionName: "" };
  var downloadInProgress = false;

  function hasAndroidUpdateBridge() {
    return !!(window.AndroidInterface && typeof window.AndroidInterface.getAppVersionInfo === "function");
  }

  function injectMarkup(root) {
    root.innerHTML =
      '<button type="button" id="update-badge-btn" title="버전 정보 / 업데이트" ' +
      'style="position: relative; display: inline-flex; align-items: center; gap: 0.3rem; background: rgba(255,255,255,0.08); ' +
      'border: 1px solid var(--border-glass); color: #fff; padding: 0.35rem 0.7rem; border-radius: 20px; font-weight: bold; ' +
      'font-size: 0.78rem; cursor: pointer; min-height: 28px;">' +
      '  <span id="update-badge-version-text">v-</span>' +
      '  <span id="update-badge-dot" style="display: none; width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; ' +
      '  box-shadow: 0 0 0 rgba(245,158,11,0.6); animation: update-badge-pulse 1.6s infinite;"></span>' +
      '</button>' +
      '<div id="update-settings-modal" class="modal-overlay" style="display: none; z-index: 9999;">' +
      '  <div class="modal-box-large" style="max-width: 440px;">' +
      '    <h2 style="font-size: 1.2rem; color: #fff; margin-bottom: 0.6rem;">⚙️ 앱 버전 / 업데이트</h2>' +
      '    <div class="modal-body">' +
      '      <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.9rem;">' +
      '        현재 버전: <strong id="update-modal-current-version" style="color:#fff;">-</strong>' +
      '      </div>' +
      '      <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0; border-top: 1px solid var(--border-glass); border-bottom: 1px solid var(--border-glass); margin-bottom: 0.9rem;">' +
      '        <input type="checkbox" id="update-auto-toggle" style="width: 18px; height: 18px; cursor: pointer;">' +
      '        <label for="update-auto-toggle" style="font-size: 0.88rem; color: #fff; cursor: pointer;">새 버전을 자동으로 감지되면 바로 다운로드/설치</label>' +
      '      </div>' +
      '      <div id="update-status-text" style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.8rem; min-height: 1.2em;">아직 확인하지 않았습니다.</div>' +
      '      <div id="update-progress-wrap" style="display: none; margin-bottom: 0.9rem;">' +
      '        <div style="background: rgba(0,0,0,0.35); border-radius: 999px; height: 10px; overflow: hidden;">' +
      '          <div id="update-progress-bar" style="height: 100%; width: 0%; background: linear-gradient(135deg, #06b6d4, #10b981); transition: width 0.2s;"></div>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '    <div class="modal-footer">' +
      '      <button type="button" id="update-check-now-btn" class="btn-action" style="background: rgba(255,255,255,0.1); color: #fff;">🔄 지금 확인</button>' +
      '      <button type="button" id="update-install-now-btn" class="btn-action btn-primary" style="display: none;">⬇️ 지금 업데이트</button>' +
      '      <button type="button" id="update-modal-close-btn" class="btn-action" style="background: rgba(255,255,255,0.1); color: #fff;">닫기</button>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<style>@keyframes update-badge-pulse { 0% { box-shadow: 0 0 0 0 rgba(245,158,11,0.55); } 70% { box-shadow: 0 0 0 6px rgba(245,158,11,0); } 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); } }</style>';
  }

  function setBadgeVersionText(info) {
    var el = document.getElementById("update-badge-version-text");
    if (el && info) el.textContent = "v" + (info.versionName || info.versionCode || "?");
  }

  function setUpdateAvailableUi(available) {
    var dot = document.getElementById("update-badge-dot");
    var installBtn = document.getElementById("update-install-now-btn");
    if (dot) dot.style.display = available ? "inline-block" : "none";
    if (installBtn) installBtn.style.display = available ? "inline-flex" : "none";
  }

  function setStatusText(text, isError) {
    var el = document.getElementById("update-status-text");
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "#f87171" : "var(--text-muted)";
  }

  function openSettingsModal() {
    var modal = document.getElementById("update-settings-modal");
    if (!modal) return;
    modal.style.display = "flex";
    modal.classList.add("active");
  }

  function closeSettingsModal() {
    var modal = document.getElementById("update-settings-modal");
    if (!modal) return;
    modal.style.display = "none";
    modal.classList.remove("active");
  }

  function refreshVersionInfoFromNative() {
    try {
      var info = JSON.parse(window.AndroidInterface.getAppVersionInfo());
      setBadgeVersionText(info);
      var currentEl = document.getElementById("update-modal-current-version");
      if (currentEl) currentEl.textContent = "v" + info.versionName + " (" + info.flavor + ")";
      var toggle = document.getElementById("update-auto-toggle");
      if (toggle) toggle.checked = !!info.autoUpdateEnabled;
    } catch (e) {
      console.warn("[업데이트 위젯] 버전 정보 조회 실패:", e);
    }
  }

  function triggerManualCheck() {
    setStatusText("업데이트 확인 중...", false);
    document.getElementById("update-progress-wrap").style.display = "none";
    try {
      window.AndroidInterface.checkForUpdate();
    } catch (e) {
      setStatusText("업데이트 확인에 실패했습니다.", true);
    }
  }

  function triggerInstallNow() {
    if (downloadInProgress) return;
    downloadInProgress = true;
    var progressWrap = document.getElementById("update-progress-wrap");
    var progressBar = document.getElementById("update-progress-bar");
    if (progressWrap) progressWrap.style.display = "block";
    if (progressBar) progressBar.style.width = "0%";
    setStatusText("다운로드를 시작합니다...", false);
    try {
      window.AndroidInterface.startUpdateDownload();
    } catch (e) {
      downloadInProgress = false;
      setStatusText("업데이트 다운로드에 실패했습니다.", true);
    }
  }

  function wireEvents() {
    var badgeBtn = document.getElementById("update-badge-btn");
    var closeBtn = document.getElementById("update-modal-close-btn");
    var checkBtn = document.getElementById("update-check-now-btn");
    var installBtn = document.getElementById("update-install-now-btn");
    var autoToggle = document.getElementById("update-auto-toggle");
    var modal = document.getElementById("update-settings-modal");

    if (badgeBtn) badgeBtn.addEventListener("click", function () {
      refreshVersionInfoFromNative();
      openSettingsModal();
    });
    if (closeBtn) closeBtn.addEventListener("click", closeSettingsModal);
    if (modal) modal.addEventListener("click", function (evt) {
      if (evt.target === modal) closeSettingsModal();
    });
    if (checkBtn) checkBtn.addEventListener("click", triggerManualCheck);
    if (installBtn) installBtn.addEventListener("click", triggerInstallNow);
    if (autoToggle) autoToggle.addEventListener("change", function () {
      try {
        window.AndroidInterface.setAutoUpdateEnabled(autoToggle.checked);
      } catch (e) {
        console.warn("[업데이트 위젯] 자동 업데이트 설정 저장 실패:", e);
      }
    });
  }

  function initUpdateWidget() {
    if (!hasAndroidUpdateBridge()) return;
    var root = document.getElementById("update-widget-root");
    if (!root) return;

    injectMarkup(root);
    wireEvents();
    refreshVersionInfoFromNative();
  }

  // UpdateManager(android_kiosk)가 호출하는 콜백들 - MainActivity.run()의
  // window.onAndroidNfcScanned 패턴과 동일하게 window 전역 함수로 노출한다.
  window.onUpdateCheckResult = function (info) {
    updateInfo = info || updateInfo;
    if (!info.available) {
      setStatusText("최신 버전을 사용 중입니다. (v" + (info.currentVersionCode || "?") + ")", false);
    }
  };

  window.onUpdateAvailable = function (info) {
    updateInfo = info || updateInfo;
    setUpdateAvailableUi(true);
    setStatusText("새 버전이 있습니다" + (info.latestVersionName ? " (v" + info.latestVersionName + ")" : "") + ".", false);
  };

  window.onUpdateDownloadProgress = function (percent) {
    var progressWrap = document.getElementById("update-progress-wrap");
    var progressBar = document.getElementById("update-progress-bar");
    if (progressWrap) progressWrap.style.display = "block";
    if (progressBar) progressBar.style.width = Math.max(0, Math.min(100, percent)) + "%";
    setStatusText("다운로드 중... " + percent + "%", false);
  };

  window.onUpdateDownloadComplete = function () {
    downloadInProgress = false;
    setStatusText("다운로드 완료. 설치 화면을 여는 중입니다...", false);
  };

  window.onUpdateError = function (message) {
    downloadInProgress = false;
    setStatusText(message || "업데이트 중 오류가 발생했습니다.", true);
  };

  document.addEventListener("DOMContentLoaded", initUpdateWidget);
})();
