const CACHE_NAME = 'mcqlala-v1';
const STATIC_CACHE = 'mcqlala-static-v1';
const API_CACHE = 'mcqlala-api-v1';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/login.html',
    '/register.html',
    '/quiz.html',
    '/results.html',
    '/profile.html',
    '/mcq.html',
    '/leaderboard.html',
    '/subject.html',
    '/pdfs.html',
    '/about.html',
    '/privacy.html',
    '/terms.html',
    '/favicon.svg'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.log('[SW] Some assets failed to cache:', err);
            });
        })
    );
    self.skipWaiting();
});

// Activate - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter((name) => name !== STATIC_CACHE && name !== API_CACHE)
                    .map((name) => caches.delete(name))
            );
        })
    );
    clients.claim();
});

// Fetch strategy: Network-first for API, Cache-first for static assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // API requests: Network-first, fallback to cache
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Cache GET responses for offline fallback (not POST/PUT/DELETE)
                    if (event.request.method === 'GET' && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(API_CACHE).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Offline fallback: return cached response if available
                    return caches.match(event.request).then((cachedResponse) => {
                        return cachedResponse || new Response(
                            JSON.stringify({ message: 'Offline - please check your connection' }),
                            { headers: { 'Content-Type': 'application/json' }, status: 503 }
                        );
                    });
                })
        );
        return;
    }

    // Static assets: Cache-first, fallback to network
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Return cache, but also update in background (stale-while-revalidate)
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(STATIC_CACHE).then((cache) => {
                            cache.put(event.request, networkResponse);
                        });
                    }
                }).catch(() => {});
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                // Cache new static assets
                if (networkResponse && networkResponse.status === 200 &&
                    event.request.method === 'GET') {
                    const responseClone = networkResponse.clone();
                    caches.open(STATIC_CACHE).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            });
        })
    );
});

// Handle messages (for cache invalidation)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then((names) => {
            names.forEach(name => caches.delete(name));
        });
    }
});
