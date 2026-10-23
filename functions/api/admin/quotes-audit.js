// GET /api/admin/quotes-audit — vypíše soubory v úložišti citátů (QUOTES_R2), které NEJSOU citáty
// ani zálohy (jen admin, nic nezapisuje). Smazání se dělá přes /api/quotes/delete?key=…
import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const r2 = env.QUOTES_R2;
  if (!r2) return json({ error: 'Chybí QUOTES_R2' }, 500);
  const foreign = [];
  let total = 0, cursor;
  for (let i = 0; i < 20; i++) {
    const l = await r2.list({ cursor });
    for (const o of l.objects || []) {
      total++;
      const k = o.key;
      if (k.startsWith('backups/') || k === 'quotes.json' || /^quotes\/[^/]+\.json$/.test(k)) continue;
      foreign.push({ key: k, size: o.size || 0, uploaded: o.uploaded || null });
    }
    if (!l.truncated || !l.cursor) break;
    cursor = l.cursor;
  }
  return json({ total, foreign });
}
