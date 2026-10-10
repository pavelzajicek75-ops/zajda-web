import { requireAdmin } from '../_auth-utils.js';
import { applySchedule, isListed } from './_publish.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get('sectionId');
  const subsectionId = searchParams.get('subsectionId');
  const isAdmin = !!(await requireAdmin(request, env));
  const list = await env.ARTICLES.list({ prefix: 'article:' });
  const articles = [];
  for (const key of list.keys) {
    let data = await env.ARTICLES.get(key.name, { type: 'json' });
    if (!data) continue;
    data = applySchedule(data);
    if (!isAdmin && !isListed(data)) continue;
    if ((!sectionId || data.sectionId === sectionId) && (!subsectionId || data.subsectionId === subsectionId)) articles.push(data);
  }
  return Response.json(articles.sort((a, b) => (b.created || 0) - (a.created || 0)));
}
