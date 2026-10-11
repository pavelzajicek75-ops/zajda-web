/* 📲 Sdílení z mobilu do blogu: v telefonu u fotky/textu zvol „Sdílet“ → Zajda.
   Service worker (sw.js) obsah uloží do schránky a otevře admin; tady z něj
   uděláš koncept článku (skrytý, dokud ho nezveřejníš). */
(function () {
  'use strict';
  var INBOX = 'zajda-share-inbox';
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }

  async function readInbox() {
    if (typeof caches === 'undefined') return null;
    var c = await caches.open(INBOX);
    var mr = await c.match('/__share/meta');
    if (!mr) return null;
    var meta = await mr.json();
    meta.blobs = [];
    for (var i = 0; i < meta.files.length; i++) {
      var r = await c.match(meta.files[i].key);
      if (r) meta.blobs.push({ blob: await r.blob(), name: meta.files[i].name, type: meta.files[i].type });
    }
    return meta;
  }
  async function clearInbox() {
    try { var c = await caches.open(INBOX); var ks = await c.keys(); await Promise.all(ks.map(function (k) { return c.delete(k); })); } catch (e) {}
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
  }

  // Zmenší fotku (delší strana max `max` px) do JPEG; když to nejde, vrátí původní soubor.
  async function shrink(blob, max, q) {
    try {
      var bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      var s = Math.min(1, max / Math.max(bmp.width, bmp.height));
      var c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return await new Promise(function (res) { c.toBlob(function (b) { res(b || blob); }, 'image/jpeg', q); });
    } catch (e) { return blob; }
  }

  async function uploadOne(f, i) {
    var big = await shrink(f.blob, 2000, 0.85), thumb = await shrink(f.blob, 320, 0.8);
    var fd = new FormData();
    fd.append('file', new File([big], (f.name || ('foto-' + i)).replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
    fd.append('thumb', new File([thumb], 'thumb.jpg', { type: 'image/jpeg' }));
    fd.append('galleryId', 'main');
    var r = await fetch('/api/photos/upload', { method: 'POST', body: fd });
    if (r.status === 401) throw new Error('Nejsi přihlášený — přihlas se a zkus to znovu.');
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || !j.url) throw new Error(j.error || ('Nahrání fotky selhalo (HTTP ' + r.status + ')'));
    return j.url;
  }

  async function panel(meta) {
    var host = $('admin'); if (!host) return;
    if (typeof showTab === 'function') { try { showTab('admin'); } catch (e) {} }
    var box = document.createElement('div');
    box.id = 'shareBox';
    box.style.cssText = 'margin:0 0 2rem;padding:14px;border:1px solid var(--nova,#2fe6c9);border-radius:12px';
    var urls = meta.blobs.map(function (b) { return URL.createObjectURL(b.blob); });
    var firstLine = (meta.title || meta.text || '').split('\n')[0].slice(0, 80);
    box.innerHTML = '<h3 style="margin-bottom:.5rem">📲 Sdílený obsah z mobilu</h3>' +
      (urls.length ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:.6rem">' + urls.map(function (u) { return '<img src="' + esc(u) + '" alt="" style="height:70px;border-radius:8px">'; }).join('') + '</div>' : '') +
      '<input type="text" id="shareTitle" maxlength="120" placeholder="Název článku" value="' + esc(firstLine) + '" style="width:100%;margin-bottom:.4rem">' +
      '<textarea id="shareText" rows="4" placeholder="Text" style="width:100%;margin-bottom:.4rem">' + esc([meta.text, meta.url].filter(Boolean).join('\n')) + '</textarea>' +
      '<button class="btn btn-blue btn-sm" id="shareGo">📝 Vytvořit koncept' + (urls.length ? ' (nahraje ' + urls.length + ' fotek)' : '') + '</button> ' +
      '<button class="btn btn-sm" id="shareCancel">Zahodit</button><div id="shareMsg" style="margin-top:.5rem;font-size:13px"></div>';
    host.insertBefore(box, host.firstChild);
    $('shareCancel').onclick = async function () { await clearInbox(); box.remove(); };
    $('shareGo').onclick = async function () {
      var b = this; b.disabled = true; var msg = $('shareMsg');
      try {
        var uploaded = [];
        for (var i = 0; i < meta.blobs.length; i++) { msg.textContent = 'Nahrávám fotku ' + (i + 1) + ' z ' + meta.blobs.length + '…'; uploaded.push(await uploadOne(meta.blobs[i], i)); }
        var title = $('shareTitle').value.trim() || 'Nový příspěvek z mobilu';
        var text = $('shareText').value.trim();
        var html = (text ? text.split(/\n{2,}/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('') : '') +
          uploaded.map(function (u) { return '<p><img src="' + esc(u) + '" alt=""></p>'; }).join('');
        var p = new Date(), pad = function (n) { return String(n).padStart(2, '0'); };
        msg.textContent = 'Vytvářím koncept…';
        var r = await fetch('/api/articles/create', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title, content: html, coverUrl: uploaded[0] || '', published: false, date: p.getFullYear() + '-' + pad(p.getMonth() + 1) + '-' + pad(p.getDate()) }) });
        if (!r.ok) throw new Error('Koncept se nepodařilo vytvořit (HTTP ' + r.status + ')');
        await clearInbox();
        urls.forEach(function (u) { URL.revokeObjectURL(u); });
        box.innerHTML = '<p>✅ Koncept „' + esc(title) + '“ je vytvořený. Najdeš ho mezi články (je skrytý, dokud ho nezveřejníš).</p>';
        toast('Koncept vytvořen', 'success');
      } catch (e) { msg.textContent = '⚠️ ' + e.message; b.disabled = false; }
    };
  }

  async function init() {
    var q = new URLSearchParams(location.search);
    if (q.get('shared') !== '1') return;
    try {
      var meta = await readInbox();
      if (!meta) { toast('Sdílený obsah se nenašel — zkus to v telefonu sdílet znovu.', 'info'); return; }
      await panel(meta);
    } catch (e) { toast('Sdílený obsah se nepodařilo načíst: ' + e.message, 'error'); }
  }
  window.ShareInbox = { init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 600); }); else setTimeout(init, 600);
})();
