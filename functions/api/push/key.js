// GET /api/push/key — veřejný klíč VAPID pro přihlášení odběru v prohlížeči.
import { getVapid } from './_push.js';
export async function onRequestGet({ env }) {
  const v = await getVapid(env);
  return new Response(JSON.stringify({ publicKey: v.publicKey }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } });
}
