import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const body = await request.json();
  const key = `subsection:${body.id}`;
  const existing = await env.SUBSECTIONS.get(key);
  if (!existing) return Response.json({ error: 'Nenalezeno' }, { status: 404 });
  const data = JSON.parse(existing);
  if (body.name !== undefined) data.name = body.name;
  if (body.coverUrl !== undefined) data.coverUrl = body.coverUrl;
  if (body.order !== undefined) data.order = body.order;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
  await env.SUBSECTIONS.put(key, JSON.stringify(data));
  return Response.json(data);
}
