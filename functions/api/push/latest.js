// GET /api/push/latest — poslední oznámení (titulek + odkaz). Čte ho service worker po „klepnutí“.
// Pole `admin` je jen text „něco nového v adminu“ (bez osobních údajů) a zobrazí ho jen zařízení správce.
import { LAST_KEY, ADMIN_LAST_KEY } from './_push.js';
export async function onRequestGet({ env }) {
  const [last, adm] = await Promise.all([
    env.ARTICLES.get(LAST_KEY, { type: 'json' }),
    env.ARTICLES.get(ADMIN_LAST_KEY, { type: 'json' })
  ]);
  const l = last || {}, a = adm || null;
  return new Response(JSON.stringify({ title: l.title || '', url: l.url || '/', at: l.at || 0, admin: a ? { kind: a.kind, text: a.text, at: a.at } : null }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
