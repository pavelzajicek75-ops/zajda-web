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

let showExif = false;
const exifCache = new Map();

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
  moveTabIndicator();
}

/* Posune plovoucí "pilulku" pod aktivní záložku (jako segmentovaný přepínač) */
function moveTabIndicator() {
  const active = document.querySelector('.ribbon-tab.active');
  const indicator = $('ribbonTabIndicator');
  if (!active || !indicator) return;
  indicator.style.width = active.offsetWidth + 'px';
  indicator.style.transform = `translateX(${active.offsetLeft}px)`;
}
window.addEventListener('resize', () => moveTabIndicator());

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

/* === SLOŽKY (virtuální, jen podle názvu souboru — bez zásahu do backendu) ===
   Formát: "[Název složky] zbytek-názvu.jpg". Parsuje se čistě na klientovi. */
function parsePhotoFolder(name) {
  const m = (name || '').match(/^\[([^\]]+)\]\s*(.*)$/);
  if (m) return { folder: m[1], base: m[2] || name };
  return { folder: null, base: name || '' };
}

function formatFolderedName(folder, baseName) {
  const clean = (baseName || 'foto').trim();
  return folder ? `[${folder.trim()}] ${clean}` : clean;
}

function getAllFolders() {
  const set = new Set();
  G.photos.forEach(p => { const { folder } = parsePhotoFolder(p.name); if (folder) set.add(folder); });
  return [...set].sort((a, b) => a.localeCompare(b));
}

function refreshFolderControls() {
  const folders = getAllFolders();
  const sel = $('folderFilter');
  if (sel) {
    const current = sel.value;
    sel.innerHTML = '<option value="">📁 Všechny složky</option><option value="__none__">— Bez složky —</option>' +
      folders.map(f => `<option value="${escapeHtml(f)}">📁 ${escapeHtml(f)}</option>`).join('');
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
  }
  const dl = $('folderSuggestions');
  if (dl) dl.innerHTML = folders.map(f => `<option value="${escapeHtml(f)}">`).join('');
}

function sortedPhotos() {
  const mode = $('sortMode')?.value || 'newest';
  const folderSel = $('folderFilter')?.value || '';
  let arr = [...G.photos];
  if (folderSel === '__none__') arr = arr.filter(p => !parsePhotoFolder(p.name).folder);
  else if (folderSel) arr = arr.filter(p => parsePhotoFolder(p.name).folder === folderSel);
  if (mode === 'newest') arr.sort((a, b) => new Date(b.uploaded || b.date || 0) - new Date(a.uploaded || a.date || 0));
  else if (mode === 'oldest') arr.sort((a, b) => new Date(a.uploaded || a.date || 0) - new Date(b.uploaded || b.date || 0));
  else if (mode === 'name') arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  else if (mode === 'size') arr.sort((a, b) => (b.size || 0) - (a.size || 0));
  return arr;
}

function renderGallery() {
  const grid = $('galleryGrid');
  if (!grid) return;
  refreshFolderControls();
  const mode = $('viewMode')?.value || 'grid';
  grid.className = 'gallery-grid' + (mode !== 'grid' ? ' mode-' + mode : '');

  const arr = sortedPhotos();
  if (!arr.length) {
    grid.innerHTML = '<div style="color:#64748b;padding:2rem;text-align:center;grid-column:1/-1">V této složce zatím žádné fotky.</div>';
    return;
  }

  grid.innerHTML = arr.map(p => {
    const selected = G.selected.has(p.id) ? ' selected' : '';
    const checked = G.selected.has(p.id) ? 'checked' : '';
    const { folder, base } = parsePhotoFolder(p.name);
    return `
    <div class="gallery-item${selected}" data-id="${p.id}">
      <input type="checkbox" class="item-checkbox" ${checked} onclick="event.stopPropagation();toggleSel('${p.id}')">
      ${folder ? `<span class="folder-badge">📁 ${escapeHtml(folder)}</span>` : ''}
      <img src="${p.url}" alt="${escapeHtml(p.name || '')}" onclick="openEditor('${p.id}')">
      <div class="item-meta">
        <div class="item-name">${escapeHtml(base || p.name || '')}</div>
        <div>${fmtBytes(p.size)}</div>
        ${showExif ? `<div class="item-exif">Načítám EXIF…</div>` : ''}
      </div>
      <div class="item-actions">
        <button class="btn btn-sm" onclick="event.stopPropagation();openLightbox('${p.url}')" title="Náhled">🔍</button>
      </div>
    </div>`;
  }).join('');

  if (showExif) arr.forEach(p => loadAndShowExif(p));
}

