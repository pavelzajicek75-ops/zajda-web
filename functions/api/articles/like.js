// POST /api/articles/like  { id }  → { likes }
// Srdíčko pod článkem. Počítadlo je přímo v záznamu článku (jako views),
// takže jeden klik = jeden zápis do KV. Proti zneužití: limit v paměti
// (bez zápisů) 5 srdíček / 10 min / IP; čtenář si navíc pamatuje, že už dal.
import { applySchedule, isListed } from './_publish.js';

const hits = new Map();
function tooMany(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  if (arr.length >= 5) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  let id;
  try { id = (await request.json()).id; } catch { return json({ error: 'Neplatný požadavek' }, 400); }
  if (!id || typeof id !== 'string') return json({ error: 'Chybí id' }, 400);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (tooMany(ip)) return json({ error: 'Moc rychle, zkus to za chvíli.' }, 429);
  const key = `article:${id}`;
  const a = await env.ARTICLES.get(key, { type: 'json' });
  if (!a || !isListed(applySchedule(a))) return json({ error: 'Nenalezeno' }, 404);
  const likes = (a.likes || 0) + 1;
  await env.ARTICLES.put(key, JSON.stringify({ ...a, likes }));
  return json({ likes });
}
