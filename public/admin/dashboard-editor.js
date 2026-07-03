/* =========================================================
   DASHBOARD — ČÁST 1/5: Inicializace, galerie, SVG filtry
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

window.G = window.G || { photos: [] };

/* === SVG filtry pro náhled ============================= */
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

/* === Stav editoru ====================================== */
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

/* === Galerie (OPRAVENO — spolehlivé načítání) ========= */
async function loadGallery() {
  try {
    const r = await fetch('/api/photos/list?galleryId=main');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    G.photos = Array.isArray(data) ? data : (data.photos || []);
  } catch (e) {
    console.error('Chyba galerie:', e);
    G.photos = [];
  }
}
/* =========================================================
   DASHBOARD — ČÁST 2/5: Editor fotek (otevření, zoom, crop, filtry)
   ========================================================= */

/* --- Otevřít editor ----------------------------------- */
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

/* --- Zoom, rotace ------------------------------------- */
function editorSetZoom(v) { ED.scale = parseFloat(v); updatePreviewTransform(); }

function updatePreviewTransform() {
  const img = $('editImg');
  if (!img) return;
  img.style.transform = `translate(${ED.panX}px, ${ED.panY}px) scale(${ED.scale}) rotate(${ED.rotate}deg)`;
  applyFilters();
}

function rotateEditor(deg) { ED.rotate = (ED.rotate + deg) % 360; updatePreviewTransform(); }

/* --- Filtry ------------------------------------------- */
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

/* --- Crop systém -------------------------------------- */
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

/* Crop drag system */
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
/* =========================================================
   DASHBOARD — ČÁST 3/5: Export, upload bez komprese, save
   ========================================================= */

/* --- Export nastavení ---------------------------------- */
function setExport(size) {
  ED.export = size;
  ['max', '2000', 'fullhd'].forEach(s => {
    const b = $('ex-' + s);
    if (b) b.classList.toggle('btn-blue', s === size);
  });
}

function getExportDim(w, h) {
  if (ED.export === 'max') return { w, h };
  if (ED.export === '2000') {
    const s = Math.min(1, 2000 / Math.max(w, h));
    return { w: Math.round(w * s), h: Math.round(h * s) };
  }
  if (ED.export === 'fullhd') {
    const s = Math.min(1, 1920 / w, 1080 / h);
    return { w: Math.round(w * s), h: Math.round(h * s) };
  }
  return { w, h };
}

function getSafeCanvasDim(w, h) {
  const max = /iPhone|iPad|iPod|Android/.test(navigator.userAgent) ? 2048 : 4096;
  if (w <= max && h <= max) return { w, h };
  const ratio = Math.min(max / w, max / h);
  return { w: Math.round(w * ratio), h: Math.round(h * ratio) };
}

/* --- Ruční doostření ---------------------------------- */
function applySharpen(ctx, w, h, strength) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const out = ctx.createImageData(w, h);
  const od = out.data;

  const kernel = strength === 'strong'
    ? [0, -1.5, 0, -1.5, 7, -1.5, 0, -1.5, 0]
    : [0, -1, 0, -1, 5, -1, 0, -1, 0];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const py = Math.min(h - 1, Math.max(0, y + ky));
          const px = Math.min(w - 1, Math.max(0, x + kx));
          const idx = (py * w + px) * 4;
          const k = kernel[(ky + 1) * 3 + (kx + 1)];
          r += data[idx] * k;
          g += data[idx + 1] * k;
          b += data[idx + 2] * k;
        }
      }
      const i = (y * w + x) * 4;
      od[i] = Math.min(255, Math.max(0, r));
      od[i + 1] = Math.min(255, Math.max(0, g));
      od[i + 2] = Math.min(255, Math.max(0, b));
      od[i + 3] = data[i + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

/* --- Spolehlivý upload s retry (OPRAVENO) ------------- */
async function uploadWithRetry(fd, maxRetries) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const r = await fetch('/api/photos/update', { method: 'POST', body: fd });
      if (r.ok) return true;
      if (r.status >= 400 && r.status < 500 && r.status !== 429) throw new Error('Klient chyba ' + r.status);
      throw new Error('Server chyba ' + r.status);
    } catch (e) {
      if (attempt === maxRetries) throw e;
      await new Promise(res => setTimeout(res, 1000 * attempt));
    }
  }
  return false;
}

