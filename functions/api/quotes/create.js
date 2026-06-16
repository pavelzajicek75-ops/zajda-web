export async function onRequestPost(context) {
  const { request, env } = context;
  
  if (!env.QUOTES_R2) {
    return Response.json({ error: 'R2 binding QUOTES_R2 není připojený.' }, { status: 500 });
  }

  const body = await request.json();
  const id = crypto.randomUUID();
  const key = `quotes/${id}.json`;
  
  const quote = {
    text: body.text || '',
    author: body.author || '',
    created: Date.now()
  };
  
  await env.QUOTES_R2.put(key, JSON.stringify(quote));
  return Response.json({ ...quote, key });
}
