// ═══════════════════════════════════════
// KONFIGURACE
// ═══════════════════════════════════════
const SECTIONS = [
  { id: 'travel', name: 'Cestování / Travel' },
  { id: 'photo', name: 'Fotografování / Photo' },
  { id: 'projects', name: 'Projekty / Projects' },
  { id: 'about', name: 'O Zajdovi / About' }
];

// ═══════════════════════════════════════
// STAV
// ═══════════════════════════════════════
let G = { photos: [], selected: new Set() };
let aboutData = { title: '', text: '', photos: [], subsections: [] };
let ED = { photo: null, img: null, scale: 1, rotate: 0, panX: 0, panY: 0, crop: 'free', export: 'max', filters: { exposure: 0, contrast: 0, saturation: 0, temp: 0, vignette: 0, sharpen: 0, ai: false }, drag: false, resize: null, lx: 0, ly: 0, cropX: 0, cropY: 0, cropW: 0, cropH: 0 };

// ═══════════════════════════════════════
// AUTH & NAV
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

function logout() {
  fetch('/api/auth/logout', { method: 'POST' }).then(() => window.location = '/admin/login.html');
}

function loadSection(name) {
  if (name === 'galleries') loadGallery();
  if (name === 'articles') { loadArtSections(); loadArticles(); }
  if (name === 'quotes') loadQuotes();
  if (name === 'subsections') loadSubsections();
  if (name === 'about') loadAbout();
}

function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function fmtBytes(b) { if (!b) return '0 B'; const u = ['B','KB','MB','GB']; let i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; } return b.toFixed(1) + ' ' + u[i]; }

// ═══════════════════════════════════════
// GALERIE
// ═══════════════════════════════════════
async function loadGallery() {
  try {
    const res = await fetch('/api/photos/list?galleryId=main');
    G.photos = await res.json();
    renderGallery();
    loadStats();
  } catch (e) { console.error('Galerie chyba:', e); }
}

async function loadStats() {
  try {
    const res = await fetch('/api/photos/stats');
    const s = await res.json();
    const c = document.getElementById('galCount'), g = document.getElementById('galSize'), t = document.getElementById('totalSize');
    if (c) c.textContent = (s.galCount || G.photos.length) + ' fotek';
    if (g) g.textContent = fmtBytes(s.galSize);
    if (t) t.textContent = 'R2: ' + fmtBytes(s.totalSize);
  } catch {
    const c = document.getElementById('galCount'), g = document.getElementById('galSize');
    if (c) c.textContent = G.photos.length + ' fotek';
    if (g) g.textContent = fmtBytes(G.photos.reduce((a, p) => a + (p.size || 0), 0));
  }
}

function renderGallery() {
  const mode = document.getElementById('viewMode')?.value || 'grid';
  const sort = document.getElementById('sortMode')?.value || 'new';
  const box = document.getElementById('galleryView');
  if (!box) return;
  box.className = 'gallery-view ' + mode + '-view';

  let list = [...G.photos];
  const map = { new: ['uploaded', -1], old: ['uploaded', 1], name: ['name', 1], big: ['size', -1], small: ['size', 1] };
  const [k, dir] = map[sort] || ['uploaded', -1];
  list.sort((a, b) => {
    let av = a[k] || '', bv = b[k] || '';
    if (typeof av === 'string') return dir === 1 ? av.localeCompare(bv) : bv.localeCompare(av);
    return av > bv ? dir : av < bv ? -dir : 0;
  });

  if (!list.length) { box.innerHTML = '<p style="color:#64748b;text-align:center;padding:2rem">Galerie je prázdná. Nahraj fotky.</p>'; return; }

  box.innerHTML = list.map(p => {
    const checked = G.selected.has(p.id) ? 'checked' : '';
    if (mode === 'list') {
      return `<div class="gallery-item" onclick="openEditor('${p.id}')">
        <input type="checkbox" class="sel" ${checked} onclick="event.stopPropagation(); toggleSel('${p.id}')">
        <img src="${p.url}" alt="" loading="lazy">
        <div class="meta"><strong>${escapeHtml(p.name)}</strong><span>${fmtBytes(p.size)} • ${new Date(p.uploaded).toLocaleDateString('cs')}</span></div>
      </div>`;
    }
    return `<div class="gallery-item" onclick="openEditor('${p.id}')">
      <input type="checkbox" class="sel" ${checked} onclick="event.stopPropagation(); toggleSel('${p.id}')">
      <img src="${p.url}" alt="" loading="lazy">
    </div>`;
  }).join('');

  const b = document.getElementById('delBtn');
  if (b) b.style.display = G.selected.size ? 'inline-flex' : 'none';
}