/* --- Uložení fotky (OPRAVENO — bez komprese, spolehlivý upload) --- */
async function saveEditor(mode) {
  if (!ED.img) return;
  const img = ED.img;

  let dim = getExportDim(img.naturalWidth, img.naturalHeight);
  dim = getSafeCanvasDim(dim.w, dim.h);

  const out = document.createElement('canvas');
  out.width = dim.w;
  out.height = dim.h;
  const ctx = out.getContext('2d', { willReadFrequently: true });

  const f = ED.filters;

  /* 1. Standardní filtry */
  let filterStr = `brightness(${100 + f.exposure}%) contrast(${100 + f.contrast}%) saturate(${100 + f.saturation}%)`;
  if (f.temp > 0) filterStr += ` sepia(${f.temp * 0.5}%)`;
  else filterStr += ` hue-rotate(${f.temp * 0.3}deg)`;
  if (f.denoise > 0) filterStr += ` blur(${f.denoise * 0.05}px)`;
  ctx.filter = filterStr;

  /* 2. Vykreslení s rotací a scale */
  ctx.save();
  ctx.translate(dim.w / 2, dim.h / 2);
  ctx.rotate(ED.rotate * Math.PI / 180);
  const drawScale = Math.min(dim.w / img.naturalWidth, dim.h / img.naturalHeight);
  ctx.drawImage(img,
    -img.naturalWidth * drawScale / 2,
    -img.naturalHeight * drawScale / 2,
    img.naturalWidth * drawScale,
    img.naturalHeight * drawScale
  );
  ctx.restore();

  /* 3. Ruční doostření */
  if (f.sharpen > 0 || f.ai) {
    const strength = (f.sharpen > 50 || f.ai) ? 'strong' : 'normal';
    applySharpen(ctx, dim.w, dim.h, strength);
  }

  /* 4. AI overlay */
  if (f.ai) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(200,220,255,0.04)';
    ctx.fillRect(0, 0, dim.w, dim.h);
    ctx.globalCompositeOperation = 'source-over';
  }

  /* 5. Vigneta */
  if (f.vignette > 0) {
    const grad = ctx.createRadialGradient(dim.w / 2, dim.h / 2, dim.w * 0.25, dim.w / 2, dim.h / 2, dim.w * 0.9);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, `rgba(0,0,0,${f.vignette / 100})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, dim.w, dim.h);
  }

  /* 6. Export — BEZ KOMPRESE (PNG = lossless) */
  const blob = await new Promise(r => out.toBlob(r, 'image/png'));
  const fd = new FormData();
  fd.append('file', blob, ED.photo.name || 'edited.png');
  fd.append('galleryId', 'main');
  fd.append('oldKey', ED.photo.key);
  fd.append('mode', mode);

  /* 7. Upload s retry (3 pokusy) */
  try {
    await uploadWithRetry(fd, 3);
  } catch (e) {
    alert('Nepodařilo se uložit fotku po 3 pokusech: ' + e.message);
    return;
  }

  closeEditor();
  await loadGallery();
}

/* === WYSIWYG Editor — toolbar ========================= */
function execCmd(c, v) {
  document.execCommand(c, false, v);
  const ed = document.activeElement;
  if (ed && (ed.id === 'artEditor' || ed.id === 'aboutEditor')) {
    ed.focus();
  }
}

function setFontName(name) { execCmd('fontName', name); }
function setFontSize(size) { execCmd('fontSize', size); }
function setForeColor(color) { execCmd('foreColor', color); }
function setBackColor(color) { execCmd('hiliteColor', color); }
function setHeading(tag) { execCmd('formatBlock', tag); }
function alignLeft() { execCmd('justifyLeft'); }
function alignCenter() { execCmd('justifyCenter'); }
function alignRight() { execCmd('justifyRight'); }
function alignJustify() { execCmd('justifyFull'); }
function insertBullet() { execCmd('insertUnorderedList'); }
function insertNumber() { execCmd('insertOrderedList'); }
function indentMore() { execCmd('indent'); }
function indentLess() { execCmd('outdent'); }
function insertHR() { execCmd('insertHorizontalRule'); }
function clearFormat() { execCmd('removeFormat'); execCmd('formatBlock', 'div'); }
function editorUndo() { execCmd('undo'); }
function editorRedo() { execCmd('redo'); }
function insertLink() {
  const url = prompt('Zadej URL odkazu:', 'https://');
  if (url) execCmd('createLink', url);
}
function unlink() { execCmd('unlink'); }
function toggleBold() { execCmd('bold'); }
function toggleItalic() { execCmd('italic'); }
function toggleUnderline() { execCmd('underline'); }
function toggleStrike() { execCmd('strikeThrough'); }

/* --- Obrázky v editoru — toolbar ----------------------- */
let currentActiveImg = null;

function setupArticleEditors() {
  ['artEditor', 'aboutEditor'].forEach(id => {
    const ed = $(id);
    if (!ed) return;
    ed.addEventListener('click', e => {
      const img = e.target.closest('img.editor-img');
      if (!img) {
        ed.querySelectorAll('img.editor-img').forEach(i => {
          i.style.outline = '';
          i.removeAttribute('data-active');
        });
        currentActiveImg = null;
        hideImgToolbar();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      ed.querySelectorAll('img.editor-img').forEach(i => {
        i.style.outline = '';
        i.removeAttribute('data-active');
      });
      img.style.outline = '3px solid #3b82f6';
      img.setAttribute('data-active', '1');
      currentActiveImg = img;
      showImgToolbar(img);
    });
    ed.addEventListener('dragstart', e => {
      if (e.target.tagName === 'IMG') e.preventDefault();
    });
  });
}

function showImgToolbar(img) {
  let bar = $('img-toolbar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'img-toolbar';
    bar.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#1e293b;border:1px solid #334155;border-radius:8px;padding:6px 12px;display:none;gap:6px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.5);flex-wrap:wrap;justify-content:center;';
    document.body.appendChild(bar);
  }
  bar.innerHTML = `
    <button onclick="imgToolbarAction('smaller')" class="btn btn-sm" style="padding:4px 10px;font-size:12px">- Menší</button>
    <button onclick="imgToolbarAction('bigger')" class="btn btn-sm" style="padding:4px 10px;font-size:12px">+ Větší</button>
    <button onclick="imgToolbarAction('left')" class="btn btn-sm" style="padding:4px 10px;font-size:12px">◀ Vlevo</button>
    <button onclick="imgToolbarAction('center')" class="btn btn-sm" style="padding:4px 10px;font-size:12px">Střed</button>
    <button onclick="imgToolbarAction('right')" class="btn btn-sm" style="padding:4px 10px;font-size:12px">Vpravo ▶</button>
    <button onclick="imgToolbarAction('up')" class="btn btn-sm" style="padding:4px 10px;font-size:12px">↑ Nahoru</button>
    <button onclick="imgToolbarAction('down')" class="btn btn-sm" style="padding:4px 10px;font-size:12px">↓ Dolů</button>
    <button onclick="imgToolbarAction('delete')" class="btn btn-red btn-sm" style="padding:4px 10px;font-size:12px">🗑 Smazat</button>
  `;
  bar.style.display = 'flex';
}

function hideImgToolbar() {
  const bar = $('img-toolbar');
  if (bar) bar.style.display = 'none';
  currentActiveImg = null;
}

function imgToolbarAction(action) {
  const ed = $('artEditor') || $('aboutEditor');
  if (!ed) return;
  const img = ed.querySelector('img[data-active]') || currentActiveImg;
  if (!img) { hideImgToolbar(); return; }
  if (action === 'delete') { img.remove(); hideImgToolbar(); return; }
  if (action === 'up') { const p = img.previousElementSibling; if (p) img.parentNode.insertBefore(img, p); return; }
  if (action === 'down') { const n = img.nextElementSibling; if (n) img.parentNode.insertBefore(n, img); return; }
  if (action === 'smaller') { let w = parseInt(img.style.width) || 300; img.style.width = Math.max(80, w - 40) + 'px'; img.style.maxWidth = img.style.width; return; }
  if (action === 'bigger') { let w = parseInt(img.style.width) || 300; img.style.width = Math.min(800, w + 40) + 'px'; img.style.maxWidth = img.style.width; return; }
  if (action === 'left') { img.style.float = 'left'; img.style.margin = '0.5rem 1rem 0.5rem 0'; img.style.display = 'block'; img.style.clear = 'none'; return; }
  if (action === 'right') { img.style.float = 'right'; img.style.margin = '0.5rem 0 0.5rem 1rem'; img.style.display = 'block'; img.style.clear = 'none'; return; }
  if (action === 'center') { img.style.float = 'none'; img.style.margin = '0.5rem auto'; img.style.display = 'block'; img.style.clear = 'both'; return; }
}

document.addEventListener('click', e => {
  if (!e.target.closest('#img-toolbar') && !e.target.closest('img[data-active]')) {
    hideImgToolbar();
    document.querySelectorAll('img[data-active]').forEach(i => {
      i.style.outline = '';
      i.removeAttribute('data-active');
    });
  }
});

/* --- Vkládání obrázků z galerie do editoru ------------- */
function insertImgTo(editorId, align) {
  if (!G.photos || !G.photos.length) { alert('Nejdřív nahraj fotky do galerie.'); return; }
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `
    <div style="background:#1e293b;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #334155">
      <h3 style="margin-bottom:1rem;color:#f8fafc">Vložit fotku</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.75rem">
        ${G.photos.map(p => `<img src="${p.url}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="insertImgUrl('${editorId}','${p.url}','${align}')">`).join('')}
      </div>
      <div style="text-align:center;margin-top:1rem">
        <button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button>
      </div>
    </div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
}

