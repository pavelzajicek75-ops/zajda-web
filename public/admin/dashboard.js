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
  if (name === 'articles') loadArticles();
  if (name === 'quotes') loadQuotes();
  if (name === 'sections') loadSections();
  if (name === 'subsections') loadSubsections();
  if (name === 'about') loadAbout();
}

function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function fmtBytes(b) { return b ? (b / 1024 / 1024).toFixed(2) + ' MB' : '0 MB'; }

// ─── GALERIE STATE (JEN JEDNA) ───
let G = { id: null, photos: [], selected: new Set() };
let editor = {
  photo: null, img: null, zoom: 1, rotate: 0, panX: 0, panY: 0,
  crop: 'free', exportSize: 'max',
  filters: { exposure: 0, shadows: 0, highlights: 0, temp: 0, colors: 0, vibrance: 0, sharpness: 0, denoise: 0, vignette: 0, ai: false },
  dragging: false, lastX: 0, lastY: 0
};

// ─── JEDNA GALERIE – načte první nebo vytvoří ───
async function loadGallery() {
  try {
    const res = await fetch('/api/photos/galleries');
    const galleries = await res.json();

    if (galleries.length === 0) {
      // Vytvoří výchozí galerii
      await fetch('/api/photos/galleries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Hlavní galerie' })
      });
      return loadGallery(); // znovu načte
    }

    G.id = galleries[0].id;
    await refreshGallery();
    document.getElementById('galleryToolbar').style.display = 'flex';
  } catch (e) {
    console.error('Chyba galerie:', e);
  }
}

async function refreshGallery() {
  if (!G.id) return;
  G.selected.clear();
  document.getElementById('bulkDeleteBtn').style.display = 'none';

  const res = await fetch(`/api/photos/list?galleryId=${G.id}`);
  G.photos = await res.json();
  renderGallery();
  loadStats();
}

async function loadStats() {
  try {
    const res = await fetch(`/api/photos/stats?galleryId=${G.id}`);
    const s = await res.json();
    document.getElementById('galCount').textContent = (s.galCount || G.photos.length || 0) + ' fotek';
    document.getElementById('galSize').textContent = fmtBytes(s.galSize || G.photos.reduce((a,p)=>a+(p.size||0),0));
    document.getElementById('totalSize').textContent = 'Celkem R2: ' + fmtBytes(s.totalSize || 0);
  } catch {
    document.getElementById('galCount').textContent = G.photos.length + ' fotek';
    document.getElementById('galSize').textContent = fmtBytes(G.photos.reduce((a,p)=>a+(p.size||0),0));
  }
}

function renderGallery() {
  const mode = document.getElementById('viewMode').value;
  const sort = document.getElementById('sortMode').value;
  const box = document.getElementById('galleryView');
  box.className = 'gallery-view ' + mode + '-view';

  let list = [...G.photos];
  const map = { dateDesc: ['uploaded', -1], dateAsc: ['uploaded', 1], nameAsc: ['name', 1], nameDesc: ['name', -1], sizeDesc: ['size', -1], sizeAsc: ['size', 1] };
  const [k, dir] = map[sort] || ['uploaded', -1];
  list.sort((a, b) => {
    let av = a[k] || 0, bv = b[k] || 0;
    if (typeof av === 'string') return dir === 1 ? av.localeCompare(bv) : bv.localeCompare(av);
    return av > bv ? dir : av < bv ? -dir : 0;
  });

  if (list.length === 0) {
    box.innerHTML = '<p style="color:#64748b;text-align:center;padding:2rem">Galerie je prázdná. Nahraj první fotky.</p>';
    return;
  }

  box.innerHTML = list.map(p => {
    const checked = G.selected.has(p.id) ? 'checked' : '';
    if (mode === 'list') {
      return `
        <div class="gallery-item" onclick="openEditor('${p.id}')">
          <input type="checkbox" class="sel" ${checked} onclick="event.stopPropagation(); toggleSelect('${p.id}')">
          <img src="${p.url}" alt="" loading="lazy">
          <div class="meta">
            <strong>${escapeHtml(p.name)}</strong>
            <span>${fmtBytes(p.size)} • ${new Date(p.uploaded).toLocaleDateString('cs')}</span>
          </div>
        </div>`;
    }
    return `
      <div class="gallery-item" onclick="openEditor('${p.id}')">
        <input type="checkbox" class="sel" ${checked} onclick="event.stopPropagation(); toggleSelect('${p.id}')">
        <img src="${p.url}" alt="" loading="lazy">
      </div>`;
  }).join('');
}

