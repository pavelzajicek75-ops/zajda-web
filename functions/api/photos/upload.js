export async function onRequestPost(context) {
  const { request, env } = context;
  const r2 = env.PHOTOS_R2;
  
  if (!r2) return Response.json({ error: 'Chybí PHOTOS_R2 binding' }, { status: 500 });

  const formData = await request.formData();
  const file = formData.get('file');
  const galleryId = formData.get('galleryId');

  if (!file || !galleryId) return Response.json({ error: 'Chybí soubor nebo galerie' }, { status: 400 });

  const id = crypto.randomUUID();
  const ext = file.name.split('.').pop();
  const key = `gallery-${galleryId}/${id}.${ext}`;
  const ts = Date.now();

  await r2.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

  const urlBase = env.CDN_BASE_URL 
    ? `${env.CDN_BASE_URL}/${key}` 
    : `https://pub-ce1c3ab85a304b4b9fb2213045f09c2c.r2.dev/${key}`;

  const photo = {
    id, key,
    url: `${urlBase}?v=${ts}`,
    name: file.name,
    size: file.size,
    type: file.type,
    uploaded: ts
  };

  const galKey = `gallery:${galleryId}`;
  const existing = await env.PHOTOS.get(galKey, { type: 'json' }) || { id: galleryId, title: 'Galerie', photos: [] };
  existing.photos = existing.photos || [];
  existing.photos.push(photo);
  await env.PHOTOS.put(galKey, JSON.stringify(existing));

  return Response.json(photo);
}
