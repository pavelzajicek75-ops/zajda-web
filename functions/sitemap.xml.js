// functions/sitemap.xml.js
//
// GET /sitemap.xml — sitemapa generovaná NAŽIVO ze skutečného seznamu
// článků (/api/articles/list), ne ručně psaný statický soubor, který by
// se musel při každém novém článku aktualizovat ručně a časem by
// zaostával za realitou.
//
// Obsahuje: homepage, /about/, a jednu položku pro každý publikovaný
// článek (/article?id=...) s datem poslední úpravy.

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = url.origin;

  let articles = [];
  try {
    const apiRes = await fetch(new URL('/api/articles/list', origin));
    if (apiRes.ok) {
      const data = await apiRes.json();
      const arr = Array.isArray(data) ? data : (data.articles || []);
      // Skryté koncepty (published === false) nemají do sitemapy co dělat —
      // vyhledávače by je jinak mohly začít indexovat, i když nejsou nikde
      // veřejně odkázané.
      articles = arr.filter(a => a && a.published !== false);
    }
  } catch (e) {
    // Selhání API nemá zablokovat aspoň základní sitemapu (homepage + about).
  }

  const toIso = (d) => {
    if (!d) return null;
    const date = new Date(d);
    return isNaN(date.getTime()) ? null : date.toISOString();
  };

  const staticUrls = [
    { loc: origin + '/', priority: '1.0', changefreq: 'daily' },
    { loc: origin + '/about/', priority: '0.6', changefreq: 'weekly' }
  ];

  const articleUrls = articles.map(a => {
    const lastmod = toIso(a.updated || a.date || a.created);
    return {
      loc: origin + '/article?id=' + encodeURIComponent(a.id),
      lastmod,
      priority: '0.8',
      changefreq: 'monthly'
    };
  });

  const all = staticUrls.concat(articleUrls);

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    all.map(u =>
      '  <url>\n' +
      '    <loc>' + u.loc.replace(/&/g, '&amp;') + '</loc>\n' +
      (u.lastmod ? '    <lastmod>' + u.lastmod + '</lastmod>\n' : '') +
      '    <changefreq>' + u.changefreq + '</changefreq>\n' +
      '    <priority>' + u.priority + '</priority>\n' +
      '  </url>\n'
    ).join('') +
    '</urlset>\n';

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // Hodina cache — sitemapu nikdo nekontroluje v reálném čase, ale
      // ať se nový článek objeví rozumně rychle, ne až za den.
      'cache-control': 'public, max-age=3600'
    }
  });
}
