/* =========================================================
   DASHBOARD CORE — auth, navigace, galerie, upload
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

function fmtBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

/* Sdílený globální stav galerie — dashboard-editor.js na tento objekt navazuje */
window.G = window.G || { photos: [], selected: new Set() };
if (!G.selected) G.selected = new Set();

/* === AUTH === */
async function checkAuth() {
  try {
    const r = await fetch('/api/auth/me');
    if (!r.ok) throw new Error('unauthorized');
    return true;
  } catch {
    window.location.href = '/admin/login.html';
    return false;
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {}
  window.location.href = '/admin/login.html';
}

/* === NAVIGACE (ribbon) === */
const RIBBON_TABS = ['galleries', 'articles', 'quotes', 'subsections', 'about'];

function showTab(name) {
  if (!RIBBON_TABS.includes(name)) name = 'galleries';
  document.querySelectorAll('.ribbon-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.dash-content .section').forEach(s => s.classList.toggle('active', s.id === name));
  localStorage.setItem('dashActiveTab', name);
  showRibbonGroup(name);
  loadSection(name);
}

function showRibbonGroup(name) {
  document.querySelectorAll('.ribbon-group').forEach(g => g.classList.toggle('active', g.dataset.for === name));
}

function loadSection(name) {
  if (name === 'galleries') {
    syncUploadQuickControls();
    loadGallery().then(() => { renderGallery(); loadStats(); });
  } else if (name === 'articles') {
    if (typeof loadArticles === 'function') loadArticles();
    if (typeof loadArtSubsections === 'function') loadArtSubsections();
  } else if (name === 'quotes') {
    if (typeof loadQuotes === 'function') loadQuotes();
  } else if (name === 'subsections') {
    if (typeof loadSubsections === 'function') loadSubsections();
    if (typeof loadSectionCovers === 'function') loadSectionCovers();
  } else if (name === 'about') {
    if (typeof loadAbout === 'function') loadAbout();
  }
}

/* === LIGHTBOX === */
function openLightbox(src) {
  const m = document.createElement('div');
  m.className = 'lightbox-modal';
  m.innerHTML = `<img src="${src}" alt="">`;
  m.onclick = () => m.remove();
  document.body.appendChild(m);
}

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

async function loadStats() {
  const pill = $('galleryCountPill');
  if (!pill) return;
  try {
    const r = await fetch('/api/photos/stats?galleryId=main');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const s = await r.json();
    const count = s.galCount ?? G.photos.length;
    pill.textContent = count + ' ' + (count === 1 ? 'fotka' : (count >= 2 && count <= 4 ? 'fotky' : 'fotek')) +
      (s.galSize ? ' · ' + fmtBytes(s.galSize) : '') +
      (s.totalSize ? ' · R2: ' + fmtBytes(s.totalSize) : '');
  } catch {
    const count = G.photos.length;
    const totalBytes = G.photos.reduce((sum, p) => sum + (p.size || 0), 0);
    pill.textContent = count + ' ' + (count === 1 ? 'fotka' : (count >= 2 && count <= 4 ? 'fotky' : 'fotek')) +
      (totalBytes ? ' · ' + fmtBytes(totalBytes) : '');
  }
}

function sortedPhotos() {
  const mode = $('sortMode')?.value || 'newest';
  const arr = [...G.photos];
  if (mode === 'newest') arr.sort((a, b) => new Date(b.uploaded || b.date || 0) - new Date(a.uploaded || a.date || 0));
  else if (mode === 'oldest') arr.sort((a, b) => new Date(a.uploaded || a.date || 0) - new Date(b.uploaded || b.date || 0));
  else if (mode === 'name') arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  else if (mode === 'size') arr.sort((a, b) => (b.size || 0) - (a.size || 0));
  return arr;
}

function renderGallery() {
  const grid = $('galleryGrid');
  if (!grid) return;
  const mode = $('viewMode')?.value || 'grid';
  grid.className = 'gallery-grid' + (mode !== 'grid' ? ' mode-' + mode : '');

  const arr = sortedPhotos();
  if (!arr.length) {
    grid.innerHTML = '<div style="color:#64748b;padding:2rem;text-align:center;grid-column:1/-1">Galerie je prázdná. Nahraj první fotky.</div>';
    return;
  }

  grid.innerHTML = arr.map(p => {
    const selected = G.selected.has(p.id) ? ' selected' : '';
    const checked = G.selected.has(p.id) ? 'checked' : '';
    return `
    <div class="gallery-item${selected}" data-id="${p.id}">
      <input type="checkbox" class="item-checkbox" ${checked} onclick="event.stopPropagation();toggleSel('${p.id}')">
      <img src="${p.url}" alt="${escapeHtml(p.name || '')}" onclick="openEditor('${p.id}')">
      <div class="item-meta">
        <div class="item-name">${escapeHtml(p.name || '')}</div>
        <div>${fmtBytes(p.size)}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-sm" onclick="event.stopPropagation();openLightbox('${p.url}')" title="Náhled">🔍</button>
      </div>
    </div>`;
  }).join('');
}

function toggleSel(id) {
  if (G.selected.has(id)) G.selected.delete(id);
  else G.selected.add(id);
  const el = document.querySelector(`.gallery-item[data-id="${id}"]`);
  if (el) el.classList.toggle('selected', G.selected.has(id));
}

async function bulkDelete() {
  if (!G.selected.size) { alert('Nejsou vybrány žádné fotky.'); return; }
  if (!confirm(`Opravdu smazat ${G.selected.size} vybraných fotek?`)) return;
  const keys = [...G.selected]
    .map(id => G.photos.find(p => p.id === id)?.key)
    .filter(Boolean)
    .join(',');
  try {
    if (keys) await fetch('/api/photos/delete?keys=' + encodeURIComponent(keys), { method: 'DELETE' });
  } catch (e) {
    console.error('Chyba hromadného mazání', e);
  }
  G.selected.clear();
  await loadGallery();
  renderGallery();
  loadStats();
}

/* === HROMADNÁ ÚPRAVA VYBRANÝCH FOTEK (velikost + JPG kvalita) === */
function openBulkEditModal() {
  if (!G.selected.size) { alert('Nejdřív vyber fotky zaškrtnutím checkboxu.'); return; }
  if ($('bulkEditCount')) $('bulkEditCount').textContent = `Vybráno: ${G.selected.size} fotek`;
  $('bulkEditModal')?.classList.remove('hidden');
}

async function resizeExistingPhoto(photo, maxRes, quality) {
  const r = await fetch(photo.url);
  if (!r.ok) throw new Error('Nepodařilo se načíst fotku ' + photo.name);
  const blob = await r.blob();
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    bitmap = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }
  const w0 = bitmap.width || bitmap.naturalWidth;
  const h0 = bitmap.height || bitmap.naturalHeight;
  let w = w0, h = h0;
  if (maxRes && Math.max(w, h) > maxRes) {
    const scale = maxRes / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/jpeg', quality));
}

function buildBulkEditProgressModal(total) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.id = 'bulkEditProgressModal';
  m.innerHTML = `
    <div class="modal-box" style="max-width:460px">
      <h3>🔧 Hromadná úprava fotek</h3>
      <div id="beFileName" style="font-size:13px;color:#94a3b8;margin-bottom:0.4rem"></div>
      <div style="background:#0f172a;border-radius:6px;height:10px;overflow:hidden;margin-bottom:0.5rem">
        <div id="beProgressBar" style="background:#ff6600;height:100%;width:0%;transition:width 0.15s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8">
        <span id="beCounter">0/${total}</span>
      </div>
      <div id="beDone" style="text-align:center;color:#22c55e;font-weight:600;margin-top:0.75rem;display:none">✅ Hotovo!</div>
    </div>`;
  document.body.appendChild(m);
  return m;
}

