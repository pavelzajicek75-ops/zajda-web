export async function onRequestPost(context) {
  const { request, env } = context;
  const r2 = env.PHOTOS_R2;
  if (!r2) return Response.json({ error: 'Chybí PHOTOS_R2' }, { status: 500 });

  const formData = await request.formData();
  const file = formData.get('file');
  const galleryId = formData.get('galleryId');
  const photoId = formData.get('photoId');
  const mode = formData.get('mode') || 'replace';

  if (!file || !galleryId || !photoId) return Response.json({ error: 'Chybí data' }, { status: 400 });

  const galKey = `gallery:${galleryId}`;
  const gal = await env.PHOTOS.get(galKey, { type: 'json' });
  if (!gal) return Response.json({ error: 'Galerie nenalezena' }, { status: 404 });

  const old = gal.photos.find(p => p.id === photoId);
  const ts = Date.now();

  // Vždy nové ID při uložení, aby se předešlo cache problémům
  const id = mode === 'saveas' ? crypto.randomUUID() : photoId;
  const ext = file.name.split('.').pop();
  const key = `gallery-${galleryId}/${id}.${ext}`;

  // Upload nového souboru
  await r2.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

  const urlBase = env.CDN_BASE_URL 
    ? `${env.CDN_BASE_URL}/${key}` 
    : `https://pub-ce1c3ab85a304b4b9fb2213045f09c2c.r2.dev/${key}`;

  const photo = { id, key, url: `${urlBase}?v=${ts}`, name: file.name, size: file.size, type: file.type, uploaded: ts };

  if (mode === 'replace' && old) {
    // Smaž starý soubor z R2
    try { await r2.delete(old.key); } catch {}
    // Nahraď v KV
    const idx = gal.photos.findIndex(p => p.id === photoId);
    if (idx !== -1) gal.photos[idx] = photo;
  } else {
    // Save as = přidat novou
    gal.photos.push(photo);
  }

  await env.PHOTOS.put(galKey, JSON.stringify(gal));
  return Response.json(photo);
}
