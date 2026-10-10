/* Kontrola rozbitých fotek a odkazů na jiné články.
   Fotky se ověřují podle seznamu souborů v úložišti (jeden dotaz na galerii,
   žádné stahování fotek). Odkazy vedoucí na jiné weby se nekontrolují —
   prohlížeč to z cizí domény spolehlivě zjistit neumí. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function photoKey(url) {
    try {
      var u = new URL(url, location.origin);
      if (u.pathname !== '/api/photos/file') return null;
      var k = u.searchParams.get('key');
      if (!k) return null;
      return k.indexOf('thumbs/') === 0 ? k.slice(7) : k;
    } catch (e) { return null; }
  }

  function scanArticle(a) {
    var refs = { photos: [], links: [] };
    if (a.coverUrl) refs.photos.push({ url: a.coverUrl, where: 'titulní fotka' });
    var doc = new DOMParser().parseFromString(a.content || '', 'text/html');
    doc.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src'); if (s) refs.photos.push({ url: s, where: 'fotka v textu' }); });
    doc.querySelectorAll('a[href]').forEach(function (l) {
      var h = l.getAttribute('href') || '';
      var m = h.match(/^(?:https?:\/\/[^/]+)?\/article(?:\/|\?id=)([^&#"'\s]+)/);
      if (m) refs.links.push({ id: decodeURIComponent(m[1]), href: h });
    });
    return refs;
  }

  async function run() {
    var out = $('linkcheckResult');
    out.textContent = 'Načítám články…';
    var arts;
    try {
      var r = await fetch('/api/articles/list');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      arts = await r.json();
    } catch (e) { out.textContent = '⚠️ ' + e.message; return; }
    arts = Array.isArray(arts) ? arts : [];

    var scans = arts.map(function (a) { return { a: a, refs: scanArticle(a) }; });

    // Seznamy souborů v úložišti — jen pro galerie, které se v článcích vyskytují.
    var galleryIds = {};
    scans.forEach(function (s) { s.refs.photos.forEach(function (p) { var k = photoKey(p.url); var m = k && k.match(/^gallery-([^/]+)\//); if (m) galleryIds[m[1]] = true; }); });
    var existing = {}, listFailed = {};
    var ids = Object.keys(galleryIds);
    for (var i = 0; i < ids.length; i++) {
      out.textContent = 'Zjišťuji, jaké fotky v úložišti jsou (' + (i + 1) + '/' + ids.length + ')…';
      try {
        var pr = await fetch('/api/photos/list?galleryId=' + encodeURIComponent(ids[i]));
        if (!pr.ok) throw new Error('HTTP ' + pr.status);
        (await pr.json()).forEach(function (p) { existing[p.key] = true; });
      } catch (e) { listFailed[ids[i]] = true; }
    }

    var articleIds = {}; arts.forEach(function (a) { articleIds[String(a.id)] = true; });
    var problems = [], photosChecked = 0, linksChecked = 0;
    scans.forEach(function (s) {
      s.refs.photos.forEach(function (p) {
        var k = photoKey(p.url); if (!k) return;
        var m = k.match(/^gallery-([^/]+)\//);
        if (!m || listFailed[m[1]]) return;
        photosChecked++;
        if (!existing[k]) problems.push({ a: s.a, type: '🖼️ Chybí fotka (' + p.where + ')', detail: k });
      });
      s.refs.links.forEach(function (l) {
        linksChecked++;
        if (!articleIds[l.id]) problems.push({ a: s.a, type: '🔗 Odkaz na neexistující článek', detail: l.href });
      });
    });

    var failedNote = Object.keys(listFailed).length ? '<p style="color:#f59e0b;font-size:13px">Některé galerie se nepodařilo zkontrolovat: ' + esc(Object.keys(listFailed).join(', ')) + '</p>' : '';
    out.innerHTML = '<p style="font-size:13px;color:var(--text-muted)">Zkontrolováno ' + arts.length + ' článků, ' + photosChecked + ' fotek a ' + linksChecked + ' odkazů na jiné články.</p>' + failedNote +
      (problems.length
        ? '<p style="color:#ef4444;font-size:14px;margin:.4rem 0">Nalezeno problémů: <b>' + problems.length + '</b></p><ul style="font-size:13.5px;line-height:1.6;margin-left:1.1rem">' +
          problems.map(function (p) { return '<li><b>' + esc(p.a.title || 'Bez názvu') + '</b> — ' + p.type + '<br><span style="opacity:.6;word-break:break-all">' + esc(p.detail) + '</span></li>'; }).join('') + '</ul>'
        : '<p style="color:#22c55e;font-size:14px">✅ Všechno v pořádku, nic nechybí.</p>');
  }

  function mount() {
    var host = $('admin');
    if (!host || $('linkcheckBox')) return;
    var box = document.createElement('div');
    box.id = 'linkcheckBox';
    box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">🩺 Kontrola fotek a odkazů</h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.6rem">Projde všechny články a najde fotky, které už v úložišti nejsou, a odkazy na články, které neexistují.</p>' +
      '<button class="btn btn-sm" id="linkcheckBtn">🩺 Zkontrolovat</button><div id="linkcheckResult" style="margin-top:.6rem"></div>';
    host.appendChild(box);
    $('linkcheckBtn').onclick = run;
  }
  window.LinkCheck = { photoKey: photoKey, scanArticle: scanArticle };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
