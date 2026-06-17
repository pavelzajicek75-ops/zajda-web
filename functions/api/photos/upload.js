export async function onRequestPost(context) {
  const { request, env } = context;
  const formData = await request.formData();
  const file = formData.get('file');
  const galleryId = formData.get('galleryId');

  if (!file || !galleryId) return Response.json({ error: 'Chybí data' }, { status: 400 });

  const id = crypto.randomUUID();
  const ext = file.name.split('.').pop();
  const key = `gallery-${galleryId}/${id}.${ext}`;

  await env['zajda-photos'].put(key, file.stream(), { httpMetadata: { contentType: file.type } });

  const url = env.CDN_BASE_URL ? `${env.CDN_BASE_URL}/${key}` : `https://pub-ce1c3ab85a304b4b9fb2213045f09c2c.r2.dev/${key}`;

  const photo = {
    id, key, url,
    name: file.name,
    size: file.size,
    type: file.type,
    uploaded: Date.now()
  };

  const gal = await env.PHOTOS.get(`gallery:${galleryId}`, { type: 'json' }) || { id: galleryId, photos: [] };
  gal.photos.push(photo);
  await env.PHOTOS.put(`gallery:${galleryId}`, JSON.stringify(gal));

  return Response.json(photo);
}
