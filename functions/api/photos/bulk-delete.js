export async function onRequestPost(context) {
  const { request, env } = context;
  const { keys, galleryId } = await request.json();

  if (!keys?.length || !galleryId) {
    return Response.json({ error: 'Chybí data' }, { status: 400 });
  }

  const gallery = await env.PHOTOS.get(`gallery:${galleryId}`, { type: 'json' });
  if (!gallery) return Response.json({ error: 'Galerie nenalezena' }, { status: 404 });

  for (const key of keys) {
    await env.PHOTOS_R2.delete(key);
  }
  
  gallery.photos = gallery.photos.filter(p => !keys.includes(p.key));
  await env.PHOTOS.put(`gallery:${galleryId}`, JSON.stringify(gallery));

  return Response.json({ success: true, deleted: keys.length });
}
