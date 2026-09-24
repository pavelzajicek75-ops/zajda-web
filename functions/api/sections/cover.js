// functions/api/sections/cover.js
//
// Cover fotka hlavní sekce (včetně 'about', která jinak přes tenhle systém
// nejde spravovat — cover ale potřebuje stejně jako ostatní tři).
// GET je bez auth (čte to homepage pro každého návštěvníka), POST jen admin.

import { requireAdmin, json } from '../_auth-utils.js';
import { ensureSeeded } from './_shared.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get('sectionId');
  if (!sectionId) return json({ error: 'Chybí sectionId' }, 400);

  const data = await env.SUBSECTIONS.get(`section:${sectionId}`, { type: 'json' });
  return json({ url: (data && data.coverUrl) || '', coverUrl: (data && data.coverUrl) || '' });
}

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

  const sectionId = body.sectionId;
  const photoUrl = body.photoUrl || body.coverUrl || body.url;
  if (!sectionId || !photoUrl) return json({ error: 'Chybí sectionId nebo fotka' }, 400);

  // 'about' není v _shared seznamu (má vlastní stránku), ale cover
  // se pro ni ukládá stejně, pod section:about.
  if (sectionId !== 'about') await ensureSeeded(env);

  const key = `section:${sectionId}`;
  const existing = (await env.SUBSECTIONS.get(key, { type: 'json' })) || { id: sectionId, name: sectionId, created: Date.now() };
  existing.coverUrl = photoUrl;
  await env.SUBSECTIONS.put(key, JSON.stringify(existing));

  return json({ success: true, url: photoUrl });
}
