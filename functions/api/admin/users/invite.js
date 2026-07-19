// functions/api/admin/users/invite.js
//
// POST /api/admin/users/invite   body: { email, role }
// → { ok: true, email, role, temporaryPassword }
//
// Vygeneruje dočasné heslo, uloží jeho HASH (ne čitelné heslo) do
// APP_DATA KV pod klíčem "user:email@...". Heslo se v odpovědi vrátí
// JEN JEDNOU — musíš ho ručně předat nové osobě (Signal, WhatsApp,
// osobně...), nikde se dál neukládá v čitelné podobě.
//
// Nová osoba se pak přihlásí přes stejný /api/auth/login formulář, jaký
// používáš ty — akorát se jejím jménem/heslem ověří proti záznamu v KV
// místo proti ADMIN_USERNAME/ADMIN_PASSWORD (viz upravený auth/login.js).

import { requireAdmin, generateSalt, generateTempPassword, hashPassword, json } from '../../_auth-utils.js';

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
    return json({ error: 'Neplatný JSON' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const role = ['admin', 'editor', 'viewer'].includes(body.role) ? body.role : 'editor';
  if (!email || !email.includes('@')) {
    return json({ error: 'Neplatný e-mail' }, 400);
  }

  const existing = await env.APP_DATA.get(USER_PREFIX + email);
  if (existing) {
    return json({ error: 'Tenhle e-mail už přístup má.' }, 409);
  }

  const tempPassword = generateTempPassword();
  const salt = generateSalt();
  const passwordHash = await hashPassword(tempPassword, salt);

  const record = { email, role, salt, passwordHash, created: new Date().toISOString() };
  await env.APP_DATA.put(USER_PREFIX + email, JSON.stringify(record));

  return json({ ok: true, email, role, temporaryPassword: tempPassword });
}
