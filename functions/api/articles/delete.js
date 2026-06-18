export async function onRequestDelete(context) {
  const { env } = context;
  const { searchParams } = new URL(context.request.url);
  const id = searchParams.get('id');
  await env.ARTICLES.delete(`article:${id}`);
  return Response.json({ success: true });
}
