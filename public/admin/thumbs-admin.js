/* 🖼️ Náhledy starších fotek: fotky nahrané dřív nemají malou verzi, na mobilu se proto
   načítají pomalu. Tlačítko je dogeneruje v prohlížeči (zmenší na 320 px) a uloží. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }

  async function makeThumb(blob) {
    var bmp;
    try { bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
    catch (e) {
      bmp = await new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = URL.createObjectURL(blob); });
    }
    var w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight, sc = Math.min(1, 320 / Math.max(w0, h0));
    var c = document.createElement('canvas'); c.width = Math.round(w0 * sc); c.height = Math.round(h0 * sc);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.72); });
  }

  var running = false;
  async function run() {
    if (running) return; running = true;
    var out = $('thumbsOut'), btn = $('thumbsBtn'); btn.disabled = true;
    try {
      out.textContent = 'Zjišťuji, kterým fotkám náhled chybí…';
      var r = await fetch('/api/photos/thumbs-missing'); if (!r.ok) throw new Error('HTTP ' + r.status);
      var j = await r.json();
      if (!j.missingCount) { out.textContent = '✅ Všech ' + j.total + ' fotek už náhled má.'; return; }
      var done = 0, fail = 0;
      for (var i = 0; i < j.missing.length; i++) {
        out.textContent = 'Dělám náhledy… ' + (done + fail) + ' / ' + j.missing.length + ' (zbývá celkem ' + j.missingCount + ')';
        try {
          var fr = await fetch('/api/photos/file?key=' + encodeURIComponent(j.missing[i])); if (!fr.ok) throw new Error('foto');
          var tb = await makeThumb(await fr.blob());
          var fd = new FormData(); fd.append('key', j.missing[i]); fd.append('thumb', tb, 'thumb.jpg');
          var pr = await fetch('/api/photos/thumb-put', { method: 'POST', body: fd }); if (!pr.ok) throw new Error('uložení');
          done++;
        } catch (e) { fail++; }
      }
      var rest = j.missingCount - j.missing.length;
      out.textContent = '✅ Hotovo: ' + done + ' náhledů vytvořeno' + (fail ? ', ' + fail + ' se nepovedlo' : '') + (rest > 0 ? '. Zbývá ještě ' + rest + ' — klikni znovu.' : '.');
      toast('Náhledy hotové', 'success');
    } catch (e) { out.textContent = '⚠️ ' + e.message; }
    finally { running = false; btn.disabled = false; }
  }

  function mount() {
    var host = $('admin'); if (!host || $('thumbsBox')) return;
    var box = document.createElement('div'); box.id = 'thumbsBox'; box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">🖼️ Náhledy starších fotek</h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.6rem">Dogeneruje malé náhledy fotkám, které je nemají — web se na mobilu načítá rychleji. Můžeš pouštět opakovaně, hotové přeskočí.</p>' +
      '<button class="btn btn-sm" id="thumbsBtn">🖼️ Dogenerovat náhledy</button><div id="thumbsOut" style="margin-top:.6rem;font-size:13.5px"></div>';
    host.appendChild(box); $('thumbsBtn').onclick = run;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
