// /functions/api/articles/react.js
//
// Vtipné reakce na článek — konfigurovatelné z adminu (viz
// /api/reactions/config.js), takže tady se NEKONTROLUJE seznam
// povolených klíčů natvrdo — validuje se jen tvar dat. Reakce se počítá
// zvlášť podle klíče a ukládá přímo do záznamu článku v KV, stejně jako
// počítadlo zobrazení (view.js) — žádná nová databáze/tabulka.
//
// action: "add" připočte, "remove" odečte (uživatel klikl podruhé = zrušil
// svou reakci — i když aktuální frontend už reakce dělá jednorázové a
// trvalé, endpoint zůstává obecný pro budoucí použití). Číslo nikdy
// neklesne pod 0, ať se to omylem "add"+"remove" v rychlém sledu
// nezacyklí do záporu.

export async function onRequestPost(context) {
  const { request, env } = context;

  let id, emoji, action;
  try {
    const body = await request.json();
    id = body && body.id;
    emoji = body && typeof body.emoji === 'string' ? body.emoji.trim() : '';
    action = body && body.action === 'remove' ? 'remove' : 'add';
  } catch {
    return Response.json({ error: 'Neplatné tělo požadavku' }, { status: 400 });
  }
  if (!id) return Response.json({ error: 'Chybí id' }, { status: 400 });
  if (!emoji) return Response.json({ error: 'Chybí emoji/klíč reakce' }, { status: 400 });

  const key = `article:${id}`;
  const existing = await env.ARTICLES.get(key, { type: 'json' });
  if (!existing) return Response.json({ error: 'Nenalezeno' }, { status: 404 });

  const reactions = Object.assign({}, existing.reactions);
  const current = reactions[emoji] || 0;
  reactions[emoji] = action === 'add' ? current + 1 : Math.max(0, current - 1);

  const updated = Object.assign({}, existing, { reactions });
  await env.ARTICLES.put(key, JSON.stringify(updated));

  // Lehký časový záznam pro graf "vývoj v čase" ve statistikách adminu —
  // samotný čítač výše stačí na aktuální čísla, ale neříká NIC o tom,
  // KDY k reakcím docházelo. Klíč nese datum přímo v sobě (řetězce se v
  // KV list() vrací abecedně = zároveň chronologicky), takže stačí
  // vylistovat prefix konkrétního dne, žádná složitější databáze.
  // Zapisuje se jen při "add" (reálná nová reakce), ne při "remove".
  if (action === 'add') {
    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const logKey = `reaction-log:${day}:${Date.now()}:${id}:${emoji}`;
    context.waitUntil
      ? context.waitUntil(env.ARTICLES.put(logKey, '1', { expirationTtl: 60 * 60 * 24 * 400 }))
      : await env.ARTICLES.put(logKey, '1', { expirationTtl: 60 * 60 * 24 * 400 });
  }

  return Response.json({ reactions });
}
