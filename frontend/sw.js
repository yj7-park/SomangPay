// SomangPay PWA Service Worker
const CACHE_NAME = "somangpay-pwa-v4";
const urlsToCache = [
  "/kiosk",
  "/user",
  "/admin",
  "/src/style.css",
  "/src/kiosk.js?v=20260802_0053",
  "/src/user.js",
  "/src/admin.js",
  "/jsQR.min.js",
  "/favicon.ico"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[PWA Service Worker] Static assets pre-cached");
      return cache.addAll(urlsToCache);
    })
  );
});

// 활성화 단계에서 이전 버전 캐시 자동 정리
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[PWA Service Worker] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener("fetch", (event) => {
  // POST 등 비-GET 요청은 캐시 조회를 생략하고 네트워크로 바로 통과시킴
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
