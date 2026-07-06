export async function onRequestGet(context) {
  const { env } = context;
  const { searchParams } = new URL(context.request.url);
  const sectionId = searchParams.get('sectionId');
  if (!sectionId) return Response.json({ url: null });

  /* Číst uložený klíč fotky — stejný princip jako podsekce */
  const obj = await env.PHOTOS_R2.get('section-covers/' + sectionId + '.txt');
  if (!obj) return Response.json({ url: null });
  const sourceKey = await obj.text();
  const url = '/api/photos/file?key=' + encodeURIComponent(sourceKey);
  return Response.json({ url });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      const json = await request.json();
      const { sectionId, photoUrl } = json;
      if (!sectionId || !photoUrl) return Response.json({ error: 'Missing sectionId or photoUrl' }, { status: 400 });

      /* Extrahovat R2 key z URL — žádný fetch, žádné kopírování */
      var sourceKey = null;
      try {
        var urlObj = new URL(photoUrl, request.url);
        sourceKey = urlObj.searchParams.get('key');
      } catch (e) {
        var match = photoUrl.match(/[?&]key=([^&]+)/);
        if (match) sourceKey = decodeURIComponent(match[1]);
      }

      if (!sourceKey) return Response.json({ error: 'No key found in photoUrl' }, { status: 400 });

      /* Uložit klíč fotky jako text — stejně jako podsekce ukládá URL */
      await env.PHOTOS_R2.put('section-covers/' + sectionId + '.txt', sourceKey);
      var url = '/api/photos/file?key=' + encodeURIComponent(sourceKey);
      return Response.json({ url: url, key: sourceKey });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  /* Fallback: FormData */
  const formData = await request.formData();
  const file = formData.get('file');
  const sectionId = formData.get('sectionId');
  if (!file || !sectionId) return Response.json({ error: 'Missing file or sectionId' }, { status: 400 });
  const key = 'section-covers/' + sectionId + '.jpg';
  await env.PHOTOS_R2.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  const url = '/api/photos/file?key=' + encodeURIComponent(key);
  return Response.json({ url: url, key: key });
}
