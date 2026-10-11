import { requireAdmin, json } from '../_auth-utils.js';

// Rozepsané nápady na články — jen pro admina. Celý seznam je v JEDNOM klíči KV
// (meta:ideas), takže přidání nebo smazání nápadu stojí jediný zápis.
export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const v = await env.ARTICLES.get('meta:ideas', { type: 'json' });
  return new Response(JSON.stringify(Array.isArray(v) ? v : []), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
