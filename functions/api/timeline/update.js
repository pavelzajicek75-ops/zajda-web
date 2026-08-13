// PUT /api/timeline/update
export async function onRequestPut(context) {
  const { request, env } = context;
  const body = await request.json();
  if (!body.id) return Response.json({ error: 'Chybí id' }, { status: 400 });
  const existing = await env.ARTICLES.get(`timeline:${body.id}`, { type: 'json' });
  if (!existing) return Response.json({ error: 'Nenalezeno' }, { status: 404 });
  const updated = { ...existing, ...body, id: existing.id, updated: Date.now() };
  await env.ARTICLES.put(`timeline:${body.id}`, JSON.stringify(updated));
  return Response.json(updated);
}
