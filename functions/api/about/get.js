export async function onRequestGet(context) {
  const { env } = context;
  try {
    const data = await env.ARTICLES.get('about:zajda', { type: 'json' });
    if (data) return Response.json(data);
  } catch {}
  
  return Response.json({
    title: 'O Zajdovi',
    text: 'Zatím žádný popis.',
    photos: []
  });
}
