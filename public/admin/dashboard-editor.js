/* =========================================================
   DASHBOARD EDITOR — kompletní soubor (opravený)
   ========================================================= */

function $(id) { return document.getElementById(id); }

function escapeHtml(t) {
  if (!t) return '';
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* === SVG filtry pro opravdové doostření ================= */
(function initEditorFilters() {
  if (document.getElementById('editor-filters-svg')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'editor-filters-svg';
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;pointer-events:none;';
  svg.innerHTML = `
    <defs>
      <filter id="ed-sharpen" x="-20%" y="-20%" width="140%" height="140%">
        <feConvolveMatrix order="3" kernelMatrix="0 -1 0 -1 5 -1 0 -1 0" preserveAlpha="true"/>
      </filter>
      <filter id="ed-sharpen-strong" x="-20%" y="-20%" width="140%" height="140%">
        <feConvolveMatrix order="3" kernelMatrix="0 -1.5 0 -1.5 7 -1.5 0 -1.5 0" preserveAlpha="true"/>
      </filter>
    </defs>
  `;
  document.body.appendChild(svg);
})();

/* === Foto Editor stav =================================== */
let ED = {
  photo: null,
  img: null,
  scale: 1,
  rotate: 0,
  panX: 0,
  panY: 0,
  crop: 'free',
  export: 'max',
  blobUrl: null,
  filters: { exposure: 0, contrast: 0, saturation: 0, temp: 0, vignette: 0, sharpen: 0, denoise: 0, ai: false },
  cropRect: null,
  isDraggingImage: false,
  isDraggingCrop: false,
  isResizingCrop: false,
  resizeDir: '',
  lastX: 0,
  lastY: 0
};

/* --- Otevřít / Zavřít editor --------------------------- */
async function openEditor(id) {
  const p = G.photos.find(x => x.id === id);
  if (!p) return;
  ED.photo = p;
  ED.scale = 1; ED.rotate = 0; ED.panX = 0; ED.panY = 0;
  ED.crop = 'free'; ED.export = 'max'; ED.cropRect = null;
  ED.filters = { exposure: 0, contrast: 0, saturation: 0, temp: 0, vignette: 0, sharpen: 0, denoise: 0, ai: false };
  if (ED.blobUrl) { URL.revokeObjectURL(ED.blobUrl); ED.blobUrl = null; }
  const aic = $('aiCheck');
  if (aic) aic.checked = false;
  updateFilterLabels();
  setCrop('free');
  setExport('max');
  try {
    const r = await fetch(p.url);
    if (!r.ok) throw new Error('fetch failed');
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    ED.blobUrl = url;
    const img = new Image();
    img.onload = () => {
      ED.img = img;
      $('editorModal')?.classList.remove('hidden');
      const el = $('editImg');
      if (el) el.src = url;
      fitImageToPreview();
      let vig = document.querySelector('.vignette-overlay');
      if (!vig) {
        vig = document.createElement('div');
        vig.className = 'vignette-overlay';
        vig.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:4;';
        $('editPreview').appendChild(vig);
      }
      vig.style.opacity = 0;
    };
    img.onerror = () => {
      alert('Obrázek se nepodařilo načíst.');
      URL.revokeObjectURL(url); ED.blobUrl = null;
    };
    img.src = url;
  } catch {
    alert('Obrázek se nepodařilo načíst.');
  }
}

function fitImageToPreview() {
  if (!ED.img) return;
  const preview = $('editPreview');
  if (!preview) return;
  const pW = preview.clientWidth, pH = preview.clientHeight;
  const fit = Math.min(pW / ED.img.naturalWidth, pH / ED.img.naturalHeight, 1);
  ED.scale = fit; ED.panX = 0; ED.panY = 0;
  const zs = $('zoomSlider');
  if (zs) { zs.min = Math.min(fit, 0.1).toFixed(2); zs.max = 4; zs.value = fit.toFixed(2); }
  updatePreviewTransform();
}

function closeEditor() {
  $('editorModal')?.classList.add('hidden');
  if (ED.blobUrl) { URL.revokeObjectURL(ED.blobUrl); ED.blobUrl = null; }
  ED.img = null; ED.photo = null; ED.cropRect = null;
  const vig = document.querySelector('.vignette-overlay');
  if (vig) vig.style.opacity = 0;
}

/* --- Zoom, rotace, transformace ------------------------ */
function editorSetZoom(v) { ED.scale = parseFloat(v); updatePreviewTransform(); }

function updatePreviewTransform() {
  const img = $('editImg');
  if (!img) return;
  img.style.transform = `translate(${ED.panX}px, ${ED.panY}px) scale(${ED.scale}) rotate(${ED.rotate}deg)`;
  applyFilters();
}

function rotateEditor(deg) { ED.rotate = (ED.rotate + deg) % 360; updatePreviewTransform(); }

/* --- Filtry (náhled) ----------------------------------- */
function applyFilters() {
  const img = $('editImg');
  if (!img) return;
  const f = ED.filters;
  let s = `brightness(${100 + f.exposure}%) contrast(${100 + f.contrast}%) saturate(${100 + f.saturation}%)`;
  if (f.temp > 0) s += ` sepia(${f.temp * 0.5}%)`;
  else s += ` hue-rotate(${f.temp * 0.3}deg)`;
  if (f.denoise > 0) s += ` blur(${f.denoise * 0.05}px)`;
  if (f.sharpen > 0) s += f.sharpen > 50 ? ' url(#ed-sharpen-strong)' : ' url(#ed-sharpen)';
  if (f.ai) s += ' brightness(105%) contrast(110%) saturate(115%) url(#ed-sharpen)';
  img.style.filter = s;

  const vig = document.querySelector('.vignette-overlay');
  if (vig && f.vignette > 0) {
    vig.style.background = `radial-gradient(circle at center, transparent 30%, rgba(0,0,0,${f.vignette / 100}) 90%)`;
    vig.style.opacity = 1;
  } else if (vig) { vig.style.opacity = 0; }
}

function updateFilterLabels() {
  const f = ED.filters;
  const ids = { exposure:'fval-exposure', contrast:'fval-contrast', saturation:'fval-saturation', temp:'fval-temp', vignette:'fval-vignette', sharpen:'fval-sharpen', denoise:'fval-denoise' };
  for (const [k, id] of Object.entries(ids)) { const el = $(id); if (el) el.textContent = f[k]; }
}

function setFilter(key, val) {
  ED.filters[key] = parseInt(val);
  const el = $('fval-' + key);
  if (el) el.textContent = val;
  applyFilters();
}

/* --- Crop systém --------------------------------------- */
function setCrop(mode) {
  ED.crop = mode;
  document.querySelectorAll('.editor-sidebar .tool-row:first-of-type .btn').forEach(b => b.classList.remove('btn-blue'));
  const labels = { free:'Volný', '1:1':'1:1', '4:3':'4:3', '3:4':'3:4', '16:9':'16:9' };
  const btn = Array.from(document.querySelectorAll('.editor-sidebar .tool-row:first-of-type .btn')).find(b => b.textContent.trim() === labels[mode]);
  if (btn) btn.classList.add('btn-blue');
  const layer = $('cropLayer'), preview = $('editPreview');
  if (!preview) return;
  if (mode === 'free') { if (layer) layer.style.display = 'none'; ED.cropRect = null; return; }
  if (layer) layer.style.display = 'block';
  const W = preview.clientWidth, H = preview.clientHeight;
  let w, h;
  if (mode === '1:1') w = h = Math.min(W, H) * 0.5;
  else if (mode === '4:3') { w = Math.min(W, H) * 0.55; h = w * 0.75; }
  else if (mode === '3:4') { h = Math.min(W, H) * 0.55; w = h * 0.75; }
  else if (mode === '16:9') { w = Math.min(W, H) * 0.6; h = w / 1.777; }
  else { w = W * 0.6; h = H * 0.6; }
  w = Math.min(w, W - 20); h = Math.min(h, H - 20);
  ED.cropRect = { x: (W - w) / 2, y: (H - h) / 2, w, h };
  renderCropRect();
}

function renderCropRect() {
  if (!ED.cropRect) return;
  const r = ED.cropRect, W = $('editPreview').clientWidth, H = $('editPreview').clientHeight;
  const rect = $('cropRect');
  if (rect) { rect.style.left = r.x + 'px'; rect.style.top = r.y + 'px'; rect.style.width = r.w + 'px'; rect.style.height = r.h + 'px'; }
  const mt = $('maskTop'); if (mt) mt.style.cssText = `left:0;top:0;width:${W}px;height:${r.y}px`;
  const mb = $('maskBottom'); if (mb) mb.style.cssText = `left:0;top:${r.y + r.h}px;width:${W}px;height:${H - r.y - r.h}px`;
  const ml = $('maskLeft'); if (ml) ml.style.cssText = `left:0;top:${r.y}px;width:${r.x}px;height:${r.h}px`;
  const mr = $('maskRight'); if (mr) mr.style.cssText = `left:${r.x + r.w}px;top:${r.y}px;width:${W - r.x - r.w}px;height:${r.h}px`;
}

(function initCropSystem() {
  const preview = $('editPreview');
  if (!preview || preview.dataset.cropReady) return;
  preview.dataset.cropReady = '1';

  const onDown = (e) => {
    if (!ED.img || ED.crop === 'free') return;
    const t = e.touches ? e.touches[0] : e, target = e.target;
    if (target.closest('.crop-handle')) {
      e.preventDefault(); e.stopPropagation();
      ED.isResizingCrop = true;
      ED.resizeDir = target.closest('.crop-handle').dataset.dir;
      ED.lastX = t.clientX; ED.lastY = t.clientY;
      return;
    }
    if (target.closest('#cropRect')) {
      e.preventDefault(); e.stopPropagation();
      ED.isDraggingCrop = true;
      ED.lastX = t.clientX; ED.lastY = t.clientY;
      return;
    }
    if (target.closest('#editImg') || target === preview) {
      ED.isDraggingImage = true;
      ED.lastX = t.clientX; ED.lastY = t.clientY;
    }
  };

  const onMove = (e) => {
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - ED.lastX, dy = t.clientY - ED.lastY;
    ED.lastX = t.clientX; ED.lastY = t.clientY;

    if (ED.isResizingCrop && ED.cropRect) {
      e.preventDefault();
      let { x, y, w, h } = ED.cropRect;
      const ratio = ED.crop === '1:1' ? 1 : ED.crop === '4:3' ? 4 / 3 : ED.crop === '3:4' ? 3 / 4 : ED.crop === '16:9' ? 16 / 9 : 0;
      const min = 50;
      if (ED.resizeDir.includes('e')) w = Math.max(min, w + dx);
      if (ED.resizeDir.includes('s')) h = Math.max(min, h + dy);
      if (ED.resizeDir.includes('w')) { const nw = Math.max(min, w - dx); x += w - nw; w = nw; }
      if (ED.resizeDir.includes('n')) { const nh = Math.max(min, h - dy); y += h - nh; h = nh; }
      if (ratio > 0) {
        if (ED.resizeDir.includes('e') || ED.resizeDir.includes('w')) h = w / ratio;
        else if (ED.resizeDir.includes('s') || ED.resizeDir.includes('n')) w = h * ratio;
        if (ED.resizeDir.includes('n')) y = ED.cropRect.y + ED.cropRect.h - h;
        if (ED.resizeDir.includes('w')) x = ED.cropRect.x + ED.cropRect.w - w;
      }
      const pW = preview.clientWidth, pH = preview.clientHeight;
      x = Math.max(0, x); y = Math.max(0, y);
      if (x + w > pW) { x = Math.max(0, pW - w); w = Math.min(w, pW); }
      if (y + h > pH) { y = Math.max(0, pH - h); h = Math.min(h, pH); }
      ED.cropRect = { x, y, w, h };
      renderCropRect();
    } else if (ED.isDraggingCrop && ED.cropRect) {
      e.preventDefault();
      let { x, y, w, h } = ED.cropRect;
      x += dx; y += dy;
      const pW = preview.clientWidth, pH = preview.clientHeight;
      x = Math.max(0, Math.min(x, pW - w)); y = Math.max(0, Math.min(y, pH - h));
      ED.cropRect = { ...ED.cropRect, x, y };
      renderCropRect();
    } else if (ED.isDraggingImage) {
      ED.panX += dx; ED.panY += dy;
      updatePreviewTransform();
    }
  };

  const onUp = () => { ED.isDraggingImage = false; ED.isDraggingCrop = false; ED.isResizingCrop = false; ED.resizeDir = ''; };

  preview.addEventListener('mousedown', onDown);
  preview.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchend', onUp);
})();

function applyCrop() {
  if (!ED.img || ED.crop === 'free' || !ED.cropRect) return;
  if (ED.rotate !== 0) { alert('Pro ořez musí být rotace 0°.'); return; }

  const preview = $('editPreview'), pW = preview.clientWidth, pH = preview.clientHeight;
  const imgW = ED.img.naturalWidth, imgH = ED.img.naturalHeight;
  const imgDisplayW = imgW * ED.scale, imgDisplayH = imgH * ED.scale;
  const imgLeft = (pW - imgDisplayW) / 2 + ED.panX, imgTop = (pH - imgDisplayH) / 2 + ED.panY;

  let srcX = (ED.cropRect.x - imgLeft) / ED.scale, srcY = (ED.cropRect.y - imgTop) / ED.scale;
  let srcW = ED.cropRect.w / ED.scale, srcH = ED.cropRect.h / ED.scale;
  if (srcX < 0) { srcW += srcX; srcX = 0; }
  if (srcY < 0) { srcH += srcY; srcY = 0; }
  if (srcX + srcW > imgW) srcW = imgW - srcX;
  if (srcY + srcH > imgH) srcH = imgH - srcY;
  srcW = Math.max(1, srcW); srcH = Math.max(1, srcH);
  if (srcW < 2 || srcH < 2) { alert('Ořez je příliš malý.'); return; }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(srcW); canvas.height = Math.round(srcH);
  canvas.getContext('2d').drawImage(ED.img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    if (ED.blobUrl) URL.revokeObjectURL(ED.blobUrl);
    ED.blobUrl = url;
    const newImg = new Image();
    newImg.onload = () => {
      ED.img = newImg; ED.crop = 'free'; ED.panX = 0; ED.panY = 0; ED.rotate = 0; ED.scale = 1;
      const zs = $('zoomSlider'); if (zs) zs.value = 1;
      const el = $('editImg'); if (el) el.src = url;
      fitImageToPreview();
      if ($('cropLayer')) $('cropLayer').style.display = 'none';
      ED.cropRect = null;
    };
    newImg.src = url;
  }, 'image/png');
}

/* --- Export a uložení ---------------------------------- */
function setExport(size) {
  ED.export = size;
  ['max', '2000', 'fullhd'].forEach(s => { const b = $('ex-' + s); if (b) b.classList.toggle('btn-blue', s === size); });
}

function getExportDim(w, h) {
  if (ED.export === 'max') return { w, h };
  if (ED.export === '2000') { const s = Math.min(1, 2000 / Math.max(w, h)); return { w: Math.round(w * s), h: Math.round(h * s) }; }
  if (ED.export === 'fullhd') { const s = Math.min(1, 1920 / w, 1080 / h); return { w: Math.round(w * s), h: Math.round(h * s) }; }
  return { w, h };
}

async function saveEditor(mode) {
  if (!ED.img) return;
  const img = ED.img, out = document.createElement('canvas');
  const dim = getExportDim(img.naturalWidth, img.naturalHeight);
  out.width = dim.w; out.height = dim.h;
  const ctx = out.getContext('2d');

  const f = ED.filters;
  let filterStr = `brightness(${100 + f.exposure}%) contrast(${100 + f.contrast}%) saturate(${100 + f.saturation}%)`;
  if (f.temp > 0) filterStr += ` sepia(${f.temp * 0.5}%)`;
  else filterStr += ` hue-rotate(${f.temp * 0.3}deg)`;
  if (f.denoise > 0) filterStr += ` blur(${f.denoise * 0.05}px)`;
  if (f.sharpen > 0) filterStr += f.sharpen > 50 ? ' url(#ed-sharpen-strong)' : ' url(#ed-sharpen)';
  if (f.ai) filterStr += ' brightness(105%) contrast(110%) saturate(115%) url(#ed-sharpen)';
  ctx.filter = filterStr;

  ctx.save();
  ctx.translate(dim.w / 2, dim.h / 2);
  ctx.rotate(ED.rotate * Math.PI / 180);
  const drawScale = Math.min(dim.w / img.naturalWidth, dim.h / img.naturalHeight);
  ctx.drawImage(img, -img.naturalWidth * drawScale / 2, -img.naturalHeight * drawScale / 2, img.naturalWidth * drawScale, img.naturalHeight * drawScale);
  ctx.restore();

  if (f.ai) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(200,220,255,0.04)';
    ctx.fillRect(0, 0, dim.w, dim.h);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (f.vignette > 0) {
    const grad = ctx.createRadialGradient(dim.w / 2, dim.h / 2, dim.w * 0.25, dim.w / 2, dim.h / 2, dim.w * 0.9);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, `rgba(0,0,0,${f.vignette / 100})`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, dim.w, dim.h);
  }

  const blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.95));
  const fd = new FormData();
  fd.append('file', blob, ED.photo.name || 'edited.jpg');
  fd.append('galleryId', 'main');
  fd.append('oldKey', ED.photo.key);
  fd.append('mode', mode);
  await fetch('/api/photos/update', { method: 'POST', body: fd });
  closeEditor();
  loadGallery();
}

