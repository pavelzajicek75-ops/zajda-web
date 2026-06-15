export async function onRequestPost(context) {
  const { request, env } = context;
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/admin_token=([^;]+)/);

  if (match) {
    try {
      const sessionId = atob(match[1]).split(':')[0];
      await env.SESSIONS.delete(sessionId);
    } catch {}
  }

  return Response.json({ success: true }, {
    headers: { 'Set-Cookie': 'admin_token=; HttpOnly; Path=/; Max-Age=0' }
  });
}
