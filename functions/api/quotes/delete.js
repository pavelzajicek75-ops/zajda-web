export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  const object = await env.QUOTES_R2.get("quotes.json");
  if (!object) {
    return new Response(JSON.stringify({ ok: false }), { status: 404 });
  }

  const quotes = JSON.parse(await object.text());
  const filtered = quotes.filter(q => q.id !== id);

  await env.QUOTES_R2.put("quotes.json", JSON.stringify(filtered));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
}
