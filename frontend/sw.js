// SomangPay PWA Service Worker
// 네트워크 우선(Network-First) 전략: 항상 최신 콘텐츠를 먼저 시도하고,
// 오프라인 등으로 네트워크 요청이 실패할 때만 캐시로 대체 응답한다.
// (캐시 우선 전략은 배포 후 새 코드가 기기에 반영되지 않는 문제를 일으킬 수 있어 사용하지 않음)
const CACHE_NAME = "somangpay-pwa-v5";
const PRECACHE_URLS = [
  "/kiosk",
  "/user",
  "/admin",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
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
