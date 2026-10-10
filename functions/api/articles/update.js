import { requireAdmin, json } from '../_auth-utils.js';
import { newShareToken } from './_publish.js';

export async function onRequestPut(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const body = await request.json();
  const existing = await env.ARTICLES.get(`article:${body.id}`, { type: 'json' });
  if (!existing) return Response.json({ error: 'Nenalezeno' }, { status: 404 });
  // shareToken nikdy nebereme z těla požadavku — spravuje se jen tady.
  const { shareToken: _ignored, ...safeBody } = body;
  const updated = { ...existing, ...safeBody, id: existing.id, updated: Date.now() };
  if (updated.unlisted === true) {
    // soukromý: zachovej stávající token (odkazy dál fungují), nebo vytvoř nový
    updated.shareToken = existing.shareToken || newShareToken();
  } else {
    // už není soukromý: token zruš (staré tajné odkazy přestanou platit)
    updated.unlisted = false;
    updated.shareToken = '';
  }
  await env.ARTICLES.put(`article:${body.id}`, JSON.stringify(updated));
  return Response.json(updated);
}
