// GET /api/admin/selftest — kontrola, že je všechno správně nastavené (jen admin).
// Nic nezapisuje (šetří denní limit zápisů KV); jen čte a počítá.
import { requireAdmin, json } from '../_auth-utils.js';
import { applySchedule } from '../articles/_publish.js';

async function listAllKeys(kv, prefix) {
  let cursor, out = [];
  for (let i = 0; i < 20; i++) {
    const l = await kv.list({ prefix, cursor });
    out = out.concat(l.keys);
    if (l.list_complete || !l.cursor) break;
    cursor = l.cursor;
  }
  return out;
}

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const checks = [];
  const add = (name, status, detail) => checks.push({ name, status, detail: detail || '' });

  // 1) Bindingy a tajemství
  const need = [['ARTICLES', 'KV články'], ['SUBSECTIONS', 'KV sekce'], ['PHOTOS', 'KV fotky'], ['PHOTOS_R2', 'R2 fotky'], ['QUOTES_R2', 'R2 citáty a zálohy']];
  for (const [k, label] of need) add(label + ' (' + k + ')', env[k] ? 'ok' : 'fail', env[k] ? '' : 'Chybí binding v Cloudflare Pages → Settings → Functions.');
  add('Přihlášení (JWT_SECRET)', env.JWT_SECRET ? 'ok' : 'fail', env.JWT_SECRET ? '' : 'Chybí proměnná JWT_SECRET.');

  // 2) Čtení KV + zdraví dat
  if (env.ARTICLES) {
    try {
      const keys = await listAllKeys(env.ARTICLES, 'article:');
      let drafts = 0, scheduledPast = 0, scheduled = 0, priv = 0, noTitle = 0, bigNames = [];
      const slugs = {}, dupes = [];
      for (const k of keys) {
        const a = await env.ARTICLES.get(k.name, { type: 'json' });
        if (!a) continue;
        if (!a.title) noTitle++;
        if (a.published === false) { if (a.publishAt) { if (Date.parse(a.publishAt) <= Date.now()) scheduledPast++; else scheduled++; } else drafts++; }
        if (a.unlisted) priv++;
        if (a.slug) { if (slugs[a.slug]) dupes.push(a.slug); slugs[a.slug] = 1; }
        const size = JSON.stringify(a).length;
        if (size > 900000) bigNames.push(a.title || a.id);
      }
      add('Články v KV', 'ok', keys.length + ' článků (' + drafts + ' konceptů, ' + scheduled + ' naplánovaných, ' + priv + ' soukromých)');
      if (noTitle) add('Články bez názvu', 'warn', noTitle + ' ks');
      if (scheduledPast) add('Naplánované po termínu', 'ok', scheduledPast + ' ks se zveřejní při dalším zobrazení — v pořádku.');
      if (dupes.length) add('Duplicitní slug', 'warn', dupes.join(', '));
      if (bigNames.length) add('Velmi velké články (blízko limitu 1 MB v KV)', 'warn', bigNames.join(', '));
    } catch (e) { add('Čtení KV', 'fail', e.message); }
  }
  if (env.SUBSECTIONS) {
    try { const s = await listAllKeys(env.SUBSECTIONS, 'section:'); const u = await listAllKeys(env.SUBSECTIONS, 'subsection:'); add('Sekce a podsekce', 'ok', s.length + ' sekcí, ' + u.length + ' podsekcí'); }
    catch (e) { add('Čtení sekcí', 'fail', e.message); }
  }

  // 3) R2
  for (const [k, label] of [['PHOTOS_R2', 'R2 fotky'], ['QUOTES_R2', 'R2 citáty/zálohy']]) {
    if (!env[k]) continue;
    try { await env[k].list({ limit: 1 }); add(label + ' — čtení', 'ok'); } catch (e) { add(label + ' — čtení', 'fail', e.message); }
  }

  // 4) Zálohy
  if (env.QUOTES_R2) {
    try {
      const l = await env.QUOTES_R2.list({ prefix: 'backups/' });
      const b = l.objects.filter(o => /zajda-zaloha-.*\.json$/.test(o.key)).map(o => new Date(o.uploaded).getTime()).sort((x, y) => y - x);
      if (!b.length) add('Automatické zálohy', 'warn', 'Zatím žádná záloha — otevři admin a dej „Zálohovat teď“.');
      else {
        const age = Math.floor((Date.now() - b[0]) / 86400000);
        add('Automatické zálohy', age > 10 ? 'warn' : 'ok', b.length + ' uložených, poslední před ' + age + ' dny');
      }
    } catch (e) { add('Automatické zálohy', 'fail', e.message); }
  }

  // 5) Fronty
  try {
    const p = await env.ARTICLES.get('meta:comments-pending', { type: 'json' });
    const n = Array.isArray(p) ? p.length : 0;
    add('Fronta komentářů', n >= 180 ? 'warn' : 'ok', n + ' čeká (limit 200)');
    const m = await env.ARTICLES.get('meta:mood-log', { type: 'json' });
    add('Deník nálady', 'ok', (Array.isArray(m) ? m.length : 0) + ' záznamů');
  } catch (e) { add('Fronty', 'fail', e.message); }

  add('Zápis do KV', 'ok', 'Netestuje se, ať se nespotřebovává denní limit zápisů.');
  const worst = checks.some(c => c.status === 'fail') ? 'fail' : (checks.some(c => c.status === 'warn') ? 'warn' : 'ok');
  return json({ status: worst, checks, time: new Date().toISOString() });
}
