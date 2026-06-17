export async function onRequestGet(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const galleryId = searchParams.get('galleryId');
  if (!galleryId) return Response.json({ error: 'Chybí galleryId' }, { status: 400 });
  const gal = await env.PHOTOS.get(`gallery:${galleryId}`, { type: 'json' });
  return Response.json(gal?.photos || []);
}
