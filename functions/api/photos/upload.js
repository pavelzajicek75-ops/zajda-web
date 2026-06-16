export async function onRequestPost(context) {
  const { request, env } = context;
  const formData = await request.formData();
  const file = formData.get('file');
  const galleryId = formData.get('galleryId');

  if (!file || !galleryId) {
    return Response.json({ error: 'Chybí soubor nebo ID galerie' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const ext = file.name.split('.').pop();
  const key = `gallery-${galleryId}/${id}.${ext}`;

  await env.PHOTOS_R2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type }
  });

  const publicUrl = env.CDN_BASE_URL
    ? `${env.CDN_BASE_URL}/${key}`
    : `https://pub-ce1c3ab85a304b4b9fb2213045f09c2c.r2.dev/${key}`;

  const gallery = await env.PHOTOS.get(`gallery:${galleryId}`, { type: 'json' });
  if (gallery) {
    gallery.photos = gallery.photos || [];
    gallery.photos.push({
      id,
      key,
      url: publicUrl,
      name: file.name,
      size: file.size,
      uploaded: Date.now()
    });
    await env.PHOTOS.put(`gallery:${galleryId}`, JSON.stringify(gallery));
  }

  return Response.json({ id, url: publicUrl, size: file.size });
}
