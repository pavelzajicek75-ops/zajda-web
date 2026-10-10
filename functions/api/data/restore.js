// functions/api/data/restore.js
//
// POST /api/data/restore — obnova ze souboru zálohy (viz backup.js).
// Jen pro admina. NIKDY nic nemaže: jen doplňuje chybějící položky a (jen
// když o to požádáš) přepisuje změněné. Nejdřív se dá spustit "náhled"
// (apply:false), který jen spočítá, co by se stalo.
//
// Tělo: { backup: {...obsah souboru zálohy...}, apply: boolean,
//         overwrite: boolean, types: ['articles', ...] (volitelně) }

import { requireAdmin, json } from '../_auth-utils.js';

const MAX_WRITES = 900; // bezplatný plán KV: 1000 zápisů denně — nechávám rezervu
const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

// typ → { kde, předpona klíče | pevný klíč, popisek }
const TYPES = {
  articles:    { kv: 'ARTICLES',    prefix: 'article:',    label: 'Články' },
  timeline:    { kv: 'ARTICLES',    prefix: 'timeline:',   label: 'Milníky časové osy' },
  sections:    { kv: 'SUBSECTIONS', prefix: 'section:',    label: 'Hlavní sekce' },
  subsections: { kv: 'SUBSECTIONS', prefix: 'subsection:', label: 'Podsekce' },
  galleries:   { kv: 'PHOTOS',      prefix: 'gallery:',    label: 'Galerie (metadata)' },
  about:       { kv: 'ARTICLES',    key: 'about:zajda',    label: 'O Zajdovi' },
  commentsPending: { kv: 'ARTICLES', key: 'meta:comments-pending', label: 'Čekající komentáře' },
  moodLog:     { kv: 'ARTICLES',    key: 'meta:mood-log',  label: 'Deník nálady' }
};

function nameOf(item) {
  return (item && (item.title || item.name)) || (item && item.id) || '';
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Neplatný požadavek (JSON)' }, 400); }
  const backup = body && body.backup;
  if (!backup || typeof backup !== 'object' || !backup.exportedAt) {
    return json({ error: 'Tohle nevypadá jako soubor zálohy z tohoto webu.' }, 400);
  }
  const apply = body.apply === true;
  const overwrite = body.overwrite === true;
  const wanted = Array.isArray(body.types) && body.types.length ? body.types : Object.keys(TYPES);

  const plan = [];   // { kvName, key, value, state:'new'|'changed'|'same', name, type }
  const skipped = [];

  for (const type of wanted) {
    const spec = TYPES[type];
    if (!spec) continue;
    const kv = env[spec.kv];
    if (!kv) { skipped.push(type + ' (úložiště není připojeno)'); continue; }
    const data = backup[type];
    if (data == null) continue;

    const items = [];
    if (spec.key) {
      items.push({ key: spec.key, value: data, name: spec.label });
    } else if (Array.isArray(data)) {
      for (const it of data) {
        if (!it || typeof it.id !== 'string' || !ID_RE.test(it.id)) { skipped.push(type + ': položka bez platného id'); continue; }
        items.push({ key: spec.prefix + it.id, value: it, name: nameOf(it) });
      }
    }
    for (const it of items) {
      const existing = await kv.get(it.key, { type: 'json' });
      let state = 'new';
      if (existing != null) state = JSON.stringify(existing) === JSON.stringify(it.value) ? 'same' : 'changed';
      plan.push({ type, kvName: spec.kv, key: it.key, value: it.value, state, name: it.name });
    }
  }

  const summary = {};
  for (const p of plan) {
    summary[p.type] = summary[p.type] || { label: TYPES[p.type].label, new: 0, changed: 0, same: 0, names: [] };
    summary[p.type][p.state]++;
    if (p.state !== 'same' && summary[p.type].names.length < 8) summary[p.type].names.push((p.state === 'new' ? '＋ ' : '≠ ') + p.name);
  }
  const toWrite = plan.filter(p => p.state === 'new' || (overwrite && p.state === 'changed'));

  if (!apply) {
    return json({ ok: true, applied: false, summary, writes: toWrite.length, maxWrites: MAX_WRITES, skipped });
  }
  if (toWrite.length > MAX_WRITES) {
    return json({ error: 'Příliš mnoho zápisů najednou (' + toWrite.length + ', limit ' + MAX_WRITES + '). Obnov po částech přes výběr typů.', writes: toWrite.length }, 413);
  }
  for (const p of toWrite) {
    await env[p.kvName].put(p.key, JSON.stringify(p.value));
  }
  return json({ ok: true, applied: true, summary, written: toWrite.length, skipped });
}