function insertImgUrl(editorId, url, align) {
  const ed = $(editorId);
  if (!ed) return;
  let style = 'max-width:300px;width:100%;height:auto;border-radius:6px;margin:0.5rem auto;display:block;cursor:pointer;';
  if (align === 'left') style = 'max-width:300px;width:100%;height:auto;border-radius:6px;margin:0.5rem 1rem 0.5rem 0;float:left;display:block;cursor:pointer;';
  else if (align === 'right') style = 'max-width:300px;width:100%;height:auto;border-radius:6px;margin:0.5rem 0 0.5rem 1rem;float:right;display:block;cursor:pointer;';
  const html = `<img src="${url}" style="${style}" class="editor-img" draggable="false">`;
  ed.focus();
  const sel = window.getSelection();
  if (sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (ed.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      const frag = range.createContextualFragment(html);
      range.insertNode(frag);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      ed.insertAdjacentHTML('beforeend', html);
    }
  } else {
    ed.insertAdjacentHTML('beforeend', html);
  }
  const modal = document.querySelector('.modal');
  if (modal) modal.remove();
  setTimeout(() => setupArticleEditors(), 50);
}

/* --- Podsekce pro formulář článku ---------------------- */
async function loadArtSubsections() {
  const sec = $('artSection')?.value;
  const sel = $('artSubsection');
  if (!sel) return;
  if (!sec) { sel.innerHTML = '<option value="">— Podsekce —</option>'; return; }
  try {
    const r = await fetch('/api/subsections/by-section?sectionId=' + sec);
    const arr = await r.json();
    sel.innerHTML = '<option value="">— Podsekce —</option>' +
      arr.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  } catch {
    sel.innerHTML = '<option value="">— Podsekce —</option>';
  }
}
/* =========================================================
   DASHBOARD — ČÁST 4/5: Články (seznam, vytvoření, editace, znovupublikování)
   ========================================================= */

