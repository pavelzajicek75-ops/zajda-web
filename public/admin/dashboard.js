// ==================== KONFIGURACE ====================
const API_BASE = '/api';
let currentEditPhoto = null;
let cropStart = null;
let cropRect = null;

// ==================== ROUTING ====================
document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = e.target.dataset.section;
        showSection(section);
        history.pushState(null, null, `#${section}`);
    });
});

function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const target = document.getElementById(`${section}-section`);
    const nav = document.querySelector(`[data-section="${section}"]`);
    
    if (target) target.classList.add('active');
    if (nav) nav.classList.add('active');
    
    // Načíst data
    if (section === 'quotes') loadQuotes();
    if (section === 'articles') loadArticles();
    if (section === 'gallery') loadGallery();
    if (section === 'dashboard') loadStats();
}

window.addEventListener('popstate', () => {
    const hash = location.hash.slice(1) || 'dashboard';
    showSection(hash);
});

// ==================== AUTH ====================
document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('adminAuth');
    window.location.href = 'login.html';
});

// ==================== STATS ====================
async function loadStats() {
    try {
        const [quotes, articles, photos] = await Promise.all([
            fetch(`${API_BASE}/quotes`).then(r => r.json()),
            fetch(`${API_BASE}/articles`).then(r => r.json()),
            fetch(`${API_BASE}/photos`).then(r => r.json())
        ]);
        document.getElementById('quoteCount').textContent = quotes.length;
        document.getElementById('articleCount').textContent = articles.length;
        document.getElementById('photoCount').textContent = photos.length;
    } catch (e) {
        console.error('Stats error:', e);
    }
}

// ==================== CITÁTY ====================
document.getElementById('addQuoteBtn').addEventListener('click', () => {
    document.getElementById('quoteId').value = '';
    document.getElementById('quoteAuthor').value = '';
    document.getElementById('quoteText').value = '';
    document.getElementById('quoteModalTitle').textContent = 'Nový citát';
    openModal('quoteModal');
});

document.getElementById('quoteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('quoteId').value;
    const data = {
        author: document.getElementById('quoteAuthor').value,
        text: document.getElementById('quoteText').value
    };
    
    const url = id ? `${API_BASE}/quotes/${id}` : `${API_BASE}/quotes`;
    const method = id ? 'PUT' : 'POST';
    
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    closeModal('quoteModal');
    loadQuotes();
});

async function loadQuotes() {
    const res = await fetch(`${API_BASE}/quotes`);
    const quotes = await res.json();
    const tbody = document.querySelector('#quotesTable tbody');
    tbody.innerHTML = quotes.map(q => `
        <tr>
            <td>${escapeHtml(q.author)}</td>
            <td>${escapeHtml(q.text)}</td>
            <td>
                <button class="btn-icon" onclick="editQuote('${q.id}')">✏️</button>
                <button class="btn-icon" onclick="deleteQuote('${q.id}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function editQuote(id) {
    const res = await fetch(`${API_BASE}/quotes/${id}`);
    const q = await res.json();
    document.getElementById('quoteId').value = q.id;
    document.getElementById('quoteAuthor').value = q.author;
    document.getElementById('quoteText').value = q.text;
    document.getElementById('quoteModalTitle').textContent = 'Upravit citát';
    openModal('quoteModal');
}

async function deleteQuote(id) {
    if (!confirm('Smazat citát?')) return;
    await fetch(`${API_BASE}/quotes/${id}`, { method: 'DELETE' });
    loadQuotes();
}

// ==================== ČLÁNKY ====================
document.getElementById('addArticleBtn').addEventListener('click', () => {
    document.getElementById('articleId').value = '';
    document.getElementById('articleTitle').value = '';
    document.getElementById('articleDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('articleSection').value = 'aktuality';
    document.getElementById('articleSubsection').value = '';
    document.getElementById('articleEditor').innerHTML = '';
    document.getElementById('articleModalTitle').textContent = 'Nový článek';
    openModal('articleModal');
});

// Editor toolbar
document.querySelectorAll('.editor-toolbar button[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        document.execCommand(cmd, false, null);
        document.getElementById('articleEditor').focus();
    });
});

// Vložit fotku z galerie
document.getElementById('insertImageBtn').addEventListener('click', async () => {
    const res = await fetch(`${API_BASE}/photos`);
    const photos = await res.json();
    const grid = document.getElementById('pickerGalleryGrid');
    grid.innerHTML = photos.map(p => `
        <div class="gallery-item" onclick="insertImageToEditor('${p.url}')">
            <img src="${p.thumbnail || p.url}" alt="${p.name}">
        </div>
    `).join('');
    openModal('galleryPickerModal');
});

function insertImageToEditor(url) {
    const editor = document.getElementById('articleEditor');
    const img = `<img src="${url}" alt="fotka" style="max-width:100%;">`;
    document.execCommand('insertHTML', false, img);
    closeModal('galleryPickerModal');
}

document.getElementById('articleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('articleId').value;
    const data = {
        title: document.getElementById('articleTitle').value,
        date: document.getElementById('articleDate').value,
        section: document.getElementById('articleSection').value,
        subsection: document.getElementById('articleSubsection').value,
        content: document.getElementById('articleEditor').innerHTML
    };
    
    const url = id ? `${API_BASE}/articles/${id}` : `${API_BASE}/articles`;
    const method = id ? 'PUT' : 'POST';
    
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    closeModal('articleModal');
    loadArticles();
});

async function loadArticles() {
    const res = await fetch(`${API_BASE}/articles`);
    const articles = await res.json();
    const tbody = document.querySelector('#articlesTable tbody');
    tbody.innerHTML = articles.map(a => `
        <tr>
            <td>${escapeHtml(a.title)}</td>
            <td>${a.date}</td>
            <td>${a.section}${a.subsection ? ' / ' + a.subsection : ''}</td>
            <td>
                <button class="btn-icon" onclick="editArticle('${a.id}')">✏️</button>
                <button class="btn-icon" onclick="deleteArticle('${a.id}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function editArticle(id) {
    const res = await fetch(`${API_BASE}/articles/${id}`);
    const a = await res.json();
    document.getElementById('articleId').value = a.id;
    document.getElementById('articleTitle').value = a.title;
    document.getElementById('articleDate').value = a.date;
    document.getElementById('articleSection').value = a.section;
    document.getElementById('articleSubsection').value = a.subsection || '';
    document.getElementById('articleEditor').innerHTML = a.content;
    document.getElementById('articleModalTitle').textContent = 'Upravit článek';
    openModal('articleModal');
}

async function deleteArticle(id) {
    if (!confirm('Smazat článek?')) return;
    await fetch(`${API_BASE}/articles/${id}`, { method: 'DELETE' });
    loadArticles();
}

// ==================== GALERIE ====================
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

async function handleFiles(files) {
    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        
        // Resize podle nastavení (default: původní)
        const resized = await resizeImage(file, 'original');
        
        const formData = new FormData();
        formData.append('file', resized.blob, file.name);
        formData.append('sizes', JSON.stringify(resized.sizes));
        
        await fetch(`${API_BASE}/photos`, { method: 'POST', body: formData });
    }
    loadGallery();
}

