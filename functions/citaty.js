// functions/citaty.js
//
// Sdílený odkaz na citát: /citaty?q=<id citátu>. Stránka je statická, takže se tady do <head>
// doplní text a autor právě toho citátu — WhatsApp, Messenger a spol. ukážou kartu s citátem.
// Bez ?q=… (nebo když citát neexistuje) se stránka vrací beze změny.

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function setMeta(html, attr, name, value) {
  const re = new RegExp('(<meta\\s+' + attr + '="' + name.replace(/[:.]/g, '\\$&') + '"\\s+content=")[^"]*(")', 'i');
  return re.test(html) ? html.replace(re, (_, a, b) => a + esc(value) + b) : html;
}
// stejné id jako v public/quote-tv.js
function qid(t) { let h = 5381; t = String(t).trim(); for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

export async function onRequestGet({ request, env }) {
  const res = await env.ASSETS.fetch(request);
  try {
    const url = new URL(request.url);
    const id = String(url.searchParams.get('q') || '').replace(/[^\w]/g, '');
    if (!id || !res.ok || !(res.headers.get('content-type') || '').includes('text/html')) return res;
    const r = await fetch(new URL('/api/quotes/list', url.origin));
    if (!r.ok) return res;
    const list = await r.json();
    const q = (Array.isArray(list) ? list : []).filter(x => x && x.text && qid(x.text) === id)[0];
    if (!q) return res;

    const siteTitle = 'Moje diagnóza, můj vesmír';
    const text = String(q.text).trim().slice(0, 140);
    const title = '„' + text + '"';
    const desc = (q.author ? '— ' + q.author + ' · ' : '') + 'Signál z hlubokého vesmíru · ' + siteTitle;
    const image = url.origin + '/og-image?title=' + encodeURIComponent(title) + '&section=' + encodeURIComponent(q.author || 'Citát') + '&image=' + encodeURIComponent(url.origin + '/images/og-cover.jpg');
    const pageUrl = url.origin + '/citaty?q=' + id;

    let html = await res.text();
    html = html.replace(/<title>[^<]*<\/title>/, '<title>' + esc(title + ' — ' + siteTitle) + '</title>');
    html = setMeta(html, 'property', 'og:title', title);
    html = setMeta(html, 'property', 'og:description', desc);
    html = setMeta(html, 'property', 'og:url', pageUrl);
    html = setMeta(html, 'property', 'og:image', image);
    html = setMeta(html, 'name', 'twitter:title', title);
    html = setMeta(html, 'name', 'twitter:description', desc);
    html = setMeta(html, 'name', 'twitter:image', image);
    const headers = new Headers(res.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.delete('content-length');
    return new Response(html, { status: 200, headers });
  } catch (e) {
    return res;
  }
}
