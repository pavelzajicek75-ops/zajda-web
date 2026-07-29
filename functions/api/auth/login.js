import { hashPassword, generateTempPassword } from '../_auth-utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { username, password } = await request.json();
    const ADMIN_USER = env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASS = env.ADMIN_PASSWORD;

    if (!ADMIN_PASS) {
      return Response.json({ error: 'Chybí ADMIN_PASSWORD v env vars' }, { status: 500 });
    }

    let authedUser = null;
    let role = 'admin';

    if (username === ADMIN_USER && password === ADMIN_PASS) {
      authedUser = ADMIN_USER;
      role = 'admin';
    } else if (env.APP_DATA) {
      const raw = await env.APP_DATA.get('user:' + String(username).toLowerCase());
      if (raw) {
        const record = JSON.parse(raw);
        const hash = await hashPassword(password, record.salt);
        if (hash === record.passwordHash) {
          authedUser = record.email;
          role = record.role || 'editor';
        }
      }
    }

    if (!authedUser) {
      return Response.json({ error: 'Špatné přihlašovací údaje' }, { status: 401 });
    }

    if (!env.SESSIONS) {
      return Response.json({ error: 'Chybí SESSIONS KV binding' }, { status: 500 });
    }

    const sessionId = crypto.randomUUID();
    await env.SESSIONS.put(
      sessionId,
      JSON.stringify({ user: authedUser, role, created: Date.now() }),
      { expirationTtl: 86400 }
    );

    return Response.json({ ok: true, token: sessionId, user: authedUser, role });

  } catch (err) {
    return Response.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
