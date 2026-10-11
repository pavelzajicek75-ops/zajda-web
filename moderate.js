import { requireAdmin } from '../_auth-utils.js';
import { loadPending, savePending, MAX_APPROVED, clean } from './_shared.js';
import { purgeEdge } from '../_edge-cache.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

// POST { action: 'approve' | 'reject', id }          — komentář z fronty
// POST { action: 'delete', articleId, id }           — už schválený komentář
// POST { action: 'reply', articleId, id, text }      — odpověď Zajdy (prázdný text = smazat odpověď)
export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Neplatný požadavek' }, 400); }
  const { action, id } = body || {};
  if (!id) return json({ error: 'Chybí id' }, 400);

  if (action === 'delete') {
    const key = `article:${body.articleId}`;
    const article = await env.ARTICLES.get(key, { type: 'json' });
    if (!article) return json({ error: 'Článek nenalezen' }, 404);
    article.comments = (article.comments || []).filter(c => c.id !== id);
    await env.ARTICLES.put(key, JSON.stringify(article));
    await purgeEdge(request, ['/api/articles/list']);
    return json({ ok: true });
  }

  if (action === 'reply') {
    const key = `article:${body.articleId}`;
    const article = await env.ARTICLES.get(key, { type: 'json' });
    if (!article) return json({ error: 'Článek nenalezen' }, 404);
    const c = (article.comments || []).find(x => x.id === id);
    if (!c) return json({ error: 'Komentář nenalezen' }, 404);
    const text = clean(body.text, 600);
    if (text) c.reply = { text, created: Date.now() }; else delete c.reply;
    await env.ARTICLES.put(key, JSON.stringify(article));
    await purgeEdge(request, ['/api/articles/list']);
    return json({ ok: true, reply: c.reply || null });
  }

  const pending = await loadPending(env);
  const item = pending.find(c => c.id === id);
  if (!item) return json({ error: 'Komentář už ve frontě není' }, 404);
  const rest = pending.filter(c => c.id !== id);

  if (action === 'reject') {
    await savePending(env, rest);
    return json({ ok: true });
  }
  if (action === 'approve') {
    const key = `article:${item.articleId}`;
    const article = await env.ARTICLES.get(key, { type: 'json' });
    if (!article) { await savePending(env, rest); return json({ error: 'Článek už neexistuje' }, 404); }
    const comments = (article.comments || []).concat([{ id: item.id, name: item.name, text: item.text, created: item.created }]);
    article.comments = comments.slice(-MAX_APPROVED);
    await env.ARTICLES.put(key, JSON.stringify(article));
    await purgeEdge(request, ['/api/articles/list']);
    await savePending(env, rest);
    return json({ ok: true });
  }
  return json({ error: 'Neznámá akce' }, 400);
}
