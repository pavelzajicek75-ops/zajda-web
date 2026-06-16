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

function formatSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ═══════════════════════════════════════
// GALERIE
// ═══════════════════════════════════════
let galleriesData = [];
let currentGalleryId = null;
let currentView = 'grid';
let currentSort = 'date-desc';
let selectedPhotos = new Set();
let editorState = { img: null, rotation: 0, flipH: 1, flipV: 1, originalKey: null };

async function loadGalleries() {
  const res = await fetch('/api/photos/list');
  galleriesData = await res.json();
  
  const tabs = document.getElementById('galleryTabs');
  if (!galleriesData.length) {
    tabs.innerHTML = '<p style="color:#64748b">Zatím žádné galerie.</p>';
    document.getElementById('galleryToolbar').style.display = 'none';
    document.getElementById('galleryContent').innerHTML = '';
    return;
  }

  tabs.innerHTML = galleriesData.map(g => `
    <button class="gallery-tab ${g.id === currentGalleryId ? 'active' : ''}" 
            onclick="switchGallery('${g.id}')">${escapeHtml(g.title)}</button>
  `).join('');

  if (!currentGalleryId || !galleriesData.find(g => g.id === currentGalleryId)) {
    currentGalleryId = galleriesData[0].id;
  }
  
  document.getElementById('galleryToolbar').style.display = 'flex';
  renderGallery();
  loadGalleryStats();
}

function switchGallery(id) {
  currentGalleryId = id;
  selectedPhotos.clear();
  updateSelectionUI();
  loadGalleries();
}

async function loadGalleryStats() {
  try {
    const res = await fetch('/api/photos/stats');
    const stats = await res.json();
    const g = galleriesData.find(x => x.id === currentGalleryId);
    const count = g?.photos?.length || 0;
    document.getElementById('galleryStats').textContent = 
      `Galerie: ${count} fotek | Celkem v R2: ${stats.count} fotek / ${stats.sizeText}`;
  } catch {
    document.getElementById('galleryStats').textContent = 'Statistiky nedostupné';
  }
}

function setView(view) {
  currentView = view;
  document.getElementById('btnGrid').classList.toggle('active', view === 'grid');
  document.getElementById('btnSmall').classList.toggle('active', view === 'small');
  document.getElementById('btnList').classList.toggle('active', view === 'list');
  renderGallery();
}

function sortPhotos(sortValue) {
  currentSort = sortValue;
  renderGallery();
}

function getSortedPhotos() {
  const g = galleriesData.find(x => x.id === currentGalleryId);
  if (!g?.photos) return [];
  const photos = [...g.photos];
  
  const [field, dir] = currentSort.split('-');
  photos.sort((a, b) => {
    let va = a[field] || 0, vb = b[field] || 0;
    if (field === 'name') { va = a.name || ''; vb = b.name || ''; }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
  return photos;
}

function renderGallery() {
  const photos = getSortedPhotos();
  const container = document.getElementById('galleryContent');
  container.className = currentView === 'list' ? 'gallery-list' : currentView === 'small' ? 'gallery-small' : 'gallery-grid';
  
  if (!photos.length) {
    container.innerHTML = '<p style="color:#64748b;grid-column:1/-1">Galerie je prázdná.</p>';
    return;
  }

  container.innerHTML = photos.map(p => {
    const checked = selectedPhotos.has(p.key) ? 'checked' : '';
    if (currentView === 'list') {
      return `
        <div class="list-row" data-key="${p.key}">
          <input type="checkbox" ${checked} onchange="toggleSelect('${p.key}')">
          <img src="${p.url}" onclick="openEditor('${p.key}','${p.url}')">
          <div class="list-info">
            <strong>${escapeHtml(p.name)}</strong>
            <small>${formatSize(p.size)} | ${new Date(p.uploaded).toLocaleDateString('cs')}</small>
          </div>
          <button onclick="deletePhoto('${currentGalleryId}','${p.id}')" class="btn btn-red btn-sm">🗑️</button>
        </div>`;
    }
    const cls = currentView === 'small' ? 'photo-small' : 'photo-card';
    return `
      <div class="${cls}" data-key="${p.key}">
        <input type="checkbox" class="photo-check" ${checked} onchange="toggleSelect('${p.key}')">
        <img src="${p.url}" onclick="openEditor('${p.key}','${p.url}')" loading="lazy">
        <div class="photo-overlay">
          <small>${escapeHtml(p.name)}</small>
          <small>${formatSize(p.size)}</small>
        </div>
      </div>`;
  }).join('');
}

function toggleSelect(key) {
  if (selectedPhotos.has(key)) selectedPhotos.delete(key);
  else selectedPhotos.add(key);
  updateSelectionUI();
}

function updateSelectionUI() {
  const count = selectedPhotos.size;
  document.getElementById('selCount').textContent = count;
  document.getElementById('bulkDeleteBtn').style.display = count > 0 ? 'inline-block' : 'none';
}

async function deleteSelected() {
  if (!confirm(`Smazat ${selectedPhotos.size} fotek?`)) return;
  await fetch('/api/photos/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys: Array.from(selectedPhotos), galleryId: currentGalleryId })
  });
  selectedPhotos.clear();
  updateSelectionUI();
  loadGalleries();
}

async function createGallery() {
  const title = document.getElementById('gTitle').value.trim();
  if (!title) return alert('Zadej název galerie');
  await fetch('/api/photos/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, desc: document.getElementById('gDesc').value.trim() })
  });
  document.getElementById('gTitle').value = '';
  document.getElementById('gDesc').value = '';
  loadGalleries();
}

