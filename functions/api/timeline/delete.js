// DELETE /api/timeline/delete?id=...
export async function onRequestDelete(context) {
  const { env } = context;
  const { searchParams } = new URL(context.request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'Chybí id' }, { status: 400 });
  await env.ARTICLES.delete(`timeline:${id}`);
  return Response.json({ success: true });
}
