/* Týdenní souhrn — jen pro tebe, počítá se v prohlížeči z existujících dat:
   návštěvy, nové články, komentáře, srdíčka, nejčtenější článek a nálada. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function isoWeekKey(d) {
    var t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    var dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn);
    var ys = Date.UTC(t.getUTCFullYear(), 0, 1);
    return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - ys) / 86400000 + 1) / 7)).padStart(2, '0');
  }
  function plural(n, a, b, c) { return n === 1 ? a : (n >= 2 && n <= 4 ? b : c); }
  function delta(cur, prev) {
    if (!prev && !cur) return '';
    if (!prev) return ' <span style="color:#10b981">↑ nově</span>';
    var p = Math.round((cur - prev) / prev * 100);
    return ' <span style="color:' + (p >= 0 ? '#10b981' : '#f59e0b') + '">' + (p >= 0 ? '↑ +' : '↓ ') + p + ' %</span>';
  }

  async function load() {
    var box = $('weeklyResult');
    box.textContent = 'Počítám…';
    var arts = [], pending = [], mood = [];
    try {
      var rs = await Promise.all([fetch('/api/articles/list'), fetch('/api/comments/pending'), fetch('/api/mood/list')]);
      if (!rs[0].ok) throw new Error('HTTP ' + rs[0].status);
      arts = await rs[0].json();
      if (rs[1].ok) pending = await rs[1].json();
      if (rs[2].ok) mood = await rs[2].json();
    } catch (e) { box.textContent = '⚠️ ' + e.message; return; }
    arts = Array.isArray(arts) ? arts : []; mood = Array.isArray(mood) ? mood : [];

    var now = new Date(), day = 86400000;
    var wk = isoWeekKey(now), pw = isoWeekKey(new Date(now.getTime() - 7 * day));
    function vw(a, w) { return (a.viewsByWeek && a.viewsByWeek[w]) || 0; }
    var vCur = arts.reduce(function (n, a) { return n + vw(a, wk); }, 0);
    var vPrev = arts.reduce(function (n, a) { return n + vw(a, pw); }, 0);
    var top = arts.slice().sort(function (x, y) { return vw(y, wk) - vw(x, wk); })[0];
    var newArts = arts.filter(function (a) { return a.published !== false && now - (a.created || 0) < 7 * day; });
    var comments = 0;
    arts.forEach(function (a) { (a.comments || []).forEach(function (c) { if (now - (c.created || 0) < 7 * day) comments++; }); });
    var topLiked = arts.slice().sort(function (x, y) { return (y.likes || 0) - (x.likes || 0); })[0];
    var totalLikes = arts.reduce(function (n, a) { return n + (a.likes || 0); }, 0);

    function ds(d) { var p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
    var from = ds(new Date(now.getTime() - 6 * day)), prevFrom = ds(new Date(now.getTime() - 13 * day));
    function avg(list) { return list.length ? list.reduce(function (n, e) { return n + (e.mood || 0); }, 0) / list.length : null; }
    var m1 = mood.filter(function (e) { return e.date >= from; }), m0 = mood.filter(function (e) { return e.date >= prevFrom && e.date < from; });
    var a1 = avg(m1), a0 = avg(m0);

    var rows = [
      ['👁️ Zobrazení tento týden', vCur + delta(vCur, vPrev) + ' <span style="color:var(--text-muted)">(minulý týden ' + vPrev + ')</span>'],
      ['✍️ Nové články (7 dní)', String(newArts.length) + (newArts.length ? ' — ' + newArts.map(function (a) { return esc(a.title || 'Bez názvu'); }).join(', ') : '')],
      ['🔥 Nejčtenější tento týden', top && vw(top, wk) ? esc(top.title || 'Bez názvu') + ' (' + vw(top, wk) + '×)' : '—'],
      ['💬 Komentáře (7 dní)', comments + ' ' + plural(comments, 'schválený', 'schválené', 'schválených') + ', čeká ' + (Array.isArray(pending) ? pending.length : 0)],
      ['❤️ Srdíčka celkem', totalLikes + (topLiked && topLiked.likes ? ' — nejvíc: ' + esc(topLiked.title || '') + ' (' + topLiked.likes + ')' : '')],
      ['🙂 Nálada (7 dní)', a1 == null ? 'bez záznamů' : (a1.toFixed(1) + ' / 5 (' + m1.length + ' ' + plural(m1.length, 'záznam', 'záznamy', 'záznamů') + ')' + (a0 != null ? ' <span style="color:var(--text-muted)">minule ' + a0.toFixed(1) + '</span>' : ''))]
    ];
    box.innerHTML = '<table style="font-size:13px;border-collapse:collapse;width:100%">' + rows.map(function (r) {
      return '<tr style="border-top:1px solid var(--border-soft,#263252)"><td style="padding:6px 12px 6px 0;white-space:nowrap;vertical-align:top">' + r[0] + '</td><td style="padding:6px 0">' + r[1] + '</td></tr>';
    }).join('') + '</table>';
  }

  function mount() {
    var host = $('admin');
    if (!host || $('weeklyBox')) return;
    var box = document.createElement('div');
    box.id = 'weeklyBox';
    box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">🗓️ Týdenní souhrn</h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.6rem">Přehled posledního týdne jen pro tebe — nic se nikam neposílá.</p>' +
      '<button class="btn btn-sm" id="weeklyBtn">🗓️ Zobrazit souhrn</button><div id="weeklyResult" style="margin-top:.6rem"></div>';
    host.appendChild(box);
    $('weeklyBtn').onclick = load;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
