// functions/api/auth/me.js
//
// ROZŠÍŘENO — vrací navíc "role", ať frontend pozná, jestli má uživatel
// vidět třeba správu přístupů (jen role "admin"). Chování pro tvůj
// původní účet je beze změny (jen response má o pole víc).

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
    const data = JSON.parse(session);
    return Response.json({ auth: true, user: data.user, role: data.role || 'admin' });
  } catch {
    return Response.json({ auth: false }, { status: 401 });
  }
}
