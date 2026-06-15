// functions/api/auth/logout.js
export async function onRequestPost(context) {
  const { request, env } = context;
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/admin_token=([^;]+)/);
  if (match) {
    const sessionId = atob(match[1]).split(':')[0];
    await env.SESSIONS.delete(sessionId);
  }
  return Response.json({ success: true }, {
    headers: { 'Set-Cookie': 'admin_token=; HttpOnly; Path=/; Max-Age=0' }
  });
}
