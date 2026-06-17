export async function onRequestGet(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const galleryId = searchParams.get('galleryId');

  if (!galleryId) return Response.json({ error: 'Chybí galleryId' }, { status: 400 });

  const galKey = `gallery:${galleryId}`;
  let gal = await env.PHOTOS.get(galKey, { type: 'json' });

  // Pokud KV neexistuje nebo je prázdné, sync z R2
  if (!gal || !gal.photos || gal.photos.length === 0) {
    if (!env.PHOTOS_R2) return Response.json([], { status: 200 });
    
    const prefix = `gallery-${galleryId}/`;
    const r2List = await env.PHOTOS_R2.list({ prefix });
    const photos = [];
    
    for (const obj of r2List.objects || []) {
      const id = obj.key.split('/').pop().split('.')[0];
      const ext = obj.key.split('.').pop();
      const urlBase = env.CDN_BASE_URL 
        ? `${env.CDN_BASE_URL}/${obj.key}` 
        : `https://pub-ce1c3ab85a304b4b9fb2213045f09c2c.r2.dev/${obj.key}`;
      
      photos.push({
        id,
        key: obj.key,
        url: `${urlBase}?v=${new Date(obj.uploaded).getTime()}`,
        name: `${id}.${ext}`,
        size: obj.size,
        uploaded: new Date(obj.uploaded).getTime()
      });
    }
    
    // Uložit do KV pro příště
    gal = { id: galleryId, title: 'Galerie', photos, created: Date.now() };
    await env.PHOTOS.put(galKey, JSON.stringify(gal));
    
    return Response.json(photos);
  }

  return Response.json(gal.photos || []);
}
