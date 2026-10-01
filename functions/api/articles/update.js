import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestPut(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const body = await request.json();
  const existing = await env.ARTICLES.get(`article:${body.id}`, { type: 'json' });
  if (!existing) return Response.json({ error: 'Nenalezeno' }, { status: 404 });
  const updated = { ...existing, ...body, id: existing.id, updated: Date.now() };
  await env.ARTICLES.put(`article:${body.id}`, JSON.stringify(updated));
  return Response.json(updated);
}