async function uploadToGallery(e) {
  const files = e.target.files;
  if (!files.length || !currentGalleryId) return;
  
  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('galleryId', currentGalleryId);
    await fetch('/api/photos/upload', { method: 'POST', body: formData });
  }
  e.target.value = '';
  loadGalleries();
}

async function deletePhoto(galleryId, photoId) {
  if (!confirm('Smazat fotku?')) return;
  await fetch(`/api/photos/delete?id=${photoId}&galleryId=${galleryId}&type=photo`, { method: 'DELETE' });
  loadGalleries();
}

// ═══════════════════════════════════════
// EDITOR FOTEK (Canvas)
// ═══════════════════════════════════════
function openEditor(key, url) {
  editorState = { img: new Image(), rotation: 0, flipH: 1, flipV: 1, originalKey: key, originalUrl: url };
  editorState.img.crossOrigin = 'anonymous';
  editorState.img.onload = () => {
    document.getElementById('editorWidth').value = editorState.img.width;
    document.getElementById('editorHeight').value = editorState.img.height;
    document.getElementById('editorQuality').addEventListener('input', e => {
      document.getElementById('qualityVal').textContent = Math.round(e.target.value * 100) + '%';
    });
    drawEditor();
    document.getElementById('photoEditor').classList.remove('hidden');
  };
  editorState.img.src = url;
}

function drawEditor() {
  const canvas = document.getElementById('editorCanvas');
  const ctx = canvas.getContext('2d');
  const img = editorState.img;
  
  const rad = editorState.rotation * Math.PI / 180;
  const isSideways = Math.abs(editorState.rotation) % 180 === 90;
  canvas.width = isSideways ? img.height : img.width;
  canvas.height = isSideways ? img.width : img.height;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.scale(editorState.flipH, editorState.flipV);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
}

function editorRotate(deg) {
  editorState.rotation = (editorState.rotation + deg) % 360;
  drawEditor();
}

function editorFlip(dir) {
  if (dir === 'h') editorState.flipH *= -1;
  else editorState.flipV *= -1;
  drawEditor();
}

function editorResize() {
  // Resize se aplikuje až při uložení - zde jen náhled
  drawEditor();
}

function closeEditor() {
  document.getElementById('photoEditor').classList.add('hidden');
}

async function saveEditor(mode) {
  const canvas = document.getElementById('editorCanvas');
  const quality = parseFloat(document.getElementById('editorQuality').value);
  
  canvas.toBlob(async (blob) => {
    const formData = new FormData();
    const fileName = editorState.originalKey.split('/').pop();
    const newFile = new File([blob], fileName, { type: 'image/jpeg' });
    
    formData.append('file', newFile);
    
    if (mode === 'overwrite') {
      formData.append('key', editorState.originalKey);
      formData.append('galleryId', currentGalleryId);
      await fetch('/api/photos/update', { method: 'POST', body: formData });
    } else {
      // Uložit jako novou - normální upload
      formData.append('galleryId', currentGalleryId);
      await fetch('/api/photos/upload', { method: 'POST', body: formData });
    }
    
    closeEditor();
    loadGalleries();
  }, 'image/jpeg', quality);
}

// ═══════════════════════════════════════
// ČLÁNKY
// ═══════════════════════════════════════
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
    body: JSON.stringify({
      title,
      content,
      image: document.getElementById('aImage').value.trim()
    })
  });
  document.getElementById('aTitle').value = '';
  document.getElementById('aContent').value = '';
  document.getElementById('aImage').value = '';
  loadArticles();
}

function toggleEdit(id) {
  document.getElementById(`edit-${id}`).classList.toggle('hidden');
}

