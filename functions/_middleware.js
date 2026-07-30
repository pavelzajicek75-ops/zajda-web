// functions/_middleware.js
//
// Běží nad KAŽDÝM /api/ voláním. Počítá requesty a chyby do KV.
// Zápis je fire-and-forget — neblokuje odpověď.

async function incrementCounter(env, key) {
  if (!env.USAGE_KV) return;
  try {
    const current = parseInt(await env.USAGE_KV.get(key) || '0', 10);
    await env.USAGE_KV.put(key, String(current + 1));
  } catch (e) {
    console.error('Chyba při zápisu do USAGE_KV (' + key + '):', e.message);
  }
}

export async function onRequest(context) {
  const { request, env, next } = context;

  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) {
    return next();
  }

  const today = new Date().toISOString().slice(0, 10);
  const reqKey = 'reqcount:' + today;

  // Pošleme request dál a počkáme na odpověď
  const response = await next();

  // Počítadlo chyb — jen pokud odpověď >= 500
  if (response.status >= 500) {
    const errKey = 'errcount:' + today;
    if (context.waitUntil) {
      context.waitUntil(incrementCounter(env, errKey));
    } else {
      incrementCounter(env, errKey).catch(() => {});
    }
  }

  // Počítadlo požadavků
  if (context.waitUntil) {
    context.waitUntil(incrementCounter(env, reqKey));
  } else {
    incrementCounter(env, reqKey).catch(() => {});
  }

  return response;
}
