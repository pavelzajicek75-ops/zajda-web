// functions/api/verify.js
//
// Cesta MUSÍ být přesně tady (functions/api/verify.js), protože frontend
// volá fetch('/api/verify', ...) — ne '/api/auth/verify'.
//
// Ověřuje stejný Bearer token / stejný klíč v env.SESSIONS jako
// functions/_middleware.js a login.js (token === sessionId uložený v KV).
// checkAuth() v dashboard-core.js čeká na odpovědi JSON tvar { ok: true/false }.
export async function onRequestPost(context) {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return Response.json({ ok: false, error: 'Chybí Authorization hlavička' }, { status: 401 });
  }

  const token = match[1];
  const raw = await env.SESSIONS.get(token);
  if (!raw) {
    return Response.json({ ok: false, error: 'Neplatný nebo expirovaný token' }, { status: 401 });
  }

  let session;
  try {
    session = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false, error: 'Poškozený záznam session' }, { status: 500 });
  }

  return Response.json({ ok: true, user: session.user, role: session.role });
}
