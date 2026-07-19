// functions/api/auth/login.js
//
// ROZŠÍŘENO oproti tvé původní verzi — přidává podporu pro další
// pozvané lidi, ale TVŮJ PŮVODNÍ ÚČET FUNGUJE NAPROSTO STEJNĚ jako
// předtím (ADMIN_USERNAME/ADMIN_PASSWORD z proměnných prostředí má
// vždycky přednost a nezávisí na KV).
//
// Nově: pokud jméno/heslo nesedí na ten hlavní účet, zkusí se ověřit
// proti záznamům v APP_DATA KV (klíč "user:email@..."), kam je ukládá
// /api/admin/users/invite.

import { hashPassword, generateTempPassword } from '../_auth-utils.js';
// (generateTempPassword se tu nepoužívá, import jen pro úplnost kdyby ses
//  rozhodl/a rozšířit o reset hesla — klidně smaž, pokud nebudeš potřebovat)

export async function onRequestPost(context) {
  const { request, env } = context;
  const { username, password } = await request.json();

  const ADMIN_USER = env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASS = env.ADMIN_PASSWORD;
  if (!ADMIN_PASS) {
    return Response.json({ error: 'Heslo není nastaveno v proměnných prostředí' }, { status: 500 });
  }

  let authedUser = null;
  let role = 'admin';

  // 1) Původní jediný účet (vlastník) — beze změny, má vždy přednost
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    authedUser = ADMIN_USER;
    role = 'admin';
  } else if (env.APP_DATA) {
    // 2) Další pozvaní lidé — uloženi v APP_DATA KV pod "user:email"
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

  const sessionId = crypto.randomUUID();
  const token = btoa(`${sessionId}:${Date.now()}`);
  await env.SESSIONS.put(sessionId, JSON.stringify({ user: authedUser, role, created: Date.now() }), {
    expirationTtl: 86400
  });

  return Response.json({ success: true }, {
    headers: {
      'Set-Cookie': `admin_token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`
    }
  });
}
