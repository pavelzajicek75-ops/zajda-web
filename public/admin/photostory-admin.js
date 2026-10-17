/* 📷 Fotopříběh v článku: fotky vedle sebe (2–3), jedna přes celou šířku s popiskem, nebo Před / Po.
   Vkládá se jako <div class="photo-row"> s <figure> — veřejný článek si to nastyluje v article.html. */
(function () {
  'use strict';
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  var saved = null;
  function rememberRange() {
    var s = window.getSelection();
    var ed = document.getElementById('artEditor');
    if (s && s.rangeCount && ed && ed.contains(s.anchorNode)) saved = s.getRangeAt(0).cloneRange();
  }

  function buildHtml(urls, captions, mode) {
    var n = urls.length;
    var cls = mode === 'ba' ? 'photo-row photo-ba' : (mode === 'full' ? 'photo-row photo-full' : 'photo-row photo-row-' + n);
    var figs = urls.map(function (u, i) {
      var cap = captions[i] || '';
      return '<figure style="margin:0;flex:1 1 0;min-width:0"><img src="' + esc(u) + '" alt="' + esc(cap || 'Fotografie z článku') + '" style="width:100%;height:auto;border-radius:10px;display:block">' +
        (cap ? '<figcaption style="font-size:13px;opacity:.75;text-align:center;margin-top:6px;font-style:italic">' + esc(cap) + '</figcaption>' : '') + '</figure>';
    }).join('');
    return '<div class="' + cls + '" style="display:flex;gap:10px;margin:1.2rem 0">' + figs + '</div><p><br></p>';
  }

  window.insertPhotoStory = function () {
    rememberRange();
    var photos = (window.G && Array.isArray(G.photos)) ? G.photos : [];
    if (!photos.length) { if (typeof showToast === 'function') showToast('Nejdřív nahraj fotky do galerie.', 'info'); return; }
    var picked = [];
    var m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = '<div style="background:#1e293b;padding:1.25rem;border-radius:12px;width:min(760px,94vw);max-height:88vh;display:flex;flex-direction:column;gap:.75rem;border:1px solid #334155;color:#f8fafc">' +
      '<h3 style="margin:0">📷 Fotky vedle sebe</h3>' +
      '<div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">' +
      '<label style="font-size:13px">Rozložení:</label>' +
      '<select id="psMode" class="form-input" style="width:auto"><option value="row">Vedle sebe (2–3 fotky)</option><option value="full">Jedna přes celou šířku + popisek</option><option value="ba">Před / Po (2 fotky)</option></select>' +
      '<span id="psInfo" style="font-size:13px;opacity:.8"></span></div>' +
      '<div id="psGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:.4rem;overflow:auto;min-height:140px"></div>' +
      '<div id="psCaps" style="display:flex;flex-direction:column;gap:.35rem"></div>' +
      '<div style="display:flex;gap:.5rem;justify-content:flex-end"><button class="btn btn-red" id="psCancel">Zavřít</button><button class="btn" id="psOk">Vložit do článku</button></div></div>';
    document.body.appendChild(m);
    var grid = m.querySelector('#psGrid'), caps = m.querySelector('#psCaps'), info = m.querySelector('#psInfo'), modeSel = m.querySelector('#psMode');
    function max() { return modeSel.value === 'full' ? 1 : (modeSel.value === 'ba' ? 2 : 3); }
    function paint() {
      grid.innerHTML = photos.map(function (p, i) {
        var idx = picked.indexOf(i);
        return '<div data-i="' + i + '" style="position:relative;cursor:pointer;border-radius:6px;overflow:hidden;outline:' + (idx > -1 ? '3px solid #ff7a45' : '1px solid #334155') + '">' +
          '<img loading="lazy" src="' + esc(p.thumbUrl || p.url) + '" style="width:100%;height:90px;object-fit:cover;display:block">' +
          (idx > -1 ? '<b style="position:absolute;top:4px;left:4px;background:#ff7a45;color:#000;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:13px">' + (idx + 1) + '</b>' : '') + '</div>';
      }).join('');
      info.textContent = 'Vybráno ' + picked.length + ' z ' + max();
      var old = {}; caps.querySelectorAll('input').forEach(function (inp) { old[inp.dataset.i] = inp.value; });
      caps.innerHTML = picked.map(function (pi, k) {
        var ph = modeSel.value === 'ba' ? (k === 0 ? 'Před' : 'Po') : 'Popisek fotky ' + (k + 1) + ' (nepovinný)';
        var def = (modeSel.value === 'ba') ? (old[pi] != null ? old[pi] : (k === 0 ? 'Před' : 'Po')) : (old[pi] != null ? old[pi] : '');
        return '<input class="form-input" data-i="' + pi + '" placeholder="' + esc(ph) + '" value="' + esc(def) + '">';
      }).join('');
    }
    grid.addEventListener('click', function (e) {
      var d = e.target.closest('[data-i]'); if (!d) return;
      var i = +d.dataset.i, at = picked.indexOf(i);
      if (at > -1) picked.splice(at, 1); else { if (picked.length >= max()) picked.shift(); picked.push(i); }
      paint();
    });
    modeSel.onchange = function () { while (picked.length > max()) picked.shift(); paint(); };
    m.querySelector('#psCancel').onclick = function () { m.remove(); };
    m.onclick = function (e) { if (e.target === m) m.remove(); };
    m.querySelector('#psOk').onclick = function () {
      var mode = modeSel.value;
      var need = mode === 'row' ? 2 : (mode === 'ba' ? 2 : 1);
      if (picked.length < need) { if (typeof showToast === 'function') showToast('Vyber alespoň ' + need + (need === 1 ? ' fotku.' : ' fotky.'), 'info'); return; }
      var urls = picked.map(function (i) { return photos[i].url; });
      var cs = picked.map(function (pi) { var inp = caps.querySelector('input[data-i="' + pi + '"]'); return inp ? inp.value.trim() : ''; });
      var html = buildHtml(urls, cs, mode);
      var ed = document.getElementById('artEditor'); if (!ed) return;
      ed.focus();
      if (saved) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(saved); }
      if (!document.execCommand('insertHTML', false, html)) ed.insertAdjacentHTML('beforeend', html);
      m.remove();
    };
    paint();
  };
  window.PhotoStory = { buildHtml: buildHtml };
})();
