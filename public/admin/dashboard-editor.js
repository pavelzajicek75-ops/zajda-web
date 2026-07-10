/* =========================================================
   DASHBOARD EDITOR — ČÁST 1/5
   ========================================================= */

/* === UTILITY === */
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

/* === SVG FILTRY === */
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
      <filter id="ed-sharpen-dynamic" x="-20%" y="-20%" width="140%" height="140%">
        <feConvolveMatrix id="ed-sharpen-dynamic-matrix" order="3" kernelMatrix="0 0 0 0 1 0 0 0 0" preserveAlpha="true"/>
      </filter>
      <filter id="ed-tone-dynamic" x="-20%" y="-20%" width="140%" height="140%">
        <feComponentTransfer>
          <feFuncR id="ed-tone-r" type="table" tableValues="0 1"/>
          <feFuncG id="ed-tone-g" type="table" tableValues="0 1"/>
          <feFuncB id="ed-tone-b" type="table" tableValues="0 1"/>
        </feComponentTransfer>
      </filter>
    </defs>
  `;
  document.body.appendChild(svg);
})();

/* Přepočítá jemnost doostření plynule (k = 0 .. 1.5) místo dřívějšího
   dvoustupňového přepínání normal/strong. Používá se pro živý náhled i export. */
function sharpenKernelForStrength(strength) {
  const k = Math.max(0, Math.min(100, strength)) / 100 * 1.5;
  return { k, kernel: [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0] };
}

function updateSharpenFilter(strength) {
  const matrix = document.getElementById('ed-sharpen-dynamic-matrix');
  if (!matrix) return;
  const { kernel } = sharpenKernelForStrength(strength);
  matrix.setAttribute('kernelMatrix', kernel.map(v => v.toFixed(3)).join(' '));
}

/* === STÍNY / SVĚTLA (tónová křivka) ===
   Vlastní jednoduchá tónová křivka: stíny zvedají/snižují tmavé partie,
   světla zvedají/snižují světlé partie, střední tóny se skoro nemění. */
function toneCurveValue(x, shadows, highlights) {
  const s = shadows / 100, h = highlights / 100;
  const shadowWeight = Math.pow(1 - x, 2);
  const highlightWeight = Math.pow(x, 2);
  const y = x + s * 0.5 * shadowWeight + h * 0.5 * highlightWeight;
  return Math.max(0, Math.min(1, y));
}

function buildToneTableSVG(shadows, highlights, steps) {
  const vals = [];
  for (let i = 0; i <= steps; i++) {
    vals.push(toneCurveValue(i / steps, shadows, highlights).toFixed(4));
  }
  return vals.join(' ');
}

function buildToneLUT256(shadows, highlights) {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(toneCurveValue(i / 255, shadows, highlights) * 255);
  }
  return lut;
}

function updateToneFilter(shadows, highlights) {
  if (!shadows && !highlights) return;
  const table = buildToneTableSVG(shadows, highlights, 32);
  ['ed-tone-r', 'ed-tone-g', 'ed-tone-b'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('tableValues', table);
  });
}

/* Pixelová aplikace tónové křivky při finálním ukládání (přesná, 256 kroků) */
function applyToneLUT(ctx, w, h, shadows, highlights) {
  if (!shadows && !highlights) return;
  const lut = buildToneLUT256(shadows, highlights);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]];
    d[i + 1] = lut[d[i + 1]];
    d[i + 2] = lut[d[i + 2]];
  }
  ctx.putImageData(imgData, 0, 0);
}

/* === ŽIVOST (vibrance) ===
   Chytřejší sytost: méně syté pixely zesílí víc, už syté (a pleťové tóny)
   šetří — na rozdíl od obyčejné sytosti, která táhne všechno stejně. */
function applyVibrance(ctx, w, h, amount) {
  if (!amount) return;
  const amt = amount / 100;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const max = Math.max(r, g, b);
    const avg = (r + g + b) / 3;
    const sat = (max - avg) / 255;
    const factor = amt * (1 - sat) * 1.6;
    d[i] = Math.max(0, Math.min(255, r + (r - avg) * factor));
    d[i + 1] = Math.max(0, Math.min(255, g + (g - avg) * factor));
    d[i + 2] = Math.max(0, Math.min(255, b + (b - avg) * factor));
  }
  ctx.putImageData(imgData, 0, 0);
}

/* === STAV EDITORU === */
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
  filters: { exposure: 0, contrast: 0, saturation: 0, vibrance: 0, shadows: 0, highlights: 0, temp: 0, vignette: 0, sharpen: 0, denoise: 0, ai: false },
  cropRect: null,
  isDraggingImage: false,
  isDraggingCrop: false,
  isResizingCrop: false,
  resizeDir: '',
  lastX: 0,
  lastY: 0
};

/* === GALERIE === */
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
   DASHBOARD EDITOR — ČÁST 2/5
   ========================================================= */

/* === EDITOR: otevření/zavření === */
async function openEditor(id) {
  const p = G.photos.find(x => x.id === id);
  if (!p) return;
  ED.photo = p;
  ED.scale = 1; ED.rotate = 0; ED.panX = 0; ED.panY = 0;
  ED.crop = 'free'; ED.export = 'max'; ED.cropRect = null;
  ED.filters = { exposure: 0, contrast: 0, saturation: 0, vibrance: 0, shadows: 0, highlights: 0, temp: 0, vignette: 0, sharpen: 0, denoise: 0, ai: false };
  if (ED.blobUrl) { URL.revokeObjectURL(ED.blobUrl); ED.blobUrl = null; }
  const aic = $('aiCheck');
  if (aic) aic.checked = false;
  updateFilterLabels();
  updateSharpenFilter(0);
  updateToneFilter(0, 0);
  const presetSel = $('presetSelect');
  if (presetSel) presetSel.value = '';
  syncFilterSlidersFromState();
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

/* === EDITOR: zoom/rotace === */
function editorSetZoom(v) { ED.scale = parseFloat(v); updatePreviewTransform(); }

function updatePreviewTransform() {
  const img = $('editImg');
  if (!img) return;
  img.style.transform = `translate(${ED.panX}px, ${ED.panY}px) scale(${ED.scale}) rotate(${ED.rotate}deg)`;
  applyFilters();
}

function rotateEditor(deg) { ED.rotate = (ED.rotate + deg) % 360; updatePreviewTransform(); }

/* === EDITOR: filtry === */
function applyFilters() {
  const img = $('editImg');
  if (!img) return;
  const f = ED.filters;
  let s = `brightness(${100 + f.exposure}%) contrast(${100 + f.contrast}%) saturate(${100 + f.saturation}%)`;
  if (f.vibrance) s += ` saturate(${100 + f.vibrance * 0.5}%)`;
  if (f.temp > 0) s += ` sepia(${f.temp * 0.5}%)`;
  else s += ` hue-rotate(${f.temp * 0.3}deg)`;
  if (f.denoise > 0) s += ` blur(${f.denoise * 0.05}px)`;
  if (f.shadows || f.highlights) {
    updateToneFilter(f.shadows, f.highlights);
    s += ' url(#ed-tone-dynamic)';
  }
  if (f.sharpen > 0 || f.ai) {
    const effectiveStrength = f.ai ? Math.max(f.sharpen, 80) : f.sharpen;
    updateSharpenFilter(effectiveStrength);
    s += ' url(#ed-sharpen-dynamic)';
  }
  if (f.ai) s += ' brightness(105%) contrast(110%) saturate(115%)';
  /* Vynucené překreslení — bez tohohle prohlížeč občas ignoruje změny uvnitř
     dynamických SVG filtrů (doostření, stíny/světla), protože samotný text
     vlastnosti filter zůstává stejný (mění se jen atributy uvnitř <svg>). */
  img.style.filter = 'none';
  void img.offsetHeight;
  img.style.filter = s;
  const vig = document.querySelector('.vignette-overlay');
  if (vig && f.vignette > 0) {
    vig.style.background = `radial-gradient(circle at center, transparent 30%, rgba(0,0,0,${f.vignette / 100}) 90%)`;
    vig.style.opacity = 1;
  } else if (vig) { vig.style.opacity = 0; }
}

function updateFilterLabels() {
  const f = ED.filters;
  const ids = { exposure:'fval-exposure', contrast:'fval-contrast', saturation:'fval-saturation', vibrance:'fval-vibrance', shadows:'fval-shadows', highlights:'fval-highlights', temp:'fval-temp', vignette:'fval-vignette', sharpen:'fval-sharpen', denoise:'fval-denoise' };
  for (const [k, id] of Object.entries(ids)) { const el = $(id); if (el) el.textContent = f[k]; }
}

/* Nastaví polohy všech posuvníků podle aktuálního ED.filters (např. po výběru předvolby) */
function syncFilterSlidersFromState() {
  const f = ED.filters;
  const ids = ['exposure', 'contrast', 'saturation', 'vibrance', 'shadows', 'highlights', 'temp', 'vignette', 'sharpen', 'denoise'];
  ids.forEach(k => { const el = $('fslider-' + k); if (el) el.value = f[k]; });
  const aic = $('aiCheck');
  if (aic) aic.checked = !!f.ai;
  updateFilterLabels();
}

function setFilter(key, val) {
  ED.filters[key] = parseInt(val);
  const el = $('fval-' + key);
  if (el) el.textContent = val;
  if (key === 'sharpen') updateSharpenFilter(ED.filters.sharpen);
  if (key === 'shadows' || key === 'highlights') updateToneFilter(ED.filters.shadows, ED.filters.highlights);
  const presetSel = $('presetSelect');
  if (presetSel) presetSel.value = '';
  applyFilters();
}

/* === PŘEDVOLBY (jako styly ve Photoshopu) === */
const FILTER_PRESETS = {
  none:         { exposure: 0,   contrast: 0,   saturation: 0,   vibrance: 0,   shadows: 0,   highlights: 0,   temp: 0,   vignette: 0,  sharpen: 0,  denoise: 0, ai: false },
  bw:           { exposure: 0,   contrast: 15,  saturation: -100, vibrance: 0,  shadows: 5,   highlights: -10, temp: 0,   vignette: 15, sharpen: 15, denoise: 0, ai: false },
  vintage:      { exposure: -5,  contrast: -10, saturation: -25, vibrance: -10, shadows: 10,  highlights: -15, temp: 25,  vignette: 35, sharpen: 0,  denoise: 5, ai: false },
  warm:         { exposure: 5,   contrast: 5,   saturation: 5,   vibrance: 15,  shadows: 5,   highlights: 0,   temp: 30,  vignette: 0,  sharpen: 0,  denoise: 0, ai: false },
  cold:         { exposure: 0,   contrast: 8,   saturation: -5,  vibrance: 5,   shadows: 0,   highlights: 0,   temp: -30, vignette: 0,  sharpen: 0,  denoise: 0, ai: false },
  highContrast: { exposure: 0,   contrast: 35,  saturation: 10,  vibrance: 10,  shadows: -20, highlights: 20,  temp: 0,   vignette: 15, sharpen: 25, denoise: 0, ai: false },
  vivid:        { exposure: 5,   contrast: 12,  saturation: 15,  vibrance: 40,  shadows: 5,   highlights: -5,  temp: 5,   vignette: 0,  sharpen: 15, denoise: 0, ai: false },
  filmNoir:     { exposure: -10, contrast: 25,  saturation: -60, vibrance: 0,   shadows: -15, highlights: 15,  temp: -10, vignette: 45, sharpen: 10, denoise: 0, ai: false }
};

function applyPreset(name) {
  const preset = FILTER_PRESETS[name];
  if (!preset) return;
  ED.filters = { ...preset };
  syncFilterSlidersFromState();
  updateSharpenFilter(ED.filters.sharpen);
  updateToneFilter(ED.filters.shadows, ED.filters.highlights);
  applyFilters();
}

/* === EDITOR: crop systém === */
function setCrop(mode) {
  ED.crop = mode;
  document.querySelectorAll('.editor-sidebar .crop-mode-row .btn').forEach(b => b.classList.remove('btn-blue'));
  const labels = { free:'Volný', '1:1':'1:1', '4:3':'4:3', '3:4':'3:4', '16:9':'16:9' };
  const btn = Array.from(document.querySelectorAll('.editor-sidebar .crop-mode-row .btn')).find(b => b.textContent.trim() === labels[mode]);
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
    if (target.closest('.crop-handle')) { e.preventDefault(); e.stopPropagation(); ED.isResizingCrop = true; ED.resizeDir = target.closest('.crop-handle').dataset.dir; ED.lastX = t.clientX; ED.lastY = t.clientY; return; }
    if (target.closest('#cropRect')) { e.preventDefault(); e.stopPropagation(); ED.isDraggingCrop = true; ED.lastX = t.clientX; ED.lastY = t.clientY; return; }
    if (target.closest('#editImg') || target === preview) { ED.isDraggingImage = true; ED.lastX = t.clientX; ED.lastY = t.clientY; }
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
   DASHBOARD EDITOR — ČÁST 3/5
   ========================================================= */

/* === EXPORT === */
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

/* === UPLOAD (PNG + retry) === */
function applySharpen(ctx, w, h, strength) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const out = ctx.createImageData(w, h);
  const od = out.data;
  const { kernel } = sharpenKernelForStrength(strength);
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

async function uploadWithRetry(fd, maxRetries) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const r = await fetch('/api/photos/update', { method: 'POST', body: fd });
      if (r.ok) return true;
      if (r.status >= 400 && r.status < 500 && r.status !== 429) throw new Error('Chyba ' + r.status);
      throw new Error('Server ' + r.status);
    } catch (e) {
      if (attempt === maxRetries) throw e;
      await new Promise(res => setTimeout(res, 1000 * attempt));
    }
  }
  return false;
}

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
  let filterStr = `brightness(${100 + f.exposure}%) contrast(${100 + f.contrast}%) saturate(${100 + f.saturation}%)`;
  if (f.temp > 0) filterStr += ` sepia(${f.temp * 0.5}%)`;
  else filterStr += ` hue-rotate(${f.temp * 0.3}deg)`;
  if (f.denoise > 0) filterStr += ` blur(${f.denoise * 0.05}px)`;
  ctx.filter = filterStr;
  ctx.save();
  ctx.translate(dim.w / 2, dim.h / 2);
  ctx.rotate(ED.rotate * Math.PI / 180);
  const drawScale = Math.min(dim.w / img.naturalWidth, dim.h / img.naturalHeight);
  ctx.drawImage(img, -img.naturalWidth * drawScale / 2, -img.naturalHeight * drawScale / 2, img.naturalWidth * drawScale, img.naturalHeight * drawScale);
  ctx.restore();
  if (f.shadows || f.highlights) {
    applyToneLUT(ctx, dim.w, dim.h, f.shadows, f.highlights);
  }
  if (f.vibrance) {
    applyVibrance(ctx, dim.w, dim.h, f.vibrance);
  }
  if (f.sharpen > 0 || f.ai) {
    const effectiveStrength = f.ai ? Math.max(f.sharpen, 80) : f.sharpen;
    applySharpen(ctx, dim.w, dim.h, effectiveStrength);
  }
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
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, dim.w, dim.h);
  }
  const blob = await new Promise(r => out.toBlob(r, 'image/png'));
  const fd = new FormData();
  fd.append('file', blob, ED.photo.name || 'edited.png');
  fd.append('galleryId', 'main');
  fd.append('oldKey', ED.photo.key);
  fd.append('mode', mode);
  try {
    await uploadWithRetry(fd, 3);
  } catch (e) {
    alert('Nepodařilo se uložit fotku po 3 pokusech: ' + e.message);
    return;
  }
  closeEditor();
  await loadGallery();
}

/* === WYSIWYG TOOLBAR === */
function execCmd(c, v) {
  document.execCommand(c, false, v);
  const ed = document.activeElement;
  if (ed && (ed.id === 'artEditor' || ed.id === 'aboutEditor')) ed.focus();
}
function setFontName(n) { execCmd('fontName', n); }
function setFontSize(s) { execCmd('fontSize', s); }
function setForeColor(c) { execCmd('foreColor', c); }
function setBackColor(c) { execCmd('hiliteColor', c); }
function setHeading(t) { execCmd('formatBlock', t); }
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
function insertLink() { const u = prompt('Zadej URL:', 'https://'); if (u) execCmd('createLink', u); }
function unlink() { execCmd('unlink'); }
function toggleBold() { execCmd('bold'); }
function toggleItalic() { execCmd('italic'); }
function toggleUnderline() { execCmd('underline'); }
function toggleStrike() { execCmd('strikeThrough'); }

/* === OBRÁZKY V EDITORU === */
let currentActiveImg = null;

function setupArticleEditors() {
  ['artEditor', 'aboutEditor'].forEach(id => {
    const ed = $(id);
    if (!ed) return;
    ed.addEventListener('click', e => {
      const img = e.target.closest('img.editor-img');
      if (!img) {
        ed.querySelectorAll('img.editor-img').forEach(i => { i.style.outline = ''; i.removeAttribute('data-active'); });
        currentActiveImg = null;
        hideImgToolbar();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      ed.querySelectorAll('img.editor-img').forEach(i => { i.style.outline = ''; i.removeAttribute('data-active'); });
      img.style.outline = '3px solid #3b82f6';
      img.setAttribute('data-active', '1');
      currentActiveImg = img;
      showImgToolbar(img);
    });
    ed.addEventListener('dragstart', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });
  });
}

/* Menu pro úpravu obrázku (velikost/zarovnání/obtékání/pořadí/smazání) je teď
   zakotvené přímo v horní liště WYSIWYG editoru (.editor-toolbar), místo
   plovoucího okna na obrazovce. */
function showImgToolbar(img) {
  const editorEl = img.closest('#artEditor') || img.closest('#aboutEditor');
  const hostToolbar = editorEl ? editorEl.previousElementSibling : null;

  let bar = $('img-toolbar');
  if (bar && hostToolbar && bar.parentElement !== hostToolbar) {
    bar.remove();
    bar = null;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'img-toolbar';
    bar.style.cssText = 'display:none;gap:6px;flex-wrap:wrap;width:100%;margin-top:6px;padding-top:6px;border-top:1px dashed #475569;';
    if (hostToolbar) hostToolbar.appendChild(bar);
    else document.body.appendChild(bar);
  }
  bar.innerHTML = `
    <button onclick="imgToolbarAction('smaller')" class="btn btn-sm">- Menší</button>
    <button onclick="imgToolbarAction('bigger')" class="btn btn-sm">+ Větší</button>
    <button onclick="imgToolbarAction('left')" class="btn btn-sm" title="Obtékat text vpravo od obrázku">◀ Vlevo (obtékat)</button>
    <button onclick="imgToolbarAction('center')" class="btn btn-sm" title="Bez obtékání textu">Střed</button>
    <button onclick="imgToolbarAction('right')" class="btn btn-sm" title="Obtékat text vlevo od obrázku">Vpravo ▶ (obtékat)</button>
    <button onclick="imgToolbarAction('up')" class="btn btn-sm">↑ Nahoru</button>
    <button onclick="imgToolbarAction('down')" class="btn btn-sm">↓ Dolů</button>
    <button onclick="imgToolbarAction('delete')" class="btn btn-red btn-sm">🗑 Smazat</button>
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

