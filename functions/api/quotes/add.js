export async function onRequest(context) {
  const { request, env } = context;

  const body = await request.json();
  const id = crypto.randomUUID();

  const quote = {
    id,
    text: body.text || "",
    author: body.author || "",
    created: Date.now()
  };

  await env.QUOTES.put(id, JSON.stringify(quote));

  return new Response(JSON.stringify(quote), {
    headers: { "Content-Type": "application/json" }
  });
}
