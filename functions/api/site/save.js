// POST /api/site/save — admin. Tělo (všechna pole volitelná; co chybí, zůstane):
//  { status: { text, emoji } | null, messagesEnabled: bool, follow: { whatsapp, messenger, instagram, facebook } }
import { requireAdmin, json } from '../_auth-utils.js';
import { SITE_KEY, loadSite, cleanText, cleanUrl } from './_shared.js';

const FOLLOW_KEYS = ['whatsapp', 'messenger', 'instagram', 'facebook'];

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Neplatný požadavek' }, 400); }
  const cur = await loadSite(env);
  const next = { ...cur };

  if ('status' in body) {
    if (body.status && cleanText(body.status.text, 140)) {
      const same = cur.status && cur.status.text === cleanText(body.status.text, 140) && cur.status.emoji === cleanText(body.status.emoji, 8);
      next.status = {
        text: cleanText(body.status.text, 140),
        emoji: cleanText(body.status.emoji, 8),
        updated: same ? cur.status.updated : Date.now()
      };
    } else next.status = null;
  }
  if ('messagesEnabled' in body) next.messagesEnabled = body.messagesEnabled === true;
  if (body.follow && typeof body.follow === 'object') {
    next.follow = { ...cur.follow };
    for (const k of FOLLOW_KEYS) if (k in body.follow) {
      const u = cleanUrl(body.follow[k]);
      if (u) next.follow[k] = u; else delete next.follow[k];
    }
  }
  await env.ARTICLES.put(SITE_KEY, JSON.stringify(next));
  return json({ ok: true, site: next });
}
