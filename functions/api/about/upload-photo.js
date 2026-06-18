export async function onRequestPost(context) {
  const { request, env } = context;
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return Response.json({ error: 'No file' }, { status: 400 });
  const id = crypto.randomUUID();
  const key = `about/${id}.${file.name.split('.').pop()}`;
  await env.PHOTOS_R2.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  const url = `/api/photos/file?key=${encodeURIComponent(key)}`;
  return Response.json({ url, key });
}
