import { requireAdmin } from '../_auth-utils.js';
import { applySchedule, isPublished } from './_publish.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const token = searchParams.get('k') || '';
  let data = await env.ARTICLES.get(`article:${id}`, { type: 'json' });
  if (!data) return Response.json({ error: 'Nenalezeno' }, { status: 404 });
  data = applySchedule(data);

  const isAdmin = !!(await requireAdmin(request, env));
  if (!isAdmin) {
    // Koncept / ještě nezveřejněný článek: jen admin.
    if (!isPublished(data)) return Response.json({ error: 'Nenalezeno' }, { status: 404 });
    // Soukromý článek: jen s platným tajným tokenem z odkazu.
    if (data.unlisted && (!data.shareToken || token !== data.shareToken)) {
      return Response.json({ error: 'Nenalezeno' }, { status: 404 });
    }
    // Token nikdy neposíláme čtenářům.
    const { shareToken, ...safe } = data;
    return new Response(JSON.stringify(safe), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
  return Response.json(data);
}
