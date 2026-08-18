const CACHE_NAME = 'weapon-v1';
const STATIC_ASSETS = [
  '/weapon/',
  '/weapon/index.html',
  '/weapon/favicon.svg',
];

const CACHE_STRATEGIES = {
  static: 'cache-first',
  pages: 'stale-while-revalidate',
  api: 'network-first',
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cache = caches.open(CACHE_NAME);
      cache.then((c) => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Determine strategy based on path
  let strategy = 'static';
  if (url.pathname.startsWith('/weapon/')) {
    if (url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
      strategy = 'pages';
    } else if (url.pathname.includes('/api/')) {
      strategy = 'api';
    } else {
      strategy = 'static';
    }
  }

  let responsePromise;
  switch (strategy) {
    case 'cache-first':
      responsePromise = cacheFirst(event.request);
      break;
    case 'stale-while-revalidate':
      responsePromise = staleWhileRevalidate(event.request);
      break;
    case 'network-first':
      responsePromise = networkFirst(event.request);
      break;
    default:
      responsePromise = cacheFirst(event.request);
  }

  event.respondWith(responsePromise);
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});