function generateSlug(title) {
  if (!title) return 'clanek-' + Date.now();
  return title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60) || 'clanek-' + Date.now();
}

async function loadArticles() {
  try {
    const r = await fetch('/api/articles/list');
    if (!r.ok) throw new Error('Chyba načítání');
    const data = await r.json();
    const arr = Array.isArray(data) ? data : (data.articles || []);
    const box = $('articleList');
    if (!box) return;

    if (!arr.length) {
      box.innerHTML = '<div style="color:#64748b;padding:1rem;text-align:center">Zatím žádné články</div>';
      return;
    }

    box.innerHTML = arr.map(a => {
      const excerpt = a.content ? a.content.replace(/<[^>]+>/g, '').substring(0, 120) + '...' : '';
      return `
      <div class="card" style="margin-bottom:1rem;padding:1rem;background:#1e293b;border:1px solid #334155;border-radius:10px">
        <h4 style="color:#ffcc66;margin-bottom:0.3rem">${escapeHtml(a.title)}</h4>
        <p style="color:#94a3b8;font-size:13px;margin-bottom:0.5rem">
          ${a.section || ''} ${a.subsection || ''} • ${a.place || ''} • ${new Date(a.date || a.created).toLocaleDateString('cs')}
          ${a.published ? '' : '<span style="color:#ef4444;margin-left:0.5rem">(ne publikováno)</span>'}
        </p>
        ${excerpt ? `<p style="color:#cbd5e1;font-size:14px;margin-bottom:0.75rem;line-height:1.5">${escapeHtml(excerpt)}</p>` : ''}
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button onclick="editArticle('${a.id}')" class="btn btn-blue btn-sm">✏️ Upravit</button>
          <button onclick="publishArticle('${a.id}')" class="btn btn-sm" style="background:#22c55e;color:#fff;border:none;padding:4px 12px;border-radius:6px;cursor:pointer">📢 Publikovat</button>
          <button onclick="deleteArticle('${a.id}')" class="btn btn-red btn-sm">🗑 Smazat</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    console.error('Chyba článků:', e);
    const box = $('articleList');
    if (box) box.innerHTML = '<div style="color:#ef4444;padding:1rem;text-align:center">Nepodařilo se načíst články</div>';
  }
}

/* --- Editace existujícího článku (OPRAVENO) ----------- */
async function editArticle(id) {
  try {
    const r = await fetch('/api/articles/get?id=' + encodeURIComponent(id));
    if (!r.ok) throw new Error('Server vrátil ' + r.status);
    const a = await r.json();

    if (typeof showTab === 'function') showTab('articles');

    const titleEl = $('artTitle');
    const editorEl = $('artEditor');
    const dateEl = $('artDate');
    const placeEl = $('artPlace');
    const sectionEl = $('artSection');

    if (titleEl) titleEl.value = a.title || '';
    if (editorEl) {
      editorEl.innerHTML = a.content || '';
      editorEl.dataset.editId = id;
    }
    if (dateEl) dateEl.value = a.date ? a.date.split('T')[0] : '';
    if (placeEl) placeEl.value = a.place || '';
    if (sectionEl) {
      sectionEl.value = a.sectionId || a.section || '';
      await loadArtSubsections();
    }

    const subEl = $('artSubsection');
    if (subEl) subEl.value = a.subsectionId || a.subsection || '';

    const btn = $('artSubmitBtn') || document.querySelector('#articles button[onclick*="createArticle"], #articles button[onclick*="updateArticle"]');
    if (btn) {
      btn.textContent = '💾 Uložit změny';
      btn.onclick = updateArticle;
    }

    setTimeout(() => setupArticleEditors(), 100);

  } catch (e) {
    alert('Nepodařilo se načíst článek pro úpravu');
    console.error(e);
  }
}

/* --- Vytvoření nového článku -------------------------- */
async function createArticle() {
  const title = $('artTitle')?.value.trim();
  const content = $('artEditor')?.innerHTML;
  if (!title || !content) return alert('Vyplň nadpis a obsah');

  const sectionId = $('artSection')?.value;
  const subsectionId = $('artSubsection')?.value;
  const date = $('artDate')?.value;
  const place = $('artPlace')?.value;

  const payload = {
    title,
    content,
    slug: generateSlug(title),
    sectionId: sectionId || null,
    subsectionId: subsectionId || null,
    date: date || new Date().toISOString().split('T')[0],
    place: place || '',
    published: true
  };

  try {
    const r = await fetch('/api/articles/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('Chyba ukládání');
  } catch (e) {
    alert('Nepodařilo se vytvořit článek');
    console.error(e);
    return;
  }

  resetArticleForm();
  loadArticles();
}

/* --- Uložení editovaného článku (OPRAVENO) ------------ */
async function updateArticle() {
  const editorEl = $('artEditor');
  const id = editorEl?.dataset?.editId;
  if (!id) return createArticle();

  const title = $('artTitle')?.value.trim();
  const content = editorEl?.innerHTML;
  if (!title || !content) return alert('Vyplň nadpis a obsah');

  const sectionId = $('artSection')?.value;
  const subsectionId = $('artSubsection')?.value;
  const date = $('artDate')?.value;
  const place = $('artPlace')?.value;

  const payload = {
    id,
    title,
    content,
    slug: generateSlug(title),
    sectionId: sectionId || null,
    subsectionId: subsectionId || null,
    date: date || new Date().toISOString().split('T')[0],
    place: place || '',
    published: true
  };

  try {
    const r = await fetch('/api/articles/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('Chyba ukládání');
  } catch (e) {
    alert('Nepodařilo se uložit změny');
    console.error(e);
    return;
  }

  resetArticleForm();
  loadArticles();
}

/* --- Publikovat článek znovu (NOVÉ) ------------------- */
async function publishArticle(id) {
  try {
    const r = await fetch('/api/articles/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!r.ok) throw new Error('Chyba publikování');
    loadArticles();
  } catch (e) {
    alert('Nepodařilo se publikovat článek');
    console.error(e);
  }
}

/* --- Reset formuláře článku --------------------------- */
function resetArticleForm() {
  const titleEl = $('artTitle');
  const editorEl = $('artEditor');
  const dateEl = $('artDate');
  const placeEl = $('artPlace');
  const sectionEl = $('artSection');
  const subEl = $('artSubsection');

  if (titleEl) titleEl.value = '';
  if (editorEl) {
    editorEl.innerHTML = '';
    delete editorEl.dataset.editId;
  }
  if (dateEl) dateEl.value = '';
  if (placeEl) placeEl.value = '';
  if (sectionEl) sectionEl.value = '';
  if (subEl) subEl.innerHTML = '<option value="">— Podsekce —</option>';

  const btn = $('artSubmitBtn') || document.querySelector('#articles button[onclick*="updateArticle"], #articles button[onclick*="createArticle"]');
  if (btn) {
    btn.textContent = 'Vytvořit článek';
    btn.onclick = createArticle;
  }

  hideImgToolbar();
}

/* --- Smazání článku ----------------------------------- */
async function deleteArticle(id) {
  if (!confirm('Opravdu smazat tento článek?')) return;
  try {
    const r = await fetch(`/api/articles/delete?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Chyba mazání');
    loadArticles();
  } catch (e) {
    alert('Nepodařilo se smazat článek');
    console.error(e);
  }
}
/* =========================================================
   DASHBOARD — ČÁST 5/5: Citáty, podsekce, cover, O Zajdovi, CSS, inicializace
   ========================================================= */

/* === Citáty ============================================ */

async function loadQuotes() {
  const tbody = $('quoteTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b;padding:1rem">Načítání...</td></tr>';
  try {
    const r = await fetch('/api/quotes/list');
    if (!r.ok) throw new Error();
    const data = await r.json();
    const arr = Array.isArray(data) ? data : [];
    if (!arr.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b;padding:1rem">Žádné citáty.</td></tr>';
      return;
    }
    tbody.innerHTML = arr.map(q => `
      <tr>
        <td style="padding:0.75rem;border-bottom:1px solid #334155">"${escapeHtml(q.text)}"</td>
        <td style="padding:0.75rem;border-bottom:1px solid #334155;color:#94a3b8">${escapeHtml(q.author) || '—'}</td>
        <td style="padding:0.75rem;border-bottom:1px solid #334155">
          <button onclick="deleteQuote('${encodeURIComponent(q.key || q.id)}')" class="btn btn-red btn-sm">Smazat</button>
        </td>
      </tr>`).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#ef4444;padding:1rem">Chyba načítání.</td></tr>';
  }
}

async function createQuote() {
  const text = $('qText')?.value.trim();
  if (!text) return alert('Zadej text citátu');
  try {
    await fetch('/api/quotes/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, author: $('qAuthor')?.value.trim() || '' })
    });
    $('qText').value = '';
    $('qAuthor').value = '';
    loadQuotes();
  } catch (e) {
    alert('Nepodařilo se uložit citát');
  }
}

async function deleteQuote(key) {
  if (!confirm('Smazat citát?')) return;
  try {
    await fetch(`/api/quotes/delete?key=${key}`, { method: 'DELETE' });
    loadQuotes();
  } catch {
    alert('Chyba mazání');
  }
}

/* === Podsekce ========================================== */

async function loadSubsections() {
  const tbody = $('subsectionTableBody');
  if (!tbody) return;
  const secs = ['travel', 'photo', 'projects', 'about'];
  const all = [];
  for (const sid of secs) {
    try {
      const r = await fetch('/api/subsections/by-section?sectionId=' + sid);
      if (r.ok) { const arr = await r.json(); all.push(...arr); }
    } catch {}
  }

  if (!all.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:1rem">Žádné podsekce.</td></tr>';
    return;
  }

  tbody.innerHTML = all.map(s => `
    <tr>
      <td style="padding:0.75rem;border-bottom:1px solid #334155">${escapeHtml(s.sectionId)}</td>
      <td style="padding:0.75rem;border-bottom:1px solid #334155">
        <div style="display:flex;align-items:center;gap:0.75rem">
          ${s.coverUrl ? `<img src="${s.coverUrl}" style="width:120px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #334155;flex-shrink:0">` : '<div style="width:120px;height:80px;background:#0f172a;border-radius:6px;border:1px solid #334155;flex-shrink:0"></div>'}
          <span>${escapeHtml(s.name)}</span>
        </div>
      </td>
      <td style="padding:0.75rem;border-bottom:1px solid #334155">${escapeHtml(s.slug)}</td>
      <td style="padding:0.75rem;border-bottom:1px solid #334155">${s.order || 0}</td>
      <td style="padding:0.75rem;border-bottom:1px solid #334155">
        <div style="display:flex;gap:0.5rem">
          <button onclick="pickSubsectionCover('${s.id}')" class="btn btn-blue btn-sm">Změnit cover</button>
          <button onclick="deleteSubsection('${s.id}')" class="btn btn-red btn-sm">Smazat</button>
        </div>
      </td>
    </tr>`).join('');
}

async function createSubsection() {
  const sec = $('ssSection')?.value;
  const name = $('ssName')?.value.trim();
  if (!sec || !name) return alert('Vyplň sekci a název');

  const slug = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  try {
    await fetch('/api/subsections/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId: sec,
        name,
        slug,
        order: parseInt($('ssOrder')?.value) || 0
      })
    });
    $('ssName').value = '';
    $('ssOrder').value = '0';
    loadSubsections();
  } catch {
    alert('Chyba vytváření podsekce');
  }
}

