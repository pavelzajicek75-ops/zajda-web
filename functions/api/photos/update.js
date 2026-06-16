export async function onRequestPost(context) {
  const { request, env } = context;
  const formData = await request.formData();
  const file = formData.get('file');
  const key = formData.get('key');
  const galleryId = formData.get('galleryId');

  if (!file || !key || !galleryId) {
    return Response.json({ error: 'Chybí data' }, { status: 400 });
  }

  await env.PHOTOS_R2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type }
  });

  const gallery = await env.PHOTOS.get(`gallery:${galleryId}`, { type: 'json' });
  if (gallery) {
    const photo = gallery.photos.find(p => p.key === key);
    if (photo) {
      photo.size = file.size;
      photo.edited = Date.now();
      await env.PHOTOS.put(`gallery:${galleryId}`, JSON.stringify(gallery));
    }
  }

  return Response.json({ success: true });
}