function toggleSel(id) {
  G.selected.has(id) ? G.selected.delete(id) : G.selected.add(id);
  renderGallery();
}

async function bulkDelete() {
  if (!G.selected.size) return;
  if (!confirm(`Smazat ${G.selected.size} fotek?`)) return;
  const keys = Array.from(G.selected).map(id => G.photos.find(p => p.id === id)?.key).filter(Boolean).join(',');
  if (keys) await fetch(`/api/photos/delete?keys=${encodeURIComponent(keys)}`, { method: 'DELETE' });
  G.selected.clear();
  const b = document.getElementById('delBtn'); if (b) b.style.display = 'none';
  loadGallery();
}

async function uploadFiles(input) {
  if (!input?.files?.length) return;
  for (const file of input.files) {
    const fd = new FormData(); fd.append('file', file); fd.append('galleryId', 'main');
    try { await fetch('/api/photos/upload', { method: 'POST', body: fd }); } catch (e) { console.error(e); }
  }
  input.value = ''; loadGallery();
}

// ═══════════════════════════════════════
// EDITOR FOTOGRAFIÍ
// ═══════════════════════════════════════
function openEditor(id) {
  const p = G.photos.find(x => x.id === id);
  if (!p) return;
  ED.photo = p; ED.scale = 1; ED.rotate = 0; ED.panX = 0; ED.panY = 0; ED.crop = 'free'; ED.export = 'max';
  ED.filters = { exposure: 0, contrast: 0, saturation: 0, temp: 0, vignette: 0, sharpen: 0, ai: false };
  const ai = document.getElementById('aiCheck'); if (ai) ai.checked = false;
  updateFilterLabels(); setCrop('free'); setExport('max');

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    ED.img = img;
    const modal = document.getElementById('editorModal');
    if (modal) modal.classList.remove('hidden');
    const imgEl = document.getElementById('editImg');
    if (imgEl) {
      imgEl.src = p.url + '?t=' + Date.now();
      imgEl.style.width = 'auto'; imgEl.style.height = 'auto';
      imgEl.style.maxWidth = '100%'; imgEl.style.maxHeight = '100%';
      updatePreviewTransform();
    }
    updateCropOverlay();
  };
  img.onerror = () => alert('Obrázek se nepodařilo načíst.');
  img.src = p.url + '?t=' + Date.now();
}

function closeEditor() {
  const m = document.getElementById('editorModal');
  if (m) m.classList.add('hidden');
  ED.img = null; ED.photo = null;
}

function editorSetZoom(v) { ED.scale = parseFloat(v); updatePreviewTransform(); }

function updatePreviewTransform() {
  const img = document.getElementById('editImg');
  if (!img) return;
  img.style.transform = `translate(${ED.panX}px, ${ED.panY}px) scale(${ED.scale}) rotate(${ED.rotate}deg)`;
  applyFilters();
}

function applyFilters() {
  const img = document.getElementById('editImg');
  if (!img) return;
  const f = ED.filters;
  let s = `brightness(${100 + f.exposure}%) contrast(${100 + f.contrast}%) saturate(${100 + f.saturation}%)`;
  if (f.temp > 0) s += ` sepia(${f.temp * 0.5}%)`; else s += ` hue-rotate(${f.temp * 0.3}deg)`;
  img.style.filter = s;
}

function updateFilterLabels() {
  const f = ED.filters, ids = { exposure: 'fval-exposure', contrast: 'fval-contrast', saturation: 'fval-saturation', temp: 'fval-temp', vignette: 'fval-vignette', sharpen: 'fval-sharpen' };
  for (const [k, id] of Object.entries(ids)) { const el = document.getElementById(id); if (el) el.textContent = f[k]; }
}

function setFilter(key, val) {
  ED.filters[key] = parseInt(val || 0);
  const el = document.getElementById('fval-' + key); if (el) el.textContent = val;
  applyFilters();
}

