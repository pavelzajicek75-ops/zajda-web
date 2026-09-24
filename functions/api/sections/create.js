// functions/api/sections/create.js
//
// Vytvoří novou hlavní sekci. Jen pro přihlášeného admina.

import { requireAdmin, json } from '../_auth-utils.js';
import { loadSections, ensureSeeded, slugify, RESERVED_SECTION_IDS } from './_shared.js';

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

  const name = (body.name || '').trim();
  if (!name) {
    return json({ error: 'Zadej název sekce' }, 400);
  }

  // Zapíše výchozí 3 sekce do KV, pokud tam ještě fyzicky nejsou
  // (viz _shared.js) — nová sekce se pak řadí za ně.
  await ensureSeeded(env);
  const existing = await loadSections(env);

  let base = slugify(name) || 'sekce';
  if (RESERVED_SECTION_IDS.includes(base)) base = base + '-sekce';

  let id = base;
  let n = 2;
  while (existing.some(s => s.id === id) || RESERVED_SECTION_IDS.includes(id)) {
    id = `${base}-${n}`;
    n++;
  }

  const maxOrder = existing.reduce((m, s) => Math.max(m, s.order || 0), -1);

  const section = {
    id,
    name,
    nameEn: (body.nameEn || '').trim(),
    order: maxOrder + 1,
    coverUrl: '',
    created: Date.now()
  };

  await env.SUBSECTIONS.put(`section:${id}`, JSON.stringify(section));
  return json(section);
}
