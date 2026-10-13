// Historie verzí článků v R2 (QUOTES_R2, předpona history/) — žádné zápisy do KV.
// Při změně titulku/obsahu/perexu se předchozí verze uloží; drží se posledních KEEP.
export const HISTORY_KEEP = 10;
export const HISTORY_KEY_RE = /^history\/[\w-]+\/\d{13}\.json$/;

export function changedText(prev, next) {
  return (prev.title || '') !== (next.title || '') || (prev.content || '') !== (next.content || '') || (prev.excerpt || '') !== (next.excerpt || '');
}

export async function saveVersion(env, prev) {
  const r2 = env.QUOTES_R2;
  if (!r2 || !prev || !prev.id) return;
  try {
    const id = String(prev.id).replace(/[^\w-]/g, '');
    const key = `history/${id}/${Date.now()}.json`;
    const snap = { id: prev.id, title: prev.title || '', content: prev.content || '', excerpt: prev.excerpt || '', savedAt: Date.now() };
    await r2.put(key, JSON.stringify(snap), { httpMetadata: { contentType: 'application/json' } });
    const l = await r2.list({ prefix: `history/${id}/` });
    const keys = l.objects.map(o => o.key).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - HISTORY_KEEP))) await r2.delete(k);
  } catch (e) { /* historie je bonus — nikdy nesmí shodit ukládání */ }
}