async function deleteSubsection(id) {
  if (!confirm('Smazat podsekci?')) return;
  try {
    await fetch(`/api/subsections/delete?id=${id}`, { method: 'DELETE' });
    loadSubsections();
  } catch {
    alert('Chyba mazání');
  }
}

async function pickSubsectionCover(id) {
  if (!G.photos || !G.photos.length) {
    alert('Galerie je prázdná. Nejprve nahraj fotky do galerie.');
    return;
  }
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `
    <div style="background:#1e293b;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #334155">
      <h3 style="margin-bottom:1rem;color:#f8fafc">Cover podsekce</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.5rem">
        ${G.photos.map(p => `<img src="${p.url}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="saveSubsectionCover('${id}','${p.url}')">`).join('')}
      </div>
      <div style="text-align:center;margin-top:1rem">
        <button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button>
      </div>
    </div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
}

async function saveSubsectionCover(id, url) {
  try {
    const r = await fetch('/api/subsections/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, coverUrl: url })
    });
    if (!r.ok) throw new Error('Server ' + r.status);
  } catch (e) {
    console.error('Chyba uložení coveru podsekce:', e);
    alert('Nepodařilo se uložit cover podsekce. Zkus to znovu.');
  } finally {
    const m = document.querySelector('.modal');
    if (m) m.remove();
    loadSubsections();
  }
}

