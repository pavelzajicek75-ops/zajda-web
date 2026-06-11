// ===== ADMIN GALERIE =====

var allPhotos = [];
var selectedFiles = new Set();
var currentView = 'list';
var currentLightboxFile = null;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return dateStr; }
}

function authenticatedFetch(url, options) {
  options = options || {};
  options.headers = options.headers || {};
  var token = localStorage.getItem('admin_token');
  if (token) {
    options.headers['Authorization'] = 'Bearer ' + token;
  }
  return fetch(url, options);
}

async function loadGallery() {
  const container = document.getElementById('gallery-container');
  container.innerHTML = '<div class="loading">Načítám galerii...</div>';

  try {
    const [photosResp, storageResp] = await Promise.all([
      authenticatedFetch('/api/admin/photos/list'),
      authenticatedFetch('/api/admin/photos/storage-info')
    ]);

    const data = await photosResp.json();
    allPhotos = data.photos || [];

    var storageData = { count: 0, totalSizeFormatted: '0 MB' };
    try { storageData = await storageResp.json(); } catch (e) {}

    document.getElementById('file-count').textContent = (storageData.count || allPhotos.length) + ' fotek';
    document.getElementById('storage-used').textContent = storageData.totalSizeFormatted || '0 MB';

    sortPhotos();
    renderGallery();
  } catch (e) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:3rem;">Chyba při načítání galerie: ' + escapeHtml(e.message) + '</p>';
  }
}

function sortPhotos() {
  var sortBy = document.getElementById('sort-by').value;
  allPhotos.sort(function(a, b) {
    switch (sortBy) {
      case 'date-desc': return new Date(b.created || 0) - new Date(a.created || 0);
      case 'date-asc': return new Date(a.created || 0) - new Date(b.created || 0);
      case 'name-asc': return (a.filename || '').localeCompare(b.filename || '');
      case 'name-desc': return (b.filename || '').localeCompare(a.filename || '');
      case 'size-desc': return ((b.sizes && b.sizes.original) || 0) - ((a.sizes && a.sizes.original) || 0);
      case 'size-asc': return ((a.sizes && a.sizes.original) || 0) - ((b.sizes && b.sizes.original) || 0);
      default: return 0;
    }
  });
}

function setView(view, btn) {
  currentView = view;
  document.querySelectorAll('.view-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');

  var container = document.getElementById('gallery-container');
  var viewClass = view === 'list' ? 'list-view' : view + '-grid';
  container.className = 'gallery-view ' + viewClass;
  renderGallery();
}

function renderGallery() {
  var container = document.getElementById('gallery-container');
  if (allPhotos.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:3rem;">Galerie je prázdná. Nahrajte první fotku.</p>';
    return;
  }

  if (currentView === 'list') {
    renderListView(container);
  } else if (currentView === 'small') {
    renderSmallGrid(container);
  } else {
    renderLargeGrid(container);
  }
}

