import { jsonCached, requireAdmin } from '../_auth-utils.js';
import { applySchedule, isPublished } from './_publish.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const isAdmin = !!(await requireAdmin(request, env));
  const list = await env.ARTICLES.list({ prefix: 'article:' });
  let articles = [];
  for (const key of list.keys) {
    const data = await env.ARTICLES.get(key.name, { type: 'json' });
    if (data) {
      // Doplň ID z klíče, pokud chybí v datech
      if (!data.id) data.id = key.name.replace('article:', '');
      articles.push(applySchedule(data));
    }
  }
  // Koncepty a ještě nezveřejněné naplánované články vidí jen admin —
  // veřejnosti se neposílají ani jako data (dřív je jen filtroval klient).
  if (!isAdmin) articles = articles.filter(isPublished);
  // Krátká 30s cache pro běžné návštěvníky (články se mění častěji než
  // sekce) — admin má díky Authorization hlavičce vždy čerstvá data.
  return jsonCached(articles.sort((a, b) => (b.created || 0) - (a.created || 0)), request, 30);
}
