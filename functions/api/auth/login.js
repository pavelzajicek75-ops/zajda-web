// functions/api/auth/login.js
//
// OPRAVA: Přepis z KV sessions na JWT — žádné zápisy do KV, žádné limity.
// Token je teď JWT podepsaný HMAC-SHA256, frontend ho ukládá do localStorage
// stejně jako dřív. Žádný env.SESSIONS.put() → žádný KV limit.

import { hashPassword, signJWT } from '../_auth-utils.js';

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

    // 1) Hlavní admin účet — vždy přednost
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      authedUser = ADMIN_USER;
      role = 'admin';
    } else if (env.APP_DATA) {
      // 2) Pozvaní uživatelé v KV (jen čtení — žádný zápis)
      try {
        const raw = await env.APP_DATA.get('user:' + String(username).toLowerCase());
        if (raw) {
          const record = JSON.parse(raw);
          const hash = await hashPassword(password, record.salt);
          if (hash === record.passwordHash) {
            authedUser = record.email;
            role = record.role || 'editor';
          }
        }
      } catch (kvErr) {
        console.error('Chyba při čtení APP_DATA KV:', kvErr.message);
      }
    }

    if (!authedUser) {
      return Response.json({ error: 'Špatné přihlašovací údaje' }, { status: 401 });
    }

    // Vytvoření JWT tokenu (žádný KV zápis!)
    const token = await signJWT({ user: authedUser, role }, env);

    return Response.json({ ok: true, token, user: authedUser, role });

  } catch (err) {
    return Response.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
