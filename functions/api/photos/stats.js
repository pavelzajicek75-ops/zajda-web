export async function onRequestGet(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const galleryId = searchParams.get('galleryId');
  const r2 = env.PHOTOS_R2;

  let totalSize = 0, totalCount = 0;
  
  if (r2) {
    try {
      let cursor;
      do {
        const list = await r2.list({ cursor, limit: 1000 });
        for (const o of list.objects || []) { totalSize += o.size; totalCount++; }
        cursor = list.truncated ? list.cursor : undefined;
      } while (cursor);
    } catch {}
  }

  let galCount = 0, galSize = 0;
  if (galleryId) {
    const gal = await env.PHOTOS.get(`gallery:${galleryId}`, { type: 'json' });
    if (gal?.photos) {
      galCount = gal.photos.length;
      galSize = gal.photos.reduce((a, p) => a + (p.size || 0), 0);
    }
  }

  return Response.json({ totalCount, totalSize, galCount, galSize });
}
