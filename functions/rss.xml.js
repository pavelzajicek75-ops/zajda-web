// Cloudflare Pages Function — vytvoří RSS feed z posledních článků.
// Umísti tento soubor do /functions/rss.xml.js ve svém repu/projektu.
// Cloudflare Pages ho automaticky namapuje na cestu /rss.xml.

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
    // prázdný feed je lepší než rozbitý — vrátí se aspoň platné XML níže
  }

  const items = articles
    .filter(a => a.published !== false)
    .sort((a, b) => {
      const da = a.date || a.created || '';
      const db = b.date || b.created || '';
      return da < db ? 1 : da > db ? -1 : 0;
    })
    .slice(0, 30)
    .map(a => {
      const link = origin + '/article?id=' + encodeURIComponent(a.id);
      const pubDate = a.date || a.created ? new Date(a.date || a.created).toUTCString() : '';
      const excerpt = (a.content || '').replace(/<[^>]+>/g, '').slice(0, 300);
      return `  <item>
    <title>${escapeXml(a.title || 'Bez názvu')}</title>
    <link>${escapeXml(link)}</link>
    <guid isPermaLink="true">${escapeXml(link)}</guid>
${pubDate ? `    <pubDate>${pubDate}</pubDate>\n` : ''}    <description>${escapeXml(excerpt)}</description>
  </item>`;
    });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Moje diagnóza, můj vesmír</title>
  <link>${escapeXml(origin + '/')}</link>
  <description>Osobní blog Zajdy — zápisky z cest, fotky a příběhy ze života s diagnózou.</description>
  <language>cs</language>
${items.join('\n')}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=UTF-8',
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
