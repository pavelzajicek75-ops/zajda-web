/* Výběr článku „Před rokem“ / „Z archivu“ pro panel Poslední aktuality.
   Najde článek, který vyšel kolem dnešního data v minulých letech;
   když žádný takový není, vybere pro každý den jeden starší článek
   z archivu (stejný celý den, další den jiný). Nic nevkládá do stránky —
   použije to loadLatest() v index.html. */
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

  window.MemoryCard = { pick: pick };
})();
