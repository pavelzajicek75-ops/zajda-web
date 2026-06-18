export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const id = crypto.randomUUID();
  const article = { id, title: body.title || '', content: body.content || '', sectionId: body.sectionId || '', subsectionId: body.subsectionId || '', date: body.date || '', place: body.place || '', created: Date.now() };
  await env.ARTICLES.put(`article:${id}`, JSON.stringify(article));
  return Response.json(article);
}
