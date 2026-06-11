export async function onRequest(context) {
  const { request, env } = context;
  const bucket = env.zajda_photos;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await request.formData();
    const filename = formData.get('filename');
    if (!filename) {
      return new Response(JSON.stringify({ success: false, error: 'Missing filename' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const files = [
      { field: 'original', path: 'photos/original/' },
      { field: '2000px', path: 'photos/2000px/' },
      { field: 'fullhd', path: 'photos/fullhd/' },
      { field: '1024px', path: 'photos/1024px/' },
      { field: 'thumb', path: 'photos/thumbs/' }
    ];

    for (const f of files) {
      const file = formData.get(f.field);
      if (file && file.size > 0) {
        await bucket.put(f.path + filename, file.stream(), {
          httpMetadata: { contentType: file.type || 'image/webp' }
        });
      }
    }

    const metadataStr = formData.get('metadata');
    if (metadataStr) {
      await bucket.put('photos/meta/' + filename + '.json', metadataStr, {
        httpMetadata: { contentType: 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, filename }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