function renderListView(container) {
  var html = '<div class="photo-list">';
  allPhotos.forEach(function(p) {
    var isSelected = selectedFiles.has(p.filename);
    var exif = p.exif || {};
    var sizes = p.sizes || {};
    html += '<div class="photo-list-item">' +
      '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' onchange="toggleSelect(\'' + p.filename + '\')">' +
      '<img class="thumb" src="/api/admin/photos/get?file=' + encodeURIComponent(p.filename) + '&size=thumb" ' +
      'onclick="openLightbox(\'' + p.filename + '\')" loading="lazy">' +
      '<div class="filename" onclick="openLightbox(\'' + p.filename + '\')">' + escapeHtml(p.filename) + '</div>' +
      '<div class="meta meta-hide-mobile">' + (p.width || '?') + '×' + (p.height || '?') + '</div>' +
      '<div class="meta meta-hide-mobile">' + formatSize(sizes.original) + '</div>' +
      '<div class="meta meta-hide-mobile">' + formatSize(sizes['2000px']) + '</div>' +
      '<div class="meta meta-hide-mobile">' + formatSize(sizes.fullhd) + '</div>' +
      '<div class="meta meta-hide-mobile">' + formatSize(sizes['1024px']) + '</div>' +
      '<div class="meta meta-hide-mobile">' + (exif.camera || '-') + '</div>' +
      '<div class="meta">' + formatDate(p.created) + '</div>' +
      '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderSmallGrid(container) {
  var html = '<div class="photo-grid">';
  allPhotos.forEach(function(p) {
    var isSelected = selectedFiles.has(p.filename);
    html += '<div class="photo-item" onclick="openLightbox(\'' + p.filename + '\')">' +
      '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleSelect(\'' + p.filename + '\')">' +
      '<img src="/api/admin/photos/get?file=' + encodeURIComponent(p.filename) + '&size=thumb" loading="lazy">' +
      '<div class="hover-info">' + escapeHtml(p.filename) + '<br>' + (p.width || '?') + '×' + (p.height || '?') + '</div>' +
      '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderLargeGrid(container) {
  var html = '<div class="photo-grid">';
  allPhotos.forEach(function(p) {
    var isSelected = selectedFiles.has(p.filename);
    var sizes = p.sizes || {};
    html += '<div class="photo-item" onclick="openLightbox(\'' + p.filename + '\')">' +
      '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleSelect(\'' + p.filename + '\')">' +
      '<img src="/api/admin/photos/get?file=' + encodeURIComponent(p.filename) + '&size=1024px" loading="lazy">' +
      '<div class="info">' +
      '<div class="name">' + escapeHtml(p.filename) + '</div>' +
      '<div class="dims">' + (p.width || '?') + '×' + (p.height || '?') + ' · ' + formatSize(sizes.original) + ' · ' + formatDate(p.created) + '</div>' +
      '</div></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function toggleSelect(filename) {
  if (selectedFiles.has(filename)) {
    selectedFiles.delete(filename);
  } else {
    selectedFiles.add(filename);
  }
  updateSelectionUI();
}

function selectAll() {
  allPhotos.forEach(function(p) { selectedFiles.add(p.filename); });
  updateSelectionUI();
  renderGallery();
}

function deselectAll() {
  selectedFiles.clear();
  updateSelectionUI();
  renderGallery();
}

function updateSelectionUI() {
  var count = selectedFiles.size;
  document.getElementById('selected-count').textContent = count;
  document.getElementById('btn-delete').disabled = count === 0;
}

async function deleteSelected() {
  if (selectedFiles.size === 0) return;
  if (!confirm('Opravdu smazat ' + selectedFiles.size + ' fotek?')) return;

  try {
    var resp = await authenticatedFetch('/api/admin/photos/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames: Array.from(selectedFiles) })
    });
    var data = await resp.json();
    if (data.success) {
      showToast('Smazáno ' + data.deleted + ' fotek');
      selectedFiles.clear();
      updateSelectionUI();
      loadGallery();
    } else {
      showToast('Chyba: ' + (data.error || 'neznámá'));
    }
  } catch (e) {
    showToast('Chyba při mazání');
  }
}

function openLightbox(filename) {
  currentLightboxFile = filename;
  var photo = allPhotos.find(function(p) { return p.filename === filename; });
  if (!photo) return;

  document.getElementById('lightbox-img').src = '/api/admin/photos/get?file=' + encodeURIComponent(filename) + '&size=original';
  document.getElementById('lightbox-info').innerHTML =
    '<strong>' + escapeHtml(filename) + '</strong><br>' +
    (photo.width || '?') + '×' + (photo.height || '?') + ' · ' +
    formatSize((photo.sizes && photo.sizes.original) || 0) + '<br>' +
    'EXIF: ' + ((photo.exif && photo.exif.camera) || '-') + ' · ISO ' + ((photo.exif && photo.exif.iso) || '-') + '<br>' +
    formatDate(photo.created);

  document.getElementById('lightbox').classList.add('active');
}

function closeLightbox(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('lightbox').classList.remove('active');
  currentLightboxFile = null;
}

async function uploadFiles(files) {
  if (!files || files.length === 0) return;
  document.getElementById('upload-modal').classList.add('active');
  var progressDiv = document.getElementById('upload-progress');
  progressDiv.innerHTML = '';

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var itemId = 'upload-' + i;
    progressDiv.innerHTML += '<div class="upload-item" id="' + itemId + '">' +
      '<span>' + escapeHtml(file.name) + '</span>' +
      '<span class="status uploading">Nahrávám...</span></div>';

    try {
      var arrayBuffer = await file.arrayBuffer();
      var img = await loadImage(arrayBuffer);
      var versions = await generateVersions(img, file.name);

      var formData = new FormData();
      formData.append('filename', file.name);
      formData.append('original', versions.original);
      formData.append('2000px', versions['2000px']);
      formData.append('fullhd', versions.fullhd);
      formData.append('1024px', versions['1024px']);
      formData.append('thumb', versions.thumb);

      var meta = await extractMetadata(file, img, versions);
      formData.append('metadata', JSON.stringify(meta));

      var resp = await authenticatedFetch('/api/admin/photos/upload', {
        method: 'POST',
        body: formData
      });
      var data = await resp.json();

      var statusEl = document.querySelector('#' + itemId + ' .status');
      if (data.success) {
        statusEl.textContent = '✓ Hotovo';
        statusEl.className = 'status done';
      } else {
        statusEl.textContent = '✗ Chyba: ' + (data.error || '');
        statusEl.className = 'status error';
      }
    } catch (e) {
      var statusEl = document.querySelector('#' + itemId + ' .status');
      statusEl.textContent = '✗ Chyba: ' + e.message;
      statusEl.className = 'status error';
    }
  }

  setTimeout(function() {
    closeUploadModal();
    loadGallery();
  }, 1500);
}

function closeUploadModal() {
  document.getElementById('upload-modal').classList.remove('active');
}

function loadImage(arrayBuffer) {
  return new Promise(function(resolve, reject) {
    var blob = new Blob([arrayBuffer]);
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function() {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function resizeCanvas(img, maxWidth, maxHeight, quality) {
  quality = quality || 0.92;
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');

  var w = img.width;
  var h = img.height;
  if (w > maxWidth || h > maxHeight) {
    var ratio = Math.min(maxWidth / w, maxHeight / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  return new Promise(function(resolve) {
    canvas.toBlob(function(blob) {
      resolve(blob);
    },
