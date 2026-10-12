import { edgeCached } from '../_edge-cache.js';
import { listIndexed } from '../_kv-index.js';
// GET /api/timeline/list — vrátí všechny milníky, seřazené vzestupně
// podle "order" (nejstarší/nejnižší první — timeline se čte
// chronologicky odshora dolů, ne "nejnovější nahoře" jako u článků).
// U starších milníků bez "order" (vytvořených před touto úpravou) se
// jako záložní klíč použije datum, ať se nezačnou řadit nahodile.
async function handleGet(context) {
  const { env } = context;
  const list = await listIndexed(env.ARTICLES, env.ARTICLES, 'timeline:');
  const milestones = [];
  for (const key of list.keys) {
    const data = await env.ARTICLES.get(key.name, { type: 'json' });
    if (data) {
      if (!data.id) data.id = key.name.replace('timeline:', '');
      milestones.push(data);
    }
  }
  function sortKey(m) {
    if (typeof m.order === 'number' && Number.isFinite(m.order)) return m.order;
    const parsed = m.date ? Date.parse(m.date) : NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  }
  milestones.sort((a, b) => sortKey(a) - sortKey(b));
  return Response.json(milestones);
}

// Veřejný výpis se drží v cache (viz _edge-cache.js) — šetří denní limit operací „list“ v KV.
export async function onRequestGet(context) {
  return edgeCached(context, 900, () => handleGet(context));
}
