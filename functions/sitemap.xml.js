// Cloudflare Pages Function — vytvoří dynamickou sitemap.xml
// Umísti tento soubor do /functions/sitemap.xml.js ve svém repu/projektu.
// Cloudflare Pages ho automaticky namapuje na cestu /sitemap.xml.
//
// Sitemapa musí být čisté XML dostupné bez spouštění JS (vyhledávače
// stránku nerenderují jako prohlížeč), proto se seznam článků natahuje
// tady na serveru přes interní volání /api/articles/list, ne v JS na
// klientovi.

export async function onRequestGet(context) {
  const origin = new URL(context.request.url).origin;

  let articles = [];
  try {
    const res = await fetch(origin + '/api/articles/list');
    if (res.ok) {
      const data = await res.json();
      articles = Array.isArray(data) ? data : (data.articles || []);
    }
  } catch (e) {
    // Když se články nepodaří natáhnout, sitemapa se vrátí aspoň se
    // statickými stránkami níže — lepší neúplná sitemapa než žádná.
  }

  const staticUrls = [
    { loc: origin + '/', priority: '1.0', changefreq: 'daily' },
    { loc: origin + '/about/', priority: '0.6', changefreq: 'monthly' }
  ];

  const articleUrls = articles
    .filter(a => a.published !== false)
    .map(a => ({
      loc: origin + '/article?id=' + encodeURIComponent(a.id),
      lastmod: (a.date || a.created || '').split('T')[0] || undefined,
      priority: '0.8',
      changefreq: 'monthly'
    }));

  const allUrls = staticUrls.concat(articleUrls);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ''}    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
