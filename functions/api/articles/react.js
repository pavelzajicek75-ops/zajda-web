// /functions/api/articles/react.js
//
// Vtipné reakce na článek (místo obyčejného srdíčka) — 🚀🐰😂🤯🥹. Každá
// reakce se počítá zvlášť a ukládá se přímo do záznamu článku v KV, stejně
// jako počítadlo zobrazení (view.js) — žádná nová databáze/tabulka.
//
// action: "add" připočte, "remove" odečte (uživatel klikl podruhé = zrušil
// svou reakci). Číslo nikdy neklesne pod 0, ať se to omylem "add"+"remove"
// v rychlém sledu nezacyklí do záporu.

const ALLOWED_EMOJI = ['rocket', 'bunny', 'laugh', 'mindblown', 'touched'];

export async function onRequestPost(context) {
  const { request, env } = context;

  let id, emoji, action;
  try {
    const body = await request.json();
    id = body && body.id;
    emoji = body && body.emoji;
    action = body && body.action === 'remove' ? 'remove' : 'add';
  } catch {
    return Response.json({ error: 'Neplatné tělo požadavku' }, { status: 400 });
  }
  if (!id) return Response.json({ error: 'Chybí id' }, { status: 400 });
  if (!ALLOWED_EMOJI.includes(emoji)) return Response.json({ error: 'Neznámá reakce' }, { status: 400 });

  const key = `article:${id}`;
  const existing = await env.ARTICLES.get(key, { type: 'json' });
  if (!existing) return Response.json({ error: 'Nenalezeno' }, { status: 404 });

  const reactions = Object.assign({}, existing.reactions);
  const current = reactions[emoji] || 0;
  reactions[emoji] = action === 'add' ? current + 1 : Math.max(0, current - 1);

  const updated = Object.assign({}, existing, { reactions });
  await env.ARTICLES.put(key, JSON.stringify(updated));

  return Response.json({ reactions });
}
