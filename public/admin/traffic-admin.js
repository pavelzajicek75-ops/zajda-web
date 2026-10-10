/* Návštěvnost po týdnech — panel v administraci (záložka se stavem webu).
   Data jsou přímo v článcích: views (celkem) a viewsByWeek (od nasazení
   této funkce). Žádné cookies, žádná cizí služba. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function isoWeekKey(d) {
    var t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    var dayNum = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dayNum);
    var yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
    var week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
    return t.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
  }
  function lastWeeks(n) {
    var out = [], d = new Date();
    for (var i = n - 1; i >= 0; i--) out.push(isoWeekKey(new Date(d.getTime() - i * 7 * 86400000)));
    return out;
  }

  async function load() {
    var box = $('trafficResult');
    box.textContent = 'Načítám…';
    var list;
    try {
      var r = await fetch('/api/articles/list');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      list = await r.json();
    } catch (e) { box.textContent = '⚠️ ' + e.message; return; }
    list = Array.isArray(list) ? list : [];

    var weeks = lastWeeks(12);
    var totals = weeks.map(function (w) {
      return list.reduce(function (n, a) { return n + ((a.viewsByWeek && a.viewsByWeek[w]) || 0); }, 0);
    });
    var max = Math.max.apply(null, totals.concat([1]));
    var allViews = list.reduce(function (n, a) { return n + (a.views || 0); }, 0);

    var last4 = weeks.slice(-4);
    var top = list.map(function (a) {
      var recent = last4.reduce(function (n, w) { return n + ((a.viewsByWeek && a.viewsByWeek[w]) || 0); }, 0);
      return { a: a, recent: recent, total: a.views || 0 };
    }).filter(function (x) { return x.total > 0; })
      .sort(function (x, y) { return (y.recent - x.recent) || (y.total - x.total); }).slice(0, 8);

    var bars = '<div style="display:flex;align-items:flex-end;gap:5px;height:120px;margin:.5rem 0">' +
      totals.map(function (v, i) {
        return '<div title="' + esc(weeks[i]) + ': ' + v + '" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%">' +
          '<span style="font-size:11px;color:var(--text-muted)">' + (v || '') + '</span>' +
          '<div style="width:100%;max-width:34px;height:' + Math.round(v / max * 100) + '%;min-height:2px;background:var(--nova,#2fe6c9);border-radius:5px 5px 2px 2px"></div>' +
          '<span style="font-size:10px;color:var(--text-faint);margin-top:4px">' + esc(weeks[i].slice(-3)) + '</span></div>';
      }).join('') + '</div>';

    box.innerHTML =
      '<p style="font-size:13px;color:var(--text-muted)">Celkem zobrazení všech článků: <b>' + allViews.toLocaleString('cs') +
      '</b> · týdenní přehled se počítá od nasazení téhle funkce, starší zobrazení v něm nejsou. Tvoje vlastní návštěvy (přihlášený admin) se nepočítají.</p>' +
      bars +
      '<h4 style="margin:.9rem 0 .4rem;font-size:14px">Nejčtenější v posledních 4 týdnech</h4>' +
      (top.length ? '<ol style="margin-left:1.2rem;font-size:13.5px;line-height:1.6">' + top.map(function (x) {
        return '<li>' + esc(x.a.title || 'Bez názvu') + ' — <b>' + x.recent + '</b> <span style="opacity:.6">(celkem ' + x.total + ')</span></li>';
      }).join('') + '</ol>' : '<p style="font-size:13px;color:var(--text-muted)">Zatím žádná data.</p>');
  }

  function mount() {
    var host = $('admin');
    if (!host || $('trafficBox')) return;
    var box = document.createElement('div');
    box.id = 'trafficBox';
    box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">📈 Návštěvnost</h3>' +
      '<button class="btn btn-sm" id="trafficBtn">📈 Zobrazit návštěvnost</button>' +
      '<div id="trafficResult" style="margin-top:.6rem"></div>';
    host.appendChild(box);
    $('trafficBtn').onclick = load;
  }
  window.TrafficAdmin = { isoWeekKey: isoWeekKey };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
