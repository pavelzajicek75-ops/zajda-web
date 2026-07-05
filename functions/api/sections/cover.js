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

  /* Zkusit parsovat jako JSON */
  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      const json = await request.json();
      const { sectionId, photoUrl } = json;
      if (!sectionId || !photoUrl) return Response.json({ error: 'Missing sectionId or photoUrl' }, { status: 400 });
      const imgResp = await fetch(photoUrl);
      if (!imgResp.ok) throw new Error('Failed to fetch image');
      const blob = await imgResp.blob();
      const key = `section-covers/${sectionId}.jpg`;
      await env.PHOTOS_R2.put(key, blob.stream(), { httpMetadata: { contentType: blob.type } });
      const url = `/api/photos/file?key=${encodeURIComponent(key)}`;
      return Response.json({ url, key });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  /* Fallback: FormData */
  const formData = await request.formData();
  const file = formData.get('file');
  const sectionId = formData.get('sectionId');
  if (!file || !sectionId) return Response.json({ error: 'Missing file or sectionId' }, { status: 400 });
  const key = `section-covers/${sectionId}.jpg`;
  await env.PHOTOS_R2.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  const url = `/api/photos/file?key=${encodeURIComponent(key)}`;
  return Response.json({ url, key });
}
