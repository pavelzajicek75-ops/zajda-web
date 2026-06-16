export async function onRequestDelete(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const type = searchParams.get('type');
  const galleryId = searchParams.get('galleryId');

  if (!env.PHOTOS_R2) {
    return Response.json({ error: 'R2 binding PHOTOS_R2 není připojený.' }, { status: 500 });
  }

  if (type === 'photo' && galleryId) {
    const gallery = await env.PHOTOS.get(`gallery:${galleryId}`, { type: 'json' });
    if (gallery?.photos) {
      const photo = gallery.photos.find(p => p.id === id);
      if (photo) {
        await env.PHOTOS_R2.delete(photo.key);
        gallery.photos = gallery.photos.filter(p => p.id !== id);
        await env.PHOTOS.put(`gallery:${galleryId}`, JSON.stringify(gallery));
      }
    }
    return Response.json({ success: true });
  }

  const gallery = await env.PHOTOS.get(`gallery:${id}`, { type: 'json' });
  if (gallery?.photos) {
    for (const p of gallery.photos) {
      await env.PHOTOS_R2.delete(p.key);
    }
  }
  await env.PHOTOS.delete(`gallery:${id}`);
  return Response.json({ success: true });
}
