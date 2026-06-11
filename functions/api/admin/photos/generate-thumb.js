export async function onRequest(context) {
  const { request, env } = context;
  const bucket = env.zajda_photos;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.json();
    const filename = body.filename;
    if (!filename) {
      return new Response(JSON.stringify({ success: false, error: 'Missing filename' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Use client-side editor to generate thumbnail and upload via /api/admin/photos/save'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
