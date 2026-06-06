export async function onRequest(context) {
  const { env } = context;

  const list = await env.PHOTOS.list();
  const photos = [];

  for (const key of list.keys) {
    const url = await env.PHOTOS.get(key.name, { type: "url" });
    photos.push({ url });
  }

  return new Response(JSON.stringify({ photos }), {
    headers: { "Content-Type": "application/json" }
  });
}
