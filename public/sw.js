// Offline režim Geodetu. Stránka se bere ze sítě (když je), hashované soubory
// z build/ jsou neměnné, takže stačí je jednou uložit. Stejné jméno souboru měl
// service worker staré hry – tahle verze jeho mezipaměť smaže.
const CACHE = 'geodet-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then(async (c) => {
        await c.addAll(CORE);
        // Skripty a styly buildu vyčti z index.html, ať jsou offline hned po první návštěvě.
        const html = await (await c.match('./index.html')).text();
        const assets = [...html.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+)"/g)].map((m) => m[1]);
        await c.addAll(assets);
        // Soubory starších buildů už nejsou potřeba.
        const keep = new Set(assets.map((a) => new URL(a, self.registration.scope).href));
        for (const req of await c.keys()) if (req.url.includes('/assets/') && !keep.has(req.url)) await c.delete(req);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const put = (req, res) => {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Stránka: síť první, offline z mezipaměti.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => put('./index.html', res))
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))),
    );
    return;
  }

  // Hashované soubory buildu a písma: mezipaměť první.
  if (url.pathname.includes('/assets/') || url.hostname.endsWith('gstatic.com')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
    return;
  }

  // Ostatní (ikony, manifest, CSS písem): vrať uložené hned, na pozadí obnov.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => put(req, res))
        .catch(() => hit);
      return hit || net;
    }),
  );
});
