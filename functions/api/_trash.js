// Koš pro články a milníky: místo hned smazat → uložit do KV pod trash:<druh>:<id> na 30 dní.
// Seznam položek koše je v jednom klíči meta:trash (žádné KV „list“, to má denní limit).
export const TRASH_DAYS = 30;
const IDX = 'meta:trash';

export async function readTrashIndex(env) {
  let idx = [];
  try { idx = (await env.ARTICLES.get(IDX, { type: 'json' })) || []; } catch (e) { idx = []; }
  const now = Date.now(), min = now - TRASH_DAYS * 864e5;
  return Array.isArray(idx) ? idx.filter(x => x && x.key && x.deletedAt > min) : [];
}
async function writeTrashIndex(env, idx) { await env.ARTICLES.put(IDX, JSON.stringify(idx.slice(0, 500))); }

// kind: 'article' | 'timeline'. Vrací true, když se uložilo do koše.
export async function moveToTrash(env, kind, id) {
  const liveKey = `${kind}:${id}`;
  const raw = await env.ARTICLES.get(liveKey);
  if (raw == null) return false;
  let title = '';
  try { const o = JSON.parse(raw); title = o.title || o.name || ''; } catch (e) {}
  const key = `trash:${kind}:${id}`;
  const deletedAt = Date.now();
  await env.ARTICLES.put(key, JSON.stringify({ kind, id, title, deletedAt, raw }), { expirationTtl: TRASH_DAYS * 864e5 / 1000 });
  const idx = (await readTrashIndex(env)).filter(x => x.key !== key);
  idx.unshift({ key, kind, id, title, deletedAt });
  await writeTrashIndex(env, idx);
  return true;
}

export async function removeFromTrashIndex(env, key) {
  await writeTrashIndex(env, (await readTrashIndex(env)).filter(x => x.key !== key));
}
