export async function onRequest(context) {
  const { request, env } = context;
  const bucket = env.zajda_photos;

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const filename = url.searchParams.get('file');
    if (!filename) {
      return new Response('Missing file', { status: 400 });
    }
    try {
      const obj = await bucket.get('photos/meta/' + filename + '.json');
      if (!obj) return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
      return new Response(obj.body, { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (request.method === 'POST') {
    try {
      const body = await request.text();
      const data = JSON.parse(body);
      const filename = data.filename;
      if (!filename) {
        return new Response(JSON.stringify({ success: false, error: 'Missing filename' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      await bucket.put('photos/meta/' + filename + '.json', JSON.stringify(data), {
        httpMetadata: { contentType: 'application/json' }
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
