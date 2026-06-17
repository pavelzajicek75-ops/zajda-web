export async function onRequestGet(context) {
  const { env } = context;
  const { searchParams } = new URL(context.request.url);
  const galleryId = searchParams.get('galleryId') || 'main';
  const prefix = `gallery-${galleryId}/`;
  
  const list = await env.PHOTOS_R2.list({ prefix });
  const photos = [];
  
  for (const obj of list.objects || []) {
    const id = obj.key.split('/').pop().split('.')[0];
    const ext = obj.key.split('.').pop();
    const url = `https://pub-ce1c3ab85a304b4b9fb2213045f09c2c.r2.dev/${obj.key}?v=${Date.now()}`;
    photos.push({
      id,
      key: obj.key,
      url,
      name: `${id}.${ext}`,
      size: obj.size,
      uploaded: new Date(obj.uploaded).toISOString()
    });
  }
  
  return Response.json(photos);
}
