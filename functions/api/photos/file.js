export async function onRequestGet(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (!key) return new Response('Chybí key', { status: 400 });

  const object = await env.PHOTOS_R2.get(key);
  if (!object) return new Response('Nenalezeno', { status: 404 });

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=31536000');
  
  return new Response(object.body, { headers });
}
