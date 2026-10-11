/* Pomůcky pro čtení článků:
   – ukazatel postupu čtení (tenký proužek nahoře) u delších textů,
   – rozklikávací obsah podle nadpisů u dlouhých článků s aspoň 3 nadpisy,
   – lazy loading fotek v textu a doplnění chybějících popisků (alt). */
(function () {
  'use strict';
  function wordsOf(node) { var t = (node.textContent || '').trim(); return t ? t.split(/\s+/).length : 0; }

  function images(body, article) {
    var imgs = body.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (i > 0 && !im.getAttribute('loading')) im.setAttribute('loading', 'lazy');
      if (!im.getAttribute('decoding')) im.setAttribute('decoding', 'async');
      if (!im.hasAttribute('alt') || im.getAttribute('alt') === '') im.setAttribute('alt', (article.title || 'Fotka') + ' — fotka ' + (i + 1));
    }
  }

  function toc(body) {
    var hs = body.querySelectorAll('h2, h3');
    if (hs.length < 3 || wordsOf(body) < 600) return;
    if (!document.getElementById('reading-aids-style')) addStyle();
    var d = document.createElement('details'); d.className = 'toc';
    var sum = document.createElement('summary'); sum.textContent = '📑 Obsah článku'; d.appendChild(sum);
    var ul = document.createElement('ul');
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i];
      if (!h.id) h.id = 'cast-' + (i + 1);
      var li = document.createElement('li'); if (h.tagName === 'H3') li.className = 'sub';
      var a = document.createElement('a'); a.href = '#' + h.id; a.textContent = h.textContent;
      a.addEventListener('click', function (e) {
        var t = document.getElementById(this.getAttribute('href').slice(1));
        if (t && t.scrollIntoView) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
      li.appendChild(a); ul.appendChild(li);
    }
    d.appendChild(ul);
    body.parentNode.insertBefore(d, body);
  }

  function progress(body) {
    if (wordsOf(body) < 300 || document.getElementById('readProgress')) return;
    if (!document.getElementById('reading-aids-style')) addStyle();
    var bar = document.createElement('div'); bar.id = 'readProgress';
    bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', 'Postup čtení');
    bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100');
    var fill = document.createElement('div'); bar.appendChild(fill);
    document.body.appendChild(bar);
    var ticking = false;
    function update() {
      ticking = false;
      var r = body.getBoundingClientRect();
      var total = r.height - window.innerHeight * 0.6;
      var pct = total > 0 ? Math.min(100, Math.max(0, (-r.top / total) * 100)) : 100;
      fill.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  function addStyle() {
    var s = document.createElement('style'); s.id = 'reading-aids-style';
    s.textContent = '#readProgress{position:fixed;top:0;left:0;right:0;height:3px;z-index:9999;background:transparent;pointer-events:none}' +
      '#readProgress div{height:100%;width:0;background:var(--ember,#ff7a45);transition:width .1s linear}' +
      '.toc{margin:0 0 24px;padding:12px 16px;border-radius:12px;background:var(--panel-solid,rgba(28,29,48,.92));border:1px solid var(--panel-border,rgba(140,150,255,.18))}' +
      '.toc summary{cursor:pointer;font:600 15px "Space Grotesk",sans-serif;color:var(--nova,#2fe6c9)}' +
      '.toc ul{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px}.toc li.sub{margin-left:16px;font-size:14px}' +
      '.toc a{color:var(--parchment,#f8f5ef);text-decoration:none}.toc a:hover,.toc a:focus-visible{color:var(--ember,#ff7a45)}' +
      '.article-body{font-size:calc(17px * var(--rp,1))!important}@media(max-width:640px){.article-body{font-size:calc(16px * var(--rp,1))!important}}' +
      '.article-body.rp-airy{line-height:2.1!important}' +
      '.read-prefs{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap;margin:0 0 14px;font-size:13px;color:var(--mist,#9aa3c0)}' +
      '.read-prefs button{font:500 13px "Space Grotesk",sans-serif;padding:3px 11px;border-radius:14px;cursor:pointer;color:var(--mist,#9aa3c0);background:transparent;border:1px solid var(--panel-border,rgba(140,150,255,.3))}' +
      '.read-prefs button:hover,.read-prefs button[aria-pressed="true"]{color:var(--parchment,#f8f5ef);border-color:var(--ember,#ff7a45)}' +
      '.art-tags{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0}.art-tags a{font-size:13px;padding:4px 12px;border-radius:16px;text-decoration:none;color:var(--nova,#2fe6c9);border:1px solid var(--panel-border,rgba(140,150,255,.3))}' +
      '.art-tags a:hover,.art-tags a:focus-visible{border-color:var(--nova,#2fe6c9)}' +
      '.article-body h2,.article-body h3{scroll-margin-top:16px}';
    document.head.appendChild(s);
  }

  function tags(article, body) {
    if (!Array.isArray(article.tags) || !article.tags.length) return;
    if (!document.getElementById('reading-aids-style')) addStyle();
    var box = document.createElement('div'); box.className = 'art-tags';
    article.tags.forEach(function (t) {
      var a = document.createElement('a'); a.href = '/temata?t=' + encodeURIComponent(t); a.textContent = '#' + t;
      box.appendChild(a);
    });
    body.parentNode.insertBefore(box, body.nextSibling);
  }

  // Nastavení čtení: velikost písma a řádkování (pamatuje se v prohlížeči).
  var STEPS = [0.9, 1, 1.1, 1.2, 1.35];
  function loadPrefs() { try { var p = JSON.parse(localStorage.getItem('readPrefs') || '{}'); return { s: (p.s >= 0 && p.s < STEPS.length) ? p.s : 1, l: p.l === 1 ? 1 : 0 }; } catch (e) { return { s: 1, l: 0 }; } }
  function savePrefs(p) { try { localStorage.setItem('readPrefs', JSON.stringify(p)); } catch (e) {} }
  function applyPrefs(body, p) {
    body.style.setProperty('--rp', String(STEPS[p.s]));
    body.classList.toggle('rp-airy', p.l === 1);
  }
  function prefs(body) {
    if (document.getElementById('readPrefsBar')) return;
    if (!document.getElementById('reading-aids-style')) addStyle();
    var p = loadPrefs(); applyPrefs(body, p);
    var bar = document.createElement('div'); bar.id = 'readPrefsBar'; bar.className = 'read-prefs';
    function btn(label, title, fn) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = title; b.setAttribute('aria-label', title); b.onclick = fn; return b; }
    var lbl = document.createElement('span'); lbl.textContent = 'Čtení:';
    var minus = btn('A−', 'Menší písmo', function () { if (p.s > 0) { p.s--; savePrefs(p); applyPrefs(body, p); } });
    var plus = btn('A+', 'Větší písmo', function () { if (p.s < STEPS.length - 1) { p.s++; savePrefs(p); applyPrefs(body, p); } });
    var lh = btn('↕ Vzdušněji', 'Přepnout řádkování', function () { p.l = p.l ? 0 : 1; savePrefs(p); applyPrefs(body, p); lh.setAttribute('aria-pressed', String(p.l === 1)); });
    lh.setAttribute('aria-pressed', String(p.l === 1));
    var reset = btn('Obnovit', 'Obnovit výchozí nastavení čtení', function () { p = { s: 1, l: 0 }; savePrefs(p); applyPrefs(body, p); lh.setAttribute('aria-pressed', 'false'); });
    [lbl, minus, plus, lh, reset].forEach(function (e) { bar.appendChild(e); });
    body.parentNode.insertBefore(bar, body);
  }

  // „Den N od diagnózy“ podle data článku (viz diagnosis-counter.js).
  function dayMeta(article, container) {
    var dc = window.DiagnosisCounter;
    var meta = container.querySelector('.article-meta');
    if (!dc || !dc.dayForDate || !meta || meta.querySelector('.meta-day')) return;
    var n = dc.dayForDate(article.date || article.created);
    if (n == null || n < 0) return;
    var sp = document.createElement('span'); sp.className = 'meta-item meta-day';
    sp.textContent = 'Den ' + n.toLocaleString('cs-CZ') + ' od diagnózy';
    sp.title = 'Počítáno od 1. 6. 2026';
    meta.appendChild(sp);
  }

  function mount(article, container) {
    if (!article || !container) return;
    var body = container.querySelector('.article-body');
    if (!body) return;
    dayMeta(article, container);
    images(body, article);
    tags(article, body);
    prefs(body);
    toc(body);
    progress(body);
  }
  window.ReadingAids = { mount: mount };
})();
