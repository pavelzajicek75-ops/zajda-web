// functions/vylet.js
//
// Sdílecí náhled výletu (/vylet?s=<sekce>&sub=<podsekce>): scrapery sociálních sítí
// nespouštějí JS, takže jim do <head> statického vylet.html vložíme pravé meta tagy
// (název podsekce, počet dílů a km, obálka). Stejný princip jako functions/article.js.
// Při jakékoli chybě se vrací původní statická stránka — nic se nerozbije.

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function ok(p) { return p && typeof p.lat === 'number' && isFinite(p.lat) && typeof p.lng === 'number' && isFinite(p.lng); }
function hav(a, b) {
  const R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function ts(a) { if (a.date) { const t = new Date(a.date).getTime(); if (!isNaN(t)) return t; } return typeof a.created === 'number' ? a.created : 0; }
function plural(n, one, few, many) { return n === 1 ? one : (n >= 2 && n <= 4 ? few : many); }

export async function onRequestGet(context) {
  const { request, env } = context;
  const response = await env.ASSETS.fetch(request);
  try {
    const url = new URL(request.url);
    const sub = url.searchParams.get('sub'), sec = url.searchParams.get('s') || '';
    if (!sub) return response;
    const res = await fetch(new URL('/api/articles/list', url.origin));
    if (!res.ok) return response;
    const raw = await res.json();
    const arts = (Array.isArray(raw) ? raw : (raw.articles || []))
      .filter(a => a && a.published !== false && !a.unlisted && String(a.subsectionId || '') === sub && (!sec || String(a.sectionId || '') === sec))
      .sort((a, b) => (ts(a) - ts(b)) || ((a.created || 0) - (b.created || 0)));
    if (!arts.length) return response;

    let name = 'Výlet', description = '', cover = '';
    try {
      const rs = await fetch(new URL('/api/subsections/by-section?sectionId=' + encodeURIComponent(sec || arts[0].sectionId || ''), url.origin));
      if (rs.ok) {
        const s = (await rs.json()).find(x => String(x.id) === sub);
        if (s) { name = s.name || name; description = s.description || ''; cover = s.coverUrl || ''; }
      }
    } catch (e) { /* bez názvu */ }

    let km = 0, prev = null;
    arts.forEach(a => {
      const st = (Array.isArray(a.stops) && a.stops.length >= 2 ? a.stops : [a]).filter(ok);
      st.forEach(p => { if (prev) km += hav(prev, p); prev = p; });
    });
    if (!cover) cover = (arts.find(a => a.coverUrl) || {}).coverUrl || '';
    const n = arts.length;
    const facts = n + ' ' + plural(n, 'díl', 'díly', 'dílů') + (km > 1 ? ' • ' + Math.round(km) + ' km' : '');
    const desc = (description ? description + ' ' : '') + '🧭 ' + facts + ' — celý výlet na mapě.';
    const siteTitle = 'Moje diagnóza, můj vesmír';
    const rawImage = cover ? (/^https?:\/\//i.test(cover) ? cover : url.origin + cover) : url.origin + '/images/og-cover.jpg';
    const image = url.origin + '/og-image?title=' + encodeURIComponent(name) + '&section=' + encodeURIComponent('Výlet · ' + facts) + '&image=' + encodeURIComponent(rawImage);
    const pageUrl = url.origin + '/vylet?s=' + encodeURIComponent(sec) + '&sub=' + encodeURIComponent(sub);

    let html = await response.text();
    html = html.replace(/<title>[^<]*<\/title>/, '<title>' + esc(name + ' — ' + siteTitle) + '</title>');
    const meta =
      '\n  <meta name="description" content="' + esc(desc) + '">' +
      '\n  <link rel="canonical" href="' + esc(pageUrl) + '">' +
      '\n  <meta property="og:type" content="website">' +
      '\n  <meta property="og:site_name" content="' + esc(siteTitle) + '">' +
      '\n  <meta property="og:title" content="' + esc(name) + '">' +
      '\n  <meta property="og:description" content="' + esc(desc) + '">' +
      '\n  <meta property="og:url" content="' + esc(pageUrl) + '">' +
      '\n  <meta property="og:image" content="' + esc(image) + '">' +
      '\n  <meta property="og:locale" content="cs_CZ">' +
      '\n  <meta name="twitter:card" content="summary_large_image">' +
      '\n  <meta name="twitter:title" content="' + esc(name) + '">' +
      '\n  <meta name="twitter:description" content="' + esc(desc) + '">' +
      '\n  <meta name="twitter:image" content="' + esc(image) + '">';
    if (!/<meta name="viewport"[^>]*>/.test(html)) return new Response(html, { status: response.status, headers: response.headers });
    html = html.replace(/(<meta name="viewport"[^>]*>)/, '$1' + meta);
    return new Response(html, { status: response.status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' } });
  } catch (e) {
    return response;
  }
}
