export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const body = await request.json();
  const text = body.text?.trim();
  const author = body.author?.trim() || "Unknown";

  if (!text) {
    return new Response(JSON.stringify({ error: "Text is required" }), { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const quote = {
    id,
    text,
    author,
    created: now,
    updated: now
  };

  await env.QUOTES_BUCKET.put(`quotes/${id}.json`, JSON.stringify(quote), {
    httpMetadata: { contentType: "application/json" }
  });

  return new Response(JSON.stringify(quote), {
    status: 201,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