function toggleExifDisplay() {
  showExif = $('exifToggle')?.checked || false;
  renderGallery();
}

/* === EXIF ===
   Vlastní minimalistický čtečka EXIF (Make/Model/expozice/clona/ISO/ohnisko/datum/GPS)
   přímo z JPEG bajtů, bez externí knihovny. Stahuje jen prvních ~128 KB souboru
   (přes Range hlavičku), kde EXIF blok obvykle je — šetří data. */
async function fetchExifPrefix(url) {
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-131071' } });
    return await r.arrayBuffer();
  } catch {
    return null;
  }
}

function parseExif(buf) {
  try {
    const view = new DataView(buf);
    if (view.getUint16(0) !== 0xFFD8) return null;
    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      if ((marker & 0xFF00) !== 0xFF00) break;
      if (marker === 0xFFE1) {
        const segLen = view.getUint16(offset + 2);
        if (view.getUint32(offset + 4) === 0x45786966) {
          return readExifSegment(view, offset + 10);
        }
        offset += 2 + segLen;
      } else if (marker === 0xFFD8) {
        offset += 2;
      } else {
        const segLen = view.getUint16(offset + 2);
        offset += 2 + segLen;
      }
    }
  } catch (e) { console.error('EXIF parse chyba:', e); }
  return null;
}

function readExifSegment(view, tiffStart) {
  const little = view.getUint16(tiffStart) === 0x4949;
  const u16 = o => view.getUint16(o, little);
  const u32 = o => view.getUint32(o, little);
  const rational = o => { const n = u32(o), d = u32(o + 4); return d ? n / d : 0; };
  const result = {};
  let exifIFD = null, gpsIFD = null;

  function readIFD(ifdOffset, target) {
    const count = u16(ifdOffset);
    for (let i = 0; i < count; i++) {
      const e = ifdOffset + 2 + i * 12;
      const tag = u16(e), type = u16(e + 2), num = u32(e + 4);
      const typeSize = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }[type] || 1;
      const dataPos = typeSize * num > 4 ? tiffStart + u32(e + 8) : e + 8;

      if (target === 'ifd0') {
        if (tag === 0x010F) result.make = readAscii(view, dataPos, num);
        else if (tag === 0x0110) result.model = readAscii(view, dataPos, num);
        else if (tag === 0x0132) result.dateTime = readAscii(view, dataPos, num);
        else if (tag === 0x8769) exifIFD = tiffStart + u32(e + 8);
        else if (tag === 0x8825) gpsIFD = tiffStart + u32(e + 8);
      } else if (target === 'exif') {
        if (tag === 0x9003) result.dateTimeOriginal = readAscii(view, dataPos, num);
        else if (tag === 0x829A) result.exposureTime = rational(dataPos);
        else if (tag === 0x829D) result.fNumber = rational(dataPos);
        else if (tag === 0x8827) result.iso = u16(dataPos);
        else if (tag === 0x920A) result.focalLength = rational(dataPos);
      } else if (target === 'gps') {
        if (tag === 0x0001) result.gpsLatRef = String.fromCharCode(view.getUint8(dataPos));
        else if (tag === 0x0002) result.gpsLat = readGPSCoord(view, dataPos, little);
        else if (tag === 0x0003) result.gpsLonRef = String.fromCharCode(view.getUint8(dataPos));
        else if (tag === 0x0004) result.gpsLon = readGPSCoord(view, dataPos, little);
      }
    }
  }

  try {
    const ifd0Offset = tiffStart + u32(tiffStart + 4);
    readIFD(ifd0Offset, 'ifd0');
    if (exifIFD) readIFD(exifIFD, 'exif');
    if (gpsIFD) readIFD(gpsIFD, 'gps');
  } catch (e) { console.error('EXIF IFD chyba:', e); }
  return result;
}

function readAscii(view, offset, length) {
  let str = '';
  for (let i = 0; i < length - 1; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    str += String.fromCharCode(c);
  }
  return str.trim();
}

function readGPSCoord(view, offset, little) {
  let coord = 0;
  for (let i = 0; i < 3; i++) {
    const n = view.getUint32(offset + i * 8, little);
    const d = view.getUint32(offset + i * 8 + 4, little);
    coord += (d ? n / d : 0) / Math.pow(60, i);
  }
  return coord;
}

