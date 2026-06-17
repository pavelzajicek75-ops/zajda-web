export async function onRequestPost(context) {
  const { request, env } = context;
  const formData = await request.formData();
  const file = formData.get('file');
  const photoId = formData.get('photoId');
  const mode = formData.get('mode') || 'replace';

  if (!file) return Response.json({ error: 'Chybí soubor' }, { status: 400 });

  const list = await env.PHOTOS.list({ prefix: 'gallery:' });
  const mainKey = list.keys[0]?.name;
  if (!mainKey) return Response.json({ error: 'Žádná galerie' }, { status: 404 });

  const gallery = await env.PHOTOS.get(mainKey, { type: 'json' });
  const old = gallery.photos.find(p => p.id === photoId);
  const id = mode === 'saveas' ? crypto.randomUUID() : photoId;
  const ext = file.name.split('.').pop();
  const key = `gallery-main/${id}.${ext}`;

  await env['zajda-photos'].put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  
  const publicUrl = env.CDN_BASE_URL 
    ? `${env.CDN_BASE_URL}/${key}` 
    : `https://pub-ce1c3ab85a304b4b9fb2213045f09c2c.r2.dev/${key}`;

  const photo = { id, key, url: publicUrl, name: file.name, size: file.size, type: file.type, uploaded: Date.now() };

  if (mode === 'replace' && old) {
    await env['zajda-photos'].delete(old.key);
    const idx = gallery.photos.findIndex(p => p.id === photoId);
    if (idx !== -1) gallery.photos[idx] = photo;
  } else {
    gallery.photos.push(photo);
  }

  await env.PHOTOS.put(mainKey, JSON.stringify(gallery));
  return Response.json(photo);
}
