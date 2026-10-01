import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const r2 = env.QUOTES_R2;
  if (!r2) return Response.json({ error: 'Chybí QUOTES_R2' }, { status: 500 });
  const body = await request.json();
  const id = crypto.randomUUID();
  const key = `quotes/${id}.json`;
  await r2.put(key, JSON.stringify({ text: body.text || '', author: body.author || '', created: Date.now() }));
  return Response.json({ id, key, text: body.text, author: body.author });
}
