const CACHE_NAME = 'quick-chat-v1';
// Các file cần thiết để ứng dụng có thể chạy offline
const urlsToCache = [
  '/', // File index.html
  '/sounds/notification.mp3',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Cài đặt Service Worker và cache các file cần thiết
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Khi có yêu cầu mạng, ưu tiên lấy từ cache trước
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Nếu tìm thấy trong cache, trả về file từ cache
        if (response) {
          return response;
        }
        // Nếu không, thực hiện yêu cầu mạng như bình thường
        return fetch(event.request);
      })
  );
});