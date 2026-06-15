// functions/api/photos/list.js
export async function onRequestGet(context) {
  const { env } = context;
  const list = await env.PHOTOS.list({ prefix: 'gallery:' });
  const galleries = [];
  for (const key of list.keys) {
    const data = await env.PHOTOS.get(key.name, { type: 'json' });
    if (data) galleries.push(data);
  }
  return Response.json(galleries);
}
