export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const id = crypto.randomUUID();
  const quote = {
    id,
    text: body.text || '',
    author: body.author || '',
    created: Date.now()
  };
  await env['zajda-quotes'].put(`quotes/${id}.json`, JSON.stringify(quote));
  return Response.json(quote);
}
