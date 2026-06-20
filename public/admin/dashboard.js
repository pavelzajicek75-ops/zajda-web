// ═══════════════════════════════════════
// AUTH, NAV, UTILS
// ═══════════════════════════════════════
fetch('/api/auth/me').then(r => { if (!r.ok) window.location = '/admin/login.html'; });

document.querySelectorAll('.nav-link').forEach(l => {
  l.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.section').forEach(x => x.classList.remove('active'));
    l.classList.add('active');
    document.getElementById(l.dataset.section).classList.add('active');
    loadSection(l.dataset.section);
  });
});

function logout() { fetch('/api/auth/logout', { method: 'POST' }).then(() => window.location = '/admin/login.html'); }

function loadSection(name) {
  if (name === 'galleries') loadGallery();
  if (name === 'articles') { loadArtSubsections(); loadArticles(); enhanceWysiwyg(); }
  if (name === 'quotes') loadQuotes();
  if (name === 'subsections') { loadSubsections(); loadSectionCovers(); }
  if (name === 'about') { loadAbout(); enhanceWysiwyg(); }
}

function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function fmtBytes(b) { return b ? (b / 1024 / 1024).toFixed(2) + ' MB' : '0 MB'; }

// ═══════════════════════════════════════
// LIGHTBOX
// ═══════════════════════════════════════
function openLightbox(src) {
  const m = document.createElement('div');
  m.className = 'modal'; m.style.cssText = 'background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;padding:1rem;z-index:2000;';
  m.innerHTML = `<div style="position:relative;max-width:95vw;max-height:95vh;display:flex;flex-direction:column;align-items:center;gap:0.75rem;">
    <img src="${src}" style="max-width:95vw;max-height:85vh;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
    <button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button>
  </div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
}

// ═══════════════════════════════════════
// GALERIE
// ═══════════════════════════════════════
let G = { photos: [], selected: new Set() };

async function loadGallery() {
  try { const r = await fetch('/api/photos/list?galleryId=main'); G.photos = await r.json(); renderGallery(); loadStats(); } catch (e) { console.error(e); }
}
async function loadStats() {
  try {
    const r = await fetch('/api/photos/stats?galleryId=main'), s = await r.json();
    const c = $('galCount'), g = $('galSize'), t = $('totalSize');
    if (c) c.textContent = (s.galCount || G.photos.length) + ' fotek';
    if (g) g.textContent = fmtBytes(s.galSize);
    if (t) t.textContent = 'R2: ' + fmtBytes(s.totalSize);
  } catch {
    if ($('galCount')) $('galCount').textContent = G.photos.length + ' fotek';
    if ($('galSize')) $('galSize').textContent = fmtBytes(G.photos.reduce((a, p) => a + (p.size || 0), 0));
  }
}
function $(id) { return document.getElementById(id); }

function renderGallery() {
  const mode = $('viewMode')?.value || 'grid', sort = $('sortMode')?.value || 'new', box = $('galleryView');
  if (!box) return;
  box.className = 'gallery-view ' + mode + '-view';
  let list = [...G.photos];
  const map = { new: ['uploaded', -1], old: ['uploaded', 1], name: ['name', 1], big: ['size', -1], small: ['size', 1] };
  const [k, dir] = map[sort] || ['uploaded', -1];
  list.sort((a, b) => { let av = a[k] || '', bv = b[k] || ''; if (typeof av === 'string') return dir === 1 ? av.localeCompare(bv) : bv.localeCompare(av); return av > bv ? dir : av < bv ? -dir : 0; });
  if (!list.length) { box.innerHTML = '<p style="color:#64748b;text-align:center;padding:2rem">Galerie je prázdná. Nahraj fotky.</p>'; return; }
  box.innerHTML = list.map(p => {
    const c = G.selected.has(p.id) ? 'checked' : '';
    if (mode === 'list') return `<div class="gallery-item" onclick="openEditor('${p.id}')"><input type="checkbox" class="sel" ${c} onclick="event.stopPropagation();toggleSel('${p.id}')"><img src="${p.url}" loading="lazy"><div class="meta"><strong>${escapeHtml(p.name)}</strong><span>${fmtBytes(p.size)} • ${new Date(p.uploaded).toLocaleDateString('cs')}</span></div></div>`;
    return `<div class="gallery-item" onclick="openEditor('${p.id}')"><input type="checkbox" class="sel" ${c} onclick="event.stopPropagation();toggleSel('${p.id}')"><img src="${p.url}" loading="lazy"></div>`;
  }).join('');
}
function toggleSel(id) { G.selected.has(id) ? G.selected.delete(id) : G.selected.add(id); const b = $('delBtn'); if (b) b.style.display = G.selected.size ? 'inline-flex' : 'none'; renderGallery(); }

async function bulkDelete() {
  if (!confirm(`Smazat ${G.selected.size} fotek?`)) return;
  const keys = Array.from(G.selected).map(id => G.photos.find(p => p.id === id)?.key).filter(Boolean).join(',');
  if (keys) await fetch(`/api/photos/delete?keys=${encodeURIComponent(keys)}`, { method: 'DELETE' });
  G.selected.clear(); const b = $('delBtn'); if (b) b.style.display = 'none'; loadGallery();
}
async function uploadFiles(input) {
  if (!input?.files?.length) return;
  for (const f of input.files) { const fd = new FormData(); fd.append('file', f); fd.append('galleryId', 'main'); try { await fetch('/api/photos/upload', { method: 'POST', body: fd }); } catch (e) {} }
  input.value = ''; loadGallery();
}

// ═══════════════════════════════════════
// EDITOR FOTOGRAFIÍ
// ═══════════════════════════════════════
let ED = {
  photo: null, img: null, scale: 1, rotate: 0, panX: 0, panY: 0,
  crop: 'free', export: 'max', blobUrl: null,
  filters: { exposure: 0, contrast: 0, saturation: 0, temp: 0, vignette: 0, sharpen: 0, denoise: 0, ai: false },
  cropRect: { x: 0, y: 0, w: 0, h: 0 },
  isDragging: false, isResizing: false, resizeDir: '', lastX: 0, lastY: 0
};

async function openEditor(id) {
  const p = G.photos.find(x => x.id === id); if (!p) return;
  ED.photo = p; ED.scale = 1; ED.rotate = 0; ED.panX = 0; ED.panY = 0; ED.crop = 'free'; ED.export = 'max';
  ED.filters = { exposure: 0, contrast: 0, saturation: 0, temp: 0, vignette: 0, sharpen: 0, denoise: 0, ai: false };
  if (ED.blobUrl) { URL.revokeObjectURL(ED.blobUrl); ED.blobUrl = null; }
  const aic = $('aiCheck'); if (aic) aic.checked = false;
  updateFilterLabels(); setCrop('free'); setExport('max');

  try {
    const r = await fetch(p.url); if (!r.ok) throw new Error('fetch failed');
    const blob = await r.blob(); const url = URL.createObjectURL(blob); ED.blobUrl = url;
    const img = new Image();
    img.onload = () => {
      ED.img = img; const preview = $('editPreview');
      const fit = preview ? Math.min(preview.clientWidth / img.naturalWidth, preview.clientHeight / img.naturalHeight, 1) : 1;
      ED.scale = fit; const zs = $('zoomSlider'); if (zs) { zs.min = Math.min(fit, 0.1).toFixed(2); zs.max = 4; zs.value = fit.toFixed(2); }
      $('editorModal')?.classList.remove('hidden');
      const el = $('editImg'); if (el) { el.src = url; updatePreviewTransform(); }
      // Vytvoř/resetuj vignette overlay
      let vig = document.querySelector('.vignette-overlay');
      if (!vig) { vig = document.createElement('div'); vig.className = 'vignette-overlay'; vig.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:4;border-radius:0;'; preview.appendChild(vig); }
      vig.style.opacity = 0;
      updateCropOverlay();
    };
    img.onerror = () => { alert('Obrázek se nepodařilo načíst.'); URL.revokeObjectURL(url); ED.blobUrl = null; };
    img.src = url;
  } catch { alert('Obrázek se nepodařilo načíst.'); }
}

function closeEditor() {
  $('editorModal')?.classList.add('hidden');
  if (ED.blobUrl) { URL.revokeObjectURL(ED.blobUrl); ED.blobUrl = null; }
  ED.img = null; ED.photo = null;
  const vig = document.querySelector('.vignette-overlay'); if (vig) vig.style.opacity = 0;
}

function editorSetZoom(v) { ED.scale = parseFloat(v); updatePreviewTransform(); }

function updatePreviewTransform() {
  const img = $('editImg'); if (!img) return;
  img.style.transform = `translate(${ED.panX}px, ${ED.panY}px) scale(${ED.scale}) rotate(${ED.rotate}deg)`;
  applyFilters();
}

function applyFilters() {
  const img = $('editImg'); if (!img) return;
  const f = ED.filters;
  let s = `brightness(${100 + f.exposure}%) contrast(${100 + f.contrast}%) saturate(${100 + f.saturation}%)`;
  if (f.temp > 0) s += ` sepia(${f.temp * 0.5}%)`; else s += ` hue-rotate(${f.temp * 0.3}deg)`;
  if (f.sharpen > 0) s += ` drop-shadow(0 0 ${f.sharpen * 0.05}px rgba(255,255,255,0.3)) contrast(${100 + f.sharpen * 0.5}%)`;
  if (f.denoise > 0) s += ` blur(${f.denoise * 0.01}px)`;
  img.style.filter = s;

  // Viněta přes overlay
  const vig = document.querySelector('.vignette-overlay');
  if (vig && f.vignette > 0) {
    vig.style.background = `radial-gradient(circle, transparent 30%, rgba(0,0,0,${f.vignette / 100}) 90%)`;
    vig.style.opacity = 1;
  } else if (vig) { vig.style.opacity = 0; }
}

function updateFilterLabels() {
  const f = ED.filters, ids = { exposure: 'fval-exposure', contrast: 'fval-contrast', saturation: 'fval-saturation', temp: 'fval-temp', vignette: 'fval-vignette', sharpen: 'fval-sharpen', denoise: 'fval-denoise' };
  for (const [k, id] of Object.entries(ids)) { const el = $(id); if (el) el.textContent = f[k]; }
}
function setFilter(key, val) { ED.filters[key] = parseInt(val); const el = $('fval-' + key); if (el) el.textContent = val; applyFilters(); }

function setCrop(mode) {
  ED.crop = mode;
  document.querySelectorAll('.editor-sidebar .tool-row:first-of-type .btn').forEach(b => b.classList.remove('btn-blue'));
  const labels = { free: 'Volný', '1:1': '1:1', '4:3': '4:3', '3:4': '3:4', '16:9': '16:9' };
  const btn = Array.from(document.querySelectorAll('.editor-sidebar .tool-row:first-of-type .btn')).find(b => b.textContent.trim() === labels[mode]);
  if (btn) btn.classList.add('btn-blue');
  updateCropOverlay();
}

function getCropRatio() {
  if (ED.crop === '1:1') return 1;
  if (ED.crop === '4:3') return 4 / 3;
  if (ED.crop === '3:4') return 3 / 4;
  if (ED.crop === '16:9') return 16 / 9;
  return 0; // free
}

function updateCropOverlay() {
  const layer = $('cropLayer'), rect = $('cropRect'), preview = $('editPreview');
  if (!preview) return;
  const W = preview.clientWidth, H = preview.clientHeight;

  if (ED.crop === 'free') { if (layer) layer.style.display = 'none'; return; }
  if (layer) layer.style.display = 'block';

  let w, h;
  if (ED.crop === '1:1') w = h = Math.min(W, H) * 0.6;
  else if (ED.crop === '4:3') { w = Math.min(W, H) * 0.6; h = w * 0.75; }
  else if (ED.crop === '3:4') { h = Math.min(W, H) * 0.6; w = h * 0.75; }
  else if (ED.crop === '16:9') { w = Math.min(W, H) * 0.7; h = w / 1.777; }
  else { w = W * 0.7; h = H * 0.7; }

  w = Math.min(w, W - 20); h = Math.min(h, H - 20);
  ED.cropRect = { x: (W - w) / 2, y: (H - h) / 2, w, h };

  if (rect) { rect.style.left = ED.cropRect.x + 'px'; rect.style.top = ED.cropRect.y + 'px'; rect.style.width = w + 'px'; rect.style.height = h + 'px'; }

  const mt = $('maskTop'); if (mt) mt.style.cssText = `left:0;top:0;width:${W}px;height:${ED.cropRect.y}px`;
  const mb = $('maskBottom'); if (mb) mb.style.cssText = `left:0;top:${ED.cropRect.y + h}px;width:${W}px;height:${H - ED.cropRect.y - h}px`;
  const ml = $('maskLeft'); if (ml) ml.style.cssText = `left:0;top:${ED.cropRect.y}px;width:${ED.cropRect.x}px;height:${h}px`;
  const mr = $('maskRight'); if (mr) mr.style.cssText = `left:${ED.cropRect.x + w}px;top:${ED.cropRect.y}px;width:${W - ED.cropRect.x - w}px;height:${h}px`;
}

function applyCrop() {
  if (!ED.img || ED.crop === 'free') return;
  if (ED.rotate !== 0) { alert('Pro ořez musí být rotace 0°. Klikni ↺ nebo ↻ pro návrat.'); return; }

  const preview = $('editPreview');
  const imgW = ED.img.naturalWidth, imgH = ED.img.naturalHeight;
  const previewW = preview.clientWidth, previewH = preview.clientHeight;

  // Spočítat, kde je obrázek vzhledem k preview
  const imgDisplayW = imgW * ED.scale;
  const imgDisplayH = imgH * ED.scale;
  const imgLeft = (previewW - imgDisplayW) / 2 + ED.panX;
  const imgTop = (previewH - imgDisplayH) / 2 + ED.panY;

  // Souřadnice cropu vůči obrázku
  let cX = (ED.cropRect.x - imgLeft) / ED.scale;
  let cY = (ED.cropRect.y - imgTop) / ED.scale;
  let cW = ED.cropRect.w / ED.scale;
  let cH = ED.cropRect.h / ED.scale;

  // Omezit na rozměry obrázku
  cX = Math.max(0, Math.min(cX, imgW));
  cY = Math.max(0, Math.min(cY, imgH));
  cW = Math.max(1, Math.min(cW, imgW - cX));
  cH = Math.max(1, Math.min(cH, imgH - cY));

  if (cW < 10 || cH < 10) { alert('Ořez je příliš malý.'); return; }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cW);
  canvas.height = Math.round(cH);
  canvas.getContext('2d').drawImage(ED.img, cX, cY, cW, cH, 0, 0, cW, cH);

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    if (ED.blobUrl) URL.revokeObjectURL(ED.blobUrl);
    ED.blobUrl = url;
    const img = new Image();
    img.onload = () => {
      ED.img = img; ED.crop = 'free'; ED.panX = 0; ED.panY = 0; ED.rotate = 0;
      const fit = Math.min(preview.clientWidth / img.naturalWidth, preview.clientHeight / img.naturalHeight, 1);
      ED.scale = fit; const zs = $('zoomSlider'); if (zs) zs.value = fit.toFixed(2);
      updatePreviewTransform(); updateCropOverlay(); if ($('cropLayer')) $('cropLayer').style.display = 'none';
    };
    img.src = url;
  }, 'image/jpeg', 0.95);
}

function setExport(size) { ED.export = size; ['max', '2000', 'fullhd'].forEach(s => { const b = $('ex-' + s); if (b) b.classList.toggle('btn-blue', s === size); }); }
function rotateEditor(deg) { ED.rotate = (ED.rotate + deg) % 360; updatePreviewTransform(); updateCropOverlay(); }

// ─── Crop drag & resize handlers ───
(function initCropSystem() {
  const preview = document.getElementById('editPreview');
  if (!preview) return;

  const onStart = (x, y, type, dir) => {
    if (!ED.img || ED.crop === 'free') return;
    ED.isDragging = (type === 'drag');
    ED.isResizing = (type === 'resize');
    ED.resizeDir = dir || '';
    ED.lastX = x; ED.lastY = y;
  };

  const onMove = (x, y) => {
    if (!ED.img || ED.crop === 'free') return;
    const dx = x - ED.lastX, dy = y - ED.lastY;
    ED.lastX = x; ED.lastY = y;
    const ratio = getCropRatio();
    let r = ED.cropRect;

    if (ED.isResizing) {
      let { x: nx, y: ny, w: nw, h: nh } = r;

      if (ED.resizeDir.includes('e')) nw = Math.max(50, nw + dx);
      if (ED.resizeDir.includes('s')) nh = Math.max(50, nh + dy);
      if (ED.resizeDir.includes('w')) { const w2 = Math.max(50, nw - dx); nx += nw - w2; nw = w2; }
      if (ED.resizeDir.includes('n')) { const h2 = Math.max(50, nh - dy); ny += nh - h2; nh = h2; }

      // Udržet poměr stran
      if (ratio > 0) {
        if (ED.resizeDir.includes('e') || ED.resizeDir.includes('w')) {
          nh = nw / ratio;
          if (ED.resizeDir.includes('n')) ny = r.y + r.h - nh;
        } else if (ED.resizeDir.includes('s') || ED.resizeDir.includes('n')) {
          nw = nh * ratio;
          if (ED.resizeDir.includes('w')) nx = r.x + r.w - nw;
        }
      }

      // Omezit na preview
      const pW = preview.clientWidth, pH = preview.clientHeight;
      if (nx < 0) { nw += nx; nx = 0; if (ratio > 0) nh = nw / ratio; }
      if (ny < 0) { nh += ny; ny = 0; if (ratio > 0) nw = nh * ratio; }
      if (nx + nw > pW) { nw = pW - nx; if (ratio > 0) nh = nw / ratio; }
      if (ny + nh > pH) { nh = pH - ny; if (ratio > 0) nw = nh * ratio; }

      ED.cropRect = { x: nx, y: ny, w: nw, h: nh };
      updateCropVisuals();
    } else if (ED.isDragging) {
      let nx = r.x + dx, ny = r.y + dy;
      const pW = preview.clientWidth, pH = preview.clientHeight;
      nx = Math.max(0, Math.min(nx, pW - r.w));
      ny = Math.max(0, Math.min(ny, pH - r.h));
      ED.cropRect = { ...r, x: nx, y: ny };
      updateCropVisuals();
    }
  };

  const onEnd = () => { ED.isDragging = false; ED.isResizing = false; ED.resizeDir = ''; };

  const updateCropVisuals = () => {
    const r = ED.cropRect, rect = $('cropRect'), W = preview.clientWidth, H = preview.clientHeight;
    if (rect) { rect.style.left = r.x + 'px'; rect.style.top = r.y + 'px'; rect.style.width = r.w + 'px'; rect.style.height = r.h + 'px'; }
    const mt = $('maskTop'); if (mt) mt.style.cssText = `left:0;top:0;width:${W}px;height:${r.y}px`;
    const mb = $('maskBottom'); if (mb) mb.style.cssText = `left:0;top:${r.y + r.h}px;width:${W}px;height:${H - r.y - r.h}px`;
    const ml = $('maskLeft'); if (ml) ml.style.cssText = `left:0;top:${r.y}px;width:${r.x}px;height:${r.h}px`;
    const mr = $('maskRight'); if (mr) mr.style.cssText = `left:${r.x + r.w}px;top:${r.y}px;width:${W - r.x - r.w}px;height:${r.h}px`;
  };

  preview.addEventListener('mousedown', e => {
    if (!ED.img) return;
    const h = e.target.closest('.crop-handle');
    if (h) { e.stopPropagation(); onStart(e.clientX, e.clientY, 'resize', h.dataset.dir); return; }
    if (e.target.closest('#cropRect')) { onStart(e.clientX, e.clientY, 'drag'); return; }
  });
  window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onEnd);

  preview.addEventListener('touchstart', e => {
    if (!ED.img || e.touches.length !== 1) return;
    const t = e.touches[0], el = document.elementFromPoint(t.clientX, t.clientY);
    const h = el?.closest('.crop-handle');
    if (h) { e.stopPropagation(); onStart(t.clientX, t.clientY, 'resize', h.dataset.dir); }
    else if (el?.closest('#cropRect')) { onStart(t.clientX, t.clientY, 'drag'); }
  }, { passive: false });
  window.addEventListener('touchmove', e => { if ((ED.isDragging || ED.isResizing) && e.touches.length === 1) { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
  window.addEventListener('touchend', onEnd);
})();

function getExportDim(w, h) {
  if (ED.export === 'max') return { w, h };
  if (ED.export === '2000') { const s = Math.min(1, 2000 / Math.max(w, h)); return { w: Math.round(w * s), h: Math.round(h * s) }; }
  if (ED.export === 'fullhd') { const s = Math.min(1, 1920 / w, 1080 / h); return { w: Math.round(w * s), h: Math.round(h * s) }; }
  return { w, h };
}

async function saveEditor(mode) {
  if (!ED.img) return;
  const img = ED.img, out = document.createElement('canvas'), dim = getExportDim(img.naturalWidth, img.naturalHeight);
  out.width = dim.w; out.height = dim.h; const ctx = out.getContext('2d');
  ctx.save(); ctx.translate(dim.w / 2, dim.h / 2); ctx.rotate(ED.rotate * Math.PI / 180); ctx.scale(ED.scale, ED.scale);
  const ratio = Math.min(dim.w / img.naturalWidth, dim.h / img.naturalHeight);
  ctx.drawImage(img, -img.naturalWidth * ratio / 2 + ED.panX / ED.scale, -img.naturalHeight * ratio / 2 + ED.panY / ED.scale, img.naturalWidth * ratio, img.naturalHeight * ratio);
  ctx.restore();

  const f = ED.filters;
  // Doostření (unsharp mask)
  if (f.sharpen > 0) {
    const temp = document.createElement('canvas'); temp.width = dim.w; temp.height = dim.h; const tctx = temp.getContext('2d');
    tctx.filter = `contrast(${100 + f.sharpen}%)`; tctx.drawImage(out, 0, 0);
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = Math.min(f.sharpen / 100, 0.6);
    ctx.drawImage(temp, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // Redukce šumu
  if (f.denoise > 0) {
    const temp = document.createElement('canvas'); temp.width = dim.w; temp.height = dim.h; const tctx = temp.getContext('2d');
    tctx.filter = `blur(${f.denoise * 0.02}px) contrast(${100 + f.denoise * 0.3}%)`;
    tctx.drawImage(out, 0, 0);
    ctx.drawImage(temp, 0, 0);
  }
  if (f.ai) { ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = 'rgba(200,220,255,0.08)'; ctx.fillRect(0, 0, dim.w, dim.h); ctx.globalCompositeOperation = 'source-over'; }
  if (f.vignette > 0) {
    const grad = ctx.createRadialGradient(dim.w / 2, dim.h / 2, dim.w * 0.25, dim.w / 2, dim.h / 2, dim.w * 0.9);
    grad.addColorStop(0, 'transparent'); grad.addColorStop(1, `rgba(0,0,0,${f.vignette / 100})`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, dim.w, dim.h);
  }
  const blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.92));
  const fd = new FormData(); fd.append('file', blob, ED.photo.name || 'edited.jpg'); fd.append('galleryId', 'main'); fd.append('oldKey', ED.photo.key); fd.append('mode', mode);
  await fetch('/api/photos/update', { method: 'POST', body: fd });
  closeEditor(); loadGallery();
}
// ═══════════════════════════════════════
// WYSIWYG + mazání fotek
// ═══════════════════════════════════════
function execCmd(cmd, val) { document.execCommand(cmd, false, val); }

function enhanceWysiwyg() {
  ['artEditor', 'aboutEditor'].forEach(id => {
    const editor = $(id); if (!editor) return;
    const toolbar = editor.previousElementSibling;
    if (toolbar && !toolbar.querySelector('.btn-del-img')) {
      const btn = document.createElement('button'); btn.className = 'btn btn-sm btn-red btn-del-img'; btn.innerHTML = '🗑️'; btn.title = 'Smazat vybranou fotku';
      btn.onclick = () => deleteSelectedImg(id); toolbar.appendChild(btn);
    }
    // Klik na img v editoru = označení (ne lightbox)
    editor.querySelectorAll('img').forEach(img => {
      img.onclick = e => { e.preventDefault(); e.stopPropagation(); const r = document.createRange(); r.selectNode(img); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); };
    });
  });
}
function deleteSelectedImg(editorId) {
  const editor = $(editorId), sel = window.getSelection();
  if (!sel.rangeCount) return;
  let node = sel.getRangeAt(0).commonAncestorContainer; if (node.nodeType === 3) node = node.parentElement;
  const img = node.closest ? node.closest('img') : null;
  if (img && editor.contains(img)) { img.remove(); sel.removeAllRanges(); }
}

function insertImgTo(editorId, align) {
  if (!G.photos.length) { alert('Nejdřív nahraj fotky do galerie.'); return; }
  const editor = $(editorId);
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div style="background:#1e293b;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #334155"><h3 style="margin-bottom:1rem;color:#f8fafc">Vložit fotku</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.5rem">${G.photos.map(p => `<img src="${p.url}" style="width:100%;height:120px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="insertImgUrl('${editorId}','${p.url}','${align}')">`).join('')}</div><div style="text-align:center;margin-top:1rem"><button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button></div></div>`;
  m.onclick = e => { if (e.target === m) m.remove(); }; document.body.appendChild(m);
}
function insertImgUrl(editorId, url, align) {
  const editor = $(editorId);
  let style = 'max-width:400px;width:100%;height:auto;border-radius:6px;margin:0.5rem 0;display:block;cursor:pointer;';
  if (align === 'left') style += 'float:left;margin:0.5rem 1rem 0.5rem 0;';
  if (align === 'right') style += 'float:right;margin:0.5rem 0 0.5rem 1rem;';
  if (align === 'center') style += 'margin:0.5rem auto;';
  const img = `<img src="${url}" style="${style}" onclick="openLightbox('${url}')">`;
  editor.focus(); document.execCommand('insertHTML', false, img);
  // Re-bind click on new img
  setTimeout(() => { const ed = $(editorId); if (ed) ed.querySelectorAll('img').forEach(im => { im.onclick = e => { e.preventDefault(); e.stopPropagation(); const r = document.createRange(); r.selectNode(im); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }; }); }, 0);
  const m = document.querySelector('.modal'); if (m) m.remove();
}

