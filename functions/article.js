// functions/article.js
//
// Cloudflare Pages Function pro články — obsluhuje OBOJÍ:
//   - /article?id=...   (běžný formát, používá ho zbytek webu)
//   - /article/<id>     (starší formát cesty)
//
// ⚠️ DŘÍV se o /article/<id> starala samostatná functions/article/
// [[catchall]].js. To je v Cloudflare Pages "volitelný catch-all", který
// ale chytá i holé /article (bez ničeho za lomítkem) — takže si o tu
// samou cestu konkurovaly DVĚ funkce najednou. Vyhrávala ta stará
// (catchall), která o meta tazích nic nevěděla, jen zavolala next() a
// servírovala čistý needitovaný article.html — proto se sdílené odkazy
// netvářily podle nastavených dat. Teď je to sloučené na jedno místo,
// soubor functions/article/[[catchall]].js smaž (nebo celou složku
// functions/article/), ať už nikdy nekoliduje.
//
// Doplňuje do <head> statického article.html SKUTEČNÉ meta tagy podle
// konkrétního článku — title, description, Open Graph, Twitter kartu —
// ještě PŘED tím, než HTML opustí server.
//
// PROČ je tohle potřeba: article.html renderuje obsah teprve JS-em po
// načtení stránky (fetch /api/articles/list → najde článek → vloží HTML).
// Prohlížeč to zvládne v pohodě, ale scrapery sociálních sítí (WhatsApp,
// Facebook, X/Twitter, Messenger...) JS nespouští — vidí jen to, co je
// v <head> hned na začátku odpovědi.
//
// JAK TO FUNGUJE: necháme Cloudflare Pages doručit původní statický
// article.html přes env.ASSETS (přístup ke statickým souborům zevnitř
// Function, obchází běžné routování). U cesty /article/<id> na tuhle
// cestu žádný statický soubor neexistuje, takže se request přepíše na
// /article.html, než se pošle do ASSETS. Do vráceného HTML textu pak
// jen přepíšeme pár řádků v <head> podle dat z veřejného
// /api/articles/list (stejný endpoint, co používá i klientský JS).

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

function estimateReadingTime(html) {
  const words = (stripHtml(html).match(/\S+/g) || []).length;
  return Math.max(1, Math.round(words / 200));
}

const SECTION_NAMES = { travel: 'Cestování', photo: 'Fotografování', projects: 'Projekty', about: 'O Zajdovi' };

// Stejná logika jako klientské findPrevNext() v article.html — hledá
// sousední články v RÁMCI STEJNÉ SEKCE, seřazené od nejnovějšího.
function findPrevNext(article, allArticles) {
  const sameSection = allArticles
    .filter(a => String(a.sectionId) === String(article.sectionId))
    .sort((a, b) => {
      const da = a.date || a.created || '', db = b.date || b.created || '';
      return da < db ? 1 : da > db ? -1 : 0;
    });
  const idx = sameSection.findIndex(a => String(a.id) === String(article.id));
  if (idx === -1) return { newer: null, older: null };
  return {
    newer: idx > 0 ? sameSection[idx - 1] : null,
    older: idx < sameSection.length - 1 ? sameSection[idx + 1] : null
  };
}

