const CACHE_NAME = 'learning-show-soundboard-v2';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest'];

// 初回オンライン接続時に、画面表示に必要な外部ライブラリも保存する。
// opaque response（no-cors）もCache Storageに保存し、オフライン時に再利用する。
const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+JP:wght@400;500;700;900&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);

    // 外部リソースの取得に失敗しても、アプリ本体のインストールは続行する。
    await Promise.allSettled(EXTERNAL_ASSETS.map(async url => {
      const request = new Request(url, { mode: 'no-cors' });
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') {
        await cache.put(request, response);
      }
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('learning-show-soundboard-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);
  const isAppOrigin = url.origin === self.location.origin;
  const isKnownExternal = EXTERNAL_ASSETS.some(asset => url.href === asset || url.href.startsWith('https://fonts.gstatic.com/'));
  if (!isAppOrigin && !isKnownExternal) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (error) {
      if (isAppOrigin) {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});
