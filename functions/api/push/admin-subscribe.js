// GET  /api/push/admin-subscribe → { count }                       (admin)
// POST /api/push/admin-subscribe { subscription:{endpoint} }       (admin) zapne oznámení pro správce na tomhle zařízení
// POST /api/push/admin-subscribe { unsubscribe:true, endpoint }    (admin) vypne
import { requireAdmin, json } from '../_auth-utils.js';
import { ADMIN_SUBS_KEY, validEndpoint } from './_push.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const cur = (await env.ARTICLES.get(ADMIN_SUBS_KEY, { type: 'json' })) || { subs: [] };
  return json({ count: (cur.subs || []).length });
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  let body; try { body = await request.json(); } catch { return json({ error: 'Neplatný požadavek' }, 400); }
  const endpoint = body && (body.unsubscribe ? body.endpoint : (body.subscription && body.subscription.endpoint));
  if (!validEndpoint(endpoint)) return json({ error: 'Neplatný odběr' }, 400);
  const cur = (await env.ARTICLES.get(ADMIN_SUBS_KEY, { type: 'json' })) || { subs: [] };
  let subs = Array.isArray(cur.subs) ? cur.subs : [];
  if (body.unsubscribe) {
    const next = subs.filter(s => s.endpoint !== endpoint);
    if (next.length !== subs.length) await env.ARTICLES.put(ADMIN_SUBS_KEY, JSON.stringify({ subs: next }));
    return json({ ok: true });
  }
  if (subs.some(s => s.endpoint === endpoint)) return json({ ok: true, already: true });
  subs = subs.slice(-9); subs.push({ endpoint, at: Date.now() }); // nejvýš 10 zařízení správce
  await env.ARTICLES.put(ADMIN_SUBS_KEY, JSON.stringify({ subs }));
  return json({ ok: true });
}
