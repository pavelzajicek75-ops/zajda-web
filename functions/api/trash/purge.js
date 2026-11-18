// POST /api/trash/purge  { key } nebo { all: true } — smaže z koše navždy.
import { requireAdmin, json } from '../_auth-utils.js';
import { readTrashIndex, removeFromTrashIndex } from '../_trash.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  let body = {}; try { body = await request.json(); } catch (e) {}
  const keys = body.all ? (await readTrashIndex(env)).map(x => x.key) : [String(body.key || '')];
  let n = 0;
  for (const k of keys) {
    if (!/^trash:(article|timeline):.+/.test(k)) continue;
    await env.ARTICLES.delete(k); await removeFromTrashIndex(env, k); n++;
  }
  return Response.json({ success: true, removed: n });
}
