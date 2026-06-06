export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), { status: 400 });
  }

  const raw = await env.ARTICLES.get(id);
  if (!raw) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }

  return new Response(raw, {
    headers: { "Content-Type": "application/json" }
  });
}
