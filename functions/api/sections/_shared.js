// functions/api/sections/_shared.js
//
// Sdílené věci pro správu HLAVNÍCH sekcí (Cestování / Fotografování / Projekty...).
// "O Zajdovi" (id 'about') je záměrně MIMO tenhle systém — má vlastní stránku
// a vlastní logiku v adminu, není to "sekce s články" jako ostatní tři.
//
// Sekce se donedávna daly jen 4, natvrdo zapsané na několika místech v kódu.
// Tohle je ukládá do KV (namespace SUBSECTIONS, stejně jako podsekce) pod
// klíčem `section:<id>`, aby šly přidávat/přejmenovávat/mazat z adminu.
//
// Zpětná kompatibilita: id původních tří sekcí ('travel', 'photo', 'projects')
// se NESMÍ změnit — na tyhle stringy se odkazují všechny existující podsekce
// a články (pole sectionId). Proto se při prvním zápisu (seed) použijí
// přesně tahle id, ne náhodná.

export const RESERVED_SECTION_IDS = ['about'];

export const DEFAULT_SECTIONS = [
  { id: 'travel', name: 'Cestování', nameEn: 'Travel', order: 0, coverUrl: '' },
  { id: 'photo', name: 'Fotografování', nameEn: 'Photo', order: 1, coverUrl: '' },
  { id: 'projects', name: 'Projekty', nameEn: 'Projects', order: 2, coverUrl: '' }
];

export function slugify(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Vrátí všechny hlavní sekce z KV. Pokud tam ještě žádné nejsou (první
 *  použití po nasazení téhle funkce), vrátí výchozí 3 sekce BEZ zápisu do KV
 *  — homepage tak funguje hned, bez nutnosti cokoliv ručně migrovat. */
export async function loadSections(env) {
  const list = await env.SUBSECTIONS.list({ prefix: 'section:' });
  if (!list.keys.length) {
    return DEFAULT_SECTIONS.map(s => ({ ...s }));
  }
  const sections = [];
  for (const key of list.keys) {
    const data = await env.SUBSECTIONS.get(key.name, { type: 'json' });
    if (data) sections.push(data);
  }
  return sections.sort((a, b) => (a.order || 0) - (b.order || 0));
}

/** Zajistí, že výchozí sekce jsou reálně zapsané v KV — voláno před jakýmkoliv
 *  zápisem (create/update/delete), aby nešlo přijít o "virtuální" výchozí
 *  sekce jen tím, že s nimi něco upravíme. Bezpečné volat opakovaně. */
export async function ensureSeeded(env) {
  const list = await env.SUBSECTIONS.list({ prefix: 'section:' });
  if (list.keys.length) return;
  for (const s of DEFAULT_SECTIONS) {
    await env.SUBSECTIONS.put(`section:${s.id}`, JSON.stringify({ ...s, created: Date.now() }));
  }
}
