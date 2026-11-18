import { requireAdmin, json } from '../_auth-utils.js';
import { purgeEdge } from '../_edge-cache.js';
import { moveToTrash } from '../_trash.js';

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'Chybí id' }, { status: 400 });
  // Koš: kopie na 30 dní (obnovení v administraci). Když koš selže, mazání proběhne jako dřív.
  let trashed = false;
  try { trashed = await moveToTrash(env, 'article', id); } catch (e) { /* mazání má přednost */ }
  await env.ARTICLES.delete(`article:${id}`);
  await purgeEdge(request, ['/api/articles/list']);
  return Response.json({ success: true, trashed });
}
