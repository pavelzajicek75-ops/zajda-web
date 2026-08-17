// POST /api/timeline/create
// Stejný vzor jako /api/articles/create.js — ukládá do stejného KV
// úložiště (env.ARTICLES), jen s prefixem "timeline:" místo "article:",
// ať nejsou milníky a články ve stejném seznamu smíchané.
export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const id = crypto.randomUUID();
  const photos = Array.isArray(body.photos) ? body.photos.filter(Boolean).slice(0, 3) : [];

  // ★ NOVÉ: "order" — číslo určující pořadí. Výchozí hodnota = datum
  // milníku převedené na čas (takže bez ručního zásahu vyjde pořadí
  // stejné jako řazení podle data). V adminu jde pořadí přetáhnout
  // myší/prstem mimo chronologii — to přepíše "order" u VŠECH milníků
  // na nové hodnoty (viz timeline-admin.js).
  const dateMs = body.date ? Date.parse(body.date) : NaN;
  const order = Number.isFinite(dateMs) ? dateMs : Date.now();

  const milestone = {
    id,
    date: body.date || '',
    title: body.title || '',
    text: body.text || '',
    photos,
    order,
    // ★ NOVÉ: nepovinné propojení s článkem — na webu se pak u milníku
    // objeví odkaz "O týhle cestě víc píšu tady →".
    linkedArticleId: body.linkedArticleId || null,
    created: Date.now()
  };
  await env.ARTICLES.put(`timeline:${id}`, JSON.stringify(milestone));
  return Response.json(milestone);
}
