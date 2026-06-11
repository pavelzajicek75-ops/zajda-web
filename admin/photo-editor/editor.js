// ===== FOTO EDITOR =====

var canvas, ctx;
var originalImage = null;
var currentImage = null;
var filename = null;
var cropRatio = 'free';
var rotation = 0;
var flipH = 1;
var flipV = 1;
var showGrid = false;

var filters = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  vibrance: 100,
  temperature: 0,
  shadows: 0,
  highlights: 0,
  clarity: 0,
  dehaze: 0,
  sharpen: 0,
  horizon: 0
};

function getQueryParam(name) {
  var url = new URL(window.location.href);
  return url.searchParams.get(name);
}

async function initEditor() {
  filename = getQueryParam('file');
  if (!filename) {
    showToast('Chybí parametr file');
    return;
  }

  canvas = document.getElementById('editor-canvas');
  ctx = canvas.getContext('2d');

  try {
    var resp = await authenticatedFetch('/api/admin/photos/get?file=' + encodeURIComponent(filename) + '&size=original');
    var blob = await resp.blob();
    var url = URL.createObjectURL(blob);

    originalImage = new Image();
    originalImage.onload = function() {
      currentImage = originalImage;
      canvas.width = originalImage.width;
      canvas.height = originalImage.height;
      render();
      URL.revokeObjectURL(url);
    };
    originalImage.src = url;
  } catch (e) {
    showToast('Chyba při načítání fotky');
  }
}

