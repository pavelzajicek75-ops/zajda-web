export async function onRequest(context) {
  const { request, env } = context;
  const bucket = env.zajda_photos;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.json();
    const filenames = body.filenames || [];
    if (filenames.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No filenames' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const prefixes = [
      'photos/original/',
      'photos/2000px/',
      'photos/fullhd/',
      'photos/1024px/',
      'photos/thumbs/',
      'photos/meta/'
    ];

    for (const filename of filenames) {
      for (const prefix of prefixes) {
        const key = prefix + (prefix === 'photos/meta/' ? filename + '.json' : filename);
        try { await bucket.delete(key); } catch (e) {}
      }
    }

    return new Response(JSON.stringify({ success: true, deleted: filenames.length }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
