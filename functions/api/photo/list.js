// /functions/api/photo/list.js

export async function onRequest(context) {
  const { env } = context;
  const bucket = env.zajda_photos;

  if (!bucket) {
    return new Response("R2 bucket zajda_photos is not bound", { status: 500 });
  }

  const list = await bucket.list();

  const files = list.objects.map(obj => ({
    name: obj.key,
    url: `/api/photo/${obj.key}`
  }));

  return new Response(JSON.stringify({ files }), {
    headers: { "Content-Type": "application/json" }
  });
}