async function resizeImage(file, preset) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const sizes = {};
            let width = img.width;
            let height = img.height;
            
            if (preset !== 'original' && width > parseInt(preset)) {
                const ratio = parseInt(preset) / width;
                width = parseInt(preset);
                height = Math.round(height * ratio);
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
                sizes[preset === 'original' ? 'original' : preset] = { width, height };
                resolve({ blob, sizes });
            }, file.type, 0.9);
        };
        img.src = URL.createObjectURL(file);
    });
}

async function loadGallery() {
    const res = await fetch(`${API_BASE}/photos`);
    const photos = await res.json();
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = photos.map(p => `
        <div class="gallery-item" data-id="${p.id}">
            <img src="${p.thumbnail || p.url}" alt="${p.name}" loading="lazy">
            <div class="gallery-overlay">
                <button class="btn-icon" onclick="editPhoto('${p.id}')">✏️</button>
                <button class="btn-icon" onclick="deletePhoto('${p.id}')">🗑️</button>
            </div>
            <div class="photo-meta">${p.width}x${p.height}px</div>
        </div>
    `).join('');
}

async function editPhoto(id) {
    const res = await fetch(`${API_BASE}/photos/${id}`);
    const photo = await res.json();
    currentEditPhoto = photo;
    
    const canvas = document.getElementById('editCanvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
    };
    img.src = photo.url;
    
    openModal('photoEditModal');
}

document.getElementById('savePhotoBtn').addEventListener('click', async () => {
    if (!currentEditPhoto) return;
    
    const canvas = document.getElementById('editCanvas');
    const selectedSize = document.querySelector('.resize-btn.active')?.dataset.size || 'original';
    
    // Aplikovat resize pokud potřeba
    let finalCanvas = canvas;
    if (selectedSize !== 'original') {
        const targetWidth = parseInt(selectedSize);
        const ratio = targetWidth / canvas.width;
        const targetHeight = Math.round(canvas.height * ratio);
        
        finalCanvas = document.createElement('canvas');
        finalCanvas.width = targetWidth;
        finalCanvas.height = targetHeight;
        const ctx = finalCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
    }
    
    finalCanvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('file', blob, currentEditPhoto.name);
        
        await fetch(`${API_BASE}/photos/${currentEditPhoto.id}`, { method: 'PUT', body: formData });
        closeModal('photoEditModal');
        loadGallery();
    }, 'image/jpeg', 0.92);
});

// Resize tlačítka
document.querySelectorAll('.resize-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.resize-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (!currentEditPhoto) return;
        const size = btn.dataset.size;
        if (size === 'original') return;
        
        const canvas = document.getElementById('editCanvas');
        const targetWidth = parseInt(size);
        const ratio = targetWidth / canvas.width;
        const targetHeight = Math.round(canvas.height * ratio);
        
        // Zobrazit preview
        const preview = document.createElement('canvas');
        preview.width = targetWidth;
        preview.height = targetHeight;
        const ctx = preview.getContext('2d');
        ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
        
        // Uložit do canvas pro další úpravy
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        canvas.getContext('2d').drawImage(preview, 0, 0);
    });
});

async function deletePhoto(id) {
    if (!confirm('Smazat fotku?')) return;
    await fetch(`${API_BASE}/photos/${id}`, { method: 'DELETE' });
    loadGallery();
}

// ==================== MODAL UTILS ====================
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    currentEditPhoto = null;
}

// Zavřít modal kliknutím mimo
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal.id);
    });
});

// ==================== UTILS ====================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== INIT ====================
const hash = location.hash.slice(1) || 'dashboard';
showSection(hash);
loadStats();
