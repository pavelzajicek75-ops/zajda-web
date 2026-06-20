export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const galleryId = formData.get('galleryId') || 'main';
    if (!file || typeof file === 'string') return Response.json({ error: 'No file' }, { status: 400 });
    const id = crypto.randomUUID();
    const ext = (file.name || 'jpg').split('.').pop() || 'jpg';
    const key = `gallery-${galleryId}/${id}.${ext}`;
    const buffer = await file.arrayBuffer();
    await env.PHOTOS_R2.put(key, buffer, { httpMetadata: { contentType: file.type || 'image/jpeg' } });
    return Response.json({ id, key, url: `/api/photos/file?key=${encodeURIComponent(key)}`, name: file.name, size: file.size, uploaded: new Date().toISOString() });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
