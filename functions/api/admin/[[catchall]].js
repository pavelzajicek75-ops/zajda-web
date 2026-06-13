export async function onRequest(context) {
  const { request, env, next } = context;

  // Skip login itself
  if (request.url.endsWith('/functions/api/admin/login')) {
    return next();
  }

  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = match[1];
  const session = await env.SESSIONS.get(token);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return next();
}
