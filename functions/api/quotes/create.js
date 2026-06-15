// functions/api/quotes/create.js
export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const id = crypto.randomUUID();
  const quote = { id, text: body.text, author: body.author || '', created: Date.now() };
  await env.QUOTES_R2.put(`quotes/${id}.json`, JSON.stringify(quote));
  return Response.json(quote);
}
