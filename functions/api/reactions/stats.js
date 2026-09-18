// /functions/api/reactions/stats.js
//
// Souhrnné statistiky reakcí pro admin (GET /api/reactions/stats):
// - celkový počet reakcí podle typu, napříč VŠEMI články
// - nejpopulárnější článek (podle součtu reakcí)
// - denní časová řada za posledních N dní (pro graf vývoje v čase)
//
// Jen pro přihlášeného admina — na rozdíl od config.js (GET tam je
// veřejné, protože ho potřebuje veřejná stránka článku), tohle je čistě
// interní přehled.

import { requireAdmin, json } from '../_auth-utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(request.url);
  const days = Math.min(180, Math.max(7, parseInt(url.searchParams.get('days') || '30', 10) || 30));

  // --- Souhrn podle typu + nejpopulárnější článek (z aktuálních čítačů
  //     na záznamech článků — přesné aktuální stavy, žádné počítání
  //     historie tady není potřeba). ---
  const articleList = await env.ARTICLES.list({ prefix: 'article:' });
  const articles = await Promise.all(
    articleList.keys.map(entry => env.ARTICLES.get(entry.name, { type: 'json' }))
  );
  const totalsByType = {};
  let topArticle = null;
  let topArticleTotal = -1;

  for (const article of articles) {
    if (!article || !article.reactions) continue;
    let articleTotal = 0;
    for (const [k, v] of Object.entries(article.reactions)) {
      const n = typeof v === 'number' ? v : 0;
      totalsByType[k] = (totalsByType[k] || 0) + n;
      articleTotal += n;
    }
    if (articleTotal > topArticleTotal) {
      topArticleTotal = articleTotal;
      topArticle = { id: article.id, title: article.title || 'Bez názvu', total: articleTotal };
    }
  }

  // --- Denní časová řada z lehkých log-záznamů (viz react.js) ---
  // Klíče mají tvar "reaction-log:YYYY-MM-DD:timestamp:articleId:emoji" —
  // stačí vylistovat s prefixem podle konkrétního dne a spočítat počet
  // klíčů, není potřeba číst hodnotu (je jen "1", nenese žádnou další
  // informaci) ani stahovat celé velké rozmezí najednou.
  const dailyCounts = [];
  const today = new Date();
  const dayStrs = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dayStrs.push(d.toISOString().slice(0, 10));
  }
  const dayResults = await Promise.all(
    dayStrs.map(dayStr => env.ARTICLES.list({ prefix: `reaction-log:${dayStr}:` }))
  );
  dayStrs.forEach((dayStr, i) => {
    dailyCounts.push({ date: dayStr, count: dayResults[i].keys.length });
  });

  return json({
    totalsByType,
    topArticle,
    dailyCounts,
    totalReactions: Object.values(totalsByType).reduce((a, b) => a + b, 0)
  });
}
