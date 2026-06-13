export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const { key } = body;

  if (!key) {
    return new Response(JSON.stringify({ error: 'Missing key' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.PHOTOS_R2.delete(key);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