function toggleSelect(id) {
  if (G.selected.has(id)) G.selected.delete(id); else G.selected.add(id);
  document.getElementById('bulkDeleteBtn').style.display = G.selected.size > 0 ? 'inline-block' : 'none';
  renderGallery();
}

async function bulkDelete() {
  if (!confirm(`Smazat ${G.selected.size} fotek?`)) return;
  const keys = Array.from(G.selected).join(',');
  await fetch(`/api/photos/delete?galleryId=${G.id}&keys=${keys}`, { method: 'DELETE' });
  G.selected.clear();
  document.getElementById('bulkDeleteBtn').style.display = 'none';
  refreshGallery();
}

// ─── UPLOAD – opravený ───
async function uploadFiles(input) {
  if (!input.files.length || !G.id) return;

  for (const file of input.files) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('galleryId', G.id);
    try {
      await fetch('/api/photos/upload', { method: 'POST', body: fd });
    } catch (e) {
      console.error('Upload chyba:', e);
    }
  }
  input.value = '';
  await refreshGallery();
}

// ─── EDITOR ───
function openEditor(id) {
  const p = G.photos.find(x => x.id === id);
  if (!p) return;
  editor.photo = p;
  editor.zoom = 1; editor.rotate = 0; editor.panX = 0; editor.panY = 0;
  editor.crop = 'free'; editor.exportSize = 'max';
  editor.filters = { exposure: 0, shadows: 0, highlights: 0, temp: 0, colors: 0, vibrance: 0, sharpness: 0, denoise: 0, vignette: 0, ai: false };
  updateFilterLabels();

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    editor.img = img;
    document.getElementById('editorModal').classList.remove('hidden');
    resizeCanvas();
    drawEditor();
  };
  img.onerror = () => alert('Obrázek se nepodařilo načíst');
  img.src = p.url;
}

function closeEditor() {
  document.getElementById('editorModal').classList.add('hidden');
  editor.img = null; editor.photo = null;
}

function resizeCanvas() {
  const box = document.querySelector('.editor-canvas-box');
  const canvas = document.getElementById('editorCanvas');
  if (box && canvas) {
    canvas.width = box.clientWidth;
    canvas.height = box.clientHeight;
  }
}

function updateFilterLabels() {
  const f = editor.filters;
  const ids = { exposure: 'val-exposure', shadows: 'val-shadows', highlights: 'val-highlights', temp: 'val-temp', colors: 'val-colors', vibrance: 'val-vibrance', sharpness: 'val-sharpness', denoise: 'val-denoise', vignette: 'val-vignette' };
  for (const [k, id] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.textContent = f[k];
  }
}

function setFilter(key, val) {
  editor.filters[key] = parseInt(val);
  const el = document.getElementById('val-' + key);
  if (el) el.textContent = val;
  drawEditor();
}

function setCrop(mode) {
  editor.crop = mode;
  drawEditor();
}

function setExportSize(size) {
  editor.exportSize = size;
  ['max', '2000', 'fullhd'].forEach(s => {
    const btn = document.getElementById('btn-' + s);
    if (btn) {
      btn.classList.toggle('btn-blue', s === size);
      btn.classList.toggle('btn-sm', s !== size);
    }
  });
}

