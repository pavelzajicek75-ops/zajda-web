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

const SW_VERSION = 'v1';
const SHELL_CACHE = 'zajda-shell-' + SW_VERSION;
const RUNTIME_CACHE = 'zajda-runtime-' + SW_VERSION;

const SHELL_URLS = [
  '/',
  '/manifest.json',
  '/shared.css',
  '/shared.js',
  '/travel-map-core.js',
  '/timeline-core.js',
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
            .filter(function (k) { return k !== SHELL_CACHE && k !== RUNTIME_CACHE; })
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

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (isCacheable(fresh)) cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(request);
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
    .catch(function () { return cached; });
  return cached || fetchPromise;
}
