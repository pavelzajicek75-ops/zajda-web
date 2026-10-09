import { requireAdmin } from '../_auth-utils.js';
import { applySchedule, isPublished } from './_publish.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  let data = await env.ARTICLES.get(`article:${id}`, { type: 'json' });
  if (!data) return Response.json({ error: 'Nenalezeno' }, { status: 404 });
  data = applySchedule(data);
  if (!isPublished(data) && !(await requireAdmin(request, env))) {
    return Response.json({ error: 'Nenalezeno' }, { status: 404 });
  }
  return Response.json(data);
}
