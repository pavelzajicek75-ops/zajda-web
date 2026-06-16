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
  if (name === 'about') { loadAbout(); loadAboutPhotoPicker(); }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─── FOTOGRAFIE ───
async function loadGalleries() {
  const res = await fetch('/api/photos/list');
  const data = await res.json();
  document.getElementById('galleryList').innerHTML = data.map(g => `
    <div class="card">
      <h4>${escapeHtml(g.title || 'Bez názvu')}</h4>
      <p>${escapeHtml(g.desc || '')}</p>
      <form onsubmit="uploadPhoto(event, '${g.id}')" class="upload-form">
        <input type="file" name="file" accept="image/*" required>
        <button type="submit" class="btn btn-blue">Nahrát foto</button>
      </form>
      <div class="thumbs">${(g.photos || []).map(p => `
        <div class="thumb">
          <img src="${p.url}" alt="" loading="lazy">
          <button onclick="deletePhoto('${g.id}','${p.id}')" class="btn btn-red btn-sm">×</button>
        </div>
      `).join('')}</div>
      <button onclick="deleteGallery('${g.id}')" class="btn btn-red">Smazat galerii</button>
    </div>
  `).join('');
}

async function createGallery() {
  const title = document.getElementById('gTitle').value.trim();
  const desc = document.getElementById('gDesc').value.trim();
  if (!title) return alert('Zadej název galerie');
  await fetch('/api/photos/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, desc })
  });
  document.getElementById('gTitle').value = '';
  document.getElementById('gDesc').value = '';
  loadGalleries();
}

async function uploadPhoto(e, galleryId) {
  e.preventDefault();
  const formData = new FormData(e.target);
  formData.append('galleryId', galleryId);
  const btn = e.target.querySelector('button');
  btn.textContent = 'Nahrávám...';
  await fetch('/api/photos/upload', { method: 'POST', body: formData });
  btn.textContent = 'Nahrát foto';
  loadGalleries();
}

async function deleteGallery(id) {
  if (!confirm('Smazat celou galerii včetně fotek?')) return;
  await fetch(`/api/photos/delete?id=${id}`, { method: 'DELETE' });
  loadGalleries();
}

async function deletePhoto(galleryId, photoId) {
  if (!confirm('Smazat fotku?')) return;
  await fetch(`/api/photos/delete?id=${photoId}&galleryId=${galleryId}&type=photo`, { method: 'DELETE' });
  loadGalleries();
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

// ─── CITÁTY ───
async function loadQuotes() {
  const tbody = document.getElementById('quoteTableBody');
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b">Načítání...</td></tr>';
  try {
    const res = await fetch('/api/quotes/list');
    const data = await res.json();
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b">Žádné citáty v databázi.</td></tr>';
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
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#ef4444">Chyba při načítání citátů.</td></tr>';
  }
}

async function createQuote() {
  const text = document.getElementById('qText').value.trim();
  if (!text) return alert('Zadej text citátu');
  await fetch('/api/quotes/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      author: document.getElementById('qAuthor').value.trim()
    })
  });
  document.getElementById('qText').value = '';
  document.getElementById('qAuthor').value = '';
  loadQuotes();
}

async function deleteQuote(key) {
  if (!confirm('Opravdu smazat tento citát?')) return;
  await fetch(`/api/quotes/delete?key=${key}`, { method: 'DELETE' });
  loadQuotes();
}

// ─── SEKCE ───
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
  if (!name) return alert('Zadej název sekce');
  await fetch('/api/sections/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      slug: document.getElementById('sSlug').value.trim(),
      order: parseInt(document.getElementById('sOrder').value) || 0
    })
  });
  document.getElementById('sName').value = '';
  document.getElementById('sSlug').value = '';
  loadSections();
}

async function deleteSection(id) {
  if (!confirm('Smazat sekci?')) return;
  await fetch(`/api/sections/delete?id=${id}`, { method: 'DELETE' });
  loadSections();
}