/* === Sekce (Cover fotky) — OPRAVENO ==================== */

async function loadSectionCovers() {
  const box = $('sectionCovers');
  if (!box) return;
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
      if (r.ok) {
        const d = await r.json();
        url = d.coverUrl || d.url || '';
      }
    } catch (e) { console.error('Chyba načítání coveru sekce:', e); }

    html += `
      <div style="background:#1e293b;padding:0.75rem;border-radius:8px;border:1px solid #334155;text-align:center;min-width:140px">
        <div style="font-size:0.875rem;margin-bottom:0.5rem;color:#ffcc66">${escapeHtml(s.n)}</div>
        ${url ? `<img src="${url}" style="width:120px;height:80px;object-fit:cover;border-radius:6px;margin:0 auto 0.5rem;display:block;border:1px solid #334155">` : '<div style="width:120px;height:80px;background:#0f172a;border-radius:6px;margin:0 auto 0.5rem;border:1px solid #334155"></div>'}
        <button onclick="pickSectionCover('${s.id}')" class="btn btn-blue btn-sm">Změnit cover</button>
      </div>`;
  }
  html += '</div>';
  box.innerHTML = html;
}

function pickSectionCover(sectionId) {
  if (!G.photos || !G.photos.length) {
    alert('Galerie je prázdná. Nejprve nahraj fotky do galerie.');
    return;
  }
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `
    <div style="background:#1e293b;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #334155">
      <h3 style="margin-bottom:1rem;color:#f8fafc">Cover sekce: ${escapeHtml(sectionId)}</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.5rem">
        ${G.photos.map(p => `<img src="${p.url}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="saveSectionCover('${sectionId}','${p.url}')">`).join('')}
      </div>
      <div style="text-align:center;margin-top:1rem">
        <button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button>
      </div>
    </div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
}

