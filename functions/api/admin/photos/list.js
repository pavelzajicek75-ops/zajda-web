export async function onRequestGet(context) {
  const { env } = context;

  const objects = await env.PHOTOS_R2.list();

  const photos = (objects.objects || []).map((obj) => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded,
    url: `${env.CDN_BASE_URL}/${obj.key}`,
  }));

  return new Response(JSON.stringify({ photos }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
