export async function onRequestDelete(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const keys = searchParams.get('keys');
  if (!keys) return Response.json({ error: 'No keys' }, { status: 400 });
  for (const key of keys.split(',')) { try { await env.PHOTOS_R2.delete(key); } catch {} }
  return Response.json({ success: true });
}
