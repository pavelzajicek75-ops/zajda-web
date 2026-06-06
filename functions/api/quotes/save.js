export async function onRequest(context) {
  const { request, env } = context;
  const body = await request.json();

  const object = await env.QUOTES_R2.get("quotes.json");
  const data = object ? JSON.parse(await object.text()) : [];

  const existing = data.find(q => q.id === body.id);
  if (existing) {
    existing.text = body.text;
    existing.author = body.author;
  } else {
    data.push({
      id: crypto.randomUUID(),
      text: body.text,
      author: body.author,
      created: Date.now()
    });
  }

  await env.QUOTES_R2.put("quotes.json", JSON.stringify(data));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
}
