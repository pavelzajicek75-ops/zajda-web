// functions/api/data/stats.js
//
// GET /api/data/stats — rychlý přehled "žije všechno?" pro diagnostickou
// stránku v adminu: kolik čeho je, a jestli se na klíčová úložiště vůbec
// dá sáhnout. Jen pro přihlášeného admina.

import { requireAdmin, json } from '../_auth-utils.js';
import { listIndexed } from '../_kv-index.js';

async function countPrefix(kv, prefix, home, tag) {
  if (!kv) return null;
  try {
    const list = await listIndexed(kv, home, prefix, { tag, allowEmpty: true });
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

  stats.articles = await countPrefix(env.ARTICLES, 'article:', env.ARTICLES, '');
  stats.timeline = await countPrefix(env.ARTICLES, 'timeline:', env.ARTICLES, '');
  stats.sections = await countPrefix(env.SUBSECTIONS, 'section:', env.ARTICLES, ':S');
  stats.subsections = await countPrefix(env.SUBSECTIONS, 'subsection:', env.ARTICLES, ':S');
  stats.galleries = await countPrefix(env.PHOTOS, 'gallery:', env.ARTICLES, ':P');

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
