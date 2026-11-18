// POST /api/trash/restore  { key } — vrátí článek / milník z koše.
import { requireAdmin, json } from '../_auth-utils.js';
import { purgeEdge } from '../_edge-cache.js';
import { invalidateIndex } from '../_kv-index.js';
import { removeFromTrashIndex } from '../_trash.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  let body = {}; try { body = await request.json(); } catch (e) {}
  const key = String(body.key || '');
  if (!/^trash:(article|timeline):.+/.test(key)) return json({ error: 'Neplatný klíč' }, 400);
  const rec = await env.ARTICLES.get(key, { type: 'json' });
  if (!rec || !rec.raw) { await removeFromTrashIndex(env, key); return json({ error: 'Položka v koši už není (vypršela?)' }, 404); }
  const liveKey = `${rec.kind}:${rec.id}`;
  if (await env.ARTICLES.get(liveKey)) return json({ error: 'Položka se stejným ID už existuje' }, 409);
  await env.ARTICLES.put(liveKey, rec.raw);
  await env.ARTICLES.delete(key);
  await removeFromTrashIndex(env, key);
  if (rec.kind === 'article') { await invalidateIndex(env.ARTICLES, 'article:'); await purgeEdge(request, ['/api/articles/list']); }
  else await purgeEdge(request, ['/api/timeline/list']);
  return Response.json({ success: true, kind: rec.kind, id: rec.id });
}
