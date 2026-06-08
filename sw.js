const CACHE_NAME = 'shrinkvibe-v1';
const ASSETS = [
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'logo.png'
];

// Install Service Worker and cache local files
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Serve cached assets when offline
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
