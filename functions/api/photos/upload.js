// functions/api/photos/upload.js
export async function onRequestPost(context) {
  const { request, env } = context;
  const formData = await request.formData();
  const file = formData.get('file');
  const galleryId = formData.get('galleryId');
  
  if (!file || !galleryId) return Response.json({ error: 'Chybí data' }, { status: 400 });
  
  const id = crypto.randomUUID();
  const ext = file.name.split('.').pop();
  const key = `gallery-${galleryId}/${id}.${ext}`;
  
  // DŮLEŽITÉ: Změň PHOTOS_R2 na název tvého R2 bindingu v dashboardu
  await env.PHOTOS_R2.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  
  const url = `https://${env.CDN_URL || ''}/${key}`; // nebo public URL R2
  
  // Ulož metadata do KV
  const gallery = await env.PHOTOS.get(`gallery:${galleryId}`, { type: 'json' });
  if (gallery) {
    gallery.photos = gallery.photos || [];
    gallery.photos.push({ id, key, url, name: file.name, type: file.type });
    await env.PHOTOS.put(`gallery:${galleryId}`, JSON.stringify(gallery));
  }
  
  return Response.json({ id, url, key });
}
