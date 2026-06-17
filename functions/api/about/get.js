export async function onRequestGet(context) {
  const { env } = context;
  const data = await env.ARTICLES.get('about:zajda', { type: 'json' });
  return Response.json(data || { title: 'O Zajdovi', text: '', photos: [], subsections: [] });
}
