// GET /api/photos/heavy — admin. Najde příliš těžké fotky v R2 (nad 2,5 MB), které se na některých mobilech nenačtou
// nebo se načítají dlouho. Vrací { count, totalMB, items: [{ key, size }] } (nejtěžších 60). Používá jen R2, žádné KV.
import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const LIMIT = 2.5 * 1024 * 1024, heavy = [];
  let cursor, pages = 0, complete = false, total = 0;
  while (pages < 12) {
    const l = await env.PHOTOS_R2.list({ cursor, limit: 1000 });
    for (const o of l.objects || []) {
      if (o.key.startsWith('thumbs/') || !o.key.startsWith('gallery-')) continue;
      total++;
      if (o.size > LIMIT) heavy.push({ key: o.key, size: o.size });
    }
    pages++;
    if (!l.truncated || !l.cursor) { complete = true; break; }
    cursor = l.cursor;
  }
  heavy.sort((a, b) => b.size - a.size);
  const totalMB = Math.round(heavy.reduce((s, x) => s + x.size, 0) / 1048576);
  return json({ total, count: heavy.length, totalMB, items: heavy.slice(0, 60), more: !complete });
}
