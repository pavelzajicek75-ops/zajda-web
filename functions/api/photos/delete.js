export async function onRequestDelete(context) {
  const { request, env } = context;
  const r2 = env.PHOTOS_R2;
  const { searchParams } = new URL(request.url);
  const galleryId = searchParams.get('galleryId');
  const keys = searchParams.get('keys');

  if (!galleryId) return Response.json({ error: 'Chybí galleryId' }, { status: 400 });

  const galKey = `gallery:${galleryId}`;
  const gal = await env.PHOTOS.get(galKey, { type: 'json' });
  if (!gal) return Response.json({ error: 'Galerie nenalezena' }, { status: 404 });

  const ids = keys ? keys.split(',') : [];
  for (const pid of ids) {
    const p = gal.photos.find(x => x.id === pid);
    if (p) {
      if (r2) try { await r2.delete(p.key); } catch {}
      gal.photos = gal.photos.filter(x => x.id !== pid);
    }
  }

  await env.PHOTOS.put(galKey, JSON.stringify(gal));
  return Response.json({ success: true, removed: ids.length });
}
