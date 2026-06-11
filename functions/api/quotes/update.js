export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST" && request.method !== "PUT") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const body = await request.json();
  const id = body.id;

  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), { status: 400 });
  }

  const key = `quotes/${id}.json`;
  const file = await env.QUOTES_BUCKET.get(key);

  if (!file) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }

  const existing = await file.json();

  const updated = {
    ...existing,
    text: body.text?.trim() ?? existing.text,
    author: body.author?.trim() ?? existing.author,
    updated: new Date().toISOString()
  };

  await env.QUOTES_BUCKET.put(key, JSON.stringify(updated), {
    httpMetadata: { contentType: "application/json" }
  });

  return new Response(JSON.stringify(updated), {
    headers: { "Content-Type": "application/json" }
  });
}
