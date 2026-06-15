// Auth check
fetch('/api/auth/me').then(r => { if (!r.ok) window.location = '/admin/login.html'; });

// Navigace
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

// Galerie
async function loadGalleries() {
  const res = await fetch('/api/photos/list');
  const data = await res.json();
  const box = document.getElementById('galleryList');
  box.innerHTML = data.map(g => `
    <div class="card">
      <h4>${g.title || 'Bez názvu'}</h4>
      <p>${g.desc || ''}</p>
      <form onsubmit="uploadPhoto(event, '${g.id}')" class="upload-form">
        <input type="file" name="file" accept="image/*" required>
        <button type="submit" class="btn btn-blue">Nahrát foto</button>
      </form>
      <div class="thumbs">${(g.photos || []).map(p => `
        <div class="thumb">
          <img src="${p.url}" alt="">
          <button onclick="deletePhoto('${g.id}', '${p.id}')" class="btn btn-red btn-sm">×</button>
        </div>
      `).join('')}</div>
      <button onclick="deleteGallery('${g.id}')" class="btn btn-red">Smazat galerii</button>
    </div>
  `).join('');
}

async function createGallery() {
  const title = document.getElementById('gTitle').value;
  const desc = document.getElementById('gDesc').value;
  if (!title) return alert('Zadej název');
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
  await fetch('/api/photos/upload', { method: 'POST', body: formData });
  loadGalleries();
}

async function deleteGallery(id) {
  if (!confirm('Smazat celou galerii?')) return;
  await fetch(`/api/photos/delete?id=${id}`, { method: 'DELETE' });
  loadGalleries();
}

async function deletePhoto(galleryId, photoId) {
  if (!confirm('Smazat fotku?')) return;
  await fetch(`/api/photos/delete?id=${photoId}&galleryId=${galleryId}&type=photo`, { method: 'DELETE' });
  loadGalleries();
}

// Články
async function loadArticles() {
  const res = await fetch('/api/articles/list');
  const data = await res.json();
  document.getElementById('articleList').innerHTML = data.map(a => `
    <div class="card">
      <h4>${a.title}</h4>
      <p>${a.content.substring(0, 120)}...</p>
      <small>${new Date(a.created).toLocaleString('cs')}</small>
      <div class="actions">
        <button onclick="editArticle('${a.id}')" class="btn btn-blue">Upravit</button>
        <button onclick="deleteArticle('${a.id}')" class="btn btn-red">Smazat</button>
      </div>
      <div id="edit-${a.id}" class="edit-box hidden">
        <input type="text" id="t-${a.id}" value="${a.title}">
        <input type="text" id="i-${a.id}" value="${a.image || ''}">
        <textarea id="c-${a.id}" rows="4">${a.content}</textarea>
        <button onclick="saveArticle('${a.id}')" class="btn btn-green">Uložit</button>
      </div>
    </div>
  `).join('');
}

async function createArticle() {
  const body = {
    title: document.getElementById('aTitle').value,
    content: document.getElementById('aContent').value,
    image: document.getElementById('aImage').value
  };
  if (!body.title || !body.content) return alert('Vyplň nadpis a obsah');
  await fetch('/api/articles/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  document.getElementById('aTitle').value = '';
  document.getElementById('aContent').value = '';
  document.getElementById('aImage').value = '';
  loadArticles();
}

function editArticle(id) {
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

// Citáty
async function loadQuotes() {
  const res = await fetch('/api/quotes/list');
  const data = await res.json();
  document.getElementById('quoteList').innerHTML = data.map(q => `
    <div class="card">
      <p>"${q.text}"</p>
      <small>— ${q.author || 'Neznámý'}</small>
      <button onclick="deleteQuote('${q.id}')" class="btn btn-red">Smazat</button>
    </div>
  `).join('');
}

async function createQuote() {
  const text = document.getElementById('qText').value;
  const author = document.getElementById('qAuthor').value;
  if (!text) return alert('Zadej text citátu');
  await fetch('/api/quotes/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, author })
  });
  document.getElementById('qText').value = '';
  document.getElementById('qAuthor').value = '';
  loadQuotes();
}

async function deleteQuote(id) {
  if (!confirm('Smazat citát?')) return;
  await fetch(`/api/quotes/delete?id=${id}`, { method: 'DELETE' });
  loadQuotes();
}

// Router
function loadSection(name) {
  if (name === 'galleries') loadGalleries();
  if (name === 'articles') loadArticles();
  if (name === 'quotes') loadQuotes();
}

// Init
loadGalleries();