/* === WYSIWYG pomocné funkce ============================ */
function execCmd(c, v) { document.execCommand(c, false, v); }
function getSelectedImg() {
  const s = window.getSelection(); if (!s.rangeCount) return null;
  let n = s.getRangeAt(0).commonAncestorContainer; if (n.nodeType === 3) n = n.parentElement;
  return n.closest ? n.closest('img') : null;
}
function deleteSelectedImg() { const i = getSelectedImg(); if (!i) return; i.remove(); window.getSelection().removeAllRanges(); }
function moveImageUp() { const i = getSelectedImg(); if (!i) return; const p = i.previousElementSibling; if (p) { i.parentNode.insertBefore(i, p); window.getSelection().removeAllRanges(); } }
function moveImageDown() { const i = getSelectedImg(); if (!i) return; const n = i.nextElementSibling; if (n) { i.parentNode.insertBefore(n, i); window.getSelection().removeAllRanges(); } }

function insertImgTo(e, a) {
  if (!G.photos.length) { alert('Nejdřív nahraj fotky do galerie.'); return; }
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div style="background:#1e293b;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #334155">
    <h3 style="margin-bottom:1rem;color:#f8fafc">Vložit fotku</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.75rem">${G.photos.map(p => `<img src="${p.url}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="insertImgUrl('${e}','${p.url}','${a}')">`).join('')}</div>
    <div style="text-align:center;margin-top:1rem"><button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button></div>
  </div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
}

function insertImgUrl(e, u, a) {
  const ed = $(e); let s = 'max-width:300px;width:100%;height:auto;border-radius:6px;margin:0.5rem auto;display:block;cursor:pointer;';
  if (a === 'left') s = 'max-width:300px;width:100%;height:auto;border-radius:6px;margin:0.5rem 1rem 0.5rem 0;float:left;display:block;cursor:pointer;';
  else if (a === 'right') s = 'max-width:300px;width:100%;height:auto;border-radius:6px;margin:0.5rem 0 0.5rem 1rem;float:right;display:block;cursor:pointer;';
  const h = `<img src="${u}" style="${s}" onclick="openLightbox('${u}')" class="editor-img" draggable="false">`;
  ed.focus(); document.execCommand('insertHTML', false, h);
  const m = document.querySelector('.modal'); if (m) m.remove();
  setTimeout(() => bindEditorImages(e), 50);
}

function bindEditorImages(e) {
  const ed = $(e); if (!ed) return;
  ed.querySelectorAll('img:not([data-bound])').forEach(i => {
    i.dataset.bound = '1';
    i.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); ed.querySelectorAll('img').forEach(x => x.style.outline = 'none'); i.style.outline = '3px solid #3b82f6'; const s = window.getSelection(); const r = document.createRange(); r.selectNode(i); s.removeAllRanges(); s.addRange(r); };
  });
}

/* === Články ============================================ */
async function loadArtSubsections() {
  const sec = $('artSection')?.value, sel = $('artSubsection');
  if (!sel) return; if (!sec) { sel.innerHTML = '<option value="">— Podsekce —</option>'; return; }
  try { const r = await fetch('/api/subsections/by-section?sectionId=' + sec); const arr = await r.json(); sel.innerHTML = '<option value="">— Podsekce —</option>' + arr.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join(''); } catch { sel.innerHTML = '<option value="">— Podsekce —</option>'; }
}

async function loadArticles() {
  try {
    const r = await fetch('/api/articles/list'), data = await r.json(), box = $('articleList');
    if (!box) return;
    box.innerHTML = data.map(a => `<div class="card"><h4>${escapeHtml(a.title)}</h4><p><small>${a.section || ''} ${a.subsection || ''} | ${a.place || ''} | ${new Date(a.date || a.created).toLocaleDateString('cs')}</small></p><div class="article-preview">${a.content}</div><div class="actions"><button onclick="deleteArticle('${a.id}')" class="btn btn-red">Smazat</button></div></div>`).join('');
    box.querySelectorAll('.article-preview img').forEach(img => { img.style.cursor = 'pointer'; img.onclick = e => { e.stopPropagation(); openLightbox(img.src); }; });
  } catch (e) { console.error(e); }
}

async function createArticle() {
  const title = $('artTitle')?.value.trim(), content = $('artEditor')?.innerHTML;
  if (!title || !content) return alert('Vyplň nadpis a obsah');
  await fetch('/api/articles/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, sectionId: $('artSection')?.value, subsectionId: $('artSubsection')?.value, date: $('artDate')?.value, place: $('artPlace')?.value }) });
  $('artTitle').value = ''; $('artEditor').innerHTML = ''; $('artDate').value = ''; $('artPlace').value = '';
  loadArticles();
}

async function deleteArticle(id) { if (!confirm('Smazat článek?')) return; await fetch(`/api/articles/delete?id=${id}`, { method: 'DELETE' }); loadArticles(); }

/* === Citáty ============================================ */
async function loadQuotes() {
  const tbody = $('quoteTableBody'); if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b">Načítání...</td></tr>';
  try {
    const r = await fetch('/api/quotes/list'), data = await r.json();
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b">Žádné citáty.</td></tr>'; return; }
    tbody.innerHTML = data.map(q => `<tr><td>"${escapeHtml(q.text)}"</td><td>${escapeHtml(q.author) || '—'}</td><td><button onclick="deleteQuote('${encodeURIComponent(q.key)}')" class="btn btn-red btn-sm">Smazat</button></td></tr>`).join('');
  } catch { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#ef4444">Chyba.</td></tr>'; }
}

async function createQuote() {
  const text = $('qText')?.value.trim(); if (!text) return alert('Zadej text citátu');
  await fetch('/api/quotes/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, author: $('qAuthor')?.value.trim() }) });
  $('qText').value = ''; $('qAuthor').value = ''; loadQuotes();
}

async function deleteQuote(key) { if (!confirm('Smazat?')) return; await fetch(`/api/quotes/delete?key=${key}`, { method: 'DELETE' }); loadQuotes(); }

/* === Podsekce ========================================== */
async function loadSubsections() {
  const tbody = $('subsectionTableBody'); if (!tbody) return;
  const secs = ['travel', 'photo', 'projects', 'about']; const all = [];
  for (const sid of secs) { try { const r = await fetch('/api/subsections/by-section?sectionId=' + sid); const arr = await r.json(); all.push(...arr); } catch {} }
  tbody.innerHTML = all.map(s => `<tr><td>${escapeHtml(s.sectionId)}</td><td style="display:flex;align-items:center;gap:0.75rem">${s.coverUrl ? `<img src="${s.coverUrl}" style="width:120px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #334155;flex-shrink:0">` : '<div style="width:120px;height:80px;background:#0f172a;border-radius:6px;border:1px solid #334155;flex-shrink:0"></div>'}<span>${escapeHtml(s.name)}</span></td><td>${escapeHtml(s.slug)}</td><td>${s.order || 0}</td><td><button onclick="pickSubsectionCover('${s.id}')" class="btn btn-blue btn-sm">Cover</button><button onclick="deleteSubsection('${s.id}')" class="btn btn-red btn-sm">Smazat</button></td></tr>`).join('');
}

async function createSubsection() {
  const sec = $('ssSection')?.value, name = $('ssName')?.value.trim();
  if (!sec || !name) return alert('Vyplň sekci a název');
  const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  await fetch('/api/subsections/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sectionId: sec, name, slug, order: parseInt($('ssOrder')?.value) || 0 }) });
  $('ssName').value = ''; $('ssOrder').value = '0'; loadSubsections();
}

async function deleteSubsection(id) { if (!confirm('Smazat?')) return; await fetch(`/api/subsections/delete?id=${id}`, { method: 'DELETE' }); loadSubsections(); }

async function pickSubsectionCover(id) {
  if (!G.photos.length) { alert('Galerie se načítá. Jdi nejdřív do Galerie.'); return; }
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div style="background:#1e293b;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #334155"><h3 style="margin-bottom:1rem;color:#f8fafc">Cover podsekce</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.5rem">${G.photos.map(p => `<img src="${p.url}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="saveSubsectionCover('${id}','${p.url}')">`).join('')}</div><div style="text-align:center;margin-top:1rem"><button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button></div></div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
}

