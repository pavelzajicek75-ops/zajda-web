/* 🏋️ Těžké fotky: fotky nad 2,5 MB se na některých mobilech nenačtou (málo paměti, pomalé připojení).
   Nástroj je najde a na požádání zmenší (nejdelší strana 2400 px, JPEG 85 %) – stejný klíč, takže se
   nic nerozpojí od článků a milníků. Přepsání nejde vrátit, proto se před ním ptá. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }
  function mb(n) { return (n / 1048576).toFixed(1) + ' MB'; }
  var found = [], running = false;

  async function scan() {
    var out = $('weightOut'), btn = $('weightScan'), go = $('weightGo');
    btn.disabled = true; go.style.display = 'none'; out.textContent = 'Hledám těžké fotky…';
    try {
      var r = await fetch('/api/photos/heavy'); if (!r.ok) throw new Error('HTTP ' + r.status);
      var j = await r.json(); found = j.items || [];
      if (!j.count) { out.textContent = '✅ Žádná fotka z ' + j.total + ' není těžší než 2,5 MB.'; return; }
      out.innerHTML = '⚠️ Těžších než 2,5 MB: <b>' + j.count + '</b> z ' + j.total + ' (celkem ' + j.totalMB + ' MB). ' +
        (found.length < j.count ? 'Ukazuji nejtěžších ' + found.length + '. ' : '') +
        '<div style="margin-top:.4rem;max-height:160px;overflow:auto;font-size:12.5px;color:var(--text-muted)">' +
        found.map(function (x) { return mb(x.size) + ' · ' + x.key.split('/').pop(); }).join('<br>') + '</div>';
      go.style.display = ''; go.textContent = '⬇️ Zmenšit ' + found.length + ' fotek';
    } catch (e) { out.textContent = '⚠️ ' + e.message; }
    finally { btn.disabled = false; }
  }

  async function shrinkOne(key) {
    var fr = await fetch('/api/photos/file?key=' + encodeURIComponent(key)); if (!fr.ok) throw new Error('stažení');
    var blob = await fr.blob(), bmp;
    try { bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
    catch (e) { bmp = await new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = URL.createObjectURL(blob); }); }
    var w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight, sc = Math.min(1, 2400 / Math.max(w0, h0));
    function enc(max, q) {
      var s = Math.min(1, max / Math.max(w0, h0)), c = document.createElement('canvas'); c.width = Math.round(w0 * s); c.height = Math.round(h0 * s);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(res, 'image/jpeg', q); });
    }
    var big = await enc(2400, 0.85); if (!big) throw new Error('převod');
    if (big.size >= blob.size) throw new Error('není menší');
    var th = await enc(320, 0.72);
    var fd = new FormData();
    fd.append('file', big, key.split('/').pop().replace(/\.[^.]+$/, '') + '.jpg');
    fd.append('galleryId', (key.split('/')[0] || 'gallery-main').replace(/^gallery-/, ''));
    fd.append('oldKey', key); fd.append('mode', 'replace');
    if (th) fd.append('thumb', th, 'thumb.jpg');
    var pr = await fetch('/api/photos/update', { method: 'POST', body: fd }); if (!pr.ok) throw new Error('uložení ' + pr.status);
    return { before: blob.size, after: big.size };
  }

  async function go() {
    if (running || !found.length) return;
    if (!confirm('Zmenšit ' + found.length + ' fotek? Nahradí se zmenšenou verzí (nejdelší strana 2400 px, JPEG 85 %). Nejde to vrátit.')) return;
    running = true; var out = $('weightOut'), btn = $('weightGo'); btn.disabled = true;
    var ok = 0, fail = 0, saved = 0;
    for (var i = 0; i < found.length; i++) {
      out.textContent = 'Zmenšuji… ' + (ok + fail) + ' / ' + found.length + (saved ? ' (ušetřeno ' + mb(saved) + ')' : '');
      try { var r = await shrinkOne(found[i].key); ok++; saved += r.before - r.after; } catch (e) { fail++; }
    }
    out.textContent = '✅ Zmenšeno ' + ok + ' fotek, ušetřeno ' + mb(saved) + (fail ? '. Nepovedlo se ' + fail + ' (možná už jsou malé).' : '.') + ' Můžeš hledat znovu.';
    toast('Fotky zmenšeny', 'success');
    running = false; btn.disabled = false; btn.style.display = 'none'; found = [];
  }

  function mount() {
    var host = $('admin'); if (!host || $('weightBox')) return;
    var box = document.createElement('div'); box.id = 'weightBox'; box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">🏋️ Těžké fotky</h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.6rem">Fotky nad 2,5 MB se na některých mobilech nenačtou. Najdi je a zmenši (nejdelší strana 2400 px, kvalita 85 %). Odkazy v článcích a milnících zůstanou stejné.</p>' +
      '<button class="btn btn-sm" id="weightScan">🔎 Najít těžké fotky</button> <button class="btn btn-sm btn-blue" id="weightGo" style="display:none"></button>' +
      '<div id="weightOut" style="margin-top:.6rem;font-size:13.5px"></div>';
    host.appendChild(box); $('weightScan').onclick = scan; $('weightGo').onclick = go;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
