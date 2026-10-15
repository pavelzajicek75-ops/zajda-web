// functions/timeline/index.js
//
// Stránka milníků je statická, takže každý odkaz na ni by se při sdílení tvářil stejně.
// Když je v adrese ?m=<id milníku>, tady se do <head> doplní nadpis, popis a obrázek
// právě toho milníku — WhatsApp, Messenger a spol. pak ukážou hezkou kartu s jeho názvem a fotkou.
// Bez ?m=… se stránka vrací beze změny.

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function strip(html) { return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function setMeta(html, attr, name, value) {
  const re = new RegExp('(<meta\\s+' + attr + '="' + name.replace(/[:.]/g, '\\$&') + '"\\s+content=")[^"]*(")', 'i');
  return re.test(html) ? html.replace(re, (_, a, b) => a + esc(value) + b) : html;
}

export async function onRequestGet({ request, env }) {
  const res = await env.ASSETS.fetch(request);
  try {
    const url = new URL(request.url);
    const id = String(url.searchParams.get('m') || '').replace(/[^\w-]/g, '');
    if (!id || !res.ok || !(res.headers.get('content-type') || '').includes('text/html')) return res;
    const m = await env.ARTICLES.get('timeline:' + id, { type: 'json' });
    if (!m || !m.title) return res;

    const siteTitle = 'Moje diagnóza, můj vesmír';
    const title = String(m.title).trim().slice(0, 120);
    const desc = (strip(m.text).slice(0, 160)) || 'Klíčové milníky, jeden po druhém.';
    const photo = (Array.isArray(m.photos) && m.photos[0]) || m.photoUrl || '';
    const raw = photo ? (/^https?:\/\//i.test(photo) ? photo : url.origin + photo) : (url.origin + '/images/og-cover.jpg');
    const image = photo
      ? url.origin + '/og-image?title=' + encodeURIComponent(title) + '&section=' + encodeURIComponent('Milník') + '&image=' + encodeURIComponent(raw)
      : raw;
    const pageUrl = url.origin + '/timeline/?m=' + encodeURIComponent(id);

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
