import { requireAdmin, json } from '../_auth-utils.js';

const MAX_ENTRIES = 3650; // ~10 let denních záznamů

function clean(str, max) {
  return String(str == null ? '' : str)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

// POST { date:'YYYY-MM-DD', mood:1-5, energy?:1-5, note?:string }  — vloží/přepíše den
// POST { action:'delete', date }                                   — smaže den
export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Neplatný požadavek' }, 400); }

  const date = String(body && body.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return json({ error: 'Neplatné datum' }, 400);

  const log = await env.ARTICLES.get('meta:mood-log', { type: 'json' });
  let entries = Array.isArray(log) ? log : [];

  if (body.action === 'delete') {
    entries = entries.filter(e => e.date !== date);
  } else {
    const mood = Number(body.mood);
    if (!Number.isInteger(mood) || mood < 1 || mood > 5) return json({ error: 'Nálada musí být 1–5' }, 400);
    const entry = { date, mood, note: clean(body.note, 500), updated: Date.now() };
    if (body.energy !== undefined && body.energy !== null && body.energy !== '') {
      const energy = Number(body.energy);
      if (!Number.isInteger(energy) || energy < 1 || energy > 5) return json({ error: 'Energie musí být 1–5' }, 400);
      entry.energy = energy;
    }
    entries = entries.filter(e => e.date !== date).concat([entry]);
  }
  entries.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
  await env.ARTICLES.put('meta:mood-log', JSON.stringify(entries));
  return json({ ok: true, count: entries.length });
}
