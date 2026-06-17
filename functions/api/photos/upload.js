export async function onRequestPost(context) {
  const { request, env } = context;
  const formData = await request.formData();
  const file = formData.get('file');
  const galleryId = formData.get('galleryId') || 'main';

  if (!file) return Response.json({ error: 'No file' }, { status: 400 });

  const id = crypto.randomUUID();
  const ext = file.name.split('.').pop();
  const key = `gallery-${galleryId}/${id}.${ext}`;

  await env.PHOTOS_R2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type }
  });

  return Response.json({
    id, key,
    url: `/api/photos/file?key=${encodeURIComponent(key)}`,
    name: file.name,
    size: file.size,
    uploaded: new Date().toISOString()
  });
}
