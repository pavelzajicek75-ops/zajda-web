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
  if (name === 'galleries') loadGalleries();
  if (name === 'articles') loadArticles();
  if (name === 'quotes') loadQuotes();
  if (name === 'sections') loadSections();
  if (name === 'subsections') loadSubsections();
  if (name === 'about') loadAbout();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─── GALERIE STATE ───
let galleryState = {
  galleries: [],
  currentGalleryId: null,
  photos: [],
  selected: new Set(),
  editor: { img: null, rotation: 0, photoId: null }
};

// ─── GALERIE ───
async function loadGalleries() {
  const res = await fetch('/api/photos/galleries');
  galleryState.galleries = await res.json();
  const tabs = document.getElementById('galleryTabs');
  tabs.innerHTML = galleryState.galleries.map(g => `
    <div class="gallery-tab ${g.id === galleryState.currentGalleryId ? 'active' : ''}" onclick="selectGallery('${g.id}')">
      ${escapeHtml(g.title)}
    </div>
  `).join('');
  if (!galleryState.currentGalleryId && galleryState.galleries.length > 0) {
    selectGallery(galleryState.galleries[0].id);
  }
}

function createGalleryPrompt() {
  const name = prompt('Název nové galerie:');
  if (!name) return;
  fetch('/api/photos/galleries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: name })
  }).then(() => loadGalleries());
}

async function selectGallery(id) {
  galleryState.currentGalleryId = id;
  galleryState.selected.clear();
  document.getElementById('bulkDeleteBtn').style.display = 'none';
  loadGalleries(); // refresh tabs

  const res = await fetch(`/api/photos/list?galleryId=${id}`);
  galleryState.photos = await res.json();
  renderGallery();
  loadStats();
  document.getElementById('galleryToolbar').style.display = 'flex';
}

async function loadStats() {
  try {
    const res = await fetch('/api/photos/stats');
    const stats = await res.json();
    document.getElementById('photoCount').textContent = (stats.count || 0) + ' fotek';
    document.getElementById('photoSize').textContent = ((stats.totalSize || 0) / 1024 / 1024).toFixed(2) + ' MB';
  } catch {
    document.getElementById('photoCount').textContent = galleryState.photos.length + ' fotek';
    const size = galleryState.photos.reduce((a, p) => a + (p.size || 0), 0);
    document.getElementById('photoSize').textContent = (size / 1024 / 1024).toFixed(2) + ' MB';
  }
}

function renderGallery() {
  const mode = document.getElementById('viewMode').value;
  const sort = document.getElementById('sortBy').value;
  const container = document.getElementById('galleryContent');
  container.className = 'gallery-view ' + mode + '-view';

  let photos = [...galleryState.photos];
  const [field, dir] = sort.split('-');
  photos.sort((a, b) => {
    let va = a[field === 'date' ? 'uploaded' : field] || '';
    let vb = b[field === 'date' ? 'uploaded' : field] || '';
    if (field === 'size') { va = a.size || 0; vb = b.size || 0; }
    if (dir === 'asc') return va > vb ? 1 : -1;
    return va < vb ? 1 : -1;
  });

  container.innerHTML = photos.map(p => {
    const checked = galleryState.selected.has(p.id) ? 'checked' : '';
    if (mode === 'list') {
      return `
        <div class="gallery-item" onclick="openLightbox('${p.id}')">
          <input type="checkbox" class="select-box" ${checked} onclick="event.stopPropagation(); toggleSelect('${p.id}')">
          <img src="${p.url}" alt="" loading="lazy">
          <div class="gallery-meta">
            <div>${escapeHtml(p.name)}</div>
            <small>${(p.size / 1024).toFixed(1)} kB • ${new Date(p.uploaded).toLocaleDateString('cs')}</small>
          </div>
        </div>`;
    }
    return `
      <div class="gallery-item" onclick="openLightbox('${p.id}')">
        <input type="checkbox" class="select-box" ${checked} onclick="event.stopPropagation(); toggleSelect('${p.id}')">
        <img src="${p.url}" alt="" loading="lazy">
      </div>`;
  }).join('');
}

function toggleSelect(id) {
  if (galleryState.selected.has(id)) galleryState.selected.delete(id);
  else galleryState.selected.add(id);
  document.getElementById('bulkDeleteBtn').style.display = galleryState.selected.size > 0 ? 'inline-block' : 'none';
  renderGallery();
}

async function deleteSelectedPhotos() {
  if (!confirm(`Smazat ${galleryState.selected.size} fotek?`)) return;
  const ids = Array.from(galleryState.selected).join(',');
  await fetch(`/api/photos/delete?galleryId=${galleryState.currentGalleryId}&keys=${ids}`, { method: 'DELETE' });
  galleryState.selected.clear();
  document.getElementById('bulkDeleteBtn').style.display = 'none';
  selectGallery(galleryState.currentGalleryId);
}

