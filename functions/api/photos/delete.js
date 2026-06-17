export async function onRequestDelete(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const keys = searchParams.get('keys'); // comma separated photoIds

  const list = await env.PHOTOS.list({ prefix: 'gallery:' });
  const mainKey = list.keys[0]?.name;
  if (!mainKey) return Response.json({ error: 'Žádná galerie' }, { status: 404 });

  const gallery = await env.PHOTOS.get(mainKey, { type: 'json' });
  if (!gallery) return Response.json({ error: 'Galerie nenalezena' }, { status: 404 });

  const ids = keys ? keys.split(',') : [];
  for (const pid of ids) {
    const p = gallery.photos.find(x => x.id === pid);
    if (p) {
      await env['zajda-photos'].delete(p.key);
      gallery.photos = gallery.photos.filter(x => x.id !== pid);
    }
  }

  await env.PHOTOS.put(mainKey, JSON.stringify(gallery));
  return Response.json({ success: true, removed: ids.length });
}
