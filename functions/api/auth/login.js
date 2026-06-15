// functions/api/auth/login.js
export async function onRequestPost(context) {
  const { request, env } = context;
  const { username, password } = await request.json();
  
  // Nastav heslo v Environment Variables nebo zde pro test
  const ADMIN_USER = 'admin';
  const ADMIN_PASS = env.ADMIN_PASSWORD || 'zmenitohle';
  
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return Response.json({ error: 'Špatné údaje' }, { status: 401 });
  }
  
  const sessionId = crypto.randomUUID();
  const token = btoa(`${sessionId}:${Date.now()}`);
  
  await env.SESSIONS.put(sessionId, JSON.stringify({ user: username, created: Date.now() }), { expirationTtl: 86400 });
  
  return Response.json({ success: true }, {
    headers: {
      'Set-Cookie': `admin_token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`
    }
  });
}
