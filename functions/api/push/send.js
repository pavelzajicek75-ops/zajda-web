// GET  /api/push/send → { subscribers } (admin)
// POST /api/push/send { articleId } → rozešle oznámení o článku všem odběratelům (admin)
import { requireAdmin, json } from '../_auth-utils.js';
import { SUBS_KEY, LAST_KEY, getVapid, sendTap } from './_push.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const cur = (await env.ARTICLES.get(SUBS_KEY, { type: 'json' })) || { subs: [] };
  const last = (await env.ARTICLES.get(LAST_KEY, { type: 'json' })) || null;
  return json({ subscribers: (cur.subs || []).length, last });
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  let body; try { body = await request.json(); } catch { return json({ error: 'Neplatný požadavek' }, 400); }
  const id = String((body && body.articleId) || '');
  const a = id ? await env.ARTICLES.get(`article:${id}`, { type: 'json' }) : null;
  if (!a) return json({ error: 'Článek nenalezen' }, 404);
  if (a.published === false || a.unlisted === true) return json({ error: 'Článek není veřejný — oznámení se neposílá.' }, 400);

  const last = (await env.ARTICLES.get(LAST_KEY, { type: 'json' })) || null;
  if (last && last.articleId === id && Date.now() - last.at < 10 * 60 * 1000 && !body.force) return json({ error: 'Oznámení o tomto článku se právě poslalo.' }, 429);

  const origin = new URL(request.url).origin;
  await env.ARTICLES.put(LAST_KEY, JSON.stringify({ articleId: id, title: String(a.title || 'Nový článek').slice(0, 120), url: '/article?id=' + encodeURIComponent(id), at: Date.now() }));
  const cur = (await env.ARTICLES.get(SUBS_KEY, { type: 'json' })) || { subs: [] };
  const subs = Array.isArray(cur.subs) ? cur.subs : [];
  const vapid = await getVapid(env);
  const results = [];
  for (let i = 0; i < subs.length; i += 10) {
    results.push(...await Promise.all(subs.slice(i, i + 10).map(async s => ({ s, status: await sendTap(vapid, s.endpoint, origin) }))));
  }
  const gone = new Set(results.filter(r => r.status === 404 || r.status === 410).map(r => r.s.endpoint));
  const sent = results.filter(r => r.status >= 200 && r.status < 300).length;
  if (gone.size) await env.ARTICLES.put(SUBS_KEY, JSON.stringify({ subs: subs.filter(s => !gone.has(s.endpoint)) }));
  return json({ ok: true, sent, failed: results.length - sent - gone.size, removed: gone.size, total: subs.length });
}