function formatExifSummary(exif) {
  if (!exif || (!exif.make && !exif.model && !exif.dateTimeOriginal && !exif.dateTime)) {
    return '📷 Bez EXIF dat';
  }
  const parts = [];
  const camera = [exif.make, exif.model].filter(Boolean).join(' ').trim();
  if (camera) parts.push(camera);
  if (exif.fNumber) parts.push('f/' + exif.fNumber.toFixed(1));
  if (exif.exposureTime) parts.push(exif.exposureTime >= 1 ? exif.exposureTime.toFixed(1) + 's' : '1/' + Math.round(1 / exif.exposureTime) + 's');
  if (exif.iso) parts.push('ISO ' + exif.iso);
  if (exif.focalLength) parts.push(Math.round(exif.focalLength) + 'mm');
  const dt = exif.dateTimeOriginal || exif.dateTime;
  if (dt) { const m = dt.match(/(\d{4}):(\d{2}):(\d{2})/); if (m) parts.push(m[3] + '.' + m[2] + '.' + m[1]); }
  if (exif.gpsLat != null && exif.gpsLon != null) {
    const lat = exif.gpsLatRef === 'S' ? -exif.gpsLat : exif.gpsLat;
    const lon = exif.gpsLonRef === 'W' ? -exif.gpsLon : exif.gpsLon;
    parts.push('📍 ' + lat.toFixed(4) + ', ' + lon.toFixed(4));
  }
  return '📷 ' + (parts.length ? parts.join(' · ') : 'Bez EXIF dat');
}

async function loadAndShowExif(p) {
  const setText = (txt) => {
    const el = document.querySelector(`.gallery-item[data-id="${p.id}"] .item-exif`);
    if (el) el.textContent = txt;
  };
  if (exifCache.has(p.id)) { setText(exifCache.get(p.id)); return; }
  try {
    const buf = await fetchExifPrefix(p.url);
    const exif = buf ? parseExif(buf) : null;
    const summary = formatExifSummary(exif);
    exifCache.set(p.id, summary);
    setText(summary);
  } catch {
    setText('📷 EXIF nedostupné');
  }
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
function openMoveToFolderModal() {
  if (!G.selected.size) { alert('Nejdřív vyber fotky zaškrtnutím checkboxu.'); return; }
  if ($('moveFolderCount')) $('moveFolderCount').textContent = `Vybráno: ${G.selected.size} fotek`;
  if ($('moveFolderName')) $('moveFolderName').value = '';
  $('moveToFolderModal')?.classList.remove('hidden');
}

async function applyMoveToFolder() {
  const folder = $('moveFolderName')?.value.trim() || '';
  $('moveToFolderModal')?.classList.add('hidden');
  const ids = [...G.selected];
  if (!ids.length) return;

  const modal = buildBulkEditProgressModal(ids.length);
  if ($('beFileName')) {
    const h3 = modal.querySelector('h3');
    if (h3) h3.textContent = '📁 Přesouvání do složky';
  }

  for (let i = 0; i < ids.length; i++) {
    const p = G.photos.find(x => x.id === ids[i]);
    if (!p) continue;
    const { base } = parsePhotoFolder(p.name);
    const newName = formatFolderedName(folder, base || p.name);
    if ($('beFileName')) $('beFileName').textContent = newName;
    if ($('beCounter')) $('beCounter').textContent = (i + 1) + '/' + ids.length;
    try {
      const r = await fetch(p.url);
      if (!r.ok) throw new Error('Nepodařilo se načíst fotku ' + p.name);
      const blob = await r.blob();
      const fd = new FormData();
      fd.append('file', blob, newName);
      fd.append('galleryId', 'main');
      fd.append('oldKey', p.key);
      fd.append('mode', 'replace');
      await fetch('/api/photos/update', { method: 'POST', body: fd });
    } catch (e) {
      console.error('Chyba přesunu fotky', p, e);
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
  const targetFolder = $('uploadFolderInput')?.value.trim() || '';
  const modal = buildUploadProgressModal();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const uploadName = targetFolder ? formatFolderedName(targetFolder, file.name) : file.name;
    if ($('upFileName')) $('upFileName').textContent = uploadName;
    if ($('upCounter')) $('upCounter').textContent = (i + 1) + '/' + files.length;
    if ($('upProgressBar')) $('upProgressBar').style.width = '0%';
    if ($('upPercent')) $('upPercent').textContent = '0 %';
    if ($('upSpeed')) $('upSpeed').textContent = '';
    try {
      const compressed = await compressImage(file, settings);
      await uploadOne(compressed, uploadName);
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
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => moveTabIndicator());
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $('uploadSettingsModal')?.classList.add('hidden');
      document.querySelectorAll('.lightbox-modal').forEach(m => m.remove());
    }
  });
});
