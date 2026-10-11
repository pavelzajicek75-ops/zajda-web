// POST { action:'read', id, read?:bool } | { action:'delete', id } — jen admin.
import { requireAdmin, json } from '../_auth-utils.js';

const KEY = 'meta:messages';

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Neplatný požadavek' }, 400); }
  const cur = await env.ARTICLES.get(KEY, { type: 'json' });
  let list = Array.isArray(cur) ? cur : [];
  const it = list.find(m => m.id === (body && body.id));
  if (!it) return json({ error: 'Zpráva nenalezena' }, 404);
  if (body.action === 'read') it.read = body.read !== false;
  else if (body.action === 'delete') list = list.filter(m => m !== it);
  else return json({ error: 'Neznámá akce' }, 400);
  await env.ARTICLES.put(KEY, JSON.stringify(list));
  return json({ ok: true, messages: list });
}
