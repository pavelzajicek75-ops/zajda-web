/* 🩺 Diagnostika webu: server (bindingy, data, zálohy) + veřejné stránky a service worker. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var ICON = { ok: '✅', warn: '⚠️', fail: '❌' };
  var PAGES = ['/', '/about', '/mapa', '/cesty', '/fotomapa', '/galerie', '/rok', '/nejctenejsi', '/temata', '/rss.xml', '/sitemap.xml', '/api/articles/list', '/api/quotes/public-list'];

  async function run() {
    var box = $('selftestResult');
    box.textContent = 'Kontroluji…';
    var rows = [];
    function add(name, status, detail) { rows.push({ name: name, status: status, detail: detail || '' }); }

    try {
      var r = await fetch('/api/admin/selftest');
      if (r.status === 401) { box.textContent = '⚠️ Nejsi přihlášený.'; return; }
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
      j.checks.forEach(function (c) { add(c.name, c.status, c.detail); });
    } catch (e) { add('Server (selftest)', 'fail', e.message); }

    var res = await Promise.all(PAGES.map(function (p) {
      var t0 = performance.now();
      return fetch(p, { cache: 'no-store' }).then(function (x) { return { p: p, ok: x.ok, status: x.status, ms: Math.round(performance.now() - t0) }; })
        .catch(function (e) { return { p: p, ok: false, status: 0, ms: 0, err: e.message }; });
    }));
    res.forEach(function (x) { add('Stránka ' + x.p, x.ok ? (x.ms > 3000 ? 'warn' : 'ok') : 'fail', x.ok ? x.ms + ' ms' : ('HTTP ' + x.status + (x.err ? ' ' + x.err : ''))); });

    try {
      var sw = await (await fetch('/sw.js', { cache: 'no-store' })).text();
      var m = sw.match(/SW_VERSION\s*=\s*'([^']+)'/);
      var reg = ('serviceWorker' in navigator) ? await navigator.serviceWorker.getRegistration('/') : null;
      add('Service worker', reg ? 'ok' : 'warn', 'na serveru ' + (m ? m[1] : '?') + (reg ? ', v tomto prohlížeči zaregistrovaný' : ', v tomto prohlížeči nezaregistrovaný (otevři veřejný web)'));
    } catch (e) { add('Service worker', 'warn', e.message); }

    var worst = rows.some(function (x) { return x.status === 'fail'; }) ? 'fail' : (rows.some(function (x) { return x.status === 'warn'; }) ? 'warn' : 'ok');
    box.innerHTML = '<p style="margin:.2rem 0 .6rem;font-weight:600">' + ICON[worst] + ' ' + (worst === 'ok' ? 'Všechno v pořádku' : worst === 'warn' ? 'Funguje, ale je tu pár upozornění' : 'Něco nefunguje') + '</p>' +
      rows.map(function (x) {
        return '<div style="border-top:1px solid var(--border-soft,#263252);padding:4px 0;font-size:13px">' + ICON[x.status] + ' ' + esc(x.name) +
          (x.detail ? ' <span style="color:var(--text-muted)">— ' + esc(x.detail) + '</span>' : '') + '</div>';
      }).join('');
  }

  function mount() {
    var host = $('admin');
    if (!host || $('selftestBox')) return;
    var box = document.createElement('div');
    box.id = 'selftestBox';
    box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">🩺 Diagnostika webu</h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.6rem">Zkontroluje nastavení Cloudflare, data, zálohy a dostupnost veřejných stránek. Nic nezapisuje.</p>' +
      '<button class="btn btn-blue btn-sm" id="selftestBtn">🩺 Spustit kontrolu</button><div id="selftestResult" style="margin-top:.6rem"></div>';
    host.appendChild(box);
    $('selftestBtn').onclick = run;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
