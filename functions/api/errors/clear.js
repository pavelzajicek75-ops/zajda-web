import { requireAdmin, json } from '../_auth-utils.js';

// POST { id } smaže jednu chybu, POST {} smaže všechny.
export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  let b = {};
  try { b = await request.json(); } catch {}
  const v = await env.ARTICLES.get('meta:errors', { type: 'json' });
  if (!v || !Array.isArray(v.items)) return json({ ok: true });
  v.items = b && b.id ? v.items.filter(x => x.id !== b.id) : [];
  await env.ARTICLES.put('meta:errors', JSON.stringify(v));
  return json({ ok: true });
}