async function applyBulkEdit() {
  const maxRes = parseInt($('beMaxRes')?.value) || 0;
  const quality = parseFloat($('beQuality')?.value) || 0.7;
  $('bulkEditModal')?.classList.add('hidden');

  const ids = [...G.selected];
  if (!ids.length) return;
  const modal = buildBulkEditProgressModal(ids.length);

  for (let i = 0; i < ids.length; i++) {
    const p = G.photos.find(x => x.id === ids[i]);
    if (!p) continue;
    if ($('beFileName')) $('beFileName').textContent = p.name || p.key || '';
    if ($('beCounter')) $('beCounter').textContent = (i + 1) + '/' + ids.length;
    try {
      const resizedBlob = await resizeExistingPhoto(p, maxRes, quality);
      const fd = new FormData();
      const baseName = (p.name || 'foto').replace(/\.[^.]+$/, '');
      fd.append('file', resizedBlob, baseName + '.jpg');
      fd.append('galleryId', 'main');
      fd.append('oldKey', p.key);
      fd.append('mode', 'replace');
      await fetch('/api/photos/update', { method: 'POST', body: fd });
    } catch (e) {
      console.error('Chyba hromadné úpravy fotky', p, e);
    }
    if ($('beProgressBar')) $('beProgressBar').style.width = Math.round(((i + 1) / ids.length) * 100) + '%';
  }

  if ($('beDone')) $('beDone').style.display = 'block';
  setTimeout(async () => {
    modal.remove();
    G.selected.clear();
    await loadGallery();
    renderGallery();
    loadStats();
  }, 700);
}

