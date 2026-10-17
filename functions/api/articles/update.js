import { requireAdmin, json } from '../_auth-utils.js';
import { newShareToken } from './_publish.js';
import { normTags } from './_tags.js';
import { purgeEdge } from '../_edge-cache.js';
import { saveVersion, changedText } from './_history.js';

export async function onRequestPut(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const body = await request.json();
  const existing = await env.ARTICLES.get(`article:${body.id}`, { type: 'json' });
  if (!existing) return Response.json({ error: 'Nenalezeno' }, { status: 404 });
  // shareToken nikdy nebereme z těla požadavku — spravuje se jen tady.
  // Počítadla (views, viewsByWeek, likes) taky ne — upravují se jen přes veřejné endpointy,
  // jinak by je starý obsah editoru mohl přepsat.
  const { shareToken: _ignored, likes: _l, views: _v, viewsByWeek: _w, refs: _r, ...safeBody } = body;
  const updated = { ...existing, ...safeBody, id: existing.id, updated: Date.now() };
  if ('takeaway' in safeBody) updated.takeaway = String(safeBody.takeaway || '').slice(0, 220);
  if ('tags' in safeBody) updated.tags = normTags(safeBody.tags);
  if (updated.unlisted === true) {
    // soukromý: zachovej stávající token (odkazy dál fungují), nebo vytvoř nový
    updated.shareToken = existing.shareToken || newShareToken();
  } else {
    // už není soukromý: token zruš (staré tajné odkazy přestanou platit)
    updated.unlisted = false;
    updated.shareToken = '';
  }
  if (changedText(existing, updated)) await saveVersion(env, existing);
  await env.ARTICLES.put(`article:${body.id}`, JSON.stringify(updated));
  await purgeEdge(request, ['/api/articles/list']);
  return Response.json(updated);
}
