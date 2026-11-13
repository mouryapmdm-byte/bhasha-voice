const CACHE_NAME = 'bharat-performance-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.warn('PWA cache addAll error:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // If a POST request hits /share-target (for Web Share Target Level 2 file or form shares)
  if (event.request.method === 'POST' && (url.pathname === '/share-target' || url.pathname.endsWith('/share-target'))) {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const title = formData.get('title') || '';
        const text = formData.get('text') || '';
        const sharedUrl = formData.get('url') || '';
        
        const combinedText = [text, sharedUrl].filter(Boolean).join('\n');
        const targetUrl = new URL('/', self.location.origin);
        if (title) targetUrl.searchParams.set('title', title.toString());
        if (combinedText) targetUrl.searchParams.set('text', combinedText.toString());
        targetUrl.searchParams.set('shared_from', 'whatsapp');
        
        return Response.redirect(targetUrl.href, 303);
      } catch (err) {
        console.error('Error handling POST share target in SW:', err);
        return Response.redirect('/?shared_from=whatsapp', 303);
      }
    })());
    return;
  }

  // Bypass cache for backend API calls
  if (url.pathname.startsWith('/api/')) {
    return;
  }
  
  // For standard navigation or GET requests
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          // Fetch fresh in background
          fetch(event.request).then(freshResponse => {
            if (freshResponse && freshResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, freshResponse));
            }
          }).catch(() => {});
          return response;
        }
        return fetch(event.request);
      })
      .catch(() => {
        // Fallback for HTML documents to app shell
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/');
        }
      })
  );
});
