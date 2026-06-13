export async function onRequestPost(context) {
  const { request, env } = context;

  const body = await request.json().catch(() => ({}));
  const { password } = body;

  if (!password || password !== env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = crypto.randomUUID();

  // Store in KV with 24h expiration (ttl in seconds)
  await env.SESSIONS.put(token, JSON.stringify({ created: Date.now() }), {
    expirationTtl: 86400,
  });

  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
