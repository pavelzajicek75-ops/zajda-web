// GET /api/push/latest — poslední oznámení (titulek + odkaz). Čte ho service worker po „klepnutí“.
import { LAST_KEY } from './_push.js';
export async function onRequestGet({ env }) {
  const last = (await env.ARTICLES.get(LAST_KEY, { type: 'json' })) || {};
  return new Response(JSON.stringify({ title: last.title || '', url: last.url || '/', at: last.at || 0 }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
