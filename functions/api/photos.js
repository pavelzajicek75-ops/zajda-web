export async function onRequest(context) {
  const { env } = context;
  const list = await env.PHOTOS.list();
  const photos = list.objects.map(obj => ({
    id: obj.key,
    name: obj.key.split("/").pop(),
    url: `https://pub-9ba0c4a1d5fc4ddabafac51f4f45d139.r2.dev/${obj.key}`
  }));
  return new Response(JSON.stringify(photos), {
    headers: { "Content-Type": "application/json" }
  });
}
