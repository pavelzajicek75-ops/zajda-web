// /api/data/auto-backup — automatické zálohy do R2 (QUOTES_R2, předpona backups/).
// Jen admin. Žádný cron: admin stránka po přihlášení zavolá POST a záloha se
// vytvoří, jen když je ta poslední starší než 7 dní. Drží se posledních KEEP
// záloh (výchozí 4, nastavitelné 1–12), starší se mažou.
//
//  GET  /api/data/auto-backup            → { backups:[{key,size,uploaded}], keep, due }
//  GET  /api/data/auto-backup?key=...    → obsah jedné zálohy (JSON)
//  POST { force?:bool, keep?:1..12 }     → { created:bool, key?, backups, keep }

import { requireAdmin, json } from '../_auth-utils.js';
import { collectBackup } from './_collect.js';

const PREFIX = 'backups/';
const SETTINGS_KEY = 'backups/_settings.json';
const WEEK = 7 * 24 * 3600 * 1000;
const KEY_RE = /^backups\/zajda-zaloha-[0-9T:\-.Z]+\.json$/;

async function getKeep(r2) {
  try {
    const o = await r2.get(SETTINGS_KEY);
    if (o) { const k = (await o.json()).keep; if (k >= 1 && k <= 12) return Math.floor(k); }
  } catch (e) { /* výchozí */ }
  return 4;
}

async function listBackups(r2) {
  const l = await r2.list({ prefix: PREFIX, include: ['customMetadata'] });
  return l.objects
    .filter(o => KEY_RE.test(o.key))
    .map(o => { let counts = null; try { counts = o.customMetadata && o.customMetadata.counts ? JSON.parse(o.customMetadata.counts) : null; } catch (e) {} return { key: o.key, size: o.size, uploaded: new Date(o.uploaded).getTime(), counts }; })
    .sort((a, b) => b.uploaded - a.uploaded);
}

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const r2 = env.QUOTES_R2;
  if (!r2) return json({ error: 'Chybí R2 binding QUOTES_R2' }, 500);
  const key = new URL(request.url).searchParams.get('key');
  if (key) {
    if (!KEY_RE.test(key)) return json({ error: 'Neplatný klíč' }, 400);
    const o = await r2.get(key);
    if (!o) return json({ error: 'Nenalezeno' }, 404);
    return new Response(o.body, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  const backups = await listBackups(r2);
  const keep = await getKeep(r2);
  return json({ backups, keep, due: !backups.length || Date.now() - backups[0].uploaded > WEEK });
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const r2 = env.QUOTES_R2;
  if (!r2) return json({ error: 'Chybí R2 binding QUOTES_R2' }, 500);
  let body = {};
  try { body = await request.json(); } catch { /* prázdné tělo je v pořádku */ }

  let keep = await getKeep(r2);
  if (body.keep != null) {
    const k = Math.floor(Number(body.keep));
    if (!(k >= 1 && k <= 12)) return json({ error: 'Počet záloh musí být 1–12.' }, 400);
    if (k !== keep) { keep = k; await r2.put(SETTINGS_KEY, JSON.stringify({ keep })); }
  }

  let backups = await listBackups(r2);
  const due = !backups.length || Date.now() - backups[0].uploaded > WEEK;
  let created = false, key = null, warnedAbout = null;
  if (due || body.force === true) {
    let data;
    try { data = await collectBackup(env, { fresh: body.force === true }); }
    catch (e) { return json({ error: 'Záloha se nepodařila: ' + (e && e.message ? e.message : String(e)) }, 500); }
    key = PREFIX + 'zajda-zaloha-' + new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, 'Z') + '.json';
    const counts = { a: (data.articles || []).length, t: (data.timeline || []).length, s: (data.sections || []).length, u: (data.subsections || []).length, g: (data.galleries || []).length, q: (data.quotes || []).length, p: data.photoInventory ? data.photoInventory.count : 0, pm: data.photoInventory ? Math.round(data.photoInventory.totalBytes / 1048576) : 0 };
    await r2.put(key, JSON.stringify(data), { httpMetadata: { contentType: 'application/json' }, customMetadata: { counts: JSON.stringify(counts) } });
    created = true;
    warnedAbout = data.warnings;
    backups = await listBackups(r2);
  }
  // rotace
  const extra = backups.slice(keep);
  for (const b of extra) await r2.delete(b.key);
  if (extra.length) backups = backups.slice(0, keep);
  return json({ created, key, backups, keep, due: false, warnings: warnedAbout || undefined });
}
