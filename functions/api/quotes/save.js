export async function onRequest(context) {
  const { request, env } = context;
  const body = await request.json();

  const object = await env.QUOTES_R2.get("quotes.json");
  const quotes = object ? JSON.parse(await object.text()) : [];

  if (body.id) {
    const q = quotes.find(x => x.id === body.id);
    if (q) {
      q.text = body.text;
      q.author = body.author;
      q.updated = Date.now();
    }
  } else {
    quotes.push({
      id: crypto.randomUUID(),
      text: body.text,
      author: body.author,
      created: Date.now()
    });
  }

  await env.QUOTES_R2.put("quotes.json", JSON.stringify(quotes));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
}
