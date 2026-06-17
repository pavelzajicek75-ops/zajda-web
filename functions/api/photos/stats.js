export async function onRequestGet(context) {
  const { env } = context;
  
  const list = await env.PHOTOS.list({ prefix: 'gallery:' });
  const mainKey = list.keys[0]?.name;
  
  let count = 0, size = 0;
  
  if (mainKey) {
    const gallery = await env.PHOTOS.get(mainKey, { type: 'json' });
    if (gallery?.photos) {
      count = gallery.photos.length;
      size = gallery.photos.reduce((a, p) => a + (p.size || 0), 0);
    }
  }

  // Celkové R2 statistiky (všechny objekty v bucketu)
  let totalSize = 0, totalCount = 0, cursor;
  do {
    const r2list = await env['zajda-photos'].list({ cursor, limit: 1000 });
    for (const o of r2list.objects || []) { totalSize += o.size; totalCount++; }
    cursor = r2list.truncated ? r2list.cursor : undefined;
  } while (cursor);

  return Response.json({ count, size, totalCount, totalSize });
}
