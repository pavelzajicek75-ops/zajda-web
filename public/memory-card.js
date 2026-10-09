/* Karta „Před rokem“ / „Z archivu“ na úvodní stránce.
   Najde článek, který vyšel kolem dnešního data v minulých letech;
   když žádný takový není, vybere pro každý den jeden starší článek
   z archivu (stejný celý den, další den jiný). Vloží se nad sekce. */
(function () {
  'use strict';

  function esc(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function plain(html) { return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
  function when(a) {
    var d = new Date(a.date || a.created);
    return isNaN(d.getTime()) ? null : d;
  }
  var DAY = 86400000;

  function pick(articles, now) {
    var today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    var best = null;
    articles.forEach(function (a) {
      var d = when(a); if (!d) return;
      var years = now.getFullYear() - d.getFullYear();
      if (years < 1) return;
      // stejné datum v letošním roce — vzdálenost ve dnech (±7 dní)
      var same = Date.UTC(now.getFullYear(), d.getMonth(), d.getDate());
      var diff = Math.abs(same - today) / DAY;
      if (diff <= 7 && (!best || diff < best.diff)) best = { a: a, diff: diff, years: years };
    });
    if (best) {
      var y = best.years;
      return { a: best.a, label: '📅 Před ' + (y === 1 ? 'rokem' : y + ' lety') };
    }
    var old = articles.filter(function (a) {
      var d = when(a); return d && (today - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) > 30 * DAY;
    });
    if (!old.length) return null;
    old.sort(function (x, y) { return String(x.id) < String(y.id) ? -1 : 1; }); // stabilní pořadí
    var seed = Math.floor(today / DAY);
    return { a: old[seed % old.length], label: '🗂️ Z archivu' };
  }

  function style() {
    if (document.getElementById('memory-card-style')) return;
    var s = document.createElement('style');
    s.id = 'memory-card-style';
    s.textContent =
      '.memory-card{display:flex;gap:14px;align-items:center;max-width:760px;margin:18px auto 6px;padding:12px 16px;' +
      'border-radius:14px;text-decoration:none;color:inherit;background:var(--panel-solid,rgba(28,29,48,.92));' +
      'border:1px solid var(--panel-border,rgba(140,150,255,.18));transition:transform .25s,border-color .25s}' +
      '.memory-card:hover,.memory-card:focus-visible{transform:translateY(-2px);border-color:var(--ember,#ff7a45)}' +
      '.memory-card img{width:72px;height:72px;object-fit:cover;border-radius:10px;flex-shrink:0}' +
      '.memory-card .mc-label{font:600 12px "Space Grotesk",sans-serif;color:var(--nova,#2fe6c9);letter-spacing:.04em}' +
      '.memory-card .mc-title{font:700 16px "Space Grotesk",sans-serif;color:var(--parchment,#f8f5ef);margin:2px 0}' +
      '.memory-card .mc-ex{font-size:13px;opacity:.75;line-height:1.4}' +
      '@media(max-width:640px){.memory-card{margin:14px 12px 4px}.memory-card img{width:56px;height:56px}}';
    document.head.appendChild(s);
  }

  async function init() {
    if (document.querySelector('.memory-card')) return;
    var anchor = document.getElementById('sectionsContainer');
    if (!anchor) return;
    var list;
    try {
      var r = await fetch('/api/articles/list');
      if (!r.ok) return;
      list = await r.json();
    } catch (e) { return; }
    var articles = (Array.isArray(list) ? list : []).filter(function (a) {
      return a && a.published !== false && a.id != null;
    });
    var res = pick(articles, new Date());
    if (!res) return;
    var a = res.a;
    var ex = (a.excerpt && a.excerpt.trim()) || plain(a.content).slice(0, 110);
    var img = '';
    if (a.coverUrl) {
      img = '<img alt="" loading="lazy" ' +
        (typeof thumbImgAttrs === 'function' ? thumbImgAttrs(a.coverUrl) : 'src="' + esc(a.coverUrl) + '"') + '>';
    }
    style();
    var el = document.createElement('a');
    el.className = 'memory-card';
    el.href = '/article?id=' + encodeURIComponent(a.id);
    el.innerHTML = img + '<div><div class="mc-label">' + res.label + '</div>' +
      '<div class="mc-title">' + esc(a.title || 'Bez názvu') + '</div>' +
      (ex ? '<div class="mc-ex">' + esc(ex) + (ex.length >= 110 ? '…' : '') + '</div>' : '') + '</div>';
    anchor.parentNode.insertBefore(el, anchor);
  }

  window.MemoryCard = { pick: pick };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
