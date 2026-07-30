// functions/_middleware.js
//
// Počítá requesty a chyby do KV. Bulletproof — pokud cokoliv selže,
// request projde dál bez ohledu na počítadla.

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
  const startMs = Date.now();

  // Nejdřív zavoláme next() — to je nejdůležitější
  let response;
  try {
    response = await next();
  } catch (e) {
    // Pokud next() samotné spadne, nepokoušíme se o počítadla
    throw e;
  }

  // Všechno kolem počítadel je v try/catch — nikdy nesmí shodit request
  try {
    const elapsedMs = Date.now() - startMs;
    const isError = response.status >= 500;

    const segments = url.pathname.split('/').filter(Boolean);
    const endpoint = '/' + segments.slice(0, 2).join('/');
    const hour = new Date().getUTCHours().toString().padStart(2, '0');

    // 1) Starý formát: reqcount:YYYY-MM-DD (plain číslo) — pro jistotu
    const reqKey = 'reqcount:' + today;
    const reqRaw = await env.USAGE_KV.get(reqKey);
    const reqCount = parseInt(reqRaw || '0', 10) + 1;
    await env.USAGE_KV.put(reqKey, String(reqCount));

    // 2) Nový formát: usage:YYYY-MM-DD (JSON s detaily)
    const usageKey = 'usage:' + today;
    const usageRaw = await env.USAGE_KV.get(usageKey);
    const data = usageRaw ? JSON.parse(usageRaw) : {
      requests: 0, errors: 0, responseMs: 0,
      endpoints: {}, hours: {}
    };

    data.requests = (data.requests || 0) + 1;
    if (isError) data.errors = (data.errors || 0) + 1;
    data.responseMs = (data.responseMs || 0) + elapsedMs;
    data.endpoints[endpoint] = (data.endpoints[endpoint] || 0) + 1;
    data.hours[hour] = (data.hours[hour] || 0) + 1;

    await env.USAGE_KV.put(usageKey, JSON.stringify(data));
  } catch (e) {
    // Počítadlo selhalo — nechceme shodit request
    console.error('USAGE_KV write failed:', e.message);
  }

  return response;
}
