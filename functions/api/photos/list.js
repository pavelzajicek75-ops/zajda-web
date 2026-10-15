// GET /api/photos/list?galleryId=main — seznam fotek galerie.
// Veřejné (používá ho úvodní stránka), ale výsledek se drží v cache na okraji sítě,
// takže návštěvníci nezatěžují úložiště. Admin (s přihlášením) dostává vždy čerstvá data.
import { edgeCached } from '../_edge-cache.js';

async function handleGet(context) {
  const { env } = context;
  const { searchParams } = new URL(context.request.url);
  const galleryId = String(searchParams.get('galleryId') || 'main').replace(/[^\w-]/g, '').slice(0, 60) || 'main';
  const prefix = `gallery-${galleryId}/`;
  const list = await env.PHOTOS_R2.list({ prefix });
  const photos = [];
  for (const obj of list.objects || []) {
    const id = obj.key.split('/').pop().split('.')[0];
    const ext = obj.key.split('.').pop();
    photos.push({ id, key: obj.key, url: `/api/photos/file?key=${encodeURIComponent(obj.key)}`, name: `${id}.${ext}`, size: obj.size, uploaded: new Date(obj.uploaded).toISOString() });
  }
  return Response.json(photos);
}

export async function onRequestGet(context) {
  return edgeCached(context, 120, () => handleGet(context));
}
