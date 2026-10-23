/* =========================================================
   sw.js — Service Worker pro "Moje diagnóza, můj vesmír"
   =========================================================
   K čemu je:
   1) Umožňuje nabídku "Přidat na plochu" — bez service workeru ji
      Android/Chrome obvykle vůbec nenabídne, i když manifest a ikony
      jsou v pořádku.
   2) Zrychluje opakované návštěvy (statické soubory a fotky se
      neshánějí ze sítě pokaždé znovu).
   3) Dává webu základní offline odolnost — NE plné offline fungování
      celého webu. Obsah (články, galerie) se mění, takže se u něj vždy
      nejdřív zkouší síť; cache je jen záložní plán, když síť není.

   Strategie podle typu requestu:
   - /admin/*  → service worker se do těchto requestů VŮBEC nezapojuje
                 (jde rovnou na síť). Editace obsahu se nemá spoléhat na
                 cache ani se tím nijak komplikovat.
   - /api/*    → network-first: vždy se nejdřív zkusí čerstvá data ze
                 sítě; teprve když request selže (offline), vrátí se
                 poslední zachycená odpověď (pokud nějaká existuje).
   - HTML stránky (navigace) → network-first s fallbackem na cache, aby
                 šla aspoň dohledat naposledy navštívená stránka offline.
   - statické soubory (CSS/JS/ikony) → cache-first — jsou verzované přes
                 "?v=" v URL (viz <script src="...js?v=20260910">), takže
                 je bezpečné je držet v cache dlouho: když se soubor
                 změní, změní se i jeho URL a stáhne se znovu sám.
   - fotky (vlastní i z CDN) → stale-while-revalidate: hned se vrátí to,
                 co je v cache (rychlé), a na pozadí se cache tiše
                 aktualizuje pro příště.

   Při každé výraznější změně webu zvyš SW_VERSION o kousek níž — vynutí
   to smazání staré cache a čerstvé stažení všeho. */

const SW_VERSION = 'v62';
const SHELL_CACHE = 'zajda-shell-' + SW_VERSION;
const RUNTIME_CACHE = 'zajda-runtime-' + SW_VERSION;
// Články uložené čtenářem „na offline“ (offline-save.js). Jméno je bez verze,
// takže se při zvýšení SW_VERSION nesmaže.
const OFFLINE_CACHE = 'zajda-offline';
// Schránka pro „Sdílet do Zajdova blogu“ z mobilu (Web Share Target) — vyřizuje admin/share-admin.js.
const SHARE_CACHE = 'zajda-share-inbox';

// POZOR: shared.css/js, fonts.css, travel-map-core.js a timeline-core.js
// se v HTML načítají s "?v=YYYYMMDD" (cache-busting). Když se některý z
// těchto souborů příště změní, zvyš datum v HTML tagách (a klidně i tady
// dole) — jinak zůstanou tyhle přesné URL v cache navždy (cache-first).
const ASSET_VERSION = '20261035';