// ─── PODSEKCE ───
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
  if (!name) return alert('Zadej název podsekce');
  if (!sectionId) return alert('Vyber sekci');
  await fetch('/api/subsections/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sectionId,
      name,
      slug: document.getElementById('ssSlug').value.trim(),
      order: parseInt(document.getElementById('ssOrder').value) || 0
    })
  });
  document.getElementById('ssName').value = '';
  document.getElementById('ssSlug').value = '';
  loadSubsections();
}

async function deleteSubsection(id) {
  if (!confirm('Smazat podsekci?')) return;
  await fetch(`/api/subsections/delete?id=${id}`, { method: 'DELETE' });
  loadSubsections();
}

// ─── O ZAJDOVI ───
async function loadAbout() {
  try {
    const res = await fetch('/api/about/get');
    const data = await res.json();
    document.getElementById('aboutTitle').value = data.title || '';
    document.getElementById('aboutText').value = data.text || '';
    renderAboutPreview(data.title, data.text);
  } catch {
    document.getElementById('aboutPreview').innerHTML = '<p style="color:#64748b">Zatím žádný obsah.</p>';
  }
}

async function saveAbout() {
  await fetch('/api/about/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: document.getElementById('aboutTitle').value,
      text: document.getElementById('aboutText').value
    })
  });
  const text = document.getElementById('aboutText').value;
  const title = document.getElementById('aboutTitle').value;
  renderAboutPreview(title, text);
  alert('Uloženo!');
}

function renderAboutPreview(title, text) {
  if (!text && !title) {
    document.getElementById('aboutPreview').innerHTML = '<p style="color:#64748b">Zatím žádný obsah.</p>';
    return;
  }
  let html = `<h4>${escapeHtml(title || 'O Zajdovi')}</h4>`;
  // Nahraď [img:URL] za obrázky
  const parts = text.split(/(\[img:[^\]]+\])/);
  parts.forEach(part => {
    if (part.startsWith('[img:')) {
      const url = part.slice(5, -1);
      html += `<img src="${escapeHtml(url)}" style="max-width:100%;border-radius:8px;margin:1rem 0;display:block;">`;
    } else {
      html += `<p style="line-height:1.7;color:#cbd5e1;">${escapeHtml(part).replace(/\n/g, '<br>')}</p>`;
    }
  });
  document.getElementById('aboutPreview').innerHTML = html;
}

// Výběr fotek z galerie pro vložení do About
async function loadAboutPhotoPicker() {
  const container = document.getElementById('aboutPhotoPicker');
  try {
    const res = await fetch('/api/photos/list');
    const galleries = await res.json();
    if (!galleries.length) {
      container.innerHTML = '<p style="color:#64748b">Žádné galerie k dispozici.</p>';
      return;
    }
    let html = '';
    galleries.forEach(g => {
      if (!g.photos || !g.photos.length) return;
      html += `<div style="margin-bottom:1rem;"><h5 style="color:#94a3b8;margin-bottom:0.5rem;">${escapeHtml(g.title)}</h5><div class="picker-thumbs">`;
      g.photos.forEach(p => {
        html += `
          <div class="picker-thumb" onclick="insertPhotoIntoAbout('${escapeHtml(p.url)}')" title="Klikni pro vložení">
            <img src="${p.url}" loading="lazy">
          </div>`;
      });
      html += '</div></div>';
    });
    container.innerHTML = html || '<p style="color:#64748b">Žádné fotky v galeriích.</p>';
  } catch {
    container.innerHTML = '<p style="color:#ef4444">Chyba při načítání galerií.</p>';
  }
}

function insertPhotoIntoAbout(url) {
  const ta = document.getElementById('aboutText');
  const tag = `\n\n[img:${url}]\n\n`;
  ta.value += tag;
  ta.focus();
}

// ─── INIT ───
loadGalleries();
