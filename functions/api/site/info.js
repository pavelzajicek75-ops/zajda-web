// GET /api/site/info — veřejné: stav dne, zda jsou zapnuté zprávy, odkazy „Sleduj blog“.
import { loadSite } from './_shared.js';

export async function onRequestGet({ env }) {
  const s = await loadSite(env);
  return new Response(JSON.stringify(s), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
}