const SHELL_URLS = [
  '/',
  '/manifest.json',
  '/fonts.css?v=' + ASSET_VERSION,
  '/shared.css?v=' + ASSET_VERSION,
  '/shared.js?v=20261040',
  '/travel-map-core.js?v=' + ASSET_VERSION,
  '/timeline-core.js?v=' + ASSET_VERSION,
  '/icon-192.png',
  '/icon-512.png',
  '/favicon-32.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(function (cache) {
        // Jeden dočasně nedostupný soubor ať nezhatí instalaci celého SW.
        return Promise.all(
          SHELL_URLS.map(function (url) {
            return cache.add(url).catch(function (e) {
              console.warn('SW: nepodařilo se předehřát', url, e);
            });
          })
        );
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) { return k !== SHELL_CACHE && k !== RUNTIME_CACHE && k !== OFFLINE_CACHE && k !== SHARE_CACHE; })
            .map(function (k) { return caches.delete(k); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

function isAdminRequest(url) { return url.pathname.startsWith('/admin/'); }
function isApiRequest(url) { return url.pathname.startsWith('/api/'); }
function isImageRequest(request, url) {
  return request.destination === 'image' || /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(url.pathname);
}
function isStaticAsset(request, url) {
  return ['style', 'script', 'font'].indexOf(request.destination) !== -1
    || /\.(css|js|woff2?|ttf)$/i.test(url.pathname);
}

self.addEventListener('fetch', function (event) {
  const request = event.request;
  // Sdílení z mobilu (POST z manifest.json → share_target): soubory a text uložíme
  // do schránky a přesměrujeme do administrace, kde z nich uděláš koncept.
  if (request.method === 'POST' && new URL(request.url).pathname === '/share-target') {
    event.respondWith(handleShareTarget(request));
    return;
  }
  // Ukládání/mazání (POST/PUT/DELETE) necachovat, nechat vždy projít na síť.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cizí domény (CDN fotek na jiném originu, Leaflet z jsdelivr...) —
  // service worker se plete jen fotkám (viz níže), zbytek necháme na
  // síti/vlastní cache prohlížeče.
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !isImageRequest(request, url)) return;

  if (sameOrigin && isAdminRequest(url)) return; // admin necachovat vůbec

  if (sameOrigin && isApiRequest(url)) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  if (isImageRequest(request, url)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  if (sameOrigin && isStaticAsset(request, url)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }
});

// Fotky z cizí domény (R2/CDN) bez CORS hlaviček dorazí jako "opaque"
// odpověď — status 0, response.ok je false, přesto se dají v pořádku
// uložit do cache a znovu vrátit. Proto se kontroluje i fresh.type.
function isCacheable(response) {
  return !!response && (response.ok || response.type === 'opaque');
}

async function handleShareTarget(request) {
  try {
    const fd = await request.formData();
    const cache = await caches.open(SHARE_CACHE);
    const old = await cache.keys();
    await Promise.all(old.map(function (k) { return cache.delete(k); }));
    const str = function (v) { return typeof v === 'string' ? v.slice(0, 5000) : ''; };
    const files = fd.getAll('media').filter(function (f) { return f && typeof f !== 'string'; }).slice(0, 12);
    const meta = { title: str(fd.get('title')), text: str(fd.get('text')), url: str(fd.get('url')), files: [], at: Date.now() };
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const key = '/__share/file/' + i;
      await cache.put(key, new Response(f, { headers: { 'Content-Type': f.type || 'image/jpeg' } }));
      meta.files.push({ key: key, name: f.name || ('foto-' + i + '.jpg'), type: f.type || 'image/jpeg' });
    }
    await cache.put('/__share/meta', new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
  } catch (e) { /* i když se něco nepovede, otevři admin */ }
  return Response.redirect(new URL('/admin/?shared=1', self.location.origin).href, 303);
}

// Záloha pro případ, že není síť: uložené články „na offline“.
async function offlineMatch(request) {
  try { return await caches.match(request, { cacheName: OFFLINE_CACHE }); } catch (e) { return undefined; }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (isCacheable(fresh)) cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = (await cache.match(request)) || (await offlineMatch(request));
    if (cached) return cached;
    throw e;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (isCacheable(fresh)) cache.put(request, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(function (fresh) {
      if (isCacheable(fresh)) cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(function () { return cached || offlineMatch(request); });
  return cached || fetchPromise;
}


/* === OZNÁMENÍ O NOVÉM ČLÁNKU (Web Push) ===
   Server posílá jen „klepnutí“ bez obsahu; titulek a odkaz si stáhneme z /api/push/latest.
   Prohlížeč vyžaduje, aby se po každém push zobrazilo oznámení — proto záložní text. */
function isAdminDevice() {
  return caches.open('zajda-flags').then(function (c) { return c.match('/__admin-device'); }).then(function (r) { return !!r; }).catch(function () { return false; });
}
self.addEventListener('push', function (event) {
  event.waitUntil(
    Promise.all([
      fetch('/api/push/latest', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
      isAdminDevice()
    ]).then(function (res) {
      var d = res[0] || {}, adm = res[1];
      if (adm && d.admin && d.admin.at && d.admin.at >= (d.at || 0)) {
        return self.registration.showNotification(d.admin.text || 'Něco nového v adminu', {
          body: 'Otevři administraci', icon: '/icon-192.png', tag: 'zajda-admin', data: { url: '/admin/' }
        });
      }
      return self.registration.showNotification(d.title || 'Nový článek na blogu', {
        body: d.title ? 'Zajda napsal nový článek' : 'Podívej se, co je nového',
        icon: '/icon-192.png',
        tag: 'zajda-new-article',
        data: { url: d.url || '/' }
      });
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (const c of list) { if (c.url === target && 'focus' in c) return c.focus(); }
      return self.clients.openWindow(target);
    })
  );
});
