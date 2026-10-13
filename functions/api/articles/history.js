// GET /api/articles/history?id=<id>  → [{ key, at, size }] (nejnovější první) — admin
// GET /api/articles/history?key=history/<id>/<ts>.json → obsah jedné verze — admin
import { requireAdmin, json } from '../_auth-utils.js';
import { HISTORY_KEY_RE } from './_history.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  if (!env.QUOTES_R2) return json({ error: 'Chybí R2 binding QUOTES_R2' }, 500);
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (key) {
    if (!HISTORY_KEY_RE.test(key)) return json({ error: 'Neplatný klíč' }, 400);
    const o = await env.QUOTES_R2.get(key);
    if (!o) return json({ error: 'Nenalezeno' }, 404);
    return new Response(o.body, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  const id = String(url.searchParams.get('id') || '').replace(/[^\w-]/g, '');
  if (!id) return json({ error: 'Chybí id' }, 400);
  const l = await env.QUOTES_R2.list({ prefix: `history/${id}/` });
  const items = l.objects.map(o => ({ key: o.key, at: Number(o.key.split('/').pop().replace('.json', '')), size: o.size })).sort((a, b) => b.at - a.at);
  return json(items);
}
