// functions/_middleware.js
//
// Běží nad KAŽDÝM /api/ voláním (Pages Functions middleware). Dvě věci:
//   1) připočítá +1 do KV "reqcount:YYYY-MM-DD" (denní počítadlo požadavků)
//   2) pokud downstream odpoví statusem >= 500, připočítá +1 do
//      "errcount:YYYY-MM-DD" (denní počítadlo chyb)
//
// Počítadla se čtou v functions/api/admin/usage.js a zobrazují se v admin
// dashboardu. Žádný Cloudflare token, žádný GraphQL — vše vlastní cestou.
//
// Zápis do KV je "fire and forget" — neblokuje odpověď. Pokud KV není
// nastavené (USAGE_KV chybí), middleware jen nechá request projít a nic
// nepočítá (admin/usage.js to pozná a ukáže "KV binding USAGE_KV chybí").

async function incrementCounter(env, key) {
  if (!env.USAGE_KV) return;
  try {
    const current = parseInt(await env.USAGE_KV.get(key) || '0', 10);
    await env.USAGE_KV.put(key, String(current + 1));
  } catch (e) {
    // Nechceme shodit request kvůli počítadlu — jen logujeme.
    console.error('Chyba při zápisu do USAGE_KV (' + key + '):', e.message);
  }
}

export async function onRequest(context) {
  const { request, env, next } = context;

  // Počítadlo požadavků — jen pro /api/ cesty
  const url = new URL(request.url);
  const isApi = url.pathname.startsWith('/api/');

  if (isApi) {
    const today = new Date().toISOString().slice(0, 10);
    const reqKey = 'reqcount:' + today;

    // Pošleme request dál a počkáme na odpověď
    const response = await next();

    // Počítadlo chyb — jen pokud odpověď >= 500
    if (response.status >= 500) {
      const errKey = 'errcount:' + today;
      // Fire and forget, neblokuje
      context.waitUntil(incrementCounter(env, errKey));
    }

    // Počítadlo požadavků — fire and forget
    context.waitUntil(incrementCounter(env, reqKey));

    return response;
  }

  // Ne-/api/ cesty jen propustíme
  return next();
}