function rotateEditor(deg) {
  editor.rotate = (editor.rotate + deg) % 360;
  drawEditor();
}

function drawEditor() {
  const canvas = document.getElementById('editorCanvas');
  const ctx = canvas.getContext('2d');
  if (!editor.img || !canvas) return;

  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W / 2 + editor.panX, H / 2 + editor.panY);
  ctx.rotate(editor.rotate * Math.PI / 180);
  ctx.scale(editor.zoom, editor.zoom);

  const img = editor.img;
  const ratio = Math.min(W / img.width, H / img.height) * 0.9;
  const dw = img.width * ratio, dh = img.height * ratio;

  const f = editor.filters;
  let filters = [];
  filters.push(`brightness(${100 + parseInt(f.exposure)}%)`);
  filters.push(`contrast(${100 + parseInt(f.colors)}%)`);
  filters.push(`saturate(${100 + parseInt(f.vibrance)}%)`);
  if (f.temp > 0) filters.push(`sepia(${f.temp * 0.5}%)`);
  else filters.push(`hue-rotate(${f.temp * 0.3}deg)`);
  if (f.sharpness > 0) filters.push(`contrast(${100 + f.sharpness * 0.5}%)`);
  ctx.filter = filters.join(' ');

  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.filter = 'none';
  ctx.restore();

  const vig = document.getElementById('vignetteOverlay');
  if (vig) vig.style.opacity = f.vignette / 100;

  const overlay = document.getElementById('cropOverlay');
  if (overlay) {
    if (editor.crop === 'free') {
      overlay.classList.add('hidden');
    } else {
      overlay.classList.remove('hidden');
      let cw = W * 0.7, ch = H * 0.7;
      if (editor.crop === '1:1') ch = cw;
      else if (editor.crop === '4:3') ch = cw * 0.75;
      else if (editor.crop === '16:9') ch = cw / 1.777;
      else if (editor.crop === 'original') ch = cw * (img.height / img.width);
      overlay.style.width = cw + 'px';
      overlay.style.height = ch + 'px';
    }
  }
}

// Drag – mouse + touch
function initEditorDrag() {
  const c = document.getElementById('editorCanvas');
  if (!c) return;

  const start = (x, y) => { editor.dragging = true; editor.lastX = x; editor.lastY = y; c.style.cursor = 'grabbing'; };
  const move = (x, y) => {
    if (!editor.dragging) return;
    editor.panX += x - editor.lastX;
    editor.panY += y - editor.lastY;
    editor.lastX = x; editor.lastY = y;
    drawEditor();
  };
  const end = () => { editor.dragging = false; c.style.cursor = 'grab'; };

  c.addEventListener('mousedown', e => start(e.clientX, e.clientY));
  window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
  window.addEventListener('mouseup', end);

  c.addEventListener('touchstart', e => { if(e.touches.length===1) start(e.touches[0].clientX, e.touches[0].clientY); }, {passive:false});
  window.addEventListener('touchmove', e => { if(editor.dragging && e.touches.length===1) { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); } }, {passive:false});
  window.addEventListener('touchend', end);
}
window.addEventListener('load', initEditorDrag);

function getCropRect(srcW, srcH) {
  if (editor.crop === 'free') return { x: 0, y: 0, w: srcW, h: srcH };
  let w = srcW, h = srcH;
  if (editor.crop === '1:1') h = w;
  else if (editor.crop === '4:3') h = w * 0.75;
  else if (editor.crop === '16:9') h = w / 1.777;
  else if (editor.crop === 'original') h = w * (editor.img.height / editor.img.width);
  const x = (srcW - w) / 2, y = (srcH - h) / 2;
  return { x: Math.max(0, x), y: Math.max(0, y), w: Math.min(w, srcW), h: Math.min(h, srcH) };
}

