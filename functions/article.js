// functions/article.js
//
// Cloudflare Pages Function pro cestu /article (tzn. odkazy tvaru
// /article?id=...). Doplňuje do <head> statického article.html SKUTEČNÉ
// meta tagy podle konkrétního článku — title, description, Open Graph,
// Twitter kartu — ještě PŘED tím, než HTML opustí server.
//
// PROČ je tohle potřeba: article.html renderuje obsah teprve JS-em po
// načtení stránky (fetch /api/articles/list → najde článek → vloží HTML).
// Prohlížeč to zvládne v pohodě, ale scrapery sociálních sítí (WhatsApp,
// Facebook, X/Twitter, Messenger...) JS nespouští — vidí jen to, co je
// v <head> hned na začátku odpovědi. Bez týhle Function by sdílení
// odkazu na KAŽDÝ článek ukázalo jen obecný homepage náhled (stejný
// nadpis/popisek/obrázek pro všechny), ne skutečný název, popisek a
// titulní fotku toho konkrétního článku.
//
// JAK TO FUNGUJE: necháme Cloudflare Pages doručit původní statický
// article.html přes env.ASSETS (standardní binding pro přístup ke
// statickým souborům zevnitř Function, obchází běžné routování — takže
// nehrozí nekonečná smyčka volání sebe sama). Do vráceného HTML textu
// pak jen přepíšeme pár řádků v <head> podle dat z veřejného
// /api/articles/list (stejný endpoint, co používá i klientský JS —
// takže žádná závislost na tom, jak přesně máš články uložené na
// backendu).
//
// ⚠️ POZOR: pokud je tahle cesta u tebe obsluhovaná jinak (např. přes
// _redirects na /article.html, nebo přes jiný routing), možná bude
// potřeba soubor přejmenovat/přesunout, ať sedí s tím, jak Cloudflare
// Pages tuhle URL doopravdy směruje. Pages Functions mají přednost před
// statickými soubory na stejné cestě, takže běžný případ (čistá URL
// /article díky "Clean URLs" nastavení) by měl fungovat bez úprav.

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const articleId = url.searchParams.get('id');

  // Vždycky nejdřív natáhnout původní statickou stránku — je to fallback
  // pro všechny případy, kdy nemáme co (nebo není proč) přepisovat.
  const assetResponse = await env.ASSETS.fetch(request);

  if (!articleId) return assetResponse;

  let article = null;
  try {
    const apiRes = await fetch(new URL('/api/articles/list', url.origin));
    if (apiRes.ok) {
      const list = await apiRes.json();
      const arr = Array.isArray(list) ? list : (list.articles || []);
      article = arr.find(a => a && a.id != null && String(a.id) === String(articleId) && a.published !== false) || null;
    }
  } catch (e) {
    // Selhání API tady nemá zablokovat zobrazení stránky — jen se
    // nevloží vlastní meta tagy a klient si obsah dotáhne sám jako dřív.
  }

  if (!article) return assetResponse;

  let html = await assetResponse.text();

  const siteTitle = 'Moje diagnóza, můj vesmír';
  const title = (article.title || 'Bez názvu').trim();
  const fullTitle = title + ' — ' + siteTitle;
  const description = (article.excerpt && article.excerpt.trim())
    || stripHtml(article.content).slice(0, 160)
    || 'Osobní blog Zajdy — zápisky z cest, fotky a příběhy ze života s diagnózou.';
  const rawImage = article.coverUrl || (url.origin + '/images/og-cover.jpg');
  const pageUrl = url.origin + '/article?id=' + encodeURIComponent(article.id);
  const sectionNames = { travel: 'Cestování', photo: 'Fotografování', projects: 'Projekty', about: 'O Zajdovi' };
  const sectionName = sectionNames[article.sectionId] || '';
  // Sdílený náhled teď není jen syrová titulní fotka, ale vygenerovaná
  // "cover karta" s nadpisem přes ni (viz functions/og-image.js) — pokud
  // by generování z nějakého důvodu selhalo, ta Function sama fallbackne
  // na rawImage, takže tohle je bezpečné i kdyby og-image.js měla problém.
  const image = url.origin + '/og-image?title=' + encodeURIComponent(title)
    + '&section=' + encodeURIComponent(sectionName)
    + '&image=' + encodeURIComponent(rawImage);

  // 1) <title> — nahradí statický "Článek — Moje diagnóza, můj vesmír"
  html = html.replace(
    /<title>[^<]*<\/title>/,
    '<title>' + escapeAttr(fullTitle) + '</title>'
  );

  // 2) Meta tagy se vloží hned za <meta name="viewport" ...> — ten tag
  //    je v šabloně vždycky přítomný hned na začátku <head>, takže je to
  //    stabilní a bezpečná kotva pro vložení.
  const metaBlock =
    '\n  <meta name="description" content="' + escapeAttr(description) + '">' +
    '\n  <link rel="canonical" href="' + escapeAttr(pageUrl) + '">' +
    '\n  <meta property="og:type" content="article">' +
    '\n  <meta property="og:site_name" content="' + escapeAttr(siteTitle) + '">' +
    '\n  <meta property="og:title" content="' + escapeAttr(title) + '">' +
    '\n  <meta property="og:description" content="' + escapeAttr(description) + '">' +
    '\n  <meta property="og:url" content="' + escapeAttr(pageUrl) + '">' +
    '\n  <meta property="og:image" content="' + escapeAttr(image) + '">' +
    '\n  <meta property="og:locale" content="cs_CZ">' +
    '\n  <meta name="twitter:card" content="summary_large_image">' +
    '\n  <meta name="twitter:title" content="' + escapeAttr(title) + '">' +
    '\n  <meta name="twitter:description" content="' + escapeAttr(description) + '">' +
    '\n  <meta name="twitter:image" content="' + escapeAttr(image) + '">' +
    // Preload jen když má ČLÁNEK vlastní titulní fotku (article.coverUrl) —
    // ne obecný fallback og-cover.jpg, ten by se preloadoval na každém
    // článku bez fotky zbytečně. Fotka se teď zobrazuje i jako hero
    // banner nahoře v article.html, takže preload reálně zrychlí, kdy ji
    // uživatel uvidí (LCP).
    (article.coverUrl ? '\n  <link rel="preload" as="image" href="' + escapeAttr(article.coverUrl) + '">' : '');

  html = html.replace(
    /(<meta name="viewport"[^>]*>)/,
    '$1' + metaBlock
  );

  return new Response(html, {
    status: assetResponse.status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Krátká cache — články se sem tam editují (nadpis, popisek, foto),
      // ať se změny na sociálních sítích projeví v rozumné době, ne až
      // za týden.
      'cache-control': 'public, max-age=60'
    }
  });
}
