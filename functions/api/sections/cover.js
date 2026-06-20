export async function onRequestGet(context) {
  const { env } = context;
  const { searchParams } = new URL(context.request.url);
  const sectionId = searchParams.get('sectionId');
  const key = `section-covers/${sectionId}.jpg`;
  const head = await env.PHOTOS_R2.head(key);
  if (!head) return Response.json({ url: null });
  const url = `/api/photos/file?key=${encodeURIComponent(key)}`;
  return Response.json({ url });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const formData = await request.formData();
  const file = formData.get('file');
  const sectionId = formData.get('sectionId');
  if (!file || !sectionId) return Response.json({ error: 'Missing file or sectionId' }, { status: 400 });
  const key = `section-covers/${sectionId}.jpg`;
  await env.PHOTOS_R2.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  const url = `/api/photos/file?key=${encodeURIComponent(key)}`;
  return Response.json({ url, key });
}
