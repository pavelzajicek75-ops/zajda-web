export async function onRequest(context) {
  const { R2 } = context.env;

  const list = await R2.list();

  const photos = list.objects.map(obj => ({
    name: obj.key,
    size: obj.size,
    url: `https://pub-04881c4bbea24b2ab23b9be5a7bd0aa1.r2.dev/${obj.key}`
  }));

  return new Response(JSON.stringify({
    totalCount: photos.length,
    totalSize: list.objects.reduce((sum, o) => sum + o.size, 0),
    photos
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
