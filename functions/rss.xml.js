// functions/rss.xml.js
//
// GET /rss.xml — RSS 2.0 feed generovaný NAŽIVO ze skutečného seznamu
// článků. Web na tenhle odkaz odkazuje v <head> (<link rel="alternate"
// type="application/rss+xml">) už od začátku — POZOR: pokud jsi neměl
// (a nemáš) žádný jiný soubor/Function na /rss.xml, byl to dosud mrtvý
// odkaz vedoucí na 404. Tahle Function ho konečně naplní skutečným
// obsahem. Pokud už NĚJAKÝ /rss.xml v projektu máš (ať static soubor
// v public/, nebo jinou Function), tenhle nový by ho měl nahradit — jen
// zkontroluj, že nekolidují dva soubory na stejné cestě.

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = url.origin;
  const siteTitle = 'Moje diagnóza, můj vesmír';
  const siteDescription = 'Osobní blog Zajdy — zápisky z cest, fotky a příběhy ze života s diagnózou.';

  let articles = [];
  try {
    const apiRes = await fetch(new URL('/api/articles/list', origin));
    if (apiRes.ok) {
      const data = await apiRes.json();
      const arr = Array.isArray(data) ? data : (data.articles || []);
      articles = arr.filter(a => a && a.published !== false);
    }
  } catch (e) {
    // Prázdný feed je lepší než chyba 500 — čtečka si aspoň ověří, že kanál existuje.
  }

  articles.sort((a, b) => {
    const da = a.date || a.created || '', db = b.date || b.created || '';
    return da < db ? 1 : da > db ? -1 : 0;
  });
  articles = articles.slice(0, 30); // poslední 30 článků stačí, RSS není archiv

  const toRfc822 = (d) => {
    if (!d) return null;
    const date = new Date(d);
    return isNaN(date.getTime()) ? null : date.toUTCString();
  };

  const items = articles.map(a => {
    const link = origin + '/article?id=' + encodeURIComponent(a.id);
    const description = (a.excerpt && a.excerpt.trim()) || stripHtml(a.content).slice(0, 300);
    const pubDate = toRfc822(a.date || a.created);
    return '  <item>\n' +
      '    <title>' + escapeXml(a.title || 'Bez názvu') + '</title>\n' +
      '    <link>' + escapeXml(link) + '</link>\n' +
      '    <guid isPermaLink="true">' + escapeXml(link) + '</guid>\n' +
      (pubDate ? '    <pubDate>' + pubDate + '</pubDate>\n' : '') +
      '    <description>' + escapeXml(description) + '</description>\n' +
      (a.coverUrl ? '    <enclosure url="' + escapeXml(a.coverUrl) + '" type="image/jpeg"/>\n' : '') +
      '  </item>\n';
  }).join('');

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0">\n' +
    '<channel>\n' +
    '  <title>' + escapeXml(siteTitle) + '</title>\n' +
    '  <link>' + escapeXml(origin + '/') + '</link>\n' +
    '  <description>' + escapeXml(siteDescription) + '</description>\n' +
    '  <language>cs</language>\n' +
    items +
    '</channel>\n' +
    '</rss>\n';

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
}
