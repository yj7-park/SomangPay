// 개발 서버에서만 favicon / PWA 설치 아이콘 / 매니페스트를 디버그 뱃지(-debug) 버전으로 바꾼다.
// 개발/운영 판별은 도메인이 아니라 app-env.js 의 window.__APP_ENV__ 로 한다
// (app-env.js 는 커밋 상태가 development, 운영은 deploy.sh 가 production 으로 덮어씀).
// <head> 에서 app-env.js 다음에 동기 로드할 것 - <link> 태그들보다 뒤에 와도 href 재작성은 먹는다.
(function () {
  'use strict';
  if (window.__APP_ENV__ === 'production') return;

  var d = document;

  // 확장자(쿼리 앞) 바로 앞에 -debug 를 끼워넣는다: favicon-kiosk.ico -> favicon-kiosk-debug.ico,
  // icons/logo-mark-user.svg -> icons/logo-mark-user-debug.svg, manifest-admin.json -> manifest-admin-debug.json
  function toDebug(href) {
    if (!href || href.indexOf('-debug.') !== -1) return href;
    return href.replace(/(\.[a-z0-9]+)(\?.*)?$/i, function (_, ext, q) {
      return '-debug' + ext + (q || '');
    });
  }

  var mf = d.querySelector('link[rel="manifest"]');
  if (mf) mf.setAttribute('href', toDebug(mf.getAttribute('href')));

  var links = d.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"]');
  for (var i = 0; i < links.length; i++) {
    links[i].setAttribute('href', toDebug(links[i].getAttribute('href')));
  }

  if (d.title.indexOf('[DEV]') === -1) d.title = '[DEV] ' + d.title;
})();
