// functions/_middleware.js
//
// Počítá API požadavky (a jen ty) do vlastní KV — bez závislosti na
// Cloudflare Analytics/GraphQL. Napsáno MAXIMÁLNĚ obranně: veškerá
// logika počítání je obalená v try/catch a spouští se přes waitUntil
// (na pozadí, nikdy neblokuje ani neovlivní skutečnou odpověď) a
// nejcitlivější cesty (přihlášení) se přeskakují úplně, i kdyby v nich
// KV binding nebo cokoliv jiného zlobilo.
//
// Zápisy do KV jsou navíc DÁVKOVÉ (flush nejvýš jednou za 60 s), ne při
// každém požadavku — Cloudflare KV má na free plánu limit jen 1000
// ZÁPISŮ/den (na rozdíl od 100 000 čtení/den), takže zápis při každém
// requestu by tenhle limit rychle vyčerpal.

const FLUSH_INTERVAL_MS = 60000;

// Cesty, které se NIKDY nepočítají a middleware se u nich chová, jako by
// vůbec neexistoval — přihlašování je příliš citlivé na to, aby na něm
// cokoliv experimentovalo.
const SKIP_PREFIXES = ['/api/auth/', '/api/verify', '/api/login'];

let buffer = {};
let lastFlush = 0;
let flushing = null;

export async function onRequest(context) {
  // next() se volá VŽDY jako první věc přes await, takže i kdyby cokoliv
  // v countIfApplicable() spadlo, skutečná odpověď už je hotová a vrátí se.
  const response = await context.next();
  try {
    countIfApplicable(context, response);
  } catch (e) {
    // tiše ignorovat — počítání nikdy nesmí ovlivnit skutečný požadavek
  }
  return response;
}

function countIfApplicable(context, response) {
  const { request, env } = context;
  if (!env || !env.USAGE_KV) return;

  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return;
  if (SKIP_PREFIXES.some(p => url.pathname.startsWith(p))) return;

  const today = new Date().toISOString().slice(0, 10);
  buffer['reqcount:' + today] = (buffer['reqcount:' + today] || 0) + 1;
  if (response && response.status >= 400) {
    buffer['errcount:' + today] = (buffer['errcount:' + today] || 0) + 1;
  }

  context.waitUntil(maybeFlush(env));
}

async function maybeFlush(env) {
  try {
    const now = Date.now();
    if (now - lastFlush < FLUSH_INTERVAL_MS) return;
    if (flushing) return flushing;

    const toFlush = buffer;
    buffer = {};
    lastFlush = now;

    flushing = (async () => {
      try {
        for (const key of Object.keys(toFlush)) {
          const current = await env.USAGE_KV.get(key);
          const count = current ? (parseInt(current, 10) || 0) : 0;
          await env.USAGE_KV.put(key, String(count + toFlush[key]), { expirationTtl: 60 * 60 * 24 * 220 });
        }
      } catch (e) {
        // ztráta pár počtů při chybě zápisu je zanedbatelná, hlavní je
        // že to nikdy nespadne skutečnému requestu
      } finally {
        flushing = null;
      }
    })();

    return flushing;
  } catch (e) {
    // viz výše — tiché ignorování
  }
}
