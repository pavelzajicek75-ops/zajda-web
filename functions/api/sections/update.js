// functions/api/sections/update.js
//
// Přejmenování / přeřazení / cover hlavní sekce. Jen pro přihlášeného admina.

import { requireAdmin, json } from '../_auth-utils.js';
import { ensureSeeded } from './_shared.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Neplatné tělo požadavku' }, 400);
  }

  const id = body.id;
  if (!id) return json({ error: 'Chybí id sekce' }, 400);
  if (id === 'about') return json({ error: 'Tahle sekce se odsud upravovat nedá' }, 400);

  // Kdyby se editovala ještě "virtuální" výchozí sekce (KV úplně prázdné),
  // nejdřív ji reálně zapsat, jinak by update neměl co najít.
  await ensureSeeded(env);

  const key = `section:${id}`;
  const existing = await env.SUBSECTIONS.get(key, { type: 'json' });
  if (!existing) return json({ error: 'Sekce nenalezena' }, 404);

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return json({ error: 'Název nesmí být prázdný' }, 400);
    existing.name = name;
  }
  if (body.nameEn !== undefined) existing.nameEn = String(body.nameEn).trim();
  if (body.order !== undefined) existing.order = parseInt(body.order, 10) || 0;
  if (body.coverUrl !== undefined) existing.coverUrl = body.coverUrl;

  await env.SUBSECTIONS.put(key, JSON.stringify(existing));
  return json(existing);
}
