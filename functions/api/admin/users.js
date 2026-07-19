// functions/api/admin/users.js
//
// GET    /api/admin/users            → [{ email, role, created }]
// DELETE /api/admin/users?email=...  → smaže přístup danému e-mailu
//
// OPRAVENO: používá KV binding APP_DATA, který už máš (klíče s prefixem
// "user:", ať se to nemíchá se záznamem "folder-sync-data" ve stejném
// namespace) — nepotřebuješ zakládat žádný nový KV navíc.

import { requireAdmin, json } from '../_auth-utils.js';

const USER_PREFIX = 'user:';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const list = await env.APP_DATA.list({ prefix: USER_PREFIX });
  const users = await Promise.all(
    list.keys.map(async (k) => {
      const raw = await env.APP_DATA.get(k.name);
      if (!raw) return null;
      const record = JSON.parse(raw);
      // Hash hesla ven neposíláme, i kdyby se dostal do odpovědi omylem.
      const { passwordHash, salt, ...safe } = record;
      return safe;
    })
  );

  return json(users.filter(Boolean));
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  if (!email) return json({ error: 'Chybí parametr email' }, 400);

  await env.APP_DATA.delete(USER_PREFIX + email.toLowerCase());
  return json({ ok: true });
}
