// functions/api/sections/repair.js
//
// JEDNORÁZOVÁ oprava pro stav, kdy se travel/photo/projects nestihly
// zaseednout se svými stabilními id (viz oprava v cover.js) a admin
// mezitím přes "Hlavní sekce" vytvořil nové záznamy s náhodnými id.
// Najde takové "duplikáty" podle shody názvu (česky nebo anglicky)
// s jedním z původních tří, přenese na správné id jejich název/cover/
// pořadí a duplikát smaže. Nic nemaže, pokud si nebude jistá shodou.
// Bezpečné spustit i vícekrát — pokud už je vše v pořádku, nic nedělá.

import { requireAdmin, json } from '../_auth-utils.js';
import { DEFAULT_SECTIONS } from './_shared.js';

function norm(s) {
  return (s || '').toString().trim().toLowerCase();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!(await requireAdmin(request, env))) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const list = await env.SUBSECTIONS.list({ prefix: 'section:' });
    const records = {};
    const unreadable = [];
    for (const key of list.keys) {
      try {
        const data = await env.SUBSECTIONS.get(key.name, { type: 'json' });
        if (data && data.id) records[data.id] = data;
      } catch (e) {
        unreadable.push(key.name);
      }
    }

    const knownIds = new Set(['travel', 'photo', 'projects', 'about']);
    const report = { restored: [], removedDuplicates: [], fixedAboutName: false, alreadyOk: [], unreadable };

    for (const def of DEFAULT_SECTIONS) {
      if (records[def.id]) {
        report.alreadyOk.push(def.id);
        continue;
      }

      let dup = null;
      for (const id in records) {
        if (knownIds.has(id)) continue;
        const r = records[id];
        if (norm(r.name) === norm(def.name) || (r.nameEn && norm(r.nameEn) === norm(def.nameEn))) {
          dup = r;
          break;
        }
      }

      const restored = {
        id: def.id,
        name: dup ? (dup.name || def.name) : def.name,
        nameEn: dup ? (dup.nameEn || def.nameEn) : def.nameEn,
        order: def.order,
        coverUrl: dup ? (dup.coverUrl || '') : '',
        created: Date.now()
      };
      await env.SUBSECTIONS.put(`section:${def.id}`, JSON.stringify(restored));
      report.restored.push(restored);

      if (dup) {
        await env.SUBSECTIONS.delete(`section:${dup.id}`);
        report.removedDuplicates.push({ id: dup.id, name: dup.name });
        delete records[dup.id];
      }
    }

    const about = records['about'];
    if (about && about.name === 'about') {
      about.name = 'O Zajdovi';
      await env.SUBSECTIONS.put('section:about', JSON.stringify(about));
      report.fixedAboutName = true;
    }

    return json(report);
  } catch (e) {
    return json({ error: 'Repair selhal: ' + (e && e.message ? e.message : String(e)), stack: e && e.stack }, 500);
  }
}