function setCrop(mode) {
  ED.crop = mode;
  document.querySelectorAll('.editor-sidebar .tool-row:first-of-type .btn').forEach(b => b.classList.remove('btn-blue'));
  const labels = { free: 'Volný', '1:1': '1:1', '4:3': '4:3', '3:4': '3:4', '16:9': '16:9' };
  const btn = Array.from(document.querySelectorAll('.editor-sidebar .tool-row:first-of-type .btn')).find(b => b.textContent.trim() === labels[mode]);
  if (btn) btn.classList.add('btn-blue');
  updateCropOverlay();
}

function updateCropOverlay() {
  const layer = document.getElementById('cropLayer');
  const rect = document.getElementById('cropRect');
  const preview = document.getElementById('editPreview');
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
  ED.cropW = w; ED.cropH = h;
  ED.cropX = (W - w) / 2; ED.cropY = (H - h) / 2;

  if (rect) { rect.style.left = ED.cropX + 'px'; rect.style.top = ED.cropY + 'px'; rect.style.width = w + 'px'; rect.style.height = h + 'px'; }

  if (document.getElementById('maskTop')) document.getElementById('maskTop').style.cssText = `left:0;top:0;width:${W}px;height:${ED.cropY}px`;
  if (document.getElementById('maskBottom')) document.getElementById('maskBottom').style.cssText = `left:0;top:${ED.cropY + h}px;width:${W}px;height:${H - ED.cropY - h}px`;
  if (document.getElementById('maskLeft')) document.getElementById('maskLeft').style.cssText = `left:0;top:${ED.cropY}px;width:${ED.cropX}px;height:${h}px`;
  if (document.getElementById('maskRight')) document.getElementById('maskRight').style.cssText = `left:${ED.cropX + w}px;top:${ED.cropY}px;width:${W - ED.cropX - w}px;height:${h}px`;
}

function setExport(size) {
  ED.export = size;
  ['max', '2000', 'fullhd'].forEach(s => {
    const b = document.getElementById('ex-' + s); if (b) b.classList.toggle('btn-blue', s === size);
  });
}

function rotateEditor(deg) { ED.rotate = (ED.rotate + deg) % 360; updatePreviewTransform(); }

