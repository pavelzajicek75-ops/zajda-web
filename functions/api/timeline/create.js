// POST /api/timeline/create
// Stejný vzor jako /api/articles/create.js — ukládá do stejného KV
// úložiště (env.ARTICLES), jen s prefixem "timeline:" místo "article:",
// ať nejsou milníky a články ve stejném seznamu smíchané.
export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const id = crypto.randomUUID();
  // ★ ZMĚNA: photoUrl (jedna fotka) → photos (pole až 3 fotek). Starší
  // milníky s jen photoUrl zůstávají čitelné (frontend má fallback),
  // nové se ukládají vždy jako pole.
  const photos = Array.isArray(body.photos) ? body.photos.filter(Boolean).slice(0, 3) : [];
  const milestone = {
    id,
    date: body.date || '',
    title: body.title || '',
    text: body.text || '',
    photos,
    created: Date.now()
  };
  await env.ARTICLES.put(`timeline:${id}`, JSON.stringify(milestone));
  return Response.json(milestone);
}
