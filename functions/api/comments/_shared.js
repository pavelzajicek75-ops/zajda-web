// Komentáře: schválené jsou přímo v záznamu článku (article.comments) —
// čtenáři je dostanou zdarma s článkem, bez dalších čtení z KV. Čekající
// jsou v JEDNOM klíči (fronta ke schválení), takže odeslání komentáře
// stojí jediný zápis do KV.
export const PENDING_KEY = 'meta:comments-pending';
export const MAX_PENDING = 200;
export const MAX_APPROVED = 200;

export async function loadPending(env) {
  const v = await env.ARTICLES.get(PENDING_KEY, { type: 'json' });
  return Array.isArray(v) ? v : [];
}
export async function savePending(env, list) {
  await env.ARTICLES.put(PENDING_KEY, JSON.stringify(list));
}

// Odstraní řídicí znaky a zbytečné mezery; ořízne na max délku.
export function clean(str, max) {
  return String(str == null ? '' : str)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}