// Editor drag (attached once)
(function initEditorDrag() {
  const preview = document.getElementById('editPreview');
  if (!preview) return;
  const start = (x, y) => { if (ED.resize) return; ED.drag = true; ED.lx = x; ED.ly = y; };
  const move = (x, y) => { if (!ED.drag) return; ED.panX += x - ED.lx; ED.panY += y - ED.ly; ED.lx = x; ED.ly = y; updatePreviewTransform(); };
  const end = () => { ED.drag = false; };

  preview.addEventListener('mousedown', e => { if (e.target.closest('.crop-handle') || e.target.id === 'cropRect') return; start(e.clientX, e.clientY); });
  window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
  window.addEventListener('mouseup', end);
  preview.addEventListener('touchstart', e => { if (e.target.closest('.crop-handle') || e.target.id === 'cropRect') return; if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  window.addEventListener('touchmove', e => { if (ED.drag && e.touches.length === 1) { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
  window.addEventListener('touchend', end);
})();

// Crop drag (attached once)
(function initCropDrag() {
  const handles = document.querySelectorAll('.crop-handle');
  const doResize = (dx, dy) => {
    if (!ED.resize) return;
    const min = 50;
    if (ED.resize.includes('e')) ED.cropW = Math.max(min, ED.cropW + dx);
    if (ED.resize.includes('s')) ED.cropH = Math.max(min, ED.cropH + dy);
    if (ED.resize.includes('w')) { const nw = Math.max(min, ED.cropW - dx); ED.cropX += ED.cropW - nw; ED.cropW = nw; }
    if (ED.resize.includes('n')) { const nh = Math.max(min, ED.cropH - dy); ED.cropY += ED.cropH - nh; ED.cropH = nh; }
    updateCropOverlay();
  };
  handles.forEach(h => {
    h.addEventListener('mousedown', e => { e.stopPropagation(); ED.resize = h.dataset.dir; ED.lx = e.clientX; ED.ly = e.clientY; });
    h.addEventListener('touchstart', e => { e.stopPropagation(); if (e.touches.length === 1) { ED.resize = h.dataset.dir; ED.lx = e.touches[0].clientX; ED.ly = e.touches[0].clientY; } }, { passive: false });
  });
  window.addEventListener('mousemove', e => { if (!ED.resize) return; doResize(e.clientX - ED.lx, e.clientY - ED.ly); ED.lx = e.clientX; ED.ly = e.clientY; });
  window.addEventListener('touchmove', e => { if (!ED.resize) return; doResize(e.touches[0].clientX - ED.lx, e.touches[0].clientY - ED.ly); ED.lx = e.touches[0].clientX; ED.ly = e.touches[0].clientY; }, { passive: false });
  window.addEventListener('mouseup', () => ED.resize = null);
  window.addEventListener('touchend', () => ED.resize = null);
})();

function getExportDim(w, h) {
  if (ED.export === 'max') return { w, h };
  if (ED.export === '2000') { const s = Math.min(1, 2000 / Math.max(w, h)); return { w: Math.round(w * s), h: Math.round(h * s) }; }
  if (ED.export === 'fullhd') { const s = Math.min(1, 1920 / w, 1080 / h); return { w: Math.round(w * s), h: Math.round(h * s) }; }
  return { w, h };
}

async function saveEditor(mode) {
  if (!ED.img) return;
  const img = ED.img;
  const out = document.createElement('canvas');
  const dim = getExportDim(img.naturalWidth, img.naturalHeight);
  out.width = dim.w; out.height = dim.h;
  const ctx = out.getContext('2d');

  const f = ED.filters;
  const filters = [`brightness(${100 + f.exposure}%)`, `contrast(${100 + f.contrast}%)`, `saturate(${100 + f.saturation}%)`];
  if (f.temp > 0) filters.push(`sepia(${f.temp * 0.5}%)`); else filters.push(`hue-rotate(${f.temp * 0.3}deg)`);
  ctx.filter = filters.join(' ');

  ctx.save();
  ctx.translate(dim.w / 2, dim.h / 2);
  ctx.rotate(ED.rotate * Math.PI / 180);
  ctx.scale(ED.scale, ED.scale);
  const ratio = Math.min(dim.w / img.naturalWidth, dim.h / img.naturalHeight);
  ctx.drawImage(img, -img.naturalWidth * ratio / 2 + ED.panX / ED.scale, -img.naturalHeight * ratio / 2 + ED.panY / ED.scale, img.naturalWidth * ratio, img.naturalHeight * ratio);
  ctx.restore();

  if (f.sharpen > 0) {
    const temp = document.createElement('canvas'); temp.width = dim.w; temp.height = dim.h;
    const tctx = temp.getContext('2d');
    tctx.filter = `contrast(${100 + f.sharpen * 2}%)`;
    tctx.drawImage(out, 0, 0);
    ctx.drawImage(temp, 0, 0);
  }

  if (f.ai) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(200,220,255,0.08)';
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

  const blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.92));
  const fd = new FormData();
  fd.append('file', blob, ED.photo.name || 'edited.jpg');
  fd.append('galleryId', 'main');
  fd.append('oldKey', ED.photo.key);
  fd.append('mode', mode);
  await fetch('/api/photos/update', { method: 'POST', body: fd });
  closeEditor(); loadGallery();
}

// ═══════════════════════════════════════
// WYSIWYG
// ═══════════════════════════════════════
function execCmd(cmd, val) {
  document.execCommand(cmd, false, val);
}

function insertImgTo(editorId) {
  if (!G.photos.length) { alert('Nejdřív nahraj fotky do galerie.'); return; }
  const editor = document.getElementById(editorId);
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div style="background:#1e293b;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #334155"><h3 style="margin-bottom:1rem;color:#f8fafc">Vložit fotku</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.5rem">${G.photos.map(p => `<img src="${p.url}" style="width:100%;height:120px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid transparent" onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='transparent'" onclick="insertImgUrl('${editorId}','${p.url}')">`).join('')}</div><div style="text-align:center;margin-top:1rem"><button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button></div></div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
}

function insertImgUrl(editorId, url) {
  const editor = document.getElementById(editorId);
  if (!editor) return;
  const img = `<img src="${url}" style="max-width:100%;border-radius:6px;margin:0.5rem 0;display:block">`;
  editor.focus();
  document.execCommand('insertHTML', false, img);
  const m = document.querySelector('.modal'); if (m) m.remove();
}

// ═══════════════════════════════════════
// ČLÁNKY
// ═══════════════════════════════════════
async function loadArticles() {
  try {
    const res = await fetch('/api/articles/list');
    const data = await res.json();
    const box = document.getElementById('articleList');
    if (!box) return;
    if (!data.length) { box.innerHTML = '<p style="color:#64748b;text-align:center;padding:2rem">Žádné články.</p>'; return; }
    box.innerHTML = data.map(a => {
      const sec = SECTIONS.find(s => s.id === a.sectionId);
      return `<div class="card">
        <h4>${escapeHtml(a.title)}</h4>
        <p><small>${sec ? sec.name : (a.sectionId || '')} ${a.subsectionId ? '• ' + escapeHtml(a.subsectionId) : ''} ${a.place ? '| ' + escapeHtml(a.place) : ''} | ${new Date(a.date || a.created).toLocaleDateString('cs')}</small></p>
        <div class="article-preview">${a.content}</div>
        <div class="actions">
          <button onclick="editArticle('${a.id}')" class="btn btn-blue">Upravit</button>
          <button onclick="deleteArticle('${a.id}')" class="btn btn-red">Smazat</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) { console.error('Články chyba:', e); }
}

function loadArtSections() {
  const sSel = document.getElementById('artSection');
  const ssSel = document.getElementById('artSubsection');
  if (!sSel) return;
  sSel.onchange = async () => {
    const sid = sSel.value;
    if (!sid) { if (ssSel) ssSel.innerHTML = '<option value="">— Podsekce —</option>'; return; }
    try {
      const res = await fetch(`/api/subsections/by-section?sectionId=${sid}`);
      const data = await res.json();
      if (ssSel) ssSel.innerHTML = '<option value="">— Podsekce —</option>' + data.map(ss => `<option value="${ss.id}">${escapeHtml(ss.name)}</option>`).join('');
    } catch { if (ssSel) ssSel.innerHTML = '<option value="">— Podsekce —</option>'; }
  };
}

async function createArticle() {
  const title = document.getElementById('artTitle')?.value.trim();
  const content = document.getElementById('artEditor')?.innerHTML;
  if (!title || !content) return alert('Vyplň nadpis a obsah');
  await fetch('/api/articles/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title, content,
      sectionId: document.getElementById('artSection')?.value,
      subsectionId: document.getElementById('artSubsection')?.value,
      date: document.getElementById('artDate')?.value,
      place: document.getElementById('artPlace')?.value
    })
  });
  document.getElementById('artTitle').value = '';
  document.getElementById('artEditor').innerHTML = '';
  document.getElementById('artDate').value = '';
  document.getElementById('artPlace').value = '';
  const ss = document.getElementById('artSubsection'); if (ss) ss.innerHTML = '<option value="">— Podsekce —</option>';
  loadArticles();
}

