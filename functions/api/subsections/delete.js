export async function onRequestDelete(context) {
  const { env } = context;
  const { searchParams } = new URL(context.request.url);
  const id = searchParams.get('id');
  await env.SUBSECTIONS.delete(`subsection:${id}`);
  return Response.json({ success: true });
}
