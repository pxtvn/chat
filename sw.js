// Thay đổi tên CACHE_NAME mỗi khi bạn cập nhật ứng dụng
// Ví dụ: từ v1 -> v2, v2 -> v3...
const CACHE_NAME = 'quick-chat-v2';

// Danh sách các file cần thiết để ứng dụng có thể chạy offline
// Đây là "vỏ" của ứng dụng
const urlsToCache = [
  '/',
  '/manifest.json',
  '/sounds/notification.mp3',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Sự kiện 'install': Được gọi khi service worker được cài đặt lần đầu
// hoặc khi có một phiên bản mới.
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
  );
});

// Sự kiện 'activate': Được gọi sau khi install thành công.
// Đây là nơi tốt nhất để dọn dẹp các cache cũ.
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Nếu tên cache không phải là CACHE_NAME hiện tại, hãy xóa nó đi
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Sự kiện 'fetch': Chặn các yêu cầu mạng và ưu tiên trả về từ cache trước
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