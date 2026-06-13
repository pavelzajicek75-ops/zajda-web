export async function onRequestPost(context) {
  const { request, env } = context;

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    return new Response(JSON.stringify({ error: 'No file uploaded' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const key = formData.get('key') || file.name;
  const arrayBuffer = await file.arrayBuffer();

  await env.PHOTOS_R2.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
  });

  return new Response(
    JSON.stringify({
      success: true,
      key,
      url: `${env.CDN_BASE_URL}/${key}`,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
