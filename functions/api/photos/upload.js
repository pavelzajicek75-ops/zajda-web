export async function onRequestPost(context) {
  const { request, env } = context;
  const r2 = env.PHOTOS_R2;
  
  if (!r2) {
    return Response.json({ error: 'R2 binding PHOTOS_R2 není připojený. Jdi do Pages Settings > Functions a přidej: Name=PHOTOS_R2, Bucket=zajda-photos' }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const galleryId = formData.get('galleryId');

  if (!file || !galleryId) {
    return Response.json({ error: 'Chybí soubor nebo ID galerie' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const ext = file.name.split('.').pop();
  const key = `gallery-${galleryId}/${id}.${ext}`;

  await r2.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

  const publicUrl = env.CDN_BASE_URL 
    ? `${env.CDN_BASE_URL}/${key}` 
    : `https://pub-ce1c3ab85a304b4b9fb2213045f09c2c.r2.dev/${key}`;

  const photo = {
    id, key, url: publicUrl,
    name: file.name,
    size: file.size,
    type: file.type,
    uploaded: Date.now()
  };

  const gal = await env.PHOTOS.get(`gallery:${galleryId}`, { type: 'json' }) || { id: galleryId, photos: [] };
  gal.photos = gal.photos || [];
  gal.photos.push(photo);
  await env.PHOTOS.put(`gallery:${galleryId}`, JSON.stringify(gal));

  return Response.json(photo);
}