function deleteSelectedImg() {
  var ed = $('aboutEditor') || $('artEditor');
  if (!ed) return;
  var img = ed.querySelector('img[data-active]') || currentActiveImg;
  if (img) { img.remove(); hideImgToolbar(); }
}

function moveImageUp() {
  var ed = $('aboutEditor') || $('artEditor');
  if (!ed) return;
  var img = ed.querySelector('img[data-active]') || currentActiveImg;
  if (!img) return;
  var p = img.previousElementSibling;
  if (p) img.parentNode.insertBefore(img, p);
}

function moveImageDown() {
  var ed = $('aboutEditor') || $('artEditor');
  if (!ed) return;
  var img = ed.querySelector('img[data-active]') || currentActiveImg;
  if (!img) return;
  var n = img.nextElementSibling;
  if (n) img.parentNode.insertBefore(n, img);
}

document.addEventListener('click', e => {
  if (!e.target.closest('#img-toolbar') && !e.target.closest('img[data-active]')) {
    hideImgToolbar();
    document.querySelectorAll('img[data-active]').forEach(i => { i.style.outline = ''; i.removeAttribute('data-active'); });
  }
});

function insertImgTo(editorId, align) {
  if (!G.photos || !G.photos.length) { alert('Nejdřív nahraj fotky do galerie.'); return; }
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `
    <div style="background:#131a2c;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #263252">
      <h3 style="margin-bottom:1rem;color:#eef1f8">Vložit fotku</h3>
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

/* === PODSEKCE FORMULÁŘ === */
async function loadArtSubsections() {
  const sec = $('artSection')?.value;
  const sel = $('artSubsection');
  if (!sel) return;
  if (!sec) { sel.innerHTML = '<option value="">— Podsekce —</option>'; return; }
  try {
    const r = await fetch('/api/subsections/by-section?sectionId=' + sec);
    const arr = await r.json();
    sel.innerHTML = '<option value="">— Podsekce —</option>' + arr.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  } catch {
    sel.innerHTML = '<option value="">— Podsekce —</option>';
  }
}
/* =========================================================
   DASHBOARD EDITOR — ČÁST 4/5
   ========================================================= */

/* === ČLÁNKY: seznam === */
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
      const pubStatus = a.published
        ? '<span style="color:#22c55e;font-size:12px">✅ Publikováno</span>'
        : '<span style="color:#ef4444;font-size:12px">⏸ Skryto</span>';
      const toggleBtn = a.published
        ? `<button onclick="unpublishArticle('${a.id}')" class="btn btn-sm" style="background:#f59e0b;color:#fff;border:none;padding:4px 12px;border-radius:6px;cursor:pointer">⏸ Skrýt</button>`
        : `<button onclick="publishArticle('${a.id}')" class="btn btn-sm" style="background:#22c55e;color:#fff;border:none;padding:4px 12px;border-radius:6px;cursor:pointer">👁 Zobrazit</button>`;
      return `
      <div class="card" style="margin-bottom:1rem;padding:1rem;background:#131a2c;border:1px solid #263252;border-radius:10px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.3rem">
          <h4 style="color:#ffc857;margin:0">${escapeHtml(a.title)}</h4>
          ${pubStatus}
        </div>
        <p style="color:#92a0bc;font-size:13px;margin-bottom:0.5rem">
          ${a.section || ''} ${a.subsection || ''} • ${a.place || ''} • ${new Date(a.date || a.created).toLocaleDateString('cs')}
        </p>
        ${excerpt ? `<p style="color:#cbd5e1;font-size:14px;margin-bottom:0.75rem;line-height:1.5">${escapeHtml(excerpt)}</p>` : ''}
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button onclick="editArticle('${a.id}')" class="btn btn-blue btn-sm">✏️ Upravit</button>
          ${toggleBtn}
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

/* === ČLÁNKY: editace === */
async function editArticle(id) {
  try {
    const r = await fetch('/api/articles/get?id=' + encodeURIComponent(id));
    if (!r.ok) throw new Error('Server vrátil ' + r.status);
    const a = await r.json();
    if (typeof showTab === 'function') showTab('articles');
    if ($('artTitle')) $('artTitle').value = a.title || '';
    if ($('artEditor')) {
      $('artEditor').innerHTML = a.content || '';
      $('artEditor').dataset.editId = id;
    }
    if ($('artDate')) $('artDate').value = a.date ? a.date.split('T')[0] : '';
    if ($('artPlace')) $('artPlace').value = a.place || '';
    if ($('artSection')) {
      $('artSection').value = a.sectionId || a.section || '';
      await loadArtSubsections();
    }
    if ($('artSubsection')) $('artSubsection').value = a.subsectionId || a.subsection || '';

    var btn = document.getElementById('artSubmitBtn');
    if (!btn) btn = document.querySelector('#articles button[onclick*="createArticle"]');
    if (!btn) btn = document.querySelector('#articles button[onclick*="updateArticle"]');
    if (!btn) btn = document.querySelector('#articles .btn-blue');
    if (!btn) btn = document.querySelector('#articles button[type="submit"]');
    if (!btn) btn = document.querySelector('#articles button');
    if (btn) {
      btn.textContent = '💾 Uložit změny a publikovat';
      btn.setAttribute('onclick', 'updateArticle()');
      btn.onclick = updateArticle;
    }
    setTimeout(() => setupArticleEditors(), 100);
  } catch (e) {
    alert('Nepodařilo se načíst článek pro úpravu');
    console.error(e);
  }
}


/* === ČLÁNKY: vytvoření === */
async function createArticle() {
  const title = $('artTitle')?.value.trim();
  const content = $('artEditor')?.innerHTML;
  if (!title || !content) return alert('Vyplň nadpis a obsah');
  const payload = {
    title, content,
    slug: generateSlug(title),
    sectionId: $('artSection')?.value || null,
    subsectionId: $('artSubsection')?.value || null,
    date: $('artDate')?.value || new Date().toISOString().split('T')[0],
    place: $('artPlace')?.value || '',
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

/* === ČLÁNKY: update === */
async function updateArticle() {
  const editorEl = $('artEditor');
  const id = editorEl?.dataset?.editId;
  if (!id) return createArticle();
  const title = $('artTitle')?.value.trim();
  const content = editorEl?.innerHTML;
  if (!title || !content) return alert('Vyplň nadpis a obsah');
  const payload = {
    id, title, content,
    slug: generateSlug(title),
    sectionId: $('artSection')?.value || null,
    subsectionId: $('artSubsection')?.value || null,
    date: $('artDate')?.value || new Date().toISOString().split('T')[0],
    place: $('artPlace')?.value || '',
    published: true
  };
  try {
    const r = await fetch('/api/articles/update', {
      method: 'PUT',
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

/* === ČLÁNKY: skrýt/zobrazit === */
async function publishArticle(id) {
  try {
    const r = await fetch('/api/articles/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, published: true })
    });
    if (!r.ok) throw new Error('Chyba publikování');
    loadArticles();
  } catch (e) {
    alert('Nepodařilo se publikovat článek');
    console.error(e);
  }
}

async function unpublishArticle(id) {
  try {
    const r = await fetch('/api/articles/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, published: false })
    });
    if (!r.ok) throw new Error('Chyba skrývání');
    loadArticles();
  } catch (e) {
    alert('Nepodařilo se skrýt článek');
    console.error(e);
  }
}

/* === ČLÁNKY: reset formuláře === */
function resetArticleForm() {
  if ($('artTitle')) $('artTitle').value = '';
  if ($('artEditor')) {
    $('artEditor').innerHTML = '';
    delete $('artEditor').dataset.editId;
  }
  if ($('artDate')) $('artDate').value = '';
  if ($('artPlace')) $('artPlace').value = '';
  if ($('artSection')) $('artSection').value = '';
  if ($('artSubsection')) $('artSubsection').innerHTML = '<option value="">— Podsekce —</option>';
  const btn = $('artSubmitBtn')
    || document.querySelector('#articles button[onclick*="updateArticle"]')
    || document.querySelector('#articles button[onclick*="createArticle"]')
    || document.querySelector('#articles .btn-blue');
  if (btn) {
    btn.textContent = 'Vytvořit článek';
    btn.removeAttribute('onclick');
    btn.onclick = createArticle;
  }
  hideImgToolbar();
}

/* === ČLÁNKY: smazání === */
async function deleteArticle(id) {
  if (!confirm('Opravdu smazat tento článek?')) return;
  try {
    const r = await fetch('/api/articles/delete?id=' + encodeURIComponent(id), { method: 'DELETE' });
    if (!r.ok) throw new Error('Chyba mazání');
    loadArticles();
  } catch (e) {
    alert('Nepodařilo se smazat článek');
    console.error(e);
  }
}
/* =========================================================
   DASHBOARD EDITOR — ČÁST 5/5
   ========================================================= */

/* === CITÁTY === */
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
        <td style="padding:0.75rem;border-bottom:1px solid #263252">"${escapeHtml(q.text)}"</td>
        <td style="padding:0.75rem;border-bottom:1px solid #263252;color:#92a0bc">${escapeHtml(q.author) || '—'}</td>
        <td style="padding:0.75rem;border-bottom:1px solid #263252">
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
    await fetch('/api/quotes/delete?key=' + key, { method: 'DELETE' });
    loadQuotes();
  } catch {
    alert('Chyba mazání');
  }
}

/* === PODSEKCE === */
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
      <td style="padding:0.75rem;border-bottom:1px solid #263252">${escapeHtml(s.sectionId)}</td>
      <td style="padding:0.75rem;border-bottom:1px solid #263252">
        <div style="display:flex;align-items:center;gap:0.75rem">
          ${s.coverUrl ? `<img src="${s.coverUrl}" style="width:120px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #263252;flex-shrink:0">` : '<div style="width:120px;height:80px;background:#0a0f1c;border-radius:6px;border:1px solid #263252;flex-shrink:0"></div>'}
          <span>${escapeHtml(s.name)}</span>
        </div>
      </td>
      <td style="padding:0.75rem;border-bottom:1px solid #263252">${escapeHtml(s.slug)}</td>
      <td style="padding:0.75rem;border-bottom:1px solid #263252">${s.order || 0}</td>
      <td style="padding:0.75rem;border-bottom:1px solid #263252">
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
      body: JSON.stringify({ sectionId: sec, name, slug, order: parseInt($('ssOrder')?.value) || 0 })
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
    await fetch('/api/subsections/delete?id=' + id, { method: 'DELETE' });
    loadSubsections();
  } catch {
    alert('Chyba mazání');
  }
}

async function pickSubsectionCover(id) {
  if (!G.photos || !G.photos.length) { alert('Galerie je prázdná. Nejprve nahraj fotky.'); return; }
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `
    <div style="background:#131a2c;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #263252">
      <h3 style="margin-bottom:1rem;color:#eef1f8">Cover podsekce</h3>
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
    await fetch('/api/subsections/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, coverUrl: url })
    });
  } catch {
    alert('Chyba uložení coveru');
  } finally {
    const m = document.querySelector('.modal');
    if (m) m.remove();
    loadSubsections();
  }
}

/* === COVER SEKCE === */
async function loadSectionCovers() {
  const box = $('sectionCovers');
  if (!box) return;
  const secs = [
    { id: 'travel', n: 'Cestování' },
    { id: 'photo', n: 'Fotografování' },
    { id: 'projects', n: 'Projekty' },
    { id: 'about', n: 'O Zajdovi' }
  ];
  var ts = Date.now();
  var html = '<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem">';
  for (const s of secs) {
    var url = '';
    try {
      const r = await fetch('/api/sections/cover?sectionId=' + s.id + '&_t=' + ts);
      if (r.ok) {
        const d = await r.json();
        url = d.coverUrl || d.url || '';
      }
    } catch (e) { console.error('Chyba načítání coveru sekce:', e); }
    if (url) url = url + (url.includes('?') ? '&' : '?') + '_t=' + ts;
    html += '<div style="background:#131a2c;padding:0.75rem;border-radius:8px;border:1px solid #263252;text-align:center;min-width:140px"><div style="font-size:0.875rem;margin-bottom:0.5rem;color:#ffc857">' + escapeHtml(s.n) + '</div>' + (url ? '<img src="' + url + '" style="width:120px;height:80px;object-fit:cover;border-radius:6px;margin:0 auto 0.5rem;display:block;border:1px solid #263252">' : '<div style="width:120px;height:80px;background:#0a0f1c;border-radius:6px;margin:0 auto 0.5rem;border:1px solid #263252"></div>') + '<button onclick="pickSectionCover(\'' + s.id + '\')" class="btn btn-blue btn-sm">Změnit cover</button></div>';
  }
  html += '</div>';
  box.innerHTML = html;
}

function pickSectionCover(sectionId) {
  if (!G.photos || !G.photos.length) { alert('Galerie je prázdná.'); return; }
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = '<div style="background:#131a2c;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #263252"><h3 style="margin-bottom:1rem;color:#eef1f8">Cover sekce: ' + escapeHtml(sectionId) + '</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.5rem">' + G.photos.map(function(p) { return '<img src="' + p.url + '" style="width:100%;height:110px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="saveSectionCover(\'' + sectionId + '\',\'' + p.url + '\')">'; }).join('') + '</div><div style="text-align:center;margin-top:1rem"><button onclick="this.closest(\'.modal\').remove()" class="btn btn-red">Zavřít</button></div></div>';
  m.onclick = function(e) { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
}

async function saveSectionCover(sectionId, url) {
  try {
    var absUrl = url.startsWith('http') ? url : window.location.origin + url;
    var resp = await fetch('/api/sections/cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: sectionId, photoUrl: absUrl })
    });
    if (!resp.ok) {
      var err = await resp.text();
      throw new Error(err);
    }
  } catch (e) {
    console.error('Chyba uložení coveru:', e);
    alert('Nepodařilo se uložit cover: ' + e.message);
  } finally {
    var m = document.querySelector('.modal');
    if (m) m.remove();
    loadSectionCovers();
  }
}

/* === O ZAJDOVI === */
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
    if (prev) prev.innerHTML = `<h4 style="color:#ffc857;margin-bottom:0.5rem">${escapeHtml(d.title || 'O Zajdovi')}</h4><div style="line-height:1.6">${d.text || ''}</div>`;
  } catch (e) {
    console.error('About chyba:', e);
    if ($('aboutTitle')) $('aboutTitle').value = '';
    if ($('aboutEditor')) $('aboutEditor').innerHTML = '';
    if ($('aboutPreview')) $('aboutPreview').innerHTML = '<h4 style="color:#ffc857">O Zajdovi</h4><div></div>';
  }
}

async function saveAbout() {
  const about = {
    title: $('aboutTitle')?.value || '',
    text: $('aboutEditor')?.innerHTML || ''
  };
  try {
    const r = await fetch('/api/about/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(about)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    loadAbout();
  } catch (e) {
    console.error('Chyba uložení about:', e);
    alert('Chyba uložení');
  }
}

/* === CSS STYLY === */
function injectEditorStyles() {
  /* Všechny tyto styly už žijí v style.css (s novým barevným systémem).
     Funkce zůstává kvůli zpětné kompatibilitě volání z initDashboardEditor(),
     ale už nic nevkládá — jinak by starými natvrdo zapsanými barvami
     přepisovala novou paletu. */
  return;
}

/* === INICIALIZACE === */
function initDashboardEditor() {
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
}

initDashboardEditor();
