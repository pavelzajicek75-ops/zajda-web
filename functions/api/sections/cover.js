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

  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      const json = await request.json();
      const { sectionId, photoUrl } = json;
      if (!sectionId || !photoUrl) return Response.json({ error: 'Missing sectionId or photoUrl' }, { status: 400 });

      let blob;

      /* Zkusit extrahovat R2 key z URL a číst přímo z R2 */
      try {
        const urlObj = new URL(photoUrl, request.url);
        const r2key = urlObj.searchParams.get('key');
        if (r2key) {
          const obj = await env.PHOTOS_R2.get(decodeURIComponent(r2key));
          if (obj) {
            blob = await obj.blob();
          }
        }
      } catch (parseErr) {
        /* Ignorovat, použít fallback */
      }

      /* Fallback: fetch s absolutní URL */
      if (!blob) {
        let fetchUrl = photoUrl;
        if (!fetchUrl.startsWith('http')) {
          const reqUrl = new URL(request.url);
          fetchUrl = reqUrl.origin + (fetchUrl.startsWith('/') ? '' : '/') + fetchUrl;
        }
        const imgResp = await fetch(fetchUrl);
        if (!imgResp.ok) throw new Error('Failed to fetch image');
        blob = await imgResp.blob();
      }

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