function getExportDimensions(origW, origH) {
  const size = editor.exportSize;
  if (size === 'max') return { w: origW, h: origH };
  if (size === '2000') {
    const max = Math.max(origW, origH);
    if (max <= 2000) return { w: origW, h: origH };
    const scale = 2000 / max;
    return { w: Math.round(origW * scale), h: Math.round(origH * scale) };
  }
  if (size === 'fullhd') {
    const scale = Math.min(1920 / origW, 1080 / origH, 1);
    return { w: Math.round(origW * scale), h: Math.round(origH * scale) };
  }
  return { w: origW, h: origH };
}

async function saveEditor(mode) {
  if (!editor.img) return;
  const img = editor.img;
  const crop = getCropRect(img.width, img.height);
  const exp = getExportDimensions(crop.w, crop.h);

  const out = document.createElement('canvas');
  out.width = exp.w; out.height = exp.h;
  const ctx = out.getContext('2d');

  const f = editor.filters;
  let filters = [];
  filters.push(`brightness(${100 + parseInt(f.exposure)}%)`);
  filters.push(`contrast(${100 + parseInt(f.colors)}%)`);
  filters.push(`saturate(${100 + parseInt(f.vibrance)}%)`);
  if (f.temp > 0) filters.push(`sepia(${f.temp * 0.5}%)`);
  else filters.push(`hue-rotate(${f.temp * 0.3}deg)`);
  if (f.sharpness > 0) filters.push(`contrast(${100 + f.sharpness * 0.5}%)`);
  ctx.filter = filters.join(' ');

  ctx.save();
  ctx.translate(exp.w / 2, exp.h / 2);
  ctx.rotate(editor.rotate * Math.PI / 180);
  const scale = Math.min(exp.w / crop.w, exp.h / crop.h);
  ctx.scale(scale, scale);
  ctx.drawImage(img, -crop.w / 2, -crop.h / 2, crop.w, crop.h);
  ctx.restore();

  if (f.ai) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 0, exp.w, exp.h);
    ctx.globalCompositeOperation = 'source-over';
  }

  if (f.vignette > 0) {
    const grad = ctx.createRadialGradient(exp.w / 2, exp.h / 2, exp.w * 0.3, exp.w / 2, exp.h / 2, exp.w * 0.8);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, `rgba(0,0,0,${f.vignette / 100})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, exp.w, exp.h);
  }

  const blob = await new Promise(res => out.toBlob(res, 'image/jpeg', 0.92));
  const fd = new FormData();
  fd.append('file', blob, editor.photo.name || 'edited.jpg');
  fd.append('galleryId', G.id);
  fd.append('photoId', editor.photo.id);
  fd.append('mode', mode);

  await fetch('/api/photos/update', { method: 'POST', body: fd });
  closeEditor();
  refreshGallery();
}

// ─── ČLÁNKY ───
async function loadArticles() {
  const res = await fetch('/api/articles/list');
  const data = await res.json();
  document.getElementById('articleList').innerHTML = data.map(a => `
    <div class="card">
      <h4>${escapeHtml(a.title)}</h4>
      <p>${escapeHtml(a.content.substring(0, 150))}...</p>
      <small>${new Date(a.created).toLocaleDateString('cs')}</small>
      <div class="actions">
        <button onclick="toggleEdit('${a.id}')" class="btn btn-blue">Upravit</button>
        <button onclick="deleteArticle('${a.id}')" class="btn btn-red">Smazat</button>
      </div>
      <div id="edit-${a.id}" class="edit-box hidden">
        <input type="text" id="t-${a.id}" value="${escapeHtml(a.title)}">
        <input type="text" id="i-${a.id}" value="${escapeHtml(a.image || '')}">
        <textarea id="c-${a.id}" rows="4">${escapeHtml(a.content)}</textarea>
        <button onclick="saveArticle('${a.id}')" class="btn btn-green">Uložit změny</button>
      </div>
    </div>
  `).join('');
}

async function createArticle() {
  const title = document.getElementById('aTitle').value.trim();
  const content = document.getElementById('aContent').value.trim();
  if (!title || !content) return alert('Vyplň nadpis a obsah');
  await fetch('/api/articles/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, image: document.getElementById('aImage').value.trim() })
  });
  document.getElementById('aTitle').value = '';
  document.getElementById('aContent').value = '';
  document.getElementById('aImage').value = '';
  loadArticles();
}

function toggleEdit(id) { document.getElementById(`edit-${id}`).classList.toggle('hidden'); }

async function saveArticle(id) {
  await fetch('/api/articles/update', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, title: document.getElementById(`t-${id}`).value, content: document.getElementById(`c-${id}`).value, image: document.getElementById(`i-${id}`).value })
  });
  loadArticles();
}

async function deleteArticle(id) {
  if (!confirm('Smazat článek?')) return;
  await fetch(`/api/articles/delete?id=${id}`, { method: 'DELETE' });
  loadArticles();
}

// ─── CITÁTY ───
async function loadQuotes() {
  const tbody = document.getElementById('quoteTableBody');
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b">Načítání...</td></tr>';
  try {
    const res = await fetch('/api/quotes/list');
    const data = await res.json();
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b">Žádné citáty.</td></tr>'; return; }
    tbody.innerHTML = data.map(q => `
      <tr><td>"${escapeHtml(q.text)}"</td><td>${escapeHtml(q.author) || '—'}</td>
      <td><button onclick="deleteQuote('${encodeURIComponent(q.key)}')" class="btn btn-red btn-sm">Smazat</button></td></tr>
    `).join('');
  } catch { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#ef4444">Chyba.</td></tr>'; }
}

async function createQuote() {
  const text = document.getElementById('qText').value.trim();
  if (!text) return alert('Zadej text citátu');
  await fetch('/api/quotes/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, author: document.getElementById('qAuthor').value.trim() }) });
  document.getElementById('qText').value = ''; document.getElementById('qAuthor').value = ''; loadQuotes();
}

async function deleteQuote(key) {
  if (!confirm('Smazat citát?')) return;
  await fetch(`/api/quotes/delete?key=${key}`, { method: 'DELETE' });
  loadQuotes();
}

// ─── SEKCE / PODSEKCE ───
async function loadSections() {
  const res = await fetch('/api/sections/list');
  const data = await res.json();
  document.getElementById('sectionTableBody').innerHTML = data.map(s => `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.slug)}</td><td>${s.order || 0}</td><td><button onclick="deleteSection('${s.id}')" class="btn btn-red btn-sm">Smazat</button></td></tr>`).join('');
  document.getElementById('ssSection').innerHTML = '<option value="">— Vyber sekci —</option>' + data.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}

async function createSection() {
  await fetch('/api/sections/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('sName').value, slug: document.getElementById('sSlug').value, order: parseInt(document.getElementById('sOrder').value) || 0 }) });
  document.getElementById('sName').value = ''; document.getElementById('sSlug').value = ''; loadSections();
}

async function deleteSection(id) { if (!confirm('Smazat?')) return; await fetch(`/api/sections/delete?id=${id}`, { method: 'DELETE' }); loadSections(); }

async function loadSubsections() {
  const res = await fetch('/api/subsections/list');
  const data = await res.json();
  document.getElementById('subsectionTableBody').innerHTML = data.map(s => `<tr><td>${escapeHtml(s.sectionId)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.slug)}</td><td>${s.order || 0}</td><td><button onclick="deleteSubsection('${s.id}')" class="btn btn-red btn-sm">Smazat</button></td></tr>`).join('');
}

async function createSubsection() {
  if (!document.getElementById('ssSection').value || !document.getElementById('ssName').value.trim()) return alert('Vyplň sekci a název');
  await fetch('/api/subsections/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sectionId: document.getElementById('ssSection').value, name: document.getElementById('ssName').value, slug: document.getElementById('ssSlug').value, order: parseInt(document.getElementById('ssOrder').value) || 0 }) });
  document.getElementById('ssName').value = ''; document.getElementById('ssSlug').value = ''; loadSubsections();
}

async function deleteSubsection(id) { if (!confirm('Smazat?')) return; await fetch(`/api/subsections/delete?id=${id}`, { method: 'DELETE' }); loadSubsections(); }

// ─── O ZAJDOVI – fotky z galerie ───
let aboutData = { title: '', text: '', photos: [], subsections: [] };

async function loadAbout() {
  try {
    const res = await fetch('/api/about/get');
    aboutData = await res.json();
  } catch { aboutData = { title: '', text: '', photos: [], subsections: [] }; }
  document.getElementById('aboutTitle').value = aboutData.title || '';
  document.getElementById('aboutText').value = aboutData.text || '';
  renderAboutPhotos();
  renderAboutSubsections();
  document.getElementById('aboutPreview').innerHTML = `
    <h4>${escapeHtml(aboutData.title || 'O Zajdovi')}</h4>
    <p>${escapeHtml(aboutData.text || '').replace(/\n/g, '<br>')}</p>
    ${aboutData.photos.length ? `<div class="about-photos">${aboutData.photos.map(u => `<img src="${u}">`).join('')}</div>` : ''}
  `;
}

function renderAboutPhotos() {
  const box = document.getElementById('aboutPhotos');
  box.innerHTML = aboutData.photos.map((u, i) => `
    <div style="position:relative;display:inline-block">
      <img src="${u}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #334155">
      <button onclick="removeAboutPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#dc2626;color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px">×</button>
    </div>
  `).join('');
}

function removeAboutPhoto(i) { aboutData.photos.splice(i, 1); renderAboutPhotos(); }

// Výběr fotek z galerie místo uploadu
function openGalleryPicker() {
  if (!G.id || !G.photos.length) {
    alert('Nejdřív nahraj fotky do galerie.');
    return;
  }
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div style="background:#1e293b;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #334155">
      <h3 style="margin-bottom:1rem;color:#f8fafc">Vyber fotku z galerie</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:0.5rem;">
        ${G.photos.map(p => `<img src="${p.url}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid transparent" onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='transparent'" onclick="pickAboutPhoto('${p.url}')">`).join('')}
      </div>
      <div style="text-align:center;margin-top:1rem">
        <button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button>
      </div>
    </div>
  `;
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

function pickAboutPhoto(url) {
  if (!aboutData.photos.includes(url)) aboutData.photos.push(url);
  renderAboutPhotos();
  const modal = document.querySelector('.modal');
  if (modal) modal.remove();
}

function renderAboutSubsections() {
  const box = document.getElementById('aboutSubsections');
  box.innerHTML = aboutData.subsections.map((s, i) => `
    <div class="about-sub">
      <input type="text" placeholder="Nadpis podsekce" value="${escapeHtml(s.title || '')}" onchange="aboutData.subsections[${i}].title=this.value">
      <textarea placeholder="Text podsekce..." rows="3" onchange="aboutData.subsections[${i}].text=this.value">${escapeHtml(s.text || '')}</textarea>
      <button onclick="removeAboutSub(${i})" class="btn btn-red btn-sm">Odstranit</button>
    </div>
  `).join('');
}

function addAboutSubsection() {
  aboutData.subsections.push({ title: '', text: '' });
  renderAboutSubsections();
}

function removeAboutSub(i) { aboutData.subsections.splice(i, 1); renderAboutSubsections(); }

async function saveAbout() {
  aboutData.title = document.getElementById('aboutTitle').value;
  aboutData.text = document.getElementById('aboutText').value;
  await fetch('/api/about/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aboutData) });
  loadAbout();
}

// ─── INIT ───
loadGallery();
