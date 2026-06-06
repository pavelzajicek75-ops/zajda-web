export async function onRequest(context) {
  const { request, env } = context;

  const body = await request.json();

  if (!body.id) {
    return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400 });
  }

  const quote = {
    id: body.id,
    text: body.text || "",
    author: body.author || "",
    updated: Date.now()
  };

  await env.QUOTES.put(body.id, JSON.stringify(quote));

  return new Response(JSON.stringify(quote), {
    headers: { "Content-Type": "application/json" }
  });
}
