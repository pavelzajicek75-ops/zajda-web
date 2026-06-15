// functions/api/photos/delete.js
export async function onRequestDelete(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const type = searchParams.get('type'); // 'gallery' nebo 'photo'
  
  if (type === 'photo') {
    const galleryId = searchParams.get('galleryId');
    const photoId = searchParams.get('photoId');
    const gallery = await env.PHOTOS.get(`gallery:${galleryId}`, { type: 'json' });
    if (gallery && gallery.photos) {
      const photo = gallery.photos.find(p => p.id === photoId);
      if (photo) await env.PHOTOS_R2.delete(photo.key);
      gallery.photos = gallery.photos.filter(p => p.id !== photoId);
      await env.PHOTOS.put(`gallery:${galleryId}`, JSON.stringify(gallery));
    }
    return Response.json({ success: true });
  }
  
  // Smazat celou galerii
  const gallery = await env.PHOTOS.get(`gallery:${id}`, { type: 'json' });
  if (gallery?.photos) {
    for (const p of gallery.photos) {
      await env.PHOTOS_R2.delete(p.key);
    }
  }
  await env.PHOTOS.delete(`gallery:${id}`);
  return Response.json({ success: true });
}
