export async function onRequest(context) {
  const { R2 } = context.env;

  const list = await R2.list();
  const photos = list.objects.map(obj => ({
    url: `https://pub-04881c4bbea24b2ab23b9be5a7bd0aa1.r2.dev/${obj.key}`
  }));

  return new Response(JSON.stringify(photos), {
    headers: { "Content-Type": "application/json" }
  });
}