function render() {
  if (!currentImage) return;

  var w = currentImage.width;
  var h = currentImage.height;

  if (rotation === 90 || rotation === 270) {
    canvas.width = h;
    canvas.height = w;
  } else {
    canvas.width = w;
    canvas.height = h;
  }

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);

  if (rotation === 90) ctx.rotate(Math.PI / 2);
  else if (rotation === 180) ctx.rotate(Math.PI);
  else if (rotation === 270) ctx.rotate(-Math.PI / 2);

  ctx.scale(flipH, flipV);

  var filterStr = buildFilterString();
  ctx.filter = filterStr;

  ctx.drawImage(currentImage, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function buildFilterString() {
  var f = filters;
  var parts = [];
  parts.push('brightness(' + f.brightness + '%)');
  parts.push('contrast(' + f.contrast + '%)');
  parts.push('saturate(' + f.saturate + '%)');

  if (f.temperature !== 0) {
    var temp = f.temperature > 0 ? '#ffaa44' : '#4488ff';
    var amount = Math.abs(f.temperature) / 100;
  }

  if (f.sharpen > 0) {
    parts.push('contrast(' + (100 + f.sharpen) + '%)');
  }

  return parts.join(' ');
}

function updateFilter() {
  filters.brightness = parseInt(document.getElementById('brightness').value);
  filters.contrast = parseInt(document.getElementById('contrast').value);
  filters.saturate = parseInt(document.getElementById('saturate').value);
  filters.vibrance = parseInt(document.getElementById('vibrance').value);
  filters.temperature = parseInt(document.getElementById('temperature').value);
  filters.shadows = parseInt(document.getElementById('shadows').value);
  filters.highlights = parseInt(document.getElementById('highlights').value);
  filters.clarity = parseInt(document.getElementById('clarity').value);
  filters.dehaze = parseInt(document.getElementById('dehaze').value);
  filters.sharpen = parseInt(document.getElementById('sharpen').value);
  filters.horizon = parseInt(document.getElementById('horizon').value);

  document.getElementById('val-brightness').textContent = filters.brightness;
  document.getElementById('val-contrast').textContent = filters.contrast;
  document.getElementById('val-saturate').textContent = filters.saturate;
  document.getElementById('val-vibrance').textContent = filters.vibrance;
  document.getElementById('val-temperature').textContent = filters.temperature;
  document.getElementById('val-shadows').textContent = filters.shadows;
  document.getElementById('val-highlights').textContent = filters.highlights;
  document.getElementById('val-clarity').textContent = filters.clarity;
  document.getElementById('val-dehaze').textContent = filters.dehaze;
  document.getElementById('val-sharpen').textContent = filters.sharpen;
  document.getElementById('val-horizon').textContent = filters.horizon;

  render();
}

function setCropRatio(ratio) {
  cropRatio = ratio;
}

function rotate(deg) {
  rotation = (rotation + deg) % 360;
  render();
}

function flip(dir) {
  if (dir === 'h') flipH *= -1;
  if (dir === 'v') flipV *= -1;
  render();
}

function toggleGrid() {
  showGrid = !showGrid;
  document.getElementById('grid-overlay').classList.toggle('active', showGrid);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

function resetEdits() {
  rotation = 0;
  flipH = 1;
  flipV = 1;
  filters = {
    brightness: 100, contrast: 100, saturate: 100, vibrance: 100,
    temperature: 0, shadows: 0, highlights: 0, clarity: 0,
    dehaze: 0, sharpen: 0, horizon: 0
  };

  document.getElementById('brightness').value = 100;
  document.getElementById('contrast').value = 100;
  document.getElementById('saturate').value = 100;
  document.getElementById('vibrance').value = 100;
  document.getElementById('temperature').value = 0;
  document.getElementById('shadows').value = 0;
  document.getElementById('highlights').value = 0;
  document.getElementById('clarity').value = 0;
  document.getElementById('dehaze').value = 0;
  document.getElementById('sharpen').value = 0;
  document.getElementById('horizon').value = 0;

  updateFilter();
}

async function saveImage() {
  if (!filename) return;

  showToast('Generuji verze...');

  var versions = await generateVersionsFromCanvas();

  var formData = new FormData();
  formData.append('filename', filename);
  formData.append('original', versions.original);
  formData.append('2000px', versions['2000px']);
  formData.append('fullhd', versions.fullhd);
  formData.append('1024px', versions['1024px']);
  formData.append('thumb', versions.thumb);

  var meta = {
    filename: filename,
    width: canvas.width,
    height: canvas.height,
    sizes: {
      original: versions.original.size,
      '2000px': versions['2000px'].size,
      fullhd: versions.fullhd.size,
      '1024px': versions['1024px'].size,
      thumb: versions.thumb.size
    },
    exif: {},
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };
  formData.append('metadata', JSON.stringify(meta));

  try {
    var resp = await authenticatedFetch('/api/admin/photos/save', {
      method: 'POST',
      body: formData
    });
    var data = await resp.json();
    if (data.success) {
      showToast('Fotka uložena!');
    } else {
      showToast('Chyba: ' + (data.error || 'neznámá'));
    }
  } catch (e) {
    showToast('Chyba při ukládání');
  }
}

async function generateVersionsFromCanvas() {
  var versions = {};

  versions.original = await canvasToBlob(canvas, 'image/webp', 0.95);

  versions['2000px'] = await resizeCanvasToBlob(canvas, 2000, 2000);
  versions.fullhd = await resizeCanvasToBlob(canvas, 1920, 1080);
  versions['1024px'] = await resizeCanvasToBlob(canvas, 1024, 1024);
  versions.thumb = await resizeCanvasToBlob(canvas, 400, 400);

  for (var key in versions) {
    versions[key] = new File([versions[key]], filename + '.' + key + '.webp', { type: 'image/webp' });
  }

  return versions;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(function(resolve) {
    canvas.toBlob(resolve, type, quality);
  });
}

function resizeCanvasToBlob(sourceCanvas, maxW, maxH) {
  var w = sourceCanvas.width;
  var h = sourceCanvas.height;
  var ratio = Math.min(maxW / w, maxH / h, 1);
  var newW = Math.round(w * ratio);
  var newH = Math.round(h * ratio);

  var c = document.createElement('canvas');
  c.width = newW;
  c.height = newH;
  var cx = c.getContext('2d');
  cx.drawImage(sourceCanvas, 0, 0, newW, newH);

  return new Promise(function(resolve) {
    c.toBlob(resolve, 'image/webp', 0.92);
  });
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

initEditor();