async function saveSubsectionCover(id, url) {
  await fetch('/api/subsections/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, coverUrl: url }) });
  const m = document.querySelector('.modal'); if (m) m.remove(); loadSubsections();
}

/* === Sekce (Cover fotky) — OPRAVENO ==================== */
async function loadSectionCovers() {
  const box = $('sectionCovers'); if (!box) return;
  const secs = [
    { id: 'travel', n: 'Cestování' },
    { id: 'photo', n: 'Fotografování' },
    { id: 'projects', n: 'Projekty' },
    { id: 'about', n: 'O Zajdovi' }
  ];
  let html = '<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem">';
  for (const s of secs) {
    let url = '';
    try {
      const r = await fetch('/api/sections/cover?sectionId=' + s.id);
      if (r.ok) { const d = await r.json(); url = d.coverUrl || d.url || ''; }
    } catch (e) { console.error('Chyba načítání coveru sekce:', e); }
    html += `<div style="background:#1e293b;padding:0.75rem;border-radius:8px;border:1px solid #334155;text-align:center;min-width:140px">
      <div style="font-size:0.875rem;margin-bottom:0.5rem">${escapeHtml(s.n)}</div>
      ${url ? `<img src="${url}" style="width:120px;height:80px;object-fit:cover;border-radius:6px;margin:0 auto 0.5rem;display:block;border:1px solid #334155">` : '<div style="width:120px;height:80px;background:#0f172a;border-radius:6px;margin:0 auto 0.5rem;border:1px solid #334155"></div>'}
      <button onclick="pickSectionCover('${s.id}')" class="btn btn-blue btn-sm">Změnit</button>
    </div>`;
  }
  html += '</div>';
  box.innerHTML = html;
}

function pickSectionCover(sectionId) {
  if (!G.photos || !G.photos.length) { alert('Galerie je prázdná. Nejprve nahraj fotky do galerie.'); return; }
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div style="background:#1e293b;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #334155">
    <h3 style="margin-bottom:1rem;color:#f8fafc">Cover sekce</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.5rem">
      ${G.photos.map(p => `<img src="${p.url}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="saveSectionCover('${sectionId}','${p.url}')">`).join('')}
    </div>
    <div style="text-align:center;margin-top:1rem"><button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button></div>
  </div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
}

/* OPRAVA: Posíláme rovnou URL z galerie místo blob re-uploadu */
async function saveSectionCover(sectionId, url) {
  try {
    const r = await fetch('/api/sections/cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, coverUrl: url })
    });
    if (!r.ok) throw new Error('Server vrátil chybu ' + r.status);
  } catch (e) {
    console.error('Chyba uložení coveru:', e);
    alert('Nepodařilo se uložit cover. Zkus to znovu.');
  } finally {
    const m = document.querySelector('.modal');
    if (m) m.remove();
    loadSectionCovers();
  }
}

/* === O mně ============================================= */
async function loadAbout() {
  try {
    const r = await fetch('/api/about/get'), d = await r.json() || {};
    $('aboutTitle').value = d.title || '';
    $('aboutEditor').innerHTML = d.text || '';
    $('aboutPreview').innerHTML = `<h4>${escapeHtml(d.title || 'O Zajdovi')}</h4><div>${d.text || ''}</div>`;
    bindEditorImages('aboutEditor');
  } catch (e) {
    console.error('About chyba:', e);
    $('aboutTitle').value = ''; $('aboutEditor').innerHTML = ''; $('aboutPreview').innerHTML = '<h4>O Zajdovi</h4><div></div>';
  }
}

async function saveAbout() {
  const about = { title: $('aboutTitle')?.value || '', text: $('aboutEditor')?.innerHTML || '' };
  await fetch('/api/about/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(about) });
  loadAbout();
}
