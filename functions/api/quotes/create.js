export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const id = crypto.randomUUID();
  const key = `quotes/${id}.json`;
  const quote = {
    text: body.text || '',
    author: body.author || '',
    created: Date.now()
  };
  await env['zajda-quotes'].put(key, JSON.stringify(quote));
  return Response.json({ ...quote, key });
}
