function getR2(env) {
  return env.PHOTOS_R2 || null;
}

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

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const id = crypto.randomUUID();
  const gallery = { id, title: body.title || 'Hlavní galerie', desc: '', photos: [], created: Date.now() };
  await env.PHOTOS.put(`gallery:${id}`, JSON.stringify(gallery));
  return Response.json(gallery);
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const r2 = getR2(env);
  const gal = await env.PHOTOS.get(`gallery:${id}`, { type: 'json' });
  if (gal?.photos && r2) {
    for (const p of gal.photos) await r2.delete(p.key);
  }
  await env.PHOTOS.delete(`gallery:${id}`);
  return Response.json({ success: true });
}
