import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const body = await request.json();
  const id = crypto.randomUUID();
  const gallery = {
    id,
    title: body.title || '',
    desc: body.desc || '',
    photos: [],
    created: Date.now()
  };
  await env.PHOTOS.put(`gallery:${id}`, JSON.stringify(gallery));
  return Response.json(gallery);
}