/* OPRAVENO — spolehlivé uložení coveru s retry */
async function saveSectionCover(sectionId, url) {
  let success = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch('/api/sections/cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, coverUrl: url })
      });
      if (r.ok) { success = true; break; }
      throw new Error('Server ' + r.status);
    } catch (e) {
      console.error('Pokus ' + attempt + ' - chyba uložení coveru:', e);
      if (attempt < 3) await new Promise(res => setTimeout(res, 1000 * attempt));
    }
  }
  if (!success) {
    alert('Nepodařilo se uložit cover ani po 3 pokusech. Zkus to znovu.');
  }
  const m = document.querySelector('.modal');
  if (m) m.remove();
  await loadSectionCovers();
}

/* === O mně — OPRAVENO ================================== */

async function loadAbout() {
  try {
    const r = await fetch('/api/about/get');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json() || {};
    if ($('aboutTitle')) $('aboutTitle').value = d.title || '';
    if ($('aboutEditor')) {
      $('aboutEditor').innerHTML = d.text || '';
      setupArticleEditors();
    }
    const prev = $('aboutPreview');
    if (prev) prev.innerHTML = `<h4 style="color:#ffcc66;margin-bottom:0.5rem">${escapeHtml(d.title || 'O Zajdovi')}</h4><div style="line-height:1.6">${d.text || ''}</div>`;
  } catch (e) {
    console.error('About chyba:', e);
    if ($('aboutTitle')) $('aboutTitle').value = '';
    if ($('aboutEditor')) $('aboutEditor').innerHTML = '';
    if ($('aboutPreview')) $('aboutPreview').innerHTML = '<h4 style="color:#ffcc66">O Zajdovi</h4><div></div>';
  }
}

/* OPRAVENO — spolehlivé uložení s retry */
async function saveAbout() {
  const about = {
    title: $('aboutTitle')?.value || '',
    text: $('aboutEditor')?.innerHTML || ''
  };
  let success = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch('/api/about/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(about)
      });
      if (r.ok) { success = true; break; }
      throw new Error('Server ' + r.status);
    } catch (e) {
      console.error('Pokus ' + attempt + ' - chyba uložení about:', e);
      if (attempt < 3) await new Promise(res => setTimeout(res, 1000 * attempt));
    }
  }
  if (!success) {
    alert('Nepodařilo se uložit "O Zajdovi" ani po 3 pokusech.');
    return;
  }
  await loadAbout();
}

