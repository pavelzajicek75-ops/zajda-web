import { notifyAdmin } from '../push/_push.js';
// POST /api/messages/create — soukromá zpráva od čtenáře (vidí ji jen admin).
// Celá fronta je v JEDNOM klíči KV (meta:messages) → odeslání = jediný zápis.
// Funguje jen když je v Nastavení webu zapnuté „Napiš mi“.
import { loadSite, cleanText } from '../site/_shared.js';

const KEY = 'meta:messages';
const MAX = 100;
const hits = new Map();
function tooMany(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  if (arr.length >= 2) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestPost({ request, env, waitUntil }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Neplatný požadavek' }, 400); }
  if (body && body.website) return json({ ok: true }); // past na roboty

  const site = await loadSite(env);
  if (!site.messagesEnabled) return json({ error: 'Posílání zpráv je zatím vypnuté.' }, 403);

  const name = cleanText(body && body.name, 60);
  const contact = cleanText(body && body.contact, 100);
  // text si necháme s odřádkováním, jen zbavený řídicích znaků
  const text = String((body && body.text) || '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F<>]/g, '').replace(/\r\n/g, '\n').trim().slice(0, 2000);
  if (text.length < 5) return json({ error: 'Napiš aspoň pár slov.' }, 400);
  if ((text.match(/https?:\/\/|www\./gi) || []).length > 2) return json({ error: 'Zpráva může obsahovat nejvýš dva odkazy.' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (tooMany(ip)) return json({ error: 'Moc zpráv za krátkou dobu — zkus to za chvíli.' }, 429);

  const cur = await env.ARTICLES.get(KEY, { type: 'json' });
  const list = Array.isArray(cur) ? cur : [];
  if (list.length >= MAX) return json({ error: 'Schránka je plná, zkus to prosím později.' }, 503);
  list.unshift({ id: crypto.randomUUID(), name, contact, text, created: Date.now(), read: false });
  await env.ARTICLES.put(KEY, JSON.stringify(list));
  const job = notifyAdmin(env, 'message', new URL(request.url).origin);
  if (typeof waitUntil === 'function') waitUntil(job); else await job;
  return json({ ok: true });
}
