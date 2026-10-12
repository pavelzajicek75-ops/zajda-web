import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const v = await env.ARTICLES.get('meta:errors', { type: 'json' });
  const items = v && Array.isArray(v.items) ? v.items : [];
  return new Response(JSON.stringify({ items: items.map(({ sig, ...rest }) => rest), day: v && v.day, writes: v && v.writes || 0 }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