/* === Dynamické CSS pro editor ========================== */
(function injectEditorStyles() {
  if (document.getElementById('dashboard-editor-styles')) return;
  const style = document.createElement('style');
  style.id = 'dashboard-editor-styles';
  style.textContent = `
    #artEditor, #aboutEditor {
      min-height: 300px; max-height: 600px; overflow-y: auto;
      background: #0f172a; border: 1px solid #334155; border-radius: 8px;
      padding: 1rem; color: #e2e8f0; line-height: 1.7; font-size: 15px; outline: none;
    }
    #artEditor:focus, #aboutEditor:focus {
      border-color: #ff6600; box-shadow: 0 0 0 2px rgba(255,102,0,0.2);
    }
    #artEditor p, #aboutEditor p { margin-bottom: 0.75rem; }
    #artEditor h1, #aboutEditor h1,
    #artEditor h2, #aboutEditor h2,
    #artEditor h3, #aboutEditor h3 { color: #ffcc66; margin: 1rem 0 0.5rem; font-weight: 600; }
    #artEditor h1, #aboutEditor h1 { font-size: 24px; border-bottom: 1px solid rgba(255,102,0,0.3); padding-bottom: 0.3rem; }
    #artEditor h2, #aboutEditor h2 { font-size: 20px; }
    #artEditor h3, #aboutEditor h3 { font-size: 17px; color: #ffb366; }
    #artEditor ul, #aboutEditor ul,
    #artEditor ol, #aboutEditor ol { margin: 0.5rem 0 0.5rem 1.5rem; }
    #artEditor li, #aboutEditor li { margin-bottom: 0.25rem; }
    #artEditor a, #aboutEditor a { color: #60a5fa; text-decoration: underline; }
    #artEditor blockquote, #aboutEditor blockquote {
      border-left: 3px solid #ff6600; margin: 0.75rem 0; padding: 0.5rem 1rem;
      background: rgba(255,102,0,0.08); border-radius: 0 6px 6px 0; font-style: italic; color: #cbd5e1;
    }
    #artEditor hr, #aboutEditor hr { border: none; border-top: 1px solid #334155; margin: 1rem 0; }
    #artEditor img.editor-img, #aboutEditor img.editor-img {
      max-width: 100%; height: auto; border-radius: 6px; transition: outline 0.15s;
    }
    #artEditor img.editor-img[data-active], #aboutEditor img.editor-img[data-active] {
      outline: 3px solid #3b82f6;
    }
    #img-toolbar { animation: toolbarIn 0.2s ease; }
    @keyframes toolbarIn { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
    #img-toolbar button { white-space: nowrap; transition: all 0.15s; }
    #img-toolbar button:hover { transform: translateY(-1px); }
    .modal { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; padding: 20px; animation: modalIn 0.2s ease; }
    @keyframes modalIn { from { opacity: 0; } to { opacity: 1; } }
    .modal > div { animation: modalContentIn 0.25s ease; }
    @keyframes modalContentIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    #artEditor::-webkit-scrollbar, #aboutEditor::-webkit-scrollbar,
    .sub-articles::-webkit-scrollbar, .modal > div::-webkit-scrollbar { width: 6px; }
    #artEditor::-webkit-scrollbar-thumb, #aboutEditor::-webkit-scrollbar-thumb,
    .sub-articles::-webkit-scrollbar-thumb, .modal > div::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
    .article-preview { color: #94a3b8; font-size: 14px; line-height: 1.5; max-height: 120px; overflow: hidden; position: relative; }
    .article-preview::after { content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 40px; background: linear-gradient(to bottom, transparent, #1e293b); pointer-events: none; }
    .article-preview img { display: none; }
    .modal img[style*="cursor:pointer"] { transition: transform 0.15s, box-shadow 0.15s; }
    .modal img[style*="cursor:pointer"]:hover { transform: scale(1.03); box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
    .lightbox-modal { position: fixed; inset: 0; z-index: 3000; background: rgba(0,0,0,0.92); display: flex; align-items: center; justify-content: center; cursor: zoom-out; animation: lightboxIn 0.2s ease; }
    @keyframes lightboxIn { from { opacity: 0; } to { opacity: 1; } }
    .lightbox-modal img { max-width: 90vw; max-height: 90vh; border-radius: 8px; box-shadow: 0 0 40px rgba(0,0,0,0.8); cursor: default; }
    @media (max-width: 640px) {
      #img-toolbar { top: auto !important; bottom: 10px !important; left: 10px !important; right: 10px !important; transform: none !important; justify-content: center; padding: 8px; }
      #artEditor, #aboutEditor { min-height: 200px; font-size: 16px; }
    }
    .editor-toolbar { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; padding: 8px; background: #1e293b; border: 1px solid #334155; border-radius: 8px 8px 0 0; border-bottom: none; }
    .editor-toolbar button, .editor-toolbar select { background: #334155; color: #e2e8f0; border: 1px solid #475569; border-radius: 4px; padding: 4px 8px; font-size: 13px; cursor: pointer; transition: all 0.15s; }
    .editor-toolbar button:hover, .editor-toolbar select:hover { background: #475569; border-color: #ff6600; }
    .editor-toolbar select { padding: 3px 6px; }
    .editor-toolbar .sep { width: 1px; background: #475569; margin: 0 4px; }
  `;
  document.head.appendChild(style);
})();

/* === Inicializace při načtení ========================= */
(function initDashboard() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  function onReady() {
    injectEditorStyles();
    loadGallery().then(() => {
      if ($('articleList')) loadArticles();
      if ($('quoteTableBody')) loadQuotes();
      if ($('subsectionTableBody')) loadSubsections();
      if ($('sectionCovers')) loadSectionCovers();
      if ($('aboutPreview') || $('aboutEditor')) loadAbout();
      if ($('artSection')) loadArtSubsections();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(m => m.remove());
        hideImgToolbar();
      }
    });
  }
})();
