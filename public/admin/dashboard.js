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
}

// ─── FOTOGRAFIE ───
async function loadGalleries() {
  const res = await fetch('/api/photos/list');
  const data = await res.json();
  document.getElementById('galleryList').innerHTML = data.map(g => `
    <div class="card">
      <h4>${g.title || 'Bez názvu'}</h4>
      <p>${g.desc || ''}</p>
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
      <h4>${a.title}</h4>
      <p>${a.content.substring(0,150)}...</p>
      <small>${new Date(a.created).toLocaleString('cs')}</small>
      <div class="actions">
        <button onclick="toggleEdit('${a.id}')" class="btn btn-blue">Upravit</button>
        <button onclick="deleteArticle('${a.id}')" class="btn btn-red">Smazat</button>
      </div>
      <div id="edit-${a.id}" class="edit-box hidden">
        <input type="text" id="t-${a.id}" value="${a.title}">
        <input type="text" id="i-${a.id}" value="${a.image || ''}">
        <textarea id="c-${a.id}" rows="4">${a.content}</textarea>
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
  const res = await fetch('/api/quotes/list');
  const data = await res.json();
  
  if (data.length === 0) {
    document.getElementById('quoteList').innerHTML = '<p style="color:#64748b">Žádné citáty v databázi.</p>';
    return;
  }
  
  document.getElementById('quoteList').innerHTML = data.map(q => `
    <div class="card">
      <p>"${q.text}"</p>
      <small>— ${q.author || 'Neznámý'}</small>
      <div class="actions">
        <button onclick="deleteQuote('${q.key}')" class="btn btn-red">Smazat</button>
      </div>
    </div>
  `).join('');
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
  if (!confirm('Smazat citát?')) return;
  await fetch(`/api/quotes/delete?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
  loadQuotes();
}

// Načti galerie při startu
loadGalleries();
