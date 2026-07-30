// functions/api/admin/users/invite.js
//
// POST /api/admin/users/invite   body: { email, role }
// → { ok: true, email, temporaryPassword }
//
// Vytvoří záznam uživatele v APP_DATA KV (klíč "user:<email>"), vygeneruje
// mu náhodné dočasné heslo (vrací se JEDNOU v odpovědi, hash se ukládá),
// role se uloží do JWT payloadu při přihlášení.
//
// Používá stejné hashování (PBKDF2) jako _auth-utils.js a login.js.

import { requireAdmin, json, hashPassword, generateSalt, generateTempPassword } from '../../_auth-utils.js';

const USER_PREFIX = 'user:';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Neplatný JSON v těle požadavku' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const role = (body.role || 'editor').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Neplatný e-mail' }, 400);
  }

  if (!['admin', 'editor', 'viewer'].includes(role)) {
    return json({ error: 'Neplatná role (admin, editor, viewer)' }, 400);
  }

  if (!env.APP_DATA) {
    return json({ error: 'KV binding APP_DATA chybí' }, 500);
  }

  // Kontrola, jestli uživatel už existuje
  const existing = await env.APP_DATA.get(USER_PREFIX + email);
  if (existing) {
    return json({ error: 'Uživatel s tímto e-mailem už existuje' }, 409);
  }

  // Vygenerování dočasného hesla a hashe
  const tempPassword = generateTempPassword(12);
  const salt = generateSalt();
  const passwordHash = await hashPassword(tempPassword, salt);

  // Uložení uživatele do KV
  const record = {
    email,
    role,
    passwordHash,
    salt,
    created: new Date().toISOString()
  };

  await env.APP_DATA.put(USER_PREFIX + email, JSON.stringify(record));

  return json({ ok: true, email, temporaryPassword: tempPassword });
}
