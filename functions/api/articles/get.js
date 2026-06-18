export async function onRequestGet(context) {
  const { env } = context;
  const { searchParams } = new URL(context.request.url);
  const id = searchParams.get('id');
  const data = await env.ARTICLES.get(`article:${id}`, { type: 'json' });
  if (!data) return Response.json({ error: 'Nenalezeno' }, { status: 404 });
  return Response.json(data);
}
