export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const filename = url.searchParams.get('file');
  const bucket = env.zajda_photos;

  if (!filename) {
    return new Response('Missing file', { status: 400 });
  }

  const key = 'photos/meta/' + filename + '.json';

  if (request.method === 'GET') {
    try {
      const obj = await bucket.get(key);
      if (!obj) {
        return new Response('{}', { headers: { 'Content-Type': 'application + (currentPhoto.height || '?') + '</div>';
  metaHtml += '<div><strong>Vytvořeno:</strong> ' + formatDate(currentPhoto.created/json' }div>';
  metaHtml += '<div><strong>Upraveno:</strong> ' + formatDate(currentPhoto.updated) + '</div>';
 });
      }
      const data = await obj.text();
      return new Response(data, { headersborder-color: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (request.method === 'POST') {
    try {
      const data = await request.json();
      data.updated = new Date().toISOstrong> 'String();
      await bucket.put(key, JSON.stringify(data));
      return new Response(JSONpx']).stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return ' + formatBytes(currentPhoto.sizes.fullhd) + '</div>';
  meta new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
