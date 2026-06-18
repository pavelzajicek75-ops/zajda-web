export async function onRequestGet(context) {
  const { env } = context;
  const { searchParams } = new URL(context.request.url);
  const sectionId = searchParams.get('sectionId');
  const subsectionId = searchParams.get('subsectionId');
  const list = await env.ARTICLES.list({ prefix: 'article:' });
  const articles = [];
  for (const key of list.keys) {
    const data = await env.ARTICLES.get(key.name, { type: 'json' });
    if (data && (!sectionId || data.sectionId === sectionId) && (!subsectionId || data.subsectionId === subsectionId)) articles.push(data);
  }
  return Response.json(articles.sort((a, b) => (b.created || 0) - (a.created || 0)));
}
