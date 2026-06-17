export async function onRequestPost(context) {
  const { request, env } = context;
  const formData = await request.formData();
  const file = formData.get('file');
  
  if (!file) return Response.json({ error: 'Chybí soubor' }, { status: 400 });

  // Najdi nebo vytvoř hlavní galerii
  const list = await env.PHOTOS.list({ prefix: 'gallery:' });
  let mainKey = list.keys[0]?.name;
  let galleryId;
  
  if (mainKey) {
    galleryId = mainKey.replace('gallery:', '');
  } else {
    galleryId = 'main';
    mainKey = 'gallery:main';
    await env.PHOTOS.put(mainKey, JSON.stringify({ id: galleryId, title: 'Hlavní galerie', photos: [] }));
  }

  const id = crypto.randomUUID();
  const ext = file.name.split('.').pop();
  const key = `gallery-${galleryId}/${id}.${ext}`;

  await env['zajda-photos'].put(key, file.stream(), { httpMetadata: { contentType: file.type } });

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

  const gallery = await env.PHOTOS.get(mainKey, { type: 'json' });
  gallery.photos = gallery.photos || [];
  gallery.photos.push(photo);
  await env.PHOTOS.put(mainKey, JSON.stringify(gallery));

  return Response.json(photo);
}