// ═══════════════════════════════════════
// ČLÁNKY
// ═══════════════════════════════════════
async function loadArtSubsections() {
  const sec = $('artSection')?.value, sel = $('artSubsection'); if (!sel) return;
  if (!sec) { sel.innerHTML = '<option value="">— Podsekce —</option>'; return; }
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
  $('artTitle').value = ''; $('artEditor').innerHTML = ''; $('artDate').value = ''; $('artPlace').value = ''; loadArticles();
}
async function deleteArticle(id) { if (!confirm('Smazat článek?')) return; await fetch(`/api/articles/delete?id=${id}`, { method: 'DELETE' }); loadArticles(); }

// ═══════════════════════════════════════
// CITÁTY
// ═══════════════════════════════════════
async function loadQuotes() {
  const tbody = $('quoteTableBody'); if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b">Načítání...</td></tr>';
  try { const r = await fetch('/api/quotes/list'), data = await r.json(); if (!data.length) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b">Žádné citáty.</td></tr>'; return; } tbody.innerHTML = data.map(q => `<tr><td>"${escapeHtml(q.text)}"</td><td>${escapeHtml(q.author) || '—'}</td><td><button onclick="deleteQuote('${encodeURIComponent(q.key)}')" class="btn btn-red btn-sm">Smazat</button></td></tr>`).join(''); } catch { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#ef4444">Chyba.</td></tr>'; }
}
async function createQuote() {
  const text = $('qText')?.value.trim(); if (!text) return alert('Zadej text citátu');
  await fetch('/api/quotes/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, author: $('qAuthor')?.value.trim() }) });
  $('qText').value = ''; $('qAuthor').value = ''; loadQuotes();
}
async function deleteQuote(key) { if (!confirm('Smazat?')) return; await fetch(`/api/quotes/delete?key=${key}`, { method: 'DELETE' }); loadQuotes(); }

// ═══════════════════════════════════════
// PODSEKCE + COVERY
// ═══════════════════════════════════════
async function loadSubsections() {
  const tbody = $('subsectionTableBody'); if (!tbody) return;
  const secs = ['travel', 'photo', 'projects', 'about'], all = [];
  for (const sid of secs) { try { const r = await fetch('/api/subsections/by-section?sectionId=' + sid); const arr = await r.json(); all.push(...arr); } catch {} }
  tbody.innerHTML = all.map(s => `<tr>
    <td>${escapeHtml(s.sectionId)}</td>
    <td>${s.coverUrl ? `<img src="${s.coverUrl}" style="width:40px;height:30px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:0.5rem">` : ''}${escapeHtml(s.name)}</td>
    <td>${escapeHtml(s.slug)}</td>
    <td>${s.order || 0}</td>
    <td>
      <button onclick="pickSubsectionCover('${s.id}')" class="btn btn-blue btn-sm">Cover</button>
      <button onclick="deleteSubsection('${s.id}')" class="btn btn-red btn-sm">Smazat</button>
    </td>
  </tr>`).join('');
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
  if (!G.photos.length) { alert('Galerie je prázdná.'); return; }
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div style="background:#1e293b;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #334155"><h3 style="margin-bottom:1rem;color:#f8fafc">Cover podsekce</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.5rem">${G.photos.map(p => `<img src="${p.url}" style="width:100%;height:120px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="saveSubsectionCover('${id}','${p.url}')">`).join('')}</div><div style="text-align:center;margin-top:1rem"><button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button></div></div>`;
  m.onclick = e => { if (e.target === m) m.remove(); }; document.body.appendChild(m);
}
async function saveSubsectionCover(id, url) {
  await fetch('/api/subsections/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, coverUrl: url }) });
  const m = document.querySelector('.modal'); if (m) m.remove(); loadSubsections();
}

// Cover hlavních sekcí
async function loadSectionCovers() {
  const box = $('sectionCovers'); if (!box) return;
  const secs = [{id:'travel',n:'Cestování'},{id:'photo',n:'Fotografování'},{id:'projects',n:'Projekty'},{id:'about',n:'O Zajdovi'}];
  let html = '<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem">';
  for (const s of secs) {
    let url = '';
    try { const r = await fetch('/api/sections/cover?sectionId=' + s.id); const d = await r.json(); url = d.url || ''; } catch {}
    html += `<div style="background:#1e293b;padding:0.75rem;border-radius:8px;border:1px solid #334155;text-align:center;min-width:100px">
      <div style="font-size:0.875rem;margin-bottom:0.5rem">${escapeHtml(s.n)}</div>
      ${url ? `<img src="${url}" style="width:80px;height:60px;object-fit:cover;border-radius:4px;margin:0 auto 0.5rem;display:block">` : '<div style="width:80px;height:60px;background:#0f172a;border-radius:4px;margin:0 auto 0.5rem"></div>'}
      <button onclick="pickSectionCover('${s.id}')" class="btn btn-blue btn-sm">Změnit</button>
    </div>`;
  }
  html += '</div>'; box.innerHTML = html;
}
function pickSectionCover(sectionId) {
  if (!G.photos.length) { alert('Galerie je prázdná.'); return; }
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div style="background:#1e293b;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #334155"><h3 style="margin-bottom:1rem;color:#f8fafc">Cover sekce</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.5rem">${G.photos.map(p => `<img src="${p.url}" style="width:100%;height:120px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="saveSectionCover('${sectionId}','${p.url}')">`).join('')}</div><div style="text-align:center;margin-top:1rem"><button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button></div></div>`;
  m.onclick = e => { if (e.target === m) m.remove(); }; document.body.appendChild(m);
}
async function saveSectionCover(sectionId, url) {
  try { const r = await fetch(url); const blob = await r.blob(); const fd = new FormData(); fd.append('file', blob, 'cover.jpg'); fd.append('sectionId', sectionId); await fetch('/api/sections/cover', { method: 'POST', body: fd }); } catch (e) { console.error(e); }
  const m = document.querySelector('.modal'); if (m) m.remove(); loadSectionCovers();
}

// ═══════════════════════════════════════
// O ZAJDOVI
// ═══════════════════════════════════════
async function loadAbout() {
  try { const r = await fetch('/api/about/get'), d = await r.json(); $('aboutTitle').value = d.title || ''; $('aboutEditor').innerHTML = d.text || ''; $('aboutPreview').innerHTML = `<h4>${escapeHtml(d.title || 'O Zajdovi')}</h4><div>${d.text || ''}</div>`; } catch {}
}
async function saveAbout() {
  await fetch('/api/about/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: $('aboutTitle')?.value || '', text: $('aboutEditor')?.innerHTML || '' }) });
  loadAbout();
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
// Přidáme tlačítko Oříznout do editor sidebar (jednou)
(function() {
  const sidebar = document.querySelector('.editor-sidebar');
  if (sidebar && !sidebar.querySelector('.crop-btn')) {
    const h4 = document.createElement('h4'); h4.textContent = 'Akce'; sidebar.appendChild(h4);
    const btn = document.createElement('button'); btn.className = 'btn btn-green btn-sm crop-btn'; btn.textContent = '✂️ Oříznout'; btn.onclick = applyCrop; sidebar.appendChild(btn);
  }
  // Panel pro cover sekci do Podsekce
  const subSec = document.getElementById('subsections');
  if (subSec) {
    const form = subSec.querySelector('.form-card');
    if (form && !subSec.querySelector('#sectionCovers')) {
      const wrap = document.createElement('div'); wrap.id = 'sectionCovers'; form.parentNode.insertBefore(wrap, form);
    }
  }
})();
loadGallery();
