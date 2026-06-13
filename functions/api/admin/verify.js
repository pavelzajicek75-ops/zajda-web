export async function onRequestGet(context) {
  const { request, env } = context;

  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return new Response(JSON.stringify({ error: "Missing token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const token = match[1];
  const exists = await env.SESSIONS.get(token);

  if (!exists) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ valid: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
