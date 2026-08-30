// SomangPay PWA Service Worker
// 네트워크 우선(Network-First) 전략: 항상 최신 콘텐츠를 먼저 시도하고,
// 오프라인 등으로 네트워크 요청이 실패할 때만 캐시로 대체 응답한다.
// (캐시 우선 전략은 배포 후 새 코드가 기기에 반영되지 않는 문제를 일으킬 수 있어 사용하지 않음)
const CACHE_NAME = "somangpay-pwa-v11";
const PRECACHE_URLS = [
  "/kiosk",
  "/user",
  "/admin",
  "/manifest.json",
  "/manifest-user.json",
  "/manifest-admin.json",
  "/icons/icon-192-kiosk.png",
  "/icons/icon-512-kiosk.png",
  "/icons/icon-192-admin.png",
  "/icons/icon-512-admin.png",
  "/icons/icon-192-user.png",
  "/icons/icon-512-user.png"
];

self.addEventListener("install", (event) => {
  // 프리캐시 URL 중 하나라도 실패하면 addAll은 전체를 실패시켜 설치 자체가 막히므로,
  // 개별 실패를 허용하고 나머지는 정상적으로 캐시되도록 처리
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

// 활성화 단계에서 이전 버전 캐시 자동 정리
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // POST 등 비-GET 요청은 캐시 대상이 아니므로 그대로 네트워크로 통과
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Web Push 수신 - 앱이 완전히 꺼져있어도 OS 푸시 서비스가 이 서비스워커를 깨워서 호출한다.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* 페이로드가 JSON이 아니면 빈 알림으로 무시 */ }

  const url = data.url || "/user";
  // 알림 카드 안쪽 아이콘은 어느 앱(관리자/사용자/키오스크) 알림인지에 맞춰 고른다.
  const icon = url.startsWith("/admin") ? "/icons/icon-192-admin.png"
    : url.startsWith("/kiosk") ? "/icons/icon-192-kiosk.png"
    : "/icons/icon-192-user.png";

  event.waitUntil(
    self.registration.showNotification(data.title || "소망페이", {
      body: data.body || "",
      icon,
      // 상태바 아이콘은 Android가 실루엣(흰색+투명 알파)만 읽으므로 일반 컬러 아이콘이 아닌
      // 전용 단색 마스크 이미지를 써야 한다 - 컬러 아이콘을 쓰면 흰 네모로 뭉개져 보인다.
      badge: "/icons/badge-96.png",
      data: { url },
    })
  );
});

// 알림 클릭 시 이미 열려있는 탭이 있으면 포커스, 없으면 새로 연다. url에는 관리자 알림의 경우
// send_push_to_admins()가 붙여준 ?category=&entity_id= 쿼리스트링이 실려올 수 있는데(어느
// 처리 화면으로 이동할지 - admin.js 참고), 매 알림마다 값이 달라서 그대로 비교하면 이미 열려있는
// 탭도 못 찾고 매번 새 창을 열게 된다 - path만 비교해서 탭을 찾는다.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/user";
  const targetPath = targetUrl.split("?")[0];

  let deepLinkCategory = null;
  let deepLinkEntityId = null;
  try {
    const parsed = new URL(targetUrl, self.location.origin);
    deepLinkCategory = parsed.searchParams.get("category");
    const rawEntityId = parsed.searchParams.get("entity_id");
    deepLinkEntityId = rawEntityId != null ? Number(rawEntityId) : null;
  } catch (e) { /* url이 상대경로가 아니거나 파싱 불가 - 딥링크 없이 그냥 이동만 시킨다 */ }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(targetPath) && "focus" in client) {
          // 이미 로드/로그인까지 끝나 있는 탭이므로 새로고침 대신 postMessage로 딥링크만 전달한다
          // (admin.js의 navigator.serviceWorker "message" 리스너 참고).
          if (deepLinkCategory) {
            client.postMessage({ type: "admin-notification-deeplink", category: deepLinkCategory, entityId: deepLinkEntityId });
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ============ 앱을 안 열어도 구독을 스스로 갱신 ============
// 이 시점(pushsubscriptionchange/periodicsync)엔 페이지가 안 열려있을 수 있어 localStorage의
// 로그인 토큰에 접근할 방법이 없다 - 그래서 인증 없이 옛 endpoint(추측 불가능한 긴 문자열)
// 자체를 소유 증명으로 삼아 갱신하는 /api/push/resubscribe를 쓴다(backend/app/main.py 참고).
async function reportResubscribe(oldEndpoint, sub) {
  if (!oldEndpoint) return; // 옛 endpoint를 모르면 서버 쪽 어느 행을 갱신할지 알 수 없어 포기
  const subJson = sub.toJSON();
  try {
    await fetch("/api/push/resubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_endpoint: oldEndpoint, endpoint: subJson.endpoint, keys: subJson.keys }),
    });
  } catch (e) { /* 실패해도 다음 pushsubscriptionchange/periodicsync/앱 실행 때 다시 시도됨 */ }
}

// 브라우저가 스스로 구독을 회전(rotate)시켰을 때 오는 이벤트 - push 이벤트처럼 앱이 완전히
// 꺼져있어도 이 서비스워커가 깨워져서 호출될 수 있다. 여기서 서버에 새 endpoint를 안 알려주면
// 브라우저 안에서는 이미 새 구독으로 넘어갔는데 서버 DB엔 죽은 옛 endpoint가 남아 발송이
// 계속 실패한다. (브라우저가 스스로 만료를 알아채지 못하고 조용히 죽이는 경우는 이 이벤트
// 자체가 안 오므로 아래 periodicsync가 대신 커버한다.)
self.addEventListener("pushsubscriptionchange", (event) => {
  const oldEndpoint = event.oldSubscription ? event.oldSubscription.endpoint : null;
  const options = (event.oldSubscription && event.oldSubscription.options) || undefined;
  event.waitUntil(
    (async () => {
      try {
        const newSub = event.newSubscription || await self.registration.pushManager.subscribe(options);
        await reportResubscribe(oldEndpoint, newSub);
      } catch (e) { /* applicationServerKey를 모르면(options 없음) 재구독 자체가 불가능 - 무시 */ }
    })()
  );
});

// Periodic Background Sync - 지원 브라우저(설치 + 사이트 참여도 조건 충족 시)에서 페이지를
// 안 열어도 이 서비스워커를 주기적으로 깨워준다(등록은 user.js/admin.js에서 로그인 시 시도).
// getSubscription()이 "있다"고 돌려줘도 푸시 서비스 쪽에서 조용히 만료됐을 수 있고 브라우저는
// 이를 스스로 알 방법이 없어서, 매번 해지 후 재구독해 강제로 유효성을 새로 받아온다.
self.addEventListener("periodicsync", (event) => {
  if (event.tag !== "push-subscription-refresh") return;
  event.waitUntil(
    (async () => {
      const existing = await self.registration.pushManager.getSubscription();
      if (!existing) return; // 구독한 적 없으면 할 일 없음 - 권한 요청은 SW 혼자 못 한다
      const oldEndpoint = existing.endpoint;
      const options = existing.options;
      try {
        await existing.unsubscribe();
        const fresh = await self.registration.pushManager.subscribe(options);
        await reportResubscribe(oldEndpoint, fresh);
      } catch (e) { /* 실패해도 다음 주기나 다음 앱 실행 때 다시 시도됨 */ }
    })()
  );
});
