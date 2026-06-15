export async function onRequestPost(context) {
  const { request, env } = context;
  const { username, password } = await request.json();

  const ADMIN_USER = env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASS = env.ADMIN_PASSWORD;

  if (!ADMIN_PASS) {
    return Response.json({ error: 'Heslo není nastaveno v proměnných prostředí' }, { status: 500 });
  }

  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return Response.json({ error: 'Špatné přihlašovací údaje' }, { status: 401 });
  }

  const sessionId = crypto.randomUUID();
  const token = btoa(`${sessionId}:${Date.now()}`);

  await env.SESSIONS.put(sessionId, JSON.stringify({ user: ADMIN_USER, created: Date.now() }), {
    expirationTtl: 86400
  });

  return Response.json({ success: true }, {
    headers: {
      'Set-Cookie': `admin_token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`
    }
  });
}
