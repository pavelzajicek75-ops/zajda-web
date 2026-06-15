export async function onRequestGet(context) {
  const { request, env } = context;
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/admin_token=([^;]+)/);

  if (!match) {
    return Response.json({ auth: false }, { status: 401 });
  }

  try {
    const sessionId = atob(match[1]).split(':')[0];
    const session = await env.SESSIONS.get(sessionId);
    if (!session) throw new Error('Session not found');
    return Response.json({ auth: true, user: JSON.parse(session).user });
  } catch {
    return Response.json({ auth: false }, { status: 401 });
  }
}
