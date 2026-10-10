import { requireAdmin, json } from '../_auth-utils.js';

// Soukromý deník nálady — jen pro admina. Celý deník je v JEDNOM klíči KV
// (meta:mood-log), takže uložení záznamu stojí jediný zápis.
export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const log = await env.ARTICLES.get('meta:mood-log', { type: 'json' });
  const entries = Array.isArray(log) ? log : [];
  return new Response(JSON.stringify(entries), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
