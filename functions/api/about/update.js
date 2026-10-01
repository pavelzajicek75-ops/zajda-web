import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const body = await request.json();
  const about = {
    title: body.title || '',
    text: body.text || '',
    photos: body.photos || [],
    subsections: body.subsections || [],
    updated: Date.now()
  };
  await env.ARTICLES.put('about:zajda', JSON.stringify(about));
  return Response.json(about);
}