function editArticle(id) {
  alert('Editace článku: ' + id + '\n\nFunkce připravena – napoj na formulář podle ID.');
}

async function deleteArticle(id) {
  if (!confirm('Smazat článek?')) return;
  await fetch(`/api/articles/delete?id=${id}`, { method: 'DELETE' });
  loadArticles();
}

// ═══════════════════════════════════════
// CITÁTY
// ═══════════════════════════════════════
async function loadQuotes() {
  const tbody = document.getElementById('quoteTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b">Načítání...</td></tr>';
  try {
    const res = await fetch('/api/quotes/list');
    const data = await res.json();
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b">Žádné citáty.</td></tr>'; return; }
    tbody.innerHTML = data.map(q => `<tr><td>"${escapeHtml(q.text)}"</td><td>${escapeHtml(q.author) || '—'}</td><td><button onclick="deleteQuote('${encodeURIComponent(q.key)}')" class="btn btn-red btn-sm">Smazat</button></td></tr>`).join('');
  } catch { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#ef4444">Chyba načítání.</td></tr>'; }
}

async function createQuote() {
  const text = document.getElementById('qText')?.value.trim();
  if (!text) return alert('Zadej text citátu');
  await fetch('/api/quotes/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, author: document.getElementById('qAuthor')?.value.trim() }) });
  document.getElementById('qText').value = ''; document.getElementById('qAuthor').value = ''; loadQuotes();
}

async function deleteQuote(key) { if (!confirm('Smazat citát?')) return; await fetch(`/api/quotes/delete?key=${key}`, { method: 'DELETE' }); loadQuotes(); }

// ═══════════════════════════════════════
// PODSEKCE (sekce jsou hardcoded 4)
// ═══════════════════════════════════════
async function loadSubsections() {
  const tbody = document.getElementById('subsectionTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748b">Načítání...</td></tr>';
  try {
    const all = [];
    await Promise.all(SECTIONS.map(async s => {
      const res = await fetch(`/api/subsections/by-section?sectionId=${s.id}`);
      const data = await res.json();
      all.push(...data.map(d => ({...d, sectionName: s.name})));
    }));
    all.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!all.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748b">Žádné podsekce.</td></tr>'; return; }
    tbody.innerHTML = all.map(s => `<tr><td>${escapeHtml(s.sectionName)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.slug)}</td><td>${s.order || 0}</td><td><button onclick="deleteSubsection('${s.id}')" class="btn btn-red btn-sm">Smazat</button></td></tr>`).join('');
  } catch { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#ef4444">Chyba načítání.</td></tr>'; }
}

async function createSubsection() {
  const sectionId = document.getElementById('ssSection')?.value;
  const name = document.getElementById('ssName')?.value.trim();
  if (!sectionId || !name) return alert('Vyplň sekci a název');
  const order = parseInt(document.getElementById('ssOrder')?.value) || 0;
  await fetch('/api/subsections/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sectionId, name, order })
  });
  document.getElementById('ssName').value = '';
  document.getElementById('ssOrder').value = '0';
  loadSubsections();
}

async function deleteSubsection(id) { if (!confirm('Smazat podsekci?')) return; await fetch(`/api/subsections/delete?id=${id}`, { method: 'DELETE' }); loadSubsections(); }

// ═══════════════════════════════════════
// O ZAJDOVI
// ═══════════════════════════════════════
async function loadAbout() {
  try { const res = await fetch('/api/about/get'); aboutData = await res.json(); } catch { aboutData = { title: '', text: '', photos: [], subsections: [] }; }
  const titleIn = document.getElementById('aboutTitle');
  const editor = document.getElementById('aboutEditor');
  const preview = document.getElementById('aboutPreview');
  if (titleIn) titleIn.value = aboutData.title || '';
  if (editor) editor.innerHTML = aboutData.text || '';
  renderAboutPhotos(); renderAboutSubs();
  if (preview) preview.innerHTML = `<h4>${escapeHtml(aboutData.title || 'O Zajdovi')}</h4><div>${aboutData.text || ''}</div>${(aboutData.photos || []).length ? `<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:1rem">${aboutData.photos.map(u => `<img src="${u}" style="width:100px;height:100px;object-fit:cover;border-radius:6px;border:1px solid #334155">`).join('')}</div>` : ''}`;
}

function renderAboutPhotos() {
  const box = document.getElementById('aboutPhotos');
  if (!box) return;
  box.innerHTML = (aboutData.photos || []).map((u, i) => `<div style="position:relative;display:inline-block"><img src="${u}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #334155"><button onclick="aboutData.photos.splice(${i},1);renderAboutPhotos()" style="position:absolute;top:-6px;right:-6px;background:#dc2626;color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;line-height:1">×</button></div>`).join('');
}

function openGalleryPicker() {
  if (!G.photos.length) { alert('Nejdřív nahraj fotky do galerie.'); return; }
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div style="background:#1e293b;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #334155"><h3 style="margin-bottom:1rem;color:#f8fafc">Vyber fotku</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:0.5rem">${G.photos.map(p => `<img src="${p.url}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid transparent" onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='transparent'" onclick="pickAboutPhoto('${p.url}')">`).join('')}</div><div style="text-align:center;margin-top:1rem"><button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button></div></div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
}

function pickAboutPhoto(url) { if (!(aboutData.photos || []).includes(url)) aboutData.photos.push(url); renderAboutPhotos(); const m = document.querySelector('.modal'); if (m) m
