export async function onRequestDelete(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  await env.SECTIONS.delete(`section:${id}`);
  return Response.json({ success: true });
}