/* === UPLOAD SETTINGS === */
function getUploadSettings() {
  const defaults = { maxRes: 2000, quality: 0.85, autoRotate: true };
  try {
    const raw = localStorage.getItem('uploadSettings');
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function openUploadSettings() {
  const s = getUploadSettings();
  if ($('usMaxRes')) $('usMaxRes').value = String(s.maxRes);
  if ($('usQuality')) $('usQuality').value = String(s.quality);
  if ($('usAutoRotate')) $('usAutoRotate').value = s.autoRotate ? '1' : '0';
  $('uploadSettingsModal')?.classList.remove('hidden');
}

function saveUploadSettings() {
  const settings = {
    maxRes: parseInt($('usMaxRes')?.value) || 0,
    quality: parseFloat($('usQuality')?.value) || 0.85,
    autoRotate: $('usAutoRotate')?.value === '1'
  };
  localStorage.setItem('uploadSettings', JSON.stringify(settings));
  $('uploadSettingsModal')?.classList.add('hidden');
  syncUploadQuickControls();
}

/* Rychlý výběr velikosti/kvality přímo v ribbon toolbaru (vedle tlačítka Nahrát) */
function syncUploadQuickControls() {
  const s = getUploadSettings();
  if ($('upResSelect')) $('upResSelect').value = String(s.maxRes);
  if ($('upQualitySelect')) $('upQualitySelect').value = String(s.quality);
}

function quickSaveUploadSetting() {
  const current = getUploadSettings();
  const settings = {
    maxRes: parseInt($('upResSelect')?.value) ?? current.maxRes,
    quality: parseFloat($('upQualitySelect')?.value) ?? current.quality,
    autoRotate: current.autoRotate
  };
  localStorage.setItem('uploadSettings', JSON.stringify(settings));
}

/* === KOMPRESE OBRÁZKŮ PŘED NAHRÁNÍM === */
async function compressImage(file, settings) {
  if (!settings.maxRes && settings.quality >= 1) {
    return file;
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, {
      imageOrientation: settings.autoRotate ? 'from-image' : 'none'
    });
  } catch {
    bitmap = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const w0 = bitmap.width || bitmap.naturalWidth;
  const h0 = bitmap.height || bitmap.naturalHeight;
  let w = w0, h = h0;
  if (settings.maxRes && Math.max(w, h) > settings.maxRes) {
    const scale = settings.maxRes / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', settings.quality));
  return blob || file;
}

/* === UPLOAD S PROGRESS MODALEM === */
function buildUploadProgressModal() {
  const m = document.createElement('div');
  m.className = 'modal';
  m.id = 'uploadProgressModal';
  const isMobile = /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
  m.innerHTML = `
    <div class="modal-box" style="max-width:460px">
      <h3>⬆️ Nahrávání fotek</h3>
      ${isMobile ? '<p style="color:#f59e0b;font-size:13px;margin-bottom:0.75rem">📱 Na mobilu může nahrávání trvat déle, nechte prosím okno otevřené.</p>' : ''}
      <div id="upFileName" style="font-size:13px;color:#94a3b8;margin-bottom:0.4rem"></div>
      <div style="background:#0f172a;border-radius:6px;height:10px;overflow:hidden;margin-bottom:0.5rem">
        <div id="upProgressBar" style="background:#ff6600;height:100%;width:0%;transition:width 0.15s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8">
        <span id="upCounter">0/0</span>
        <span id="upPercent">0 %</span>
        <span id="upSpeed"></span>
      </div>
      <div id="upDone" style="text-align:center;color:#22c55e;font-weight:600;margin-top:0.75rem;display:none">✅ Hotovo!</div>
    </div>`;
  document.body.appendChild(m);
  return m;
}

function fmtSpeed(bytesPerSec) {
  if (bytesPerSec >= 1024 * 1024) return (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
  if (bytesPerSec >= 1024) return (bytesPerSec / 1024).toFixed(1) + ' KB/s';
  return Math.round(bytesPerSec) + ' B/s';
}

function uploadOne(blob, filename) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', blob, filename);
    fd.append('galleryId', 'main');
    const xhr = new XMLHttpRequest();
    let lastLoaded = 0, lastTime = Date.now();
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      const speed = dt > 0 ? (e.loaded - lastLoaded) / dt : 0;
      lastLoaded = e.loaded; lastTime = now;
      const pct = Math.round((e.loaded / e.total) * 100);
      if ($('upProgressBar')) $('upProgressBar').style.width = pct + '%';
      if ($('upPercent')) $('upPercent').textContent = pct + ' %';
      if ($('upSpeed')) $('upSpeed').textContent = fmtSpeed(speed);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error('Server ' + xhr.status));
    };
    xhr.onerror = () => reject(new Error('Chyba sítě'));
    xhr.open('POST', '/api/photos/upload');
    xhr.send(fd);
  });
}

