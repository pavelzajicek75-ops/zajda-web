export async function onRequest(context) {
  const { env } = context;
  const list = await env.PHOTOS.list();
  const photos = list.objects.map(obj => ({
    id: obj.key,
    name: obj.key,
    // správná cesta je přímo root bucketu
    url: `https://pub-04881c4bbea24b2ab23b9be5a7bd0aa1.r2.dev/${obj.key}`
  }));
  return new Response(JSON.stringify(photos), {
    headers: { "Content-Type": "application/json" }
  });
}
