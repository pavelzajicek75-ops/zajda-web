// functions/about/index.js
//
// Cloudflare Pages Function pro /about/ — stejný princip jako
// functions/index.js (homepage) a functions/article.js (články):
// text "O Zajdovi" se dřív skládal VÝHRADNĚ přes klientský JS
// (loadAbout() v public/about/index.html), takže v prvotní HTML
// odpovědi crawler viděl jen "Načítání...". <title> a meta description
// tahle stránka už napevno měla ve statickém HTML (v pořádku), chybělo
// jen samotné tělo textu.

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Přesné literální bloky z public/about/index.html — nahrazují se jen
// při přesné shodě; pokud by markup v budoucnu neseděl, úprava se tiše
// přeskočí (stránka funguje dál přesně jako dřív, jen bez SSR obsahu
// navíc — bezpečný fallback, ne rozbité HTML).
const TITLE_PLACEHOLDER = '<h1 id="pageTitle">O Zajdovi</h1>';
const CONTENT_PLACEHOLDER = '<div id="content" class="content loading" tabindex="-1">Načítání...</div>';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const assetResponse = await env.ASSETS.fetch(request);
  let html = await assetResponse.text();

  try {
    const apiRes = await fetch(new URL('/api/about/get', url.origin));
    if (apiRes.ok) {
      const data = await apiRes.json();
      const title = (data && data.title) || 'O Zajdovi';
      const text = (data && data.text) || '';

      if (html.includes(TITLE_PLACEHOLDER)) {
        html = html.replace(TITLE_PLACEHOLDER, '<h1 id="pageTitle">' + escapeAttr(title) + '</h1>');
      }
      // <title> jen když se admin rozhodl titulek přejmenovat na něco
      // jiného než výchozí "O Zajdovi" — ať se zbytečně nepřepisuje
      // stejnou hodnotou, co tam už je.
      if (title !== 'O Zajdovi') {
        html = html.replace(/<title>[^<]*<\/title>/, '<title>' + escapeAttr(title) + ' — Moje diagnóza, můj vesmír</title>');
      }
      if (html.includes(CONTENT_PLACEHOLDER)) {
        const bodyHtml = text ? text : '<p>Zatím žádný obsah.</p>';
        // "loading" třída se rovnou nevkládá — obsah je už hotový, na
        // rozdíl od stavu, kdy na něj čeká klientský JS.
        html = html.replace(CONTENT_PLACEHOLDER, '<div id="content" class="content" tabindex="-1">' + bodyHtml + '</div>');
      }
    }
  } catch (e) {
    // Selhání API nemá zablokovat zobrazení stránky — klient si obsah
    // dotáhne sám přes JS jako dřív, jen bez SSR obsahu navíc.
  }

  return new Response(html, {
    status: assetResponse.status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60'
    }
  });
}