async function uploadFiles(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  const settings = getUploadSettings();
  const modal = buildUploadProgressModal();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if ($('upFileName')) $('upFileName').textContent = file.name;
    if ($('upCounter')) $('upCounter').textContent = (i + 1) + '/' + files.length;
    if ($('upProgressBar')) $('upProgressBar').style.width = '0%';
    if ($('upPercent')) $('upPercent').textContent = '0 %';
    if ($('upSpeed')) $('upSpeed').textContent = '';
    try {
      const compressed = await compressImage(file, settings);
      await uploadOne(compressed, file.name);
    } catch (e) {
      console.error('Chyba nahrávání souboru', file.name, e);
      alert('Nepodařilo se nahrát ' + file.name + ': ' + e.message);
    }
  }

  if ($('upDone')) $('upDone').style.display = 'block';
  setTimeout(async () => {
    modal.remove();
    input.value = '';
    await loadGallery();
    renderGallery();
    loadStats();
  }, 700);
}

/* === INICIALIZACE === */
document.addEventListener('DOMContentLoaded', async () => {
  const ok = await checkAuth();
  if (!ok) return;

  const saved = localStorage.getItem('dashActiveTab') || 'galleries';
  showTab(saved);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $('uploadSettingsModal')?.classList.add('hidden');
      document.querySelectorAll('.lightbox-modal').forEach(m => m.remove());
    }
  });
});
