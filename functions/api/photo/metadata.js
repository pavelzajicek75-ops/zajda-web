export async function onRequest(context) {
  const { request, env } = context;
  const bucket = env.zajda_photos;
  const url = new URL(request.url);
  const filename = url.searchParams.get('file');
  
  if (!filename) {
    return new Response(JSON.stringify({ error: 'Missing file param' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  
  if (request.method === 'GET') {
    try {
      const obj = await bucket.get(`photos/meta/${filename}.json`);
      if (!obj) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      return new Response(await obj.text(), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
  
  if (request.method === 'POST') {
    try {
      const meta = await request.json();
      meta.updated = new Date().toISOString();
      await bucket.put(`photos/meta/${filename}.json`, JSON.stringify(meta), {
        httpMetadata: { contentType': 'application/json' }
      });
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
  
  return new Response('Method not allowed', { status: 405 });
}
