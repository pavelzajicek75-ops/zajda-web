// ═══════════════════════════════════════
// AUTH & NAV & UTILS
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
  if (name === 'articles') { loadArtSubsections(); loadArticles(); }
  if (name === 'quotes') loadQuotes();
  if (name === 'subsections') { loadSubsections(); loadSectionCovers(); }
  if (name === 'about') loadAbout();
}

function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function fmtBytes(b) { return b ? (b / 1024 / 1024).toFixed(2) + ' MB' : '0 MB'; }
function $(id) { return document.getElementById(id); }

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
  var files = Array.from(input.files);
  var total = files.length;
  var completed = 0;

  var modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'uploadModal';
  modal.innerHTML = '\
    <div style="background:#1e293b;padding:2rem;border-radius:16px;max-width:480px;width:90vw;border:1px solid #334155;box-shadow:0 20px 60px rgba(0,0,0,0.6)">\
      <h3 style="color:#ffcc66;margin-bottom:1.5rem;text-align:center">⬆ Nahrávání fotek</h3>\
      <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem">\
        <span style="color:#94a3b8;font-size:13px" id="upFileName">Příprava...</span>\
        <span style="color:#ff6600;font-size:13px;font-weight:600" id="upCounter">0 / ' + total + '</span>\
      </div>\
      <div style="background:#0f172a;border-radius:8px;height:24px;overflow:hidden;border:1px solid #334155;margin-bottom:1rem">\
        <div id="upProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,#ff6600,#ffcc66);border-radius:7px;transition:width 0.3s ease"></div>\
      </div>\
      <div style="display:flex;justify-content:space-between;align-items:center">\
        <span style="color:#64748b;font-size:12px" id="upSpeed">—</span>\
        <span style="color:#64748b;font-size:12px" id="upPercent">0%</span>\
      </div>\
      <div style="margin-top:1rem;text-align:center">\
        <span style="color:#475569;font-size:11px" id="upStatus">Nahrávám...</span>\
      </div>\
    </div>';
  document.body.appendChild(modal);

  var fileNameEl = document.getElementById('upFileName');
  var counterEl = document.getElementById('upCounter');
  var progressBarEl = document.getElementById('upProgressBar');
  var speedEl = document.getElementById('upSpeed');
  var percentEl = document.getElementById('upPercent');
  var statusEl = document.getElementById('upStatus');

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    fileNameEl.textContent = file.name;
    counterEl.textContent = (i + 1) + ' / ' + total;
    statusEl.textContent = 'Nahrávám...';

    var fd = new FormData();
    fd.append('file', file);
    fd.append('galleryId', 'main');

    await new Promise(function(resolve) {
      var xhr = new XMLHttpRequest();
      var startTime = Date.now();

      xhr.upload.addEventListener('progress', function(e) {
        if (e.lengthComputable) {
          var percent = Math.round((e.loaded / e.total) * 100);
          var overallPercent = Math.round(((completed + e.loaded / e.total) / total) * 100);
          progressBarEl.style.width = overallPercent + '%';
          percentEl.textContent = overallPercent + '%';

          var elapsed = (Date.now() - startTime) / 1000;
          if (elapsed > 0.1) {
            var speed = e.loaded / elapsed;
            if (speed > 1048576) speedEl.textContent = (speed / 1048576).toFixed(1) + ' MB/s';
            else if (speed > 1024) speedEl.textContent = (speed / 1024).toFixed(0) + ' KB/s';
            else speedEl.textContent = speed.toFixed(0) + ' B/s';
          }
        }
      });

      xhr.addEventListener('load', function() {
        completed++;
        progressBarEl.style.width = Math.round((completed / total) * 100) + '%';
        percentEl.textContent = Math.round((completed / total) * 100) + '%';
        resolve();
      });

      xhr.addEventListener('error', function() {
        completed++;
        resolve();
      });

      xhr.addEventListener('abort', function() {
        resolve();
      });

      xhr.open('POST', '/api/photos/upload');
      xhr.send(fd);
    });
  }

  statusEl.textContent = '✅ Hotovo!';
  statusEl.style.color = '#22c55e';
  progressBarEl.style.width = '100%';
  percentEl.textContent = '100%';
  speedEl.textContent = '';

  await new Promise(function(r) { setTimeout(r, 800); });

  var m = document.getElementById('uploadModal');
  if (m) m.remove();
  input.value = '';
  loadGallery();
}


loadGallery();
