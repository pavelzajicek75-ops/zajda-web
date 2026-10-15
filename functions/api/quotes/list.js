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
  const push = (key, text, author, created) => {
    const q = { text: String(text), author: String(author || ''), created };
    if (isAdmin) q.key = key;
    quotes.push(q);
  };
  for (const obj of list.objects || []) {
    try {
      const data = await r2.get(obj.key);
      if (!data) continue;
      let item, raw = null;
      try { item = await data.json(); } catch { raw = await data.text(); item = { text: raw }; }
      let text = item.text || item.quote || item.content || item.citat || '';
      let author = item.author || item.autor || item.by || item.source || '';
      if (!text && raw) text = raw;
      if (Array.isArray(item)) { for (const sub of item) { const st = sub.text || sub.quote || sub.content || sub.citat || ''; const sa = sub.author || sub.autor || sub.by || sub.source || ''; if (st) push(obj.key, st, sa, sub.created || obj.uploaded); } continue; }
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
