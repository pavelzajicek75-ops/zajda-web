import { requireAdmin, json as _json } from '../_auth-utils.js';
export async function onRequestGet(context) {
  const { env } = context;
  if (!(await requireAdmin(context.request, env))) return _json({ error: 'Unauthorized' }, 401);
  const { searchParams } = new URL(context.request.url);
  const galleryId = searchParams.get('galleryId') || 'main';
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
