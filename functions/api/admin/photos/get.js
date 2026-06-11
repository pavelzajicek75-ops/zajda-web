export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const filename = url.searchParams.get('file');
  const size = url.searchParams.get('size') || 'original';
  const bucket = env.zajda_photos;

  if (!filename) {
    return new Response('Missing file parameter', { status: 400 });
  }

  const sizeMap = {
    'original': 'photos/original/',
    '2000px': 'photos/2000px/',
    'fullhd': 'photos/fullhd/',
    '1024px': 'photos/1024px/',
    'thumb': 'photos/thumbs/'
  };

  const prefix = sizeMap[size] || sizeMap['original'];
  const key = prefix + filename;

  try {
    const obj = await bucket.get(key);
    if (!obj) {
      return new Response('Not found', { status: 404 });
    }

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'public, max-age=86400');
    headers.set('etag', obj.httpEtag);

    // Fallback Content-Type pouze pokud R2 nemá metadata
    if (!headers.has('Content-Type')) {
      const ext = filename.split('.').pop().toLowerCase();
      const mimeTypes = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'png': 'image/png', 'webp': 'image/webp',
        'gif': 'image/gif', 'avif': 'image/avif'
      };
      headers.set('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    }

    return new Response(obj.body, { headers });
  } catch (e) {
    return new Response('Error: ' + e.message, { status: 500 });
  }
}
