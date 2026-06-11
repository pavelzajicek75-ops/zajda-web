export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST" && request.method !== "DELETE") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const body = await request.json();
  const ids = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);

  if (!ids.length) {
    return new Response(JSON.stringify({ error: "Missing id(s)" }), { status: 400 });
  }

  for (const id of ids) {
    await env.QUOTES_BUCKET.delete(`quotes/${id}.json`);
  }

  return new Response(JSON.stringify({ success: true, deleted: ids }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
