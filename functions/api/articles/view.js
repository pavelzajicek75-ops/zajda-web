// /functions/api/articles/view.js
//
// Zaznamená jedno zobrazení článku. Volá se z veřejné stránky článku
// (article.html) při každém úspěšném načtení. Počítadlo se ukládá přímo
// do záznamu článku v KV (stejné místo, kde jsou title/content/atd.) —
// díky tomu ho admin vidí zdarma i v /api/articles/list, bez nutnosti
// tahat další data zvlášť.
//
// POZOR na známé omezení: čtení+zápis do KV není atomické. Při dvou
// zobrazeních naprosto současně (během pár milisekund) se teoreticky
// jedno připočtení může "ztratit". Pro osobní blog s běžnou návštěvností
// je to zanedbatelné; pro web s vysokou návštěvností by bylo potřeba
// řešit přes Durable Objects nebo Cloudflare Analytics Engine.

export async function onRequestPost(context) {
  const { request, env } = context;

  let id;
  try {
    const body = await request.json();
    id = body && body.id;
  } catch {
    return Response.json({ error: 'Neplatné tělo požadavku' }, { status: 400 });
  }
  if (!id) return Response.json({ error: 'Chybí id' }, { status: 400 });

  const key = `article:${id}`;
  const existing = await env.ARTICLES.get(key, { type: 'json' });
  if (!existing) return Response.json({ error: 'Nenalezeno' }, { status: 404 });

  const views = (existing.views || 0) + 1;
  const updated = { ...existing, views };
  await env.ARTICLES.put(key, JSON.stringify(updated));

  return Response.json({ views });
}
