// GET /api/quotes/list
//  – veřejně (bez přihlášení): jen text a autor, bez interních klíčů; drží se v cache na okraji sítě
//  – admin (s přihlášením): navíc `key` (potřebný ke smazání) a vždy čerstvá data
import { requireAdmin } from '../_auth-utils.js';
import { edgeCached } from '../_edge-cache.js';

async function build(env, isAdmin) {
  const r2 = env.QUOTES_R2;
  if (!r2) return Response.json({ error: 'Chybí QUOTES_R2' }, { status: 500 });
  const list = await r2.list();
  const quotes = [];
  // Citát = krátký prostý text. Cokoli, co vypadá jako článek (HTML, dlouhý text), se přeskočí,
  // ať se do citátů nikdy nedostane obsah článků, který se v bucketu mohl omylem ocitnout.
  const MAX_LEN = 600;
  const looksLikeQuote = (t) => { t = String(t || '').trim(); return t.length > 0 && t.length <= MAX_LEN && !/<\/?[a-z][^>]*>/i.test(t); };
  const push = (key, text, author, created) => {
    if (!looksLikeQuote(text)) return;
    const q = { text: String(text), author: String(author || ''), created };
    if (isAdmin) q.key = key;
    quotes.push(q);
  };
  for (const obj of list.objects || []) {
    if (obj.key.startsWith('backups/')) continue;   // v tomhle úložišti leží i zálohy webu — to nejsou citáty
    const official = /^quotes\/[^/]+\.json$/.test(obj.key) || obj.key === 'quotes.json';
    try {
      const data = await r2.get(obj.key);
      if (!data) continue;
      let item, raw = null;
      try { item = await data.json(); } catch { continue; }
      if (Array.isArray(item) && obj.key !== 'quotes.json') continue;
      // Neoficiální klíč: přijmout jen když to nevypadá jako článek (články mají title / sekci / obálku).
      if (!official && item && !Array.isArray(item) && (item.title || item.sectionId || item.coverUrl || item.subsectionId || item.published !== undefined)) continue;
      let text = item.text || item.quote || item.citat || '';
      let author = item.author || item.autor || item.by || item.source || '';
      if (!text && raw) text = raw;
      if (Array.isArray(item)) { for (const sub of item) { const st = sub.text || sub.quote || sub.citat || ''; const sa = sub.author || sub.autor || sub.by || sub.source || ''; if (st) push(obj.key, st, sa, sub.created || obj.uploaded); } continue; }
      if (text) push(obj.key, text, author, item.created || obj.uploaded);
    } catch {}
  }
  return Response.json(quotes);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (request.headers.get('Authorization') && (await requireAdmin(request, env))) return build(env, true);
  return edgeCached(context, 600, () => build(env, false));
}
