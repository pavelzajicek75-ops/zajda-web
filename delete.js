import { requireAdmin, json } from '../_auth-utils.js';
import { purgeEdge } from '../_edge-cache.js';

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  await env.ARTICLES.delete(`article:${id}`);
  await purgeEdge(request, ['/api/articles/list']);
  return Response.json({ success: true });
}
