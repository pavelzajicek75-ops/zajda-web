import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized' }, 401);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  await env.SUBSECTIONS.delete(`subsection:${id}`);
  return Response.json({ success: true });
}
