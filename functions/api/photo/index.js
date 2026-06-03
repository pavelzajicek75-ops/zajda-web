// /functions/api/photo/index.js

export async function onRequest(context) {
  const bucket = context.env.zajda_photos;
  const list = await bucket.list();

  const items = list.objects.map(obj => ({
    filename: obj.key,
    size: obj.size,
    url: `/api/photo/${encodeURIComponent(obj.key)}`
  }));

  return new Response(JSON.stringify(items), {
    headers: { "Content-Type": "application/json" }
  });
}
