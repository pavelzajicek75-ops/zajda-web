import { applySchedule, isListed } from '../articles/_publish.js';
import { loadPending, savePending, clean, MAX_PENDING } from './_shared.js';

// Jednoduchý limit v paměti (bez zápisů do KV): 3 komentáře / 10 min / IP.
const hits = new Map();
function tooMany(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  if (arr.length >= 3) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Neplatný požadavek' }, 400); }

  // Past na roboty: skryté pole, které člověk nevyplní. Robotovi tvrdíme, že to prošlo.
  if (body && body.website) return json({ ok: true, pending: true });

  const articleId = clean(body && body.articleId, 100);
  const name = clean(body && body.name, 40);
  const text = clean(body && body.text, 1000);
  if (!articleId) return json({ error: 'Chybí článek' }, 400);
  if (name.length < 1) return json({ error: 'Napiš své jméno nebo přezdívku.' }, 400);
  if (text.length < 2) return json({ error: 'Komentář je prázdný.' }, 400);
  // Víc než jeden odkaz = skoro jistě spam.
  if ((text.match(/https?:\/\/|www\./gi) || []).length > 1) return json({ error: 'Komentář může obsahovat nejvýš jeden odkaz.' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (tooMany(ip)) return json({ error: 'Moc komentářů za krátkou dobu — zkus to za chvíli.' }, 429);

  const article = await env.ARTICLES.get(`article:${articleId}`, { type: 'json' });
  if (!article || !isListed(applySchedule(article))) return json({ error: 'Článek nenalezen' }, 404);

  const pending = await loadPending(env);
  if (pending.length >= MAX_PENDING) return json({ error: 'Fronta komentářů je plná, zkus to později.' }, 503);
  pending.push({
    id: crypto.randomUUID(),
    articleId,
    articleTitle: clean(article.title, 120),
    name, text, created: Date.now()
  });
  await savePending(env, pending);
  return json({ ok: true, pending: true });
}
