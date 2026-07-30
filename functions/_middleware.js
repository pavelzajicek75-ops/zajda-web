// functions/_middleware.js
//
// Běží nad KAŽDÝM /api/ voláním. Zapisuje denní agregát do KV
// (usage:YYYY-MM-DD) jako JSON. AWAITS zápis — ne fire-and-forget,
// aby se zápis stihl dokončit před ukončením funkce.

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
  const segments = url.pathname.split('/').filter(Boolean);
  const endpoint = '/' + segments.slice(0, 2).join('/');

  // Hodina (UTC, 2 číslice)
  const hour = new Date().getUTCHours().toString().padStart(2, '0');

  // AWAIT zápis — garantuje dokončení
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
    // Nechceme shodit request kvůli počítadlu
    console.error('Chyba při zápisu do USAGE_KV (' + key + '):', e.message);
  }

  return response;
}
