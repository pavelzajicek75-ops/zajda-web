// POST /api/push/subscribe { subscription: { endpoint } }  → uloží odběr (1 zápis)
// POST /api/push/subscribe { endpoint, unsubscribe: true }  → odběr zruší
import { SUBS_KEY, MAX_SUBS, validEndpoint } from './_push.js';

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
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Neplatný požadavek' }, 400); }
  if (tooMany(request.headers.get('CF-Connecting-IP') || 'x')) return json({ error: 'Zkus to prosím za chvíli.' }, 429);
  const endpoint = body && (body.unsubscribe ? body.endpoint : (body.subscription && body.subscription.endpoint));
  if (!validEndpoint(endpoint)) return json({ error: 'Neplatný odběr' }, 400);
  const cur = (await env.ARTICLES.get(SUBS_KEY, { type: 'json' })) || { subs: [] };
  let subs = Array.isArray(cur.subs) ? cur.subs : [];
  if (body.unsubscribe) {
    const next = subs.filter(s => s.endpoint !== endpoint);
    if (next.length !== subs.length) await env.ARTICLES.put(SUBS_KEY, JSON.stringify({ subs: next }));
    return json({ ok: true });
  }
  if (subs.some(s => s.endpoint === endpoint)) return json({ ok: true, already: true });
  if (subs.length >= MAX_SUBS) subs = subs.slice(subs.length - MAX_SUBS + 1);
  subs.push({ endpoint, at: Date.now() });
  await env.ARTICLES.put(SUBS_KEY, JSON.stringify({ subs }));
  return json({ ok: true });
}
