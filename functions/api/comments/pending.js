import { requireAdmin } from '../_auth-utils.js';
import { loadPending } from './_shared.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const list = await loadPending(env);
  return new Response(JSON.stringify(list), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
