export async function onRequestPost(context) {
  const { request, env } = context;
  const r2 = env.PHOTOS_R2;
  
  if (!r2) return Response.json({ error: 'Chybí R2 binding PHOTOS_R2' }, { status: 500 });

  const formData = await request.formData();
  const file = formData.get('file');
  const galleryId = formData.get('galleryId');
  const photoId = formData.get('photoId');
  const mode = formData.get('mode') || 'replace';

  if (!file || !galleryId) return Response.json({ error: 'Chybí data' }, { status: 400 });

  const gal = await env.PHOTOS.get(`gallery:${galleryId}`, { type: 'json' });
  if (!gal) return Response.json({ error: 'Galerie nenalezena' }, { status: 404 });

  const old = gal.photos.find(p => p.id === photoId);
  const id = mode === 'saveas' ? crypto.randomUUID() : photoId;
  const ext = file.name.split('.').pop();
  const key = `gallery-${galleryId}/${id}.${ext}`;

  await r2.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  
  const publicUrl = env.CDN_BASE_URL 
    ? `${env.CDN_BASE_URL}/${key}` 
    : `https://pub-ce1c3ab85a304b4b9fb2213045f09c2c.r2.dev/${key}`;

  const photo = { id, key, url: publicUrl, name: file.name, size: file.size, type: file.type, uploaded: Date.now() };

  if (mode === 'replace' && old) {
    await r2.delete(old.key);
    const idx = gal.photos.findIndex(p => p.id === photoId);
    if (idx !== -1) gal.photos[idx] = photo;
  } else {
    gal.photos.push(photo);
  }
  
  await env.PHOTOS.put(`gallery:${galleryId}`, JSON.stringify(gal));
  return Response.json(photo);
}
