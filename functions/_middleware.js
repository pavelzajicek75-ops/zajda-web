// functions/_middleware.js
//
// Běží nad KAŽDÝM /api/ voláním (Pages Functions middleware).
// Všechny metriky zapisuje do JEDNOHO JSON klíče denně (usage:YYYY-MM-DD),
// aby KV write limit na Free plánu (1000 zápisů/den) nebyl překročen —
// každý request udělá jen 1 read + 1 write, bez ohledu na počet metrik.
//
// Sleduje:
//   1) počet požadavků (celkem + per endpoint + per hodina)
//   2) chyby (status >= 500)
//   3) dobu odpovědi (celkové ms → průměr se počítá v usage.js)
//
// Formát JSON v KV:
// {
//   "requests": 489,
//   "errors": 2,
//   "responseMs": 12345,
//   "endpoints": { "/api/photos": 100, "/api/quotes": 50, ... },
//   "hours": { "00": 5, "01": 3, ..., "23": 10 }
// }

export async function onRequest(context) {
  const { request, env, next } = context;

  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) {
    return next();
  }

  if (!env.USAGE_KV) {
    return next();
  }

  const today = new Date().toISOString().slice(0, 10);
  const key = 'usage:' + today;
  const startMs = Date.now();

  // Pošleme request dál a počkáme na odpověď
  const response = await next();

  const elapsedMs = Date.now() - startMs;
  const isError = response.status >= 500;

  // Normalizace endpointu — první 2 segmenty cesty
  // /api/photos/123 → /api/photos, /api/admin/usage → /api/admin
  const segments = url.pathname.split('/').filter(Boolean);
  const endpoint = '/' + segments.slice(0, 2).join('/');

  // Hodina (UTC, 2 číslice)
  const hour = new Date().getUTCHours().toString().padStart(2, '0');

  // Zápis do KV — fire and forget, neblokuje odpověď
  const writePromise = (async () => {
    try {
      const raw = await env.USAGE_KV.get(key);
      const data = raw ? JSON.parse(raw) : {
        requests: 0, errors: 0, responseMs: 0,
        endpoints: {}, hours: {}
      };

      data.requests = (data.requests || 0) + 1;
      if (isError) data.errors = (data.errors || 0) + 1;
      data.responseMs = (data.responseMs || 0) + elapsedMs;
      data.endpoints[endpoint] = (data.endpoints[endpoint] || 0) + 1;
      data.hours[hour] = (data.hours[hour] || 0) + 1;

      await env.USAGE_KV.put(key, JSON.stringify(data));
    } catch (e) {
      console.error('Chyba při zápisu do USAGE_KV (' + key + '):', e.message);
    }
  })();

  if (context.waitUntil) {
    context.waitUntil(writePromise);
  }

  return response;
}
