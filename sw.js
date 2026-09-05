// GeoGame — offline cache
// Verzi posila index.html v adrese registrace (./sw.js?v=82). Zustava tak
// napsana na JEDNOM miste; cislo nize je jen zaloha, kdyby parametr chybel.
const VERZE = Number(new URL(self.location.href).searchParams.get('v')) || 82;
const CACHE = 'geogame-v' + VERZE;
const ASSETS = ['./', './index.html', './manifest.webmanifest',
                './icon.svg', './icon-192.png', './icon-512.png',
                './icon-512-maskable.png', './apple-touch-icon-180.png'];

// Instalace smí uspět jen tehdy, když se do zásoby dostala samotná hra.
// Jinak by activate smazal starou funkční kopii a hráč by v terénu zůstal na suchu.
const HRA = './index.html';
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      await Promise.allSettled(ASSETS.filter(a => a !== HRA).map(a => c.add(a)));
      await c.add(HRA);        // tohle selhat NESMÍ — a když selže, instalace padá s ním
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.match(HRA))
      .then(hra => hra
        ? caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
        : null)          // nova zasoba je prazdna: starou si necháme
      .then(() => self.clients.claim())
  );
});

function jeHtml(res) {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('text/html');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Stránka: síť napřed, ale jen 2,5 s. Pak nastoupí uložená kopie, protože
  // čekat na jedné čárce signálu půl minuty je horší než hrát starší verzi.
  // Odpověď ze sítě doběhne nezávisle a stejně se uloží pro příště.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    const zeSite = fetch(req).then(res => {
      if (res && res.ok && res.status === 200 && jeHtml(res)) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(HRA, copy));
      }
      return res;
    });
    e.respondWith(
      Promise.race([
        zeSite,
        new Promise(resolve => setTimeout(
          () => caches.match(HRA).then(r => r && resolve(r)), 2500))
      ]).catch(() =>
        caches.match(HRA)
          .then(r => r || caches.match('./'))
          .then(r => r || new Response(
            '<!doctype html><meta charset="utf-8"><title>GeoGame</title>' +
            '<body style="font:16px system-ui;background:#0b1030;color:#fff;padding:24px">' +
            '<h1>GeoGame</h1><p>Hra se zatím nestihla uložit do zařízení. ' +
            'Připoj se k internetu a otevři ji jednou znovu.</p>',
            { headers: { 'content-type': 'text/html; charset=utf-8' } }
          ))
      )
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => Response.error()))   // hit je v teto vetvi vzdy falsy
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
