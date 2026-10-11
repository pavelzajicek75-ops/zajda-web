// Cache na okraji sítě Cloudflare pro veřejné výpisy (články, sekce, osa…).
//
// PROČ: bezplatný plán KV povoluje jen 1 000 operací „list“ denně a každé
// zobrazení stránky jich dělalo víc (články, sekce, podsekce, osa…). Teď se
// výsledek uloží na pár minut a další návštěvníci ho dostanou bez dotazu na KV.
//
// – Požadavky s Authorization (admin) se NIKDY necachují, admin vidí čerstvá data.
// – Po uložení/smazání článku nebo schválení komentáře se výpis článků smaže z cache
//   (purgeEdge), takže změna je vidět hned (v datacentru, které tě obsluhuje);
//   jinde nejdéle po vypršení TTL.

export async function edgeCached(context, ttlSeconds, producer) {
  const { request } = context;
  if (typeof caches === 'undefined' || !caches.default) return producer();
  if (request.method !== 'GET' || request.headers.get('Authorization')) return producer();
  const cache = caches.default;
  const key = new Request(new URL(request.url).toString(), { method: 'GET' });
  try {
    const hit = await cache.match(key);
    if (hit) {
      // Prohlížeč nemá držet výpis dlouho (jinak by nepomohlo ani smazání z cache).
      const out = new Response(hit.body, hit);
      out.headers.set('Cache-Control', 'public, max-age=30');
      return out;
    }
  } catch (e) { /* cache nedostupná → jedeme bez ní */ }
  const res = await producer();
  if (res && res.status === 200) {
    try {
      const copy = new Response(res.clone().body, res);
      copy.headers.set('Cache-Control', 'public, max-age=' + ttlSeconds);
      const p = cache.put(key, copy);
      if (context.waitUntil) context.waitUntil(p);
    } catch (e) { /* uložení do cache je jen bonus */ }
  }
  return res;
}

// Smaže z cache dané cesty (např. '/api/articles/list') pro stejný web jako request.
export async function purgeEdge(request, paths) {
  if (typeof caches === 'undefined' || !caches.default) return;
  const origin = new URL(request.url).origin;
  for (const p of paths) {
    try { await caches.default.delete(new Request(origin + p, { method: 'GET' })); } catch (e) { /* ticho */ }
  }
}