async function saveArticle(id) {
  await fetch('/api/articles/update', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      title: document.getElementById(`t-${id}`).value,
      content: document.getElementById(`c-${id}`).value,
      image: document.getElementById(`i-${id}`).value
    })
  });
  loadArticles();
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
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b">Načítání...</td></tr>';
  try {
    const res = await fetch('/api/quotes/list');
    const data = await res.json();
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b">Žádné citáty.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(q => `
      <tr>
        <td>"${escapeHtml(q.text)}"</td>
        <td>${escapeHtml(q.author) || '—'}</td>
        <td><button onclick="deleteQuote('${encodeURIComponent(q.key)}')" class="btn btn-red btn-sm">Smazat</button></td>
      </tr>
    `).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#ef4444">Chyba při načítání.</td></tr>';
  }
}

async function createQuote() {
  const text = document.getElementById('qText').value.trim();
  if (!text) return alert('Zadej text citátu');
  await fetch('/api/quotes/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, author: document.getElementById('qAuthor').value.trim() })
  });
  document.getElementById('qText').value = '';
  document.getElementById('qAuthor').value = '';
  loadQuotes();
}

async function deleteQuote(key) {
  if (!confirm('Smazat citát?')) return;
  await fetch(`/api/quotes/delete?key=${key}`, { method: 'DELETE' });
  loadQuotes();
}

// ═══════════════════════════════════════
// SEKCE & PODSEKCE
// ═══════════════════════════════════════
async function loadSections() {
  const res = await fetch('/api/sections/list');
  const data = await res.json();
  document.getElementById('sectionTableBody').innerHTML = data.map(s => `
    <tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.slug)}</td><td>${s.order || 0}</td>
    <td><button onclick="deleteSection('${s.id}')" class="btn btn-red btn-sm">Smazat</button></td></tr>
  `).join('');
  const select = document.getElementById('ssSection');
  select.innerHTML = '<option value="">— Vyber sekci —</option>' +
    data.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}

async function createSection() {
  const name = document.getElementById('sName').value.trim();
  if (!name) return alert('Zadej název');
  await fetch('/api/sections/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, slug: document.getElementById('sSlug').value.trim(), order: parseInt(document.getElementById('sOrder').value) || 0 })
  });
  document.getElementById('sName').value = '';
  loadSections();
}

async function deleteSection(id) {
  if (!confirm('Smazat?')) return;
  await fetch(`/api/sections/delete?id=${id}`, { method: 'DELETE' });
  loadSections();
}

async function loadSubsections() {
  const res = await fetch('/api/subsections/list');
  const data = await res.json();
  document.getElementById('subsectionTableBody').innerHTML = data.map(s => `
    <tr><td>${escapeHtml(s.sectionName || s.sectionId)}</td><td>${escapeHtml(s.name)}</td>
    <td>${escapeHtml(s.slug)}</td><td>${s.order || 0}</td>
    <td><button onclick="deleteSubsection('${s.id}')" class="btn btn-red btn-sm">Smazat</button></td></tr>
  `).join('');
}

async function createSubsection() {
  const name = document.getElementById('ssName').value.trim();
  const sectionId = document.getElementById('ssSection').value;
  if (!name || !sectionId) return alert('Vyplň vše');
  await fetch('/api/subsections/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sectionId, name, slug: document.getElementById('ssSlug').value.trim(), order: parseInt(document.getElementById('ssOrder').value) || 0 })
  });
  document.getElementById('ssName').value = '';
  loadSubsections();
}

async function deleteSubsection(id) {
  if (!confirm('Smazat?')) return;
  await fetch(`/api/subsections/delete?id=${id}`, { method: 'DELETE' });
  loadSubsections();
}

// ═══════════════════════════════════════
// O ZAJDOVI
// ═══════════════════════════════════════
async function loadAbout() {
  try {
    const res = await fetch('/api/about/get');
    const data = await res.json();
    document.getElementById('aboutTitle').value = data.title || '';
    document.getElementById('aboutText').value = data.text || '';
    document.getElementById('aboutPreview').innerHTML = `
      <h4>${escapeHtml(data.title || 'O Zajdovi')}</h4>
      <p>${escapeHtml(data.text || '').replace(/\n/g, '<br>')}</p>`;
  } catch {
    document.getElementById('aboutPreview').innerHTML = '<p style="color:#64748b">Zatím žádný obsah.</p>';
  }
}

async function saveAbout() {
  await fetch('/api/about/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: document.getElementById('aboutTitle').value, text: document.getElementById('aboutText').value })
  });
  loadAbout();
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
loadGalleries();
