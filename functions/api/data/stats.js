// functions/api/data/stats.js
//
// GET /api/data/stats — rychlý přehled "žije všechno?" pro diagnostickou
// stránku v adminu: kolik čeho je, a jestli se na klíčová úložiště vůbec
// dá sáhnout. Jen pro přihlášeného admina.

import { requireAdmin, json } from '../_auth-utils.js';

async function countPrefix(kv, prefix) {
  if (!kv) return null;
  try {
    const list = await kv.list({ prefix });
    return list.keys.length;
  } catch (e) {
    return null;
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const stats = { checkedAt: new Date().toISOString() };

  stats.articles = await countPrefix(env.ARTICLES, 'article:');
  stats.timeline = await countPrefix(env.ARTICLES, 'timeline:');
  stats.sections = await countPrefix(env.SUBSECTIONS, 'section:');
  stats.subsections = await countPrefix(env.SUBSECTIONS, 'subsection:');
  stats.galleries = await countPrefix(env.PHOTOS, 'gallery:');

  stats.quotes = null;
  if (env.QUOTES_R2) {
    try {
      const list = await env.QUOTES_R2.list({ prefix: 'quotes/' });
      stats.quotes = list.objects.length;
    } catch (e) { stats.quotes = null; }
  }

  stats.bindings = {
    ARTICLES: !!env.ARTICLES,
    SUBSECTIONS: !!env.SUBSECTIONS,
    PHOTOS: !!env.PHOTOS,
    PHOTOS_R2: !!env.PHOTOS_R2,
    QUOTES_R2: !!env.QUOTES_R2
  };

  return json(stats);
}
