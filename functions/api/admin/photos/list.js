export async function onRequest(context) {
  const { request, env } = context;
  const bucket = env.zajda_photos;

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const prefix = 'photos/meta/';
    const listed = await bucket.list({ prefix: prefix });
    const photos = [];

    for (const obj of listed.objects || []) {
      try {
        const metaObj = await bucket.get(obj.key);
        if (!metaObj) continue;
        const metaText = await metaObj.text();
        const meta = JSON.parse(metaText);
        photos.push(meta);
      } catch (e) {
        continue;
      }
    }

    photos.sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));

    return new Response(JSON.stringify({ photos, count: photos.length }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, photos: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
