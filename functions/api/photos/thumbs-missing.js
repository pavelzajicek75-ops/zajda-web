// GET /api/photos/thumbs-missing — admin. Najde fotky v R2, které nemají malý náhled
// (thumbs/<klíč>). Vrací { total, missing: [klíče], more }. Používá jen R2, žádné KV.
import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const photos = new Set(), thumbs = new Set();
  let cursor, pages = 0, complete = false;
  while (pages < 12) {
    const l = await env.PHOTOS_R2.list({ cursor, limit: 1000 });
    for (const o of l.objects || []) {
      if (o.key.startsWith('thumbs/')) thumbs.add(o.key.slice(7));
      else if (o.key.startsWith('gallery-') && /\.(jpe?g|png|webp|gif)$/i.test(o.key)) photos.add(o.key);
    }
    pages++;
    if (!l.truncated || !l.cursor) { complete = true; break; }
    cursor = l.cursor;
  }
  const missing = [...photos].filter(k => !thumbs.has(k));
  return json({ total: photos.size, missing: missing.slice(0, 300), missingCount: missing.length, more: !complete });
}
