export async function onRequestGet(context) {
  const { env } = context;
  const { searchParams } = new URL(context.request.url);
  const sectionId = searchParams.get('sectionId');
  const limit = parseInt(searchParams.get('limit')) || 6;
  const list = await env.ARTICLES.list({ prefix: 'article:' });
  const articles = [];
  for (const k of list.keys) {
    const d = await env.ARTICLES.get(k.name, { type: 'json' });
    if (d && (!sectionId || d.sectionId === sectionId)) articles.push(d);
  }
  const photos = [];
  for (const a of articles) {
    if (!a.content) continue;
    const matches = a.content.match(/src="([^"]+)"/g);
    if (matches) matches.forEach(m => photos.push(m.slice(5, -1)));
  }
  for (let i = photos.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [photos[i], photos[j]] = [photos[j], photos[i]]; }
  return Response.json(photos.slice(0, limit));
}
