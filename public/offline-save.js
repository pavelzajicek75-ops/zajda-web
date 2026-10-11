/* „Uložit na offline“ — čtenář si uloží článek (stránku, data a fotky) do
   prohlížeče a přečte ho i bez signálu. Ukládá se do cache 'zajda-offline',
   kterou service worker (sw.js) používá, když není síť. */
(function () {
  'use strict';
  var CACHE = 'zajda-offline';
  var supported = typeof caches !== 'undefined' && 'serviceWorker' in navigator;

  function store(id) { try { return JSON.parse(localStorage.getItem('offline:' + id) || 'null'); } catch (e) { return null; } }
  function setStore(id, v) { try { if (v) localStorage.setItem('offline:' + id, JSON.stringify(v)); else localStorage.removeItem('offline:' + id); } catch (e) {} }
  function abs(u) { try { return new URL(u, location.href).href; } catch (e) { return null; } }

  function collectUrls(article) {
    var api = [], imgs = [], seen = {};
    function add(list, u) { var a = abs(u); if (a && !seen[a]) { seen[a] = 1; list.push(a); } }
    try {
      performance.getEntriesByType('resource').forEach(function (e) {
        var u; try { u = new URL(e.name); } catch (x) { return; }
        if (u.origin === location.origin && u.pathname.indexOf('/api/') === 0) {
          if (u.pathname.indexOf('/api/articles/view') === 0 || u.pathname.indexOf('/api/articles/like') === 0 || u.pathname.indexOf('/api/comments') === 0) return;
          add(api, e.name);
        } else if (e.initiatorType === 'img' || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u.pathname)) add(imgs, e.name);
      });
    } catch (e) {}
    try { (window.PhotoStops ? window.PhotoStops.allImages(article) : []).forEach(function (u) { add(imgs, u); }); } catch (e) {}
    return { api: api, imgs: imgs };
  }

  async function put(cache, url) {
    var same = new URL(url).origin === location.origin;
    var r = await fetch(url, same ? undefined : { mode: 'no-cors' });
    if (r.ok || r.type === 'opaque') { await cache.put(url, r); return true; }
    return false;
  }

  async function save(article) {
    var cache = await caches.open(CACHE);
    var c = collectUrls(article);
    var pageUrl = location.href;
    var page = await fetch(pageUrl);
    if (!page.ok) throw new Error('Stránku se nepodařilo stáhnout');
    await cache.put(pageUrl, page);
    try { await put(cache, location.origin + '/offline'); } catch (e) { /* seznam offline čtení je jen bonus */ }
    var done = [], failed = 0;
    for (var i = 0; i < c.api.length; i++) { try { if (await put(cache, c.api[i])) done.push(c.api[i]); else failed++; } catch (e) { failed++; } }
    var imgOk = [];
    for (var j = 0; j < c.imgs.length; j++) { try { if (await put(cache, c.imgs[j])) imgOk.push(c.imgs[j]); else failed++; } catch (e) { failed++; } }
    setStore(article.id, { title: article.title || 'Bez názvu', page: pageUrl, imgs: imgOk, api: done, at: Date.now() });
    return { photos: imgOk.length, failed: failed };
  }

  async function remove(article) {
    var s = store(article.id); if (!s) return;
    var cache = await caches.open(CACHE);
    await cache.delete(s.page);
    for (var i = 0; i < s.imgs.length; i++) await cache.delete(s.imgs[i]);
    setStore(article.id, null);
  }

  function mount(article, container) {
    if (!supported || !article || !container || container.querySelector('.offline-btn')) return;
    if (!document.getElementById('offline-style')) {
      var st = document.createElement('style');
      st.id = 'offline-style';
      st.textContent = '.offline-btn{display:block;margin:12px auto 0;font:500 13px "Space Grotesk",sans-serif;padding:7px 16px;border-radius:22px;cursor:pointer;color:var(--mist,#9aa3c0);background:transparent;border:1px dashed var(--panel-border,rgba(140,150,255,.35))}' +
        '.offline-btn:hover:not(:disabled){color:var(--parchment,#f8f5ef);border-color:var(--ember,#ff7a45)}.offline-btn:disabled{cursor:default;opacity:.7}';
      document.head.appendChild(st);
    }
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'offline-btn';
    function paint(msg) {
      var s = store(article.id);
      btn.textContent = msg || (s ? '✅ Uloženo na offline · zrušit' : '📥 Uložit na offline (čtení bez signálu)');
    }
    paint();
    btn.onclick = async function () {
      btn.disabled = true;
      try {
        if (store(article.id)) { await remove(article); paint(); }
        else {
          paint('Ukládám…');
          var res = await save(article);
          paint('✅ Uloženo na offline · ' + res.photos + ' fotek' + (res.failed ? ' (' + res.failed + ' se nepovedlo)' : '') + ' · zrušit');
        }
      } catch (e) { paint('⚠️ Nepovedlo se uložit'); setTimeout(function () { paint(); }, 3000); }
      btn.disabled = false;
    };
    var link = document.createElement('a'); link.className = 'offline-btn'; link.href = '/offline'; link.textContent = '📚 Moje offline čtení';
    link.style.textDecoration = 'none'; link.style.width = 'fit-content';
    function anySaved() { try { for (var i = 0; i < localStorage.length; i++) if (localStorage.key(i).indexOf('offline:') === 0) return true; } catch (e) {} return false; }
    function showLink() { link.hidden = !anySaved(); }
    var origPaint = paint; paint = function (m) { origPaint(m); showLink(); };
    showLink();
    var host = container.querySelector('.heart-box');
    if (host) { host.appendChild(btn); host.appendChild(link); } else { container.appendChild(btn); container.appendChild(link); }
  }
  window.ArticleOffline = { mount: mount };
})();
