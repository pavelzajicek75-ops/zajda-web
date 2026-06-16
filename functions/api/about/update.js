export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  
  const about = {
    id: 'zajda',
    title: body.title || 'O Zajdovi',
    text: body.text || '',
    updated: Date.now()
  };
  
  await env.ARTICLES.put('about:zajda', JSON.stringify(about));
  return Response.json(about);
}