// Postaví STEJNOU strukturu, jakou by po načtení JS vytvořila klientská
// renderArticle() v article.html — hero fotka, nadpis, meta údaje, text
// článku a odkazy na sousední články. VYNECHÁNO záměrně: miniatura mapy
// (potřebuje Leaflet, nemá smysl pro SEO text), sdílecí tlačítka a
// "Podobné články" (vyžadují JS/složitější logiku) — ty klient po
// načtení stejně hned doplní, tohle je jen "první dojem" pro prohlížeče
// bez JS a pro vyhledávače/crawlery.
function renderArticleBodyHtml(article, allArticles) {
  const title = (article.title || 'Bez názvu').trim();
  const content = article.content || '';
  const date = article.date || article.created || '';
  let dateStr = '';
  if (date) {
    try { dateStr = new Date(date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) {}
  }
  const sectionName = SECTION_NAMES[article.sectionId] || article.sectionId || '';
  const readingMinutes = estimateReadingTime(content);

  let html = '';
  if (article.coverUrl) {
    html += '<img class="article-hero" src="' + escapeAttr(article.coverUrl) + '" alt="' + escapeAttr('Titulní fotografie k článku: ' + title) + '" loading="eager">';
  }
  html += '<div class="article-header">';
  html += '<h1 class="article-title">' + escapeAttr(title) + '</h1>';
  html += '<div class="article-meta">';
  if (sectionName) html += '<span class="meta-badge">' + escapeAttr(sectionName) + '</span>';
  if (dateStr) html += '<span class="meta-item">' + escapeAttr(dateStr) + '</span>';
  html += '<span class="meta-item">📖 ~' + readingMinutes + ' min čtení</span>';
  html += '</div></div>';
  html += '<div class="article-divider"></div>';
  html += '<div class="article-body" id="articleBody">' + content + '</div>';

  if (Array.isArray(allArticles) && allArticles.length) {
    const pn = findPrevNext(article, allArticles);
    const navParts = [];
    if (pn.older) navParts.push('<a class="article-nav-link prev" href="/article?id=' + encodeURIComponent(pn.older.id) + '"><span class="nav-hint">← Starší</span><span class="nav-title-text">' + escapeAttr(pn.older.title || 'Bez názvu') + '</span></a>');
    if (pn.newer) navParts.push('<a class="article-nav-link next" href="/article?id=' + encodeURIComponent(pn.newer.id) + '"><span class="nav-hint">Novější →</span><span class="nav-title-text">' + escapeAttr(pn.newer.title || 'Bez názvu') + '</span></a>');
    if (navParts.length) html += '<div class="article-nav-links' + (navParts.length === 1 ? ' single' : '') + '">' + navParts.join('') + '</div>';
  }

  return html;
}

// Přesný literální blok z article.html (loading spinner, co se má
// nahradit) — viz komentář u volání níže. Musí sedět znak na znak,
// jinak náhrada tiše selže a stránka zůstane jen s meta tagy (bezpečný
//, ne rozbitý stav — viz podmínka `if (html.includes(...))` níže).
const LOADING_PLACEHOLDER =
  '<div class="article-container" id="articleContainer" tabindex="-1">\n' +
  '    <div class="article-loading" id="articleLoading">\n' +
  '      <div class="loading-constellation">\n' +
  '        <svg viewBox="0 0 120 60"><line x1="8" y1="30" x2="60" y2="8"/><line x1="60" y1="8" x2="112" y2="30"/></svg>\n' +
  '        <span class="lc-dot"></span><span class="lc-dot"></span><span class="lc-dot"></span>\n' +
  '      </div>\n' +
  '      <div>Načítání článku…</div>\n' +
  '    </div>\n' +
  '  </div>';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // ID článku ze dvou možných tvarů URL: ?id=... (běžné) nebo /article/<id>
  // (starší cesta, dřív obsluhovaná zvlášť v article/[[catchall]].js).
  let articleId = url.searchParams.get('id');
  if (!articleId && pathname.startsWith('/article/') && pathname !== '/article/') {
    articleId = decodeURIComponent(pathname.slice('/article/'.length));
  }

  // /article/<id> nemá vlastní statický soubor — natáhnout musíme
  // article.html a předstírat, že o něj šlo od začátku.
  const assetRequest = pathname.startsWith('/article/')
    ? new Request(new URL('/article.html', url.origin), request)
    : request;
  const assetResponse = await env.ASSETS.fetch(assetRequest);

  if (!articleId) return assetResponse;

  let article = null;
  let publishedArticles = [];
  try {
    const apiRes = await fetch(new URL('/api/articles/list', url.origin));
    if (apiRes.ok) {
      const list = await apiRes.json();
      const arr = Array.isArray(list) ? list : (list.articles || []);
      publishedArticles = arr.filter(a => a && a.published !== false);
      article = publishedArticles.find(a => a.id != null && String(a.id) === String(articleId)) || null;
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
  // article.coverUrl bývá uložený jako RELATIVNÍ cesta (např.
  // "/api/photos/file?key=..."). V prohlížeči to nevadí (sám si ji
  // doplní vůči aktuální stránce), ale og-image.js běží na serveru a
  // fotku stahuje přes fetch() — Cloudflare Workers relativní URL v
  // fetch() neumí, potřebují vždy plnou adresu i s doménou.
  const rawImage = article.coverUrl
    ? (/^https?:\/\//i.test(article.coverUrl) ? article.coverUrl : url.origin + article.coverUrl)
    : (url.origin + '/images/og-cover.jpg');
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
    (article.coverUrl ? '\n  <link rel="preload" as="image" href="' + escapeAttr(article.coverUrl) + '">' : '') +
    // JSON-LD structured data — dřív se vkládalo jen přes JS
    // (injectArticleJsonLd v article.html), takže ho crawlery bez JS
    // (a i některé rychlé/"lite" prohlížeče Googlu) nikdy neviděly.
    '\n  <script type="application/ld+json" id="articleJsonLd">' + JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description: description,
      image: article.coverUrl ? [rawImage] : undefined,
      datePublished: article.date || article.created || undefined,
      dateModified: article.updated || article.date || article.created || undefined,
      author: { '@type': 'Person', name: 'Zajda' },
      publisher: { '@type': 'Organization', name: siteTitle },
      mainEntityOfPage: pageUrl
    }) + '</script>';

  html = html.replace(
    /(<meta name="viewport"[^>]*>)/,
    '$1' + metaBlock
  );

  // 3) Skutečný text článku místo prázdného loading spinneru — TOHLE je
  // ta část, co uvidí Google/vyhledávače a prohlížeče bez JS hned v
  // první odpovědi ze serveru, ne až po doběhnutí klientského JS.
  // Nahrazuje se jen při přesné shodě literálního bloku — pokud by se
  // markup article.html v budoucnu změnil a přestal sedět, tahle úprava
  // se prostě tiše přeskočí (stránka funguje dál přesně jako dřív, jen
  // bez SSR obsahu) místo aby vyrobila rozbité HTML.
  if (html.includes(LOADING_PLACEHOLDER)) {
    const bodyHtml = renderArticleBodyHtml(article, publishedArticles);
    html = html.replace(
      LOADING_PLACEHOLDER,
      '<div class="article-container" id="articleContainer" tabindex="-1">' + bodyHtml + '</div>'
    );
  }

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
