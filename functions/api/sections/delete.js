// functions/api/sections/delete.js
//
// Smaže hlavní sekci — jen pokud v ní nezůstaly žádné podsekce ani články
// (jinak by šlo o "osiřelý" obsah, který by na webu přestal jít najít).
// Jen pro přihlášeného admina.

import { requireAdmin, json } from '../_auth-utils.js';
import { ensureSeeded } from './_shared.js';

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return json({ error: 'Chybí id sekce' }, 400);
  if (id === 'about') return json({ error: 'Tahle sekce se smazat nedá' }, 400);

  await ensureSeeded(env);

  const existing = await env.SUBSECTIONS.get(`section:${id}`, { type: 'json' });
  if (!existing) return json({ error: 'Sekce nenalezena' }, 404);

  // Podsekce navázané na tuhle sekci
  const subList = await env.SUBSECTIONS.list({ prefix: 'subsection:' });
  for (const key of subList.keys) {
    const data = await env.SUBSECTIONS.get(key.name, { type: 'json' });
    if (data && String(data.sectionId) === String(id)) {
      return json({ error: 'V sekci jsou ještě podsekce — nejdřív je smaž nebo přesuň jinam.' }, 409);
    }
  }

  // Články navázané na tuhle sekci
  if (env.ARTICLES) {
    const artList = await env.ARTICLES.list({ prefix: 'article:' });
    for (const key of artList.keys) {
      const data = await env.ARTICLES.get(key.name, { type: 'json' });
      if (data && String(data.sectionId) === String(id)) {
        return json({ error: 'V sekci jsou ještě články — nejdřív je přesuň do jiné sekce.' }, 409);
      }
    }
  }

  await env.SUBSECTIONS.delete(`section:${id}`);
  return json({ success: true });
}
