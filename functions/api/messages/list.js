import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const v = await env.ARTICLES.get('meta:messages', { type: 'json' });
  return new Response(JSON.stringify(Array.isArray(v) ? v : []), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
