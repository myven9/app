// ============================================================
// 서비스 워커
// - 앱 화면(HTML/CSS/JS/아이콘)만 캐싱해서 "홈 화면에 추가" 후
//   빠르게 뜨도록 함.
// - Supabase 데이터 요청은 캐싱하지 않고 항상 네트워크로 보냄
//   (데이터는 항상 최신이어야 하니까).
// - 캐시 이름(CACHE_NAME)의 버전 숫자를 올리면 예전 캐시는 자동 정리됨.
//   나중에 파일을 수정/배포했는데 화면이 안 바뀌면 이 숫자를 올리세요.
// ============================================================

const CACHE_NAME = "myapp-cache-v1";

const APP_SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/todo.js",
  "/diary.js",
  "/memo.js",
  "/theme.js",
  "/supabase-client.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
];

// 설치: 앱 셸 파일들을 미리 캐싱
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// 활성화: 이전 버전 캐시 정리
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// 요청 가로채기
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Supabase API 요청이나 GET이 아닌 요청은 캐싱 없이 그냥 네트워크로
  if (
    url.hostname.includes("supabase.co") ||
    event.request.method !== "GET"
  ) {
    return; // 서비스워커가 손대지 않고 브라우저 기본 동작에 맡김
  }

  // 앱 셸 파일: 캐시 우선, 없으면 네트워크 + 캐시에 저장
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
