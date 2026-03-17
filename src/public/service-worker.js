const CACHE_NAME = 'nw-admin-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/robots.txt'
];

// Install: Cache static core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
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

// Fetch: Network-first for HTML/Data, Cache-first for Assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Ignore API calls, Supabase, and non-GET requests (Network Only)
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('supabase.co') ||
    url.pathname.includes('/functions/v1')
  ) {
    return;
  }

  // 2. HTML / Navigation (Network First, fallback to cache, fallback to /index.html)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request)
            .then((response) => {
              if (response) {
                return response;
              }
              // Fallback to /index.html for SPA offline support
              return caches.match('/');
            });
        })
    );
    return;
  }

  // 3. Static Assets (Cache First, fallback to network)
  // JS, CSS, Images, Fonts
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|json|woff|woff2|ttf|eot)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Default: Network First
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