async function uploadGalleryPhotos(input) {
  if (!input.files.length) return;
  for (const file of input.files) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('galleryId', galleryState.currentGalleryId);
    await fetch('/api/photos/upload', { method: 'POST', body: formData });
  }
  input.value = '';
  selectGallery(galleryState.currentGalleryId);
}

// ─── LIGHTBOX ───
function openLightbox(id) {
  const p = galleryState.photos.find(x => x.id === id);
  if (!p) return;
  galleryState.editor.photoId = id;
  document.getElementById('lightboxImg').src = p.url;
  document.getElementById('lightbox').classList.remove('hidden');
}

function closeLightbox(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('lightbox').classList.add('hidden');
}

function deleteLightboxPhoto() {
  const id = galleryState.editor.photoId;
  closeLightbox();
  fetch(`/api/photos/delete?galleryId=${galleryState.currentGalleryId}&photoId=${id}`, { method: 'DELETE' })
    .then(() => selectGallery(galleryState.currentGalleryId));
}

// ─── EDITOR ───
function openEditorFromLightbox() {
  const id = galleryState.editor.photoId;
  const p = galleryState.photos.find(x => x.id === id);
  closeLightbox();
  if (!p) return;

  const modal = document.getElementById('editorModal');
  modal.classList.remove('hidden');

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    galleryState.editor.img = img;
    galleryState.editor.rotation = 0;
    document.getElementById('cropZoom').value = 1;
    document.getElementById('brightness').value = 100;
    document.getElementById('contrast').value = 100;
    refreshEditor();
  };
  img.src = p.url;
}

function refreshEditor() {
  const canvas = document.getElementById('editorCanvas');
  const ctx = canvas.getContext('2d');
  const img = galleryState.editor.img;
  if (!img) return;

  const zoom = parseFloat(document.getElementById('cropZoom').value);
  const bright = document.getElementById('brightness').value;
  const contrast = document.getElementById('contrast').value;
  const rot = galleryState.editor.rotation;

  // Výpočet rozměrů canvasu po rotaci
  let w = img.width / zoom;
  let h = img.height / zoom;

  if (rot % 180 !== 0) {
    canvas.width = h;
    canvas.height = w;
  } else {
    canvas.width = w;
    canvas.height = h;
  }

  ctx.filter = `brightness(${bright}%) contrast(${contrast}%)`;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rot * Math.PI / 180);

  const sx = (img.width - w) / 2;
  const sy = (img.height - h) / 2;
  ctx.drawImage(img, sx, sy, w, h, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function rotateEditor(deg) {
  galleryState.editor.rotation = (galleryState.editor.rotation + deg) % 360;
  refreshEditor();
}

function closeEditor() {
  document.getElementById('editorModal').classList.add('hidden');
  galleryState.editor.img = null;
}

async function saveEditor(mode) {
  const canvas = document.getElementById('editorCanvas');
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
  const formData = new FormData();
  formData.append('file', blob, 'edited.jpg');
  formData.append('galleryId', galleryState.currentGalleryId);
  formData.append('photoId', galleryState.editor.photoId);
  formData.append('mode', mode);

  await fetch('/api/photos/update', { method: 'POST', body: formData });
  closeEditor();
  selectGallery(galleryState.currentGalleryId);
}

// ─── ČLÁNKY ───
async function loadArticles() {
  const res = await fetch('/api/articles/list');
  const data = await res.json();
  document.getElementById('articleList').innerHTML = data.map(a => `
    <div class="card">
      <h4>${escapeHtml(a.title)}</h4>
      <p>${escapeHtml(a.content.substring(0,150))}...</p>
      <small>${new Date(a.created).toLocaleString('cs')}</small>
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

// ─── SEKCE / PODSEKCE / ABOUT ───
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
  const name = document.getElementById('ssName').value.trim();
  if (!name || !document.getElementById('ssSection').value) return alert('Vyplň název a sekci');
  await fetch('/api/subsections/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sectionId: document.getElementById('ssSection').value, name, slug: document.getElementById('ssSlug').value, order: parseInt(document.getElementById('ssOrder').value) || 0 }) });
  document.getElementById('ssName').value = ''; document.getElementById('ssSlug').value = ''; loadSubsections();
}

async function deleteSubsection(id) { if (!confirm('Smazat?')) return; await fetch(`/api/subsections/delete?id=${id}`, { method: 'DELETE' }); loadSubsections(); }

async function loadAbout() {
  try { const res = await fetch('/api/about/get'); const data = await res.json(); document.getElementById('aboutTitle').value = data.title || ''; document.getElementById('aboutText').value = data.text || ''; document.getElementById('aboutPreview').innerHTML = `<h4>${escapeHtml(data.title || 'O Zajdovi')}</h4><p>${escapeHtml(data.text || '').replace(/\n/g, '<br>')}</p>`; } catch {}
}

async function saveAbout() { await fetch('/api/about/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: document.getElementById('aboutTitle').value, text: document.getElementById('aboutText').value }) }); loadAbout(); }

// ─── INIT ───
loadGalleries();
