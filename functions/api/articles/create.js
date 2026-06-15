// functions/api/articles/create.js
export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const id = crypto.randomUUID();
  const article = { id, title: body.title, content: body.content, image: body.image || '', created: Date.now() };
  await env.ARTICLES.put(`article:${id}`, JSON.stringify(article));
  return Response.json(article);
}
