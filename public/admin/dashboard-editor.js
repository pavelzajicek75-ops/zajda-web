/* =========================================================
   DASHBOARD EDITOR — ČÁST 1/5
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

window.G = window.G || { photos: [] };

/* === SVG FILTRY === */
(function initEditorFilters() {
  if (document.getElementById('editor-filters-svg')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'editor-filters-svg';
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;pointer-events:none;';
  svg.innerHTML = `
    <defs>
      <filter id="ed-sharpen" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
        <feConvolveMatrix order="3" kernelMatrix="0 -1 0 -1 5 -1 0 -1 0" preserveAlpha="true"/>
      </filter>
      <filter id="ed-sharpen-strong" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
        <feConvolveMatrix order="3" kernelMatrix="0 -1.5 0 -1.5 7 -1.5 0 -1.5 0" preserveAlpha="true"/>
      </filter>
      <filter id="ed-sharpen-dynamic" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
        <feConvolveMatrix id="ed-sharpen-dynamic-matrix" order="3" kernelMatrix="0 0 0 0 1 0 0 0 0" preserveAlpha="true"/>
      </filter>
      <filter id="ed-tone-dynamic" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
        <feComponentTransfer>
          <feFuncR id="ed-tone-r" type="table" tableValues="0 1"/>
          <feFuncG id="ed-tone-g" type="table" tableValues="0 1"/>
          <feFuncB id="ed-tone-b" type="table" tableValues="0 1"/>
        </feComponentTransfer>
      </filter>
    </defs>
  `;
  document.body.appendChild(svg);
})();

/* Přepočítá jemnost doostření plynule (k = 0 .. 1.5) místo dřívějšího
   dvoustupňového přepínání normal/strong. Používá se pro živý náhled i export. */
function sharpenKernelForStrength(strength) {
  const k = Math.max(0, Math.min(100, strength)) / 100 * 1.5;
  return { k, kernel: [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0] };
}

function updateSharpenFilter(strength) {
  const matrix = document.getElementById('ed-sharpen-dynamic-matrix');
  if (!matrix) return;
  const { kernel } = sharpenKernelForStrength(strength);
  matrix.setAttribute('kernelMatrix', kernel.map(v => v.toFixed(3)).join(' '));
}

/* === STÍNY / SVĚTLA (tónová křivka) ===
   Vlastní jednoduchá tónová křivka: stíny zvedají/snižují tmavé partie,
   světla zvedají/snižují světlé partie, střední tóny se skoro nemění. */
function toneCurveValue(x, shadows, highlights, blackPoint, whitePoint) {
  const bp = (blackPoint || 0) / 255;
  const wp = (whitePoint == null ? 255 : whitePoint) / 255;
  let lx = wp > bp ? (x - bp) / (wp - bp) : x;
  lx = Math.max(0, Math.min(1, lx));
  const s = shadows / 100, h = highlights / 100;
  const shadowWeight = Math.pow(1 - lx, 2);
  const highlightWeight = Math.pow(lx, 2);
  const y = lx + s * 0.5 * shadowWeight + h * 0.5 * highlightWeight;
  return Math.max(0, Math.min(1, y));
}

function buildToneTableSVG(shadows, highlights, blackPoint, whitePoint, steps) {
  const vals = [];
  for (let i = 0; i <= steps; i++) {
    vals.push(toneCurveValue(i / steps, shadows, highlights, blackPoint, whitePoint).toFixed(4));
  }
  return vals.join(' ');
}

function buildToneLUT256(shadows, highlights, blackPoint, whitePoint) {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(toneCurveValue(i / 255, shadows, highlights, blackPoint, whitePoint) * 255);
  }
  return lut;
}

function toneIsActive(shadows, highlights, blackPoint, whitePoint) {
  return !!shadows || !!highlights || !!blackPoint || (whitePoint != null && whitePoint < 255);
}

function updateToneFilter(shadows, highlights, blackPoint, whitePoint) {
  if (!toneIsActive(shadows, highlights, blackPoint, whitePoint)) return;
  const table = buildToneTableSVG(shadows, highlights, blackPoint, whitePoint, 32);
  ['ed-tone-r', 'ed-tone-g', 'ed-tone-b'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('tableValues', table);
  });
}

/* Pixelová aplikace tónové křivky při finálním ukládání (přesná, 256 kroků) */
function applyToneLUT(ctx, w, h, shadows, highlights, blackPoint, whitePoint) {
  if (!toneIsActive(shadows, highlights, blackPoint, whitePoint)) return;
  const lut = buildToneLUT256(shadows, highlights, blackPoint, whitePoint);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]];
    d[i + 1] = lut[d[i + 1]];
    d[i + 2] = lut[d[i + 2]];
  }
  ctx.putImageData(imgData, 0, 0);
}

/* === NAROVNÁNÍ HORIZONTU ===
   Jemná rotace (±45°) nezávislá na tlačítkách ⟲⟳90° — obojí se sčítá
   do výsledného úhlu. Volitelná vodicí mřížka pro zarovnání. */
function setStraighten(val) {
  ED.straighten = parseFloat(val);
  const el = $('fval-straighten');
  if (el) el.textContent = ED.straighten + '°';
  updatePreviewTransform();
}

function toggleStraightenGrid(show) {
  const preview = $('editPreview');
  if (!preview) return;
  let grid = preview.querySelector('.straighten-grid');
  if (show) {
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'straighten-grid';
      preview.appendChild(grid);
    }
    grid.style.display = 'block';
  } else if (grid) {
    grid.style.display = 'none';
  }
}

/* === ŽIVOST (vibrance) ===
   Chytřejší sytost: méně syté pixely zesílí víc, už syté (a pleťové tóny)
   šetří — na rozdíl od obyčejné sytosti, která táhne všechno stejně. */
function applyVibrance(ctx, w, h, amount) {
  if (!amount) return;
  const amt = amount / 100;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const max = Math.max(r, g, b);
    const avg = (r + g + b) / 3;
    const sat = (max - avg) / 255;
    const factor = amt * (1 - sat) * 1.6;
    d[i] = Math.max(0, Math.min(255, r + (r - avg) * factor));
    d[i + 1] = Math.max(0, Math.min(255, g + (g - avg) * factor));
    d[i + 2] = Math.max(0, Math.min(255, b + (b - avg) * factor));
  }
  ctx.putImageData(imgData, 0, 0);
}

/* === STAV EDITORU === */
let ED = {
  photo: null,
  img: null,
  scale: 1,
  rotate: 0,
  straighten: 0,
  panX: 0,
  panY: 0,
  crop: 'free',
  export: 'max',
  blobUrl: null,
  toneBaseUrl: null,
  filters: { exposure: 0, contrast: 0, saturation: 0, vibrance: 0, shadows: 0, highlights: 0, blackPoint: 0, whitePoint: 255, temp: 0, vignette: 0, sharpen: 0, denoise: 0 },
  cropRect: null,
  isDraggingImage: false,
  isDraggingCrop: false,
  isResizingCrop: false,
  resizeDir: '',
  lastX: 0,
  lastY: 0,
  stats: null,
  activePreset: '',
  presetIntensity: 100,
  filterHistory: [],
  _suppressSnapshot: false
};

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
/* =========================================================
   DASHBOARD EDITOR — ČÁST 2/5
   ========================================================= */

/* === EDITOR: otevření/zavření === */
async function openEditor(id) {
  const p = G.photos.find(x => x.id === id);
  if (!p) return;
  ED.photo = p;
  ED.scale = 1; ED.rotate = 0; ED.straighten = 0; ED.panX = 0; ED.panY = 0;
  ED.crop = 'free'; ED.export = 'max'; ED.cropRect = null;
  ED.filters = { exposure: 0, contrast: 0, saturation: 0, vibrance: 0, shadows: 0, highlights: 0, blackPoint: 0, whitePoint: 255, temp: 0, vignette: 0, sharpen: 0, denoise: 0 };
  ED.stats = null;
  ED.presetIntensity = 100;
  ED.filterHistory = [];
  const intensitySlider = $('presetIntensitySlider');
  if (intensitySlider) intensitySlider.value = 100;
  const intensityLabel = $('presetIntensityVal');
  if (intensityLabel) intensityLabel.textContent = '100%';
  if (ED.blobUrl) { URL.revokeObjectURL(ED.blobUrl); ED.blobUrl = null; }
  if (ED.toneBaseUrl) { URL.revokeObjectURL(ED.toneBaseUrl); ED.toneBaseUrl = null; }
  const straightSlider = $('fslider-straighten');
  if (straightSlider) straightSlider.value = 0;
  const straightLabel = $('fval-straighten');
  if (straightLabel) straightLabel.textContent = '0°';
  const gridToggle = $('gridToggle');
  if (gridToggle) gridToggle.checked = false;
  toggleStraightenGrid(false);
  updateFilterLabels();
  updateSharpenFilter(0);
  ED.activePreset = '';
  syncFilterSlidersFromState();
  setCrop('free');
  setExport('max');
  try {
    const r = await fetch(p.url);
    if (!r.ok) throw new Error('fetch failed');
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    ED.blobUrl = url;
    const img = new Image();
    img.onload = () => {
      ED.img = img;
      $('editorModal')?.classList.remove('hidden');
      const el = $('editImg');
      if (el) el.src = url;
      fitImageToPreview();
      let vig = document.querySelector('.vignette-overlay');
      if (!vig) {
        vig = document.createElement('div');
        vig.className = 'vignette-overlay';
        vig.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:4;';
        $('editPreview').appendChild(vig);
      }
      vig.style.opacity = 0;
      renderPresetSwatches();
    };
    img.onerror = () => {
      showToast('Obrázek se nepodařilo načíst.', 'error');
      URL.revokeObjectURL(url); ED.blobUrl = null;
    };
    img.src = url;
  } catch {
    showToast('Obrázek se nepodařilo načíst.', 'error');
  }
}

function fitImageToPreview() {
  if (!ED.img) return;
  const preview = $('editPreview');
  if (!preview) return;
  const pW = preview.clientWidth, pH = preview.clientHeight;
  const fit = Math.min(pW / ED.img.naturalWidth, pH / ED.img.naturalHeight, 1);
  ED.scale = fit; ED.panX = 0; ED.panY = 0;
  const zs = $('zoomSlider');
  if (zs) { zs.min = Math.min(fit, 0.1).toFixed(2); zs.max = 4; zs.value = fit.toFixed(2); }
  updatePreviewTransform();
}

function closeEditor() {
  $('editorModal')?.classList.add('hidden');
  if (ED.blobUrl) { URL.revokeObjectURL(ED.blobUrl); ED.blobUrl = null; }
  if (ED.toneBaseUrl) { URL.revokeObjectURL(ED.toneBaseUrl); ED.toneBaseUrl = null; }
  ED.img = null; ED.photo = null; ED.cropRect = null;
  const vig = document.querySelector('.vignette-overlay');
  if (vig) vig.style.opacity = 0;
}

/* === EDITOR: zoom/rotace === */
function editorSetZoom(v) { ED.scale = parseFloat(v); updatePreviewTransform(); }

/* Velikost náhledu na obrazovce se teď VŽDY počítá z rozměrů originální
   (plné) fotky (ED.img.naturalWidth/Height) × ED.scale, nastavena natvrdo
   jako width/height v px. Dřív se spoléhalo na to, že <img> má "přirozenou"
   velikost currently-loaded src a transform:scale() ji jen zvětší/zmenší —
   jenže živý náhled tónové křivky (viz regenerateToneMappedImage) kvůli
   výkonu nahrazuje src menším (max 1600px) obrázkem. Přirozená velikost se
   tak změnila, ale scale ne → fotka se najednou zobrazila menší, než měla
   (a ořezový rámeček pak odpovídal jiné oblasti, než bylo vidět). Explicitní
   px rozměry z ORIGINÁLU tohle úplně odstraní bez ohledu na to, jaký
   (případně zmenšený) obrázek je zrovna v src. */
function updatePreviewTransform() {
  const img = $('editImg');
  if (!img || !ED.img) return;
  img.style.width = (ED.img.naturalWidth * ED.scale) + 'px';
  img.style.height = (ED.img.naturalHeight * ED.scale) + 'px';
  img.style.transform = `translate(${ED.panX}px, ${ED.panY}px) rotate(${ED.rotate + ED.straighten}deg)`;
  applyFilters();
}

function rotateEditor(deg) { ED.rotate = (ED.rotate + deg) % 360; updatePreviewTransform(); }

/* === PŘED/PO NÁHLED ===
   Podržením tlačítka se na chvíli ukáže needitovaná fotka (bez CSS
   filtrů, tónové křivky i vinětace) — jako v Lightroomu/Photoshopu.
   Netýká se ořezu/rotace (to jsou už "trvalé" změny geometrie, ne
   filtr), jen barevných/světelných úprav a stylů. */
let beforeAfterState = null;
function showBeforePreview(show) {
  const img = $('editImg');
  const vig = document.querySelector('.vignette-overlay');
  if (!img) return;
  if (show) {
    if (beforeAfterState) return; // už drženo
    beforeAfterState = { filter: img.style.filter, src: img.src, vigOpacity: vig ? vig.style.opacity : null };
    img.style.filter = 'none';
    if (ED.blobUrl) img.src = ED.blobUrl;
    if (vig) vig.style.opacity = 0;
  } else {
    if (!beforeAfterState) return;
    img.style.filter = beforeAfterState.filter;
    img.src = beforeAfterState.src;
    if (vig && beforeAfterState.vigOpacity != null) vig.style.opacity = beforeAfterState.vigOpacity;
    beforeAfterState = null;
  }
}

/* === EDITOR: filtry === */
function applyFilters() {
  const img = $('editImg');
  if (!img) return;
  const f = ED.filters;
  let s = `brightness(${100 + f.exposure}%) contrast(${100 + f.contrast}%) saturate(${100 + f.saturation}%)`;
  if (f.vibrance) s += ` saturate(${100 + f.vibrance * 0.5}%)`;
  if (f.temp > 0) s += ` sepia(${f.temp * 0.5}%)`;
  else s += ` hue-rotate(${f.temp * 0.3}deg)`;
  if (f.denoise > 0) s += ` blur(${f.denoise * 0.05}px)`;
  if (f.sharpen > 0) {
    updateSharpenFilter(f.sharpen);
    s += ' url(#ed-sharpen-dynamic)';
  }
  /* Vynucené překreslení — bez tohohle prohlížeč občas ignoruje změny uvnitř
     dynamických SVG filtrů (doostření), protože samotný text vlastnosti
     filter zůstává stejný (mění se jen atributy uvnitř <svg>). */
  img.style.filter = 'none';
  void img.offsetHeight;
  img.style.filter = s;
  const vig = document.querySelector('.vignette-overlay');
  if (vig && f.vignette > 0) {
    vig.style.background = `radial-gradient(circle at center, transparent 30%, rgba(0,0,0,${f.vignette / 100}) 90%)`;
    vig.style.opacity = 1;
  } else if (vig) { vig.style.opacity = 0; }
}

/* === PŘESNÝ NÁHLED STÍNŮ/SVĚTEL/LEVELS ===
   Tón (stíny, světla, černý/bílý bod) se v SVG filtru chovalo nespolehlivě
   napříč prohlížeči (i po opravě barevného prostoru). Místo toho se teď
   náhled dopočítá STEJNOU pixelovou funkcí jako finální export
   (applyToneLUT), aby náhled = realita na 100 %. Debounce 120ms kvůli
   plynulému tažení posuvníku. */
let toneRegenTimer = null;
let toneRegenToken = 0;
function scheduleToneRegeneration() {
  clearTimeout(toneRegenTimer);
  toneRegenTimer = setTimeout(regenerateToneMappedImage, 120);
}

async function regenerateToneMappedImage() {
  if (!ED.img) return;
  const el = $('editImg');
  if (!el) return;
  const f = ED.filters;

  if (!toneIsActive(f.shadows, f.highlights, f.blackPoint, f.whitePoint)) {
    if (ED.toneBaseUrl) { URL.revokeObjectURL(ED.toneBaseUrl); ED.toneBaseUrl = null; }
    if (ED.blobUrl && el.src !== ED.blobUrl) el.src = ED.blobUrl;
    return;
  }

  /* Token proti "race condition" — pokud uživatel rychle táhne slider,
     může se stát, že starší (pomalejší) výpočet dokončí PO novějším a
     přepíše náhled zastaralým výsledkem. Použije se jen výsledek
     poslední spuštěné regenerace. */
  const myToken = ++toneRegenToken;

  const maxSide = 1600; // strop pro plynulý živý náhled, export používá plné rozlišení
  let w = ED.img.naturalWidth, h = ED.img.naturalHeight;
  if (Math.max(w, h) > maxSide) {
    const scale = maxSide / Math.max(w, h);
    w = Math.round(w * scale); h = Math.round(h * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(ED.img, 0, 0, w, h);
  applyToneLUT(ctx, w, h, f.shadows, f.highlights, f.blackPoint, f.whitePoint);

  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
  if (!blob || myToken !== toneRegenToken) return; // zastaralý výsledek, zahodit
  const url = URL.createObjectURL(blob);
  if (ED.toneBaseUrl) URL.revokeObjectURL(ED.toneBaseUrl);
  ED.toneBaseUrl = url;
  el.src = url;
  // Velikost na obrazovce zůstává svázaná s ED.img (originálem), takže
  // zmenšený náhled se nezobrazí menší — viz updatePreviewTransform().
}

function updateFilterLabels() {
  const f = ED.filters;
  const ids = { exposure:'fval-exposure', contrast:'fval-contrast', saturation:'fval-saturation', vibrance:'fval-vibrance', shadows:'fval-shadows', highlights:'fval-highlights', blackPoint:'fval-blackPoint', whitePoint:'fval-whitePoint', temp:'fval-temp', vignette:'fval-vignette', sharpen:'fval-sharpen', denoise:'fval-denoise' };
  for (const [k, id] of Object.entries(ids)) { const el = $(id); if (el) el.textContent = f[k]; }
}

/* Nastaví polohy všech posuvníků podle aktuálního ED.filters (např. po výběru předvolby) */
function syncFilterSlidersFromState() {
  const f = ED.filters;
  const ids = ['exposure', 'contrast', 'saturation', 'vibrance', 'shadows', 'highlights', 'blackPoint', 'whitePoint', 'temp', 'vignette', 'sharpen', 'denoise'];
  ids.forEach(k => { const el = $('fslider-' + k); if (el) el.value = f[k]; });
  updateFilterLabels();
}

function setFilter(key, val) {
  if (!ED._suppressSnapshot) snapshotFilters();
  ED.filters[key] = parseInt(val);
  const el = $('fval-' + key);
  if (el) el.textContent = val;
  if (key === 'sharpen') updateSharpenFilter(ED.filters.sharpen);
  if (key === 'shadows' || key === 'highlights' || key === 'blackPoint' || key === 'whitePoint') {
    scheduleToneRegeneration();
  }
  ED.activePreset = '';
  document.querySelectorAll('.preset-swatch.active').forEach(b => b.classList.remove('active'));
  applyFilters();
}

/* === HISTORIE ÚPRAV (Zpět) ===
   Posuvníky (expozice, kontrast, stíny...) a předvolby/auto-tlačítka
   dřív neměly žádné "zpět" — jen textový WYSIWYG editor článku. Tohle
   ukládá otisk ED.filters PŘED každou změnou (max 25 kroků), takže
   "↶ Zpět (styl)" vrátí poslední úpravu. Neřeší ořez/rotaci (to jsou
   geometrické, ne filtrové změny) — na ty pořád slouží vlastní
   ⟲⟳90° tlačítka a posuvník narovnání. */
function snapshotFilters() {
  ED.filterHistory = ED.filterHistory || [];
  ED.filterHistory.push(JSON.stringify({ filters: ED.filters, preset: ED.activePreset }));
  if (ED.filterHistory.length > 25) ED.filterHistory.shift();
}

function undoFilterChange() {
  if (!ED.filterHistory || !ED.filterHistory.length) { showToast('Není co vrátit zpět.', 'info'); return; }
  const prev = JSON.parse(ED.filterHistory.pop());
  ED.filters = prev.filters;
  ED.activePreset = prev.preset || '';
  syncFilterSlidersFromState();
  updateSharpenFilter(ED.filters.sharpen);
  scheduleToneRegeneration();
  applyFilters();
  document.querySelectorAll('.preset-swatch').forEach(b => b.classList.toggle('active', b.dataset.preset === ED.activePreset));
}

/* === PŘEDVOLBY (jako styly ve Photoshopu) === */
const FILTER_PRESETS = {
  none:         { exposure: 0,   contrast: 0,   saturation: 0,   vibrance: 0,   shadows: 0,   highlights: 0,   blackPoint: 0,  whitePoint: 255, temp: 0,   vignette: 0,  sharpen: 0,  denoise: 0 },
  bw:           { exposure: 0,   contrast: 15,  saturation: -100, vibrance: 0,  shadows: 5,   highlights: -10, blackPoint: 5,  whitePoint: 250, temp: 0,   vignette: 15, sharpen: 15, denoise: 0 },
  highKeyBW:    { exposure: 15,  contrast: -5,  saturation: -100, vibrance: 0,  shadows: 25,  highlights: 5,   blackPoint: 0,  whitePoint: 255, temp: 0,   vignette: 0,  sharpen: 10, denoise: 0 },
  vintage:      { exposure: -5,  contrast: -10, saturation: -25, vibrance: -10, shadows: 10,  highlights: -15, blackPoint: 15, whitePoint: 235, temp: 25,  vignette: 35, sharpen: 0,  denoise: 5 },
  fadedFilm:    { exposure: 3,   contrast: -25, saturation: -15, vibrance: -5,  shadows: 30,  highlights: -20, blackPoint: 25, whitePoint: 230, temp: 12,  vignette: 10, sharpen: 0,  denoise: 8 },
  crossProcess: { exposure: 2,   contrast: 30,  saturation: 20,  vibrance: 15,  shadows: -15, highlights: 10,  blackPoint: 15, whitePoint: 245, temp: -8,  vignette: 20, sharpen: 10, denoise: 0 },
  warm:         { exposure: 5,   contrast: 5,   saturation: 5,   vibrance: 15,  shadows: 5,   highlights: 0,   blackPoint: 0,  whitePoint: 255, temp: 30,  vignette: 0,  sharpen: 0,  denoise: 0 },
  goldenHour:   { exposure: 8,   contrast: 8,   saturation: 10,  vibrance: 25,  shadows: 10,  highlights: -12, blackPoint: 5,  whitePoint: 248, temp: 35,  vignette: 15, sharpen: 5,  denoise: 0 },
  autumnGlow:   { exposure: 3,   contrast: 12,  saturation: 18,  vibrance: 20,  shadows: 0,   highlights: -8,  blackPoint: 8,  whitePoint: 248, temp: 22,  vignette: 12, sharpen: 5,  denoise: 0 },
  cold:         { exposure: 0,   contrast: 8,   saturation: -5,  vibrance: 5,   shadows: 0,   highlights: 0,   blackPoint: 0,  whitePoint: 255, temp: -30, vignette: 0,  sharpen: 0,  denoise: 0 },
  arcticBlue:   { exposure: 5,   contrast: 5,   saturation: -10, vibrance: 10,  shadows: 15,  highlights: 5,   blackPoint: 0,  whitePoint: 255, temp: -35, vignette: 0,  sharpen: 5,  denoise: 0 },
  blueHour:     { exposure: -5,  contrast: 15,  saturation: 5,   vibrance: 15,  shadows: -10, highlights: 0,   blackPoint: 5,  whitePoint: 250, temp: -25, vignette: 25, sharpen: 5,  denoise: 0 },
  highContrast: { exposure: 0,   contrast: 35,  saturation: 10,  vibrance: 10,  shadows: -20, highlights: 20,  blackPoint: 12, whitePoint: 245, temp: 0,   vignette: 15, sharpen: 25, denoise: 0 },
  vivid:        { exposure: 5,   contrast: 12,  saturation: 15,  vibrance: 40,  shadows: 5,   highlights: -5,  blackPoint: 0,  whitePoint: 255, temp: 5,   vignette: 0,  sharpen: 15, denoise: 0 },
  neonNight:    { exposure: -5,  contrast: 30,  saturation: 25,  vibrance: 35,  shadows: -25, highlights: 10,  blackPoint: 15, whitePoint: 245, temp: -15, vignette: 20, sharpen: 15, denoise: 0 },
  filmNoir:     { exposure: -10, contrast: 25,  saturation: -60, vibrance: 0,   shadows: -15, highlights: 15,  blackPoint: 20, whitePoint: 240, temp: -10, vignette: 45, sharpen: 10, denoise: 0 },
  pastel:       { exposure: 8,   contrast: -15, saturation: -20, vibrance: 25,  shadows: 20,  highlights: -10, blackPoint: 15, whitePoint: 245, temp: 10,  vignette: 0,  sharpen: 0,  denoise: 5 },
  softPortrait: { exposure: 8,   contrast: -8,  saturation: -5,  vibrance: 15,  shadows: 20,  highlights: -15, blackPoint: 5,  whitePoint: 248, temp: 12,  vignette: 8,  sharpen: 0,  denoise: 8 },
  drama:        { exposure: -8,  contrast: 40,  saturation: -10, vibrance: 20,  shadows: -30, highlights: 25,  blackPoint: 10, whitePoint: 248, temp: 0,   vignette: 30, sharpen: 20, denoise: 0 },
  sepia:        { exposure: 0,   contrast: 8,   saturation: -80, vibrance: 0,   shadows: 12,  highlights: -8,  blackPoint: 10, whitePoint: 235, temp: 45,  vignette: 25, sharpen: 0,  denoise: 3 },
  clean:        { exposure: 10,  contrast: 8,   saturation: 5,   vibrance: 10,  shadows: 15,  highlights: -15, blackPoint: 0,  whitePoint: 255, temp: -5,  vignette: 0,  sharpen: 10, denoise: 0 },
  matte:        { exposure: 5,   contrast: -20, saturation: -10, vibrance: 5,   shadows: 25,  highlights: -30, blackPoint: 30, whitePoint: 225, temp: 8,   vignette: 0,  sharpen: 0,  denoise: 0 },
  sunset:       { exposure: 3,   contrast: 10,  saturation: 15,  vibrance: 30,  shadows: -5,  highlights: -10, blackPoint: 5,  whitePoint: 250, temp: 40,  vignette: 20, sharpen: 5,  denoise: 0 },
  night:        { exposure: -15, contrast: 20,  saturation: -15, vibrance: 10,  shadows: 30,  highlights: -20, blackPoint: 0,  whitePoint: 240, temp: -20, vignette: 40, sharpen: 15, denoise: 20 }
};

/* === AUTO VYLEPŠENÍ (skutečná analýza obrázku, ne pevný "kosmetický" filtr) ===
   Starý přepínač "✨ AI vylepšení" jen natvrdo přidal fixní zesílení jasu/
   kontrastu/sytosti bez ohledu na to, jak fotka vlastně vypadá — proto na
   spoustě fotek nefungoval (přepálil je, nebo se nic nezměnilo). Tohle
   místo toho fotku skutečně změří (histogram jasu a průměr barevných
   kanálů) a spočítá, co konkrétně potřebuje — přesně jako "Auto Tone /
   Auto Contrast / Auto Color" ve Photoshopu. */
function analyzeImageStats(img) {
  const maxSide = 300; // stačí zmenšenina, jde jen o statistiku
  let w = img.naturalWidth, h = img.naturalHeight;
  if (Math.max(w, h) > maxSide) {
    const s = maxSide / Math.max(w, h);
    w = Math.max(1, Math.round(w * s));
    h = Math.max(1, Math.round(h * s));
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let rSum = 0, gSum = 0, bSum = 0, lumMin = 255, lumMax = 0;
  const n = w * h;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    rSum += r; gSum += g; bSum += b;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < lumMin) lumMin = lum;
    if (lum > lumMax) lumMax = lum;
  }
  return { rAvg: rSum / n, gAvg: gSum / n, bAvg: bSum / n, lumMin, lumMax };
}

/* Statistiky se počítají jen jednou na fotku (a znovu po ořezu), ne při
   každém kliknutí na auto-tlačítko. */
function getImageStats() {
  if (!ED.img) return null;
  if (!ED.stats) ED.stats = analyzeImageStats(ED.img);
  return ED.stats;
}

/* Auto kontrast — natáhne histogram jasu tak, aby nejtmavší místo bylo
   téměř černé a nejsvětlejší téměř bílé (klasický "auto levels"). */
function autoContrast() {
  const s = getImageStats();
  if (!s) return;
  if (!ED._suppressSnapshot) snapshotFilters();
  ED.filters.blackPoint = Math.max(0, Math.min(60, Math.round(s.lumMin)));
  ED.filters.whitePoint = Math.min(255, Math.max(195, Math.round(s.lumMax)));
  syncFilterSlidersFromState();
  scheduleToneRegeneration();
  applyFilters();
  showToast('Auto kontrast použit', 'success');
}

/* Auto expozice — posune průměrný jas fotky směrem ke střední šedé. */
function autoExposure() {
  const s = getImageStats();
  if (!s) return;
  if (!ED._suppressSnapshot) snapshotFilters();
  const avgLum = (s.rAvg + s.gAvg + s.bAvg) / 3;
  ED.filters.exposure = Math.max(-60, Math.min(60, Math.round((128 - avgLum) * 0.5)));
  syncFilterSlidersFromState();
  applyFilters();
  showToast('Auto expozice použita', 'success');
}

/* Auto bílá — gray-world vyvážení: pokud fotka táhne do modra/žluta,
   jemně to narovná přes teplotu. */
function autoWhiteBalance() {
  const s = getImageStats();
  if (!s) return;
  if (!ED._suppressSnapshot) snapshotFilters();
  const rbDiff = s.rAvg - s.bAvg;
  ED.filters.temp = Math.max(-45, Math.min(45, Math.round(-rbDiff * 0.85)));
  syncFilterSlidersFromState();
  applyFilters();
  showToast('Auto bílá použita', 'success');
}

/* === AUTO DOOSTŘENÍ / ODŠUMĚNÍ (reálná analýza, ne pevná hodnota) ===
   Míra rozmazání se počítá přes varianci Laplaciánu (klasická metrika
   "jak ostrá je fotka" — ostré hrany dávají vysokou varianci, rozmazané
   plochy nízkou). Míra šumu se odhaduje přes Immerkærovu metodu (rychlý
   odhad směrodatné odchylky šumu z vysokofrekvenčního obsahu). Obojí se
   počítá na zmenšenině, stačí to na spolehlivý odhad a je to rychlé. */
function computeBlurAndNoiseScores(img) {
  const maxSide = 260;
  let w = img.naturalWidth, h = img.naturalHeight;
  if (Math.max(w, h) > maxSide) {
    const s = maxSide / Math.max(w, h);
    w = Math.max(3, Math.round(w * s));
    h = Math.max(3, Math.round(h * s));
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const gray = new Float64Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const at = (x, y) => gray[y * w + x];

  let lapSum = 0, lapSumSq = 0, lapCount = 0, noiseAbsSum = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const lap = at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1) - 4 * at(x, y);
      lapSum += lap; lapSumSq += lap * lap; lapCount++;

      const n = at(x - 1, y - 1) - 2 * at(x, y - 1) + at(x + 1, y - 1)
              - 2 * at(x - 1, y) + 4 * at(x, y) - 2 * at(x + 1, y)
              + at(x - 1, y + 1) - 2 * at(x, y + 1) + at(x + 1, y + 1);
      noiseAbsSum += Math.abs(n);
    }
  }
  const lapMean = lapSum / lapCount;
  const sharpnessVariance = lapSumSq / lapCount - lapMean * lapMean;
  const noiseSigma = Math.sqrt(Math.PI / 2) * noiseAbsSum / (6 * Math.max(1, (w - 2) * (h - 2)));
  return { sharpnessVariance, noiseSigma };
}

function autoSharpen() {
  if (!ED.img) return;
  if (!ED._suppressSnapshot) snapshotFilters();
  const { sharpnessVariance } = computeBlurAndNoiseScores(ED.img);
  // Nízká variance Laplaciánu = rozmazaná fotka → potřebuje víc doostřit.
  let amount;
  if (sharpnessVariance < 20) amount = 75;
  else if (sharpnessVariance < 60) amount = 55;
  else if (sharpnessVariance < 150) amount = 35;
  else if (sharpnessVariance < 400) amount = 22;
  else amount = 14;
  ED.filters.sharpen = amount;
  syncFilterSlidersFromState();
  updateSharpenFilter(amount);
  applyFilters();
  showToast('Auto doostření nastaveno (' + amount + ')', 'success');
}

/* === AUTO NAROVNÁNÍ HORIZONTU ===
   Přes Sobelův gradient najde ve fotce nejvýraznější téměř vodorovné linie
   (horizont, hrany budov, čáry na zemi...) a spočítá, o kolik stupňů jsou
   nakloněné — pak fotku narovná o opačný úhel. Funguje dobře na fotkách
   s jasnou vodorovnou linií; pokud žádnou výraznou nenajde, radši nic
   nezmění a řekne to, než aby otočila fotku nasilu špatně. */
function computeAutoStraightenAngle(img) {
  const maxSide = 260;
  let w = img.naturalWidth, h = img.naturalHeight;
  if (Math.max(w, h) > maxSide) {
    const s = maxSide / Math.max(w, h);
    w = Math.max(3, Math.round(w * s));
    h = Math.max(3, Math.round(h * s));
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const gray = new Float64Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const at = (x, y) => gray[y * w + x];

  const bins = {};
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag < 25) continue; // slabé hrany (šum) ignorovat
      const gradAngle = Math.atan2(gy, gx) * 180 / Math.PI;
      let lineAngle = gradAngle - 90; // směr čáry je kolmý na gradient
      while (lineAngle > 90) lineAngle -= 180;
      while (lineAngle < -90) lineAngle += 180;
      if (Math.abs(lineAngle) > 25) continue; // zajímají nás jen téměř vodorovné linie
      const bin = Math.round(lineAngle * 2) / 2; // kroky po 0,5°
      bins[bin] = (bins[bin] || 0) + mag;
    }
  }

  let bestAngle = 0, bestWeight = 0;
  for (const key in bins) {
    if (bins[key] > bestWeight) { bestWeight = bins[key]; bestAngle = parseFloat(key); }
  }
  if (bestWeight < 220) return null; // nedostatek důkazů — radši nic nedělat
  return -bestAngle;
}

function autoStraighten() {
  if (!ED.img) return;
  const angle = computeAutoStraightenAngle(ED.img);
  if (angle == null) {
    showToast('Nenašel jsem dost výraznou vodorovnou linii k narovnání — zkus ruční posuvník.', 'info');
    return;
  }
  ED.straighten = Math.max(-45, Math.min(45, Math.round(angle * 10) / 10));
  const slider = $('fslider-straighten');
  if (slider) slider.value = ED.straighten;
  const label = $('fval-straighten');
  if (label) label.textContent = ED.straighten + '°';
  updatePreviewTransform();
  showToast('Horizont narovnán o ' + ED.straighten + '°', 'success');
}

/* === AUTO VŠECHNO NAJEDNOU ===
   Jedno tlačítko, co spustí všechny čtyři automatické korekce v rozumném
   pořadí (nejdřív narovnání a expozice, pak kontrast a bílá, nakonec
   doostření podle výsledné ostrosti). Pohodlné pro rychlé "hodit fotku
   do prezentovatelného stavu" bez ručního doťukávání posuvníků. */
function autoEnhanceAll() {
  if (!ED.img) return;
  snapshotFilters();
  ED._suppressSnapshot = true;
  autoStraighten();
  autoExposure();
  autoContrast();
  autoWhiteBalance();
  autoSharpen();
  ED._suppressSnapshot = false;
  showToast('Automatické vylepšení hotovo — zkontroluj výsledek a doladˇ dle chuti', 'success');
}

/* === SÍLA PŘEDVOLBY (jako "Amount" u Lightroom presetů) ===
   Místo binárního zapnuto/vypnuto jde intenzita stylu doladit 0–150 %.
   Většina hodnot v předvolbě je "delta" od neutrálu (0), ty se prostě
   násobí. blackPoint/whitePoint ale mají neutrál 0 / 255, ne 0 — takže
   se škáluje jejich VZDÁLENOST od neutrálu, ne hodnota samotná. */
function scalePreset(preset, intensity) {
  const k = intensity / 100;
  const scaled = {};
  for (const key of ['exposure', 'contrast', 'saturation', 'vibrance', 'shadows', 'highlights', 'temp', 'vignette', 'sharpen', 'denoise']) {
    scaled[key] = Math.round((preset[key] || 0) * k);
  }
  scaled.blackPoint = Math.max(0, Math.round((preset.blackPoint || 0) * k));
  scaled.whitePoint = Math.min(255, Math.round(255 - (255 - (preset.whitePoint ?? 255)) * k));
  scaled.vignette = Math.max(0, scaled.vignette);
  scaled.sharpen = Math.max(0, scaled.sharpen);
  scaled.denoise = Math.max(0, scaled.denoise);
  return scaled;
}

function setPresetIntensity(val) {
  ED.presetIntensity = parseInt(val);
  const label = $('presetIntensityVal');
  if (label) label.textContent = val + '%';
  if (ED.activePreset && FILTER_PRESETS[ED.activePreset]) {
    ED.filters = scalePreset(FILTER_PRESETS[ED.activePreset], ED.presetIntensity);
    syncFilterSlidersFromState();
    updateSharpenFilter(ED.filters.sharpen);
    scheduleToneRegeneration();
    applyFilters();
  }
}

function applyPreset(name) {
  const preset = FILTER_PRESETS[name];
  if (!preset) return;
  if (!ED._suppressSnapshot) snapshotFilters();
  ED.activePreset = name;
  ED.filters = scalePreset(preset, ED.presetIntensity);
  syncFilterSlidersFromState();
  updateSharpenFilter(ED.filters.sharpen);
  scheduleToneRegeneration();
  applyFilters();
  document.querySelectorAll('.preset-swatch').forEach(b => b.classList.toggle('active', b.dataset.preset === name));
}

const PRESET_LABELS = {
  none: '↺ Bez efektu', bw: 'Černobílá', highKeyBW: 'Světlá ČB', vintage: 'Vintage', fadedFilm: 'Vybledlý film',
  crossProcess: 'Cross process', warm: 'Teplý tón', goldenHour: 'Zlatá hodinka', autumnGlow: 'Podzimní záře',
  cold: 'Studený tón', arcticBlue: 'Arktická modrá', blueHour: 'Modrá hodinka',
  highContrast: 'Vysoký kontrast', vivid: 'Živé barvy', neonNight: 'Neonová noc', filmNoir: 'Film Noir', pastel: 'Pastelové',
  softPortrait: 'Jemný portrét', drama: 'Dramatický', sepia: 'Sépie', clean: 'Čistý/Jasný', matte: 'Matný',
  sunset: 'Západ slunce', night: 'Noční'
};

/* Přibližný CSS filtr pro RYCHLÝ náhled stylu na malé miniatuře (jen
   exposure/contrast/saturation/temp — stíny/světla/vinětace apod. se do
   rychlého CSS filtru nedají přenést přesně, na miniatuře ale stačí na
   rozpoznání stylu). Přesný výsledek se použije až po kliknutí. */
function presetPreviewFilterString(preset) {
  let s = `brightness(${100 + preset.exposure}%) contrast(${100 + preset.contrast}%) saturate(${100 + preset.saturation}%)`;
  if (preset.temp > 0) s += ` sepia(${preset.temp * 0.5}%)`;
  else s += ` hue-rotate(${preset.temp * 0.3}deg)`;
  return s;
}

/* Vykreslí mřížku náhledů stylů — miniatury AKTUÁLNÍ fotky s filtrem
   přímo v panelu (jako swatch v Photoshopu), místo textového rozbalovacího
   seznamu. Díky tomu je hned vidět, jak bude fotka vypadat, a na mobilu to
   nezakrývá náhled fotky přes celou obrazovku (je to obyčejný obsah
   sbalitelného panelu, ne nativní <select> overlay). */
function renderPresetSwatches() {
  const box = $('presetSwatches');
  if (!box || !ED.img) return;
  const thumbSrc = ED.toneBaseUrl || ED.blobUrl || '';
  const activeName = ED.activePreset || '';
  box.innerHTML = Object.keys(FILTER_PRESETS).map(key => {
    const preset = FILTER_PRESETS[key];
    const label = PRESET_LABELS[key] || key;
    const filterCss = presetPreviewFilterString(preset);
    const active = key === activeName ? ' active' : '';
    return `
      <button type="button" class="preset-swatch${active}" onclick="applyPreset('${key}')" data-preset="${key}" title="${escapeHtml(label)}">
        <span class="preset-swatch-thumb" style="background-image:url('${thumbSrc}');filter:${filterCss}"></span>
        <span class="preset-swatch-label">${escapeHtml(label)}</span>
      </button>`;
  }).join('');
}

/* === EDITOR: crop systém === */
function setCrop(mode) {
  ED.crop = mode;
  document.querySelectorAll('.editor-sidebar .crop-mode-row .btn').forEach(b => b.classList.remove('btn-blue'));
  const labels = { free:'Volný', '1:1':'1:1', '4:3':'4:3', '3:4':'3:4', '16:9':'16:9' };
  const btn = Array.from(document.querySelectorAll('.editor-sidebar .crop-mode-row .btn')).find(b => b.textContent.trim() === labels[mode]);
  if (btn) btn.classList.add('btn-blue');
  const layer = $('cropLayer'), preview = $('editPreview');
  if (!preview) return;
  if (mode === 'free') { if (layer) layer.style.display = 'none'; ED.cropRect = null; return; }
  if (layer) layer.style.display = 'block';
  const W = preview.clientWidth, H = preview.clientHeight;
  let w, h;
  if (mode === '1:1') w = h = Math.min(W, H) * 0.5;
  else if (mode === '4:3') { w = Math.min(W, H) * 0.55; h = w * 0.75; }
  else if (mode === '3:4') { h = Math.min(W, H) * 0.55; w = h * 0.75; }
  else if (mode === '16:9') { w = Math.min(W, H) * 0.6; h = w / 1.777; }
  else { w = W * 0.6; h = H * 0.6; }
  w = Math.min(w, W - 20); h = Math.min(h, H - 20);
  ED.cropRect = { x: (W - w) / 2, y: (H - h) / 2, w, h };
  renderCropRect();
}

function renderCropRect() {
  if (!ED.cropRect) return;
  const r = ED.cropRect, W = $('editPreview').clientWidth, H = $('editPreview').clientHeight;
  const rect = $('cropRect');
  if (rect) { rect.style.left = r.x + 'px'; rect.style.top = r.y + 'px'; rect.style.width = r.w + 'px'; rect.style.height = r.h + 'px'; }
  const mt = $('maskTop'); if (mt) mt.style.cssText = `left:0;top:0;width:${W}px;height:${r.y}px`;
  const mb = $('maskBottom'); if (mb) mb.style.cssText = `left:0;top:${r.y + r.h}px;width:${W}px;height:${H - r.y - r.h}px`;
  const ml = $('maskLeft'); if (ml) ml.style.cssText = `left:0;top:${r.y}px;width:${r.x}px;height:${r.h}px`;
  const mr = $('maskRight'); if (mr) mr.style.cssText = `left:${r.x + r.w}px;top:${r.y}px;width:${W - r.x - r.w}px;height:${r.h}px`;
}

(function initCropSystem() {
  const preview = $('editPreview');
  if (!preview || preview.dataset.cropReady) return;
  preview.dataset.cropReady = '1';
  const onDown = (e) => {
    if (!ED.img || ED.crop === 'free') return;
    const t = e.touches ? e.touches[0] : e, target = e.target;
    if (target.closest('.crop-handle')) { e.preventDefault(); e.stopPropagation(); ED.isResizingCrop = true; ED.resizeDir = target.closest('.crop-handle').dataset.dir; ED.lastX = t.clientX; ED.lastY = t.clientY; return; }
    if (target.closest('#cropRect')) { e.preventDefault(); e.stopPropagation(); ED.isDraggingCrop = true; ED.lastX = t.clientX; ED.lastY = t.clientY; return; }
    if (target.closest('#editImg') || target === preview) { ED.isDraggingImage = true; ED.lastX = t.clientX; ED.lastY = t.clientY; }
  };
  const onMove = (e) => {
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - ED.lastX, dy = t.clientY - ED.lastY;
    ED.lastX = t.clientX; ED.lastY = t.clientY;
    if (ED.isResizingCrop && ED.cropRect) {
      e.preventDefault();
      let { x, y, w, h } = ED.cropRect;
      const ratio = ED.crop === '1:1' ? 1 : ED.crop === '4:3' ? 4 / 3 : ED.crop === '3:4' ? 3 / 4 : ED.crop === '16:9' ? 16 / 9 : 0;
      const min = 50;
      if (ED.resizeDir.includes('e')) w = Math.max(min, w + dx);
      if (ED.resizeDir.includes('s')) h = Math.max(min, h + dy);
      if (ED.resizeDir.includes('w')) { const nw = Math.max(min, w - dx); x += w - nw; w = nw; }
      if (ED.resizeDir.includes('n')) { const nh = Math.max(min, h - dy); y += h - nh; h = nh; }
      if (ratio > 0) {
        if (ED.resizeDir.includes('e') || ED.resizeDir.includes('w')) h = w / ratio;
        else if (ED.resizeDir.includes('s') || ED.resizeDir.includes('n')) w = h * ratio;
        if (ED.resizeDir.includes('n')) y = ED.cropRect.y + ED.cropRect.h - h;
        if (ED.resizeDir.includes('w')) x = ED.cropRect.x + ED.cropRect.w - w;
      }
      const pW = preview.clientWidth, pH = preview.clientHeight;
      x = Math.max(0, x); y = Math.max(0, y);
      if (x + w > pW) { x = Math.max(0, pW - w); w = Math.min(w, pW); }
      if (y + h > pH) { y = Math.max(0, pH - h); h = Math.min(h, pH); }
      ED.cropRect = { x, y, w, h };
      renderCropRect();
    } else if (ED.isDraggingCrop && ED.cropRect) {
      e.preventDefault();
      let { x, y, w, h } = ED.cropRect;
      x += dx; y += dy;
      const pW = preview.clientWidth, pH = preview.clientHeight;
      x = Math.max(0, Math.min(x, pW - w)); y = Math.max(0, Math.min(y, pH - h));
      ED.cropRect = { ...ED.cropRect, x, y };
      renderCropRect();
    } else if (ED.isDraggingImage) {
      ED.panX += dx; ED.panY += dy;
      updatePreviewTransform();
    }
  };
  const onUp = () => { ED.isDraggingImage = false; ED.isDraggingCrop = false; ED.isResizingCrop = false; ED.resizeDir = ''; };
  preview.addEventListener('mousedown', onDown);
  preview.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchend', onUp);
})();

function applyCrop() {
  if (!ED.img || ED.crop === 'free' || !ED.cropRect) return;
  if (ED.rotate !== 0 || ED.straighten !== 0) { showToast('Pro ořez musí být rotace i narovnání horizontu na 0°.', 'info'); return; }
  const preview = $('editPreview'), pW = preview.clientWidth, pH = preview.clientHeight;
  const imgW = ED.img.naturalWidth, imgH = ED.img.naturalHeight;
  const imgDisplayW = imgW * ED.scale, imgDisplayH = imgH * ED.scale;
  const imgLeft = (pW - imgDisplayW) / 2 + ED.panX, imgTop = (pH - imgDisplayH) / 2 + ED.panY;
  let srcX = (ED.cropRect.x - imgLeft) / ED.scale, srcY = (ED.cropRect.y - imgTop) / ED.scale;
  let srcW = ED.cropRect.w / ED.scale, srcH = ED.cropRect.h / ED.scale;
  if (srcX < 0) { srcW += srcX; srcX = 0; }
  if (srcY < 0) { srcH += srcY; srcY = 0; }
  if (srcX + srcW > imgW) srcW = imgW - srcX;
  if (srcY + srcH > imgH) srcH = imgH - srcY;
  srcW = Math.max(1, srcW); srcH = Math.max(1, srcH);
  if (srcW < 2 || srcH < 2) { showToast('Ořez je příliš malý.', 'info'); return; }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(srcW); canvas.height = Math.round(srcH);
  canvas.getContext('2d').drawImage(ED.img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    if (ED.blobUrl) URL.revokeObjectURL(ED.blobUrl);
    ED.blobUrl = url;
    const newImg = new Image();
    newImg.onload = () => {
      ED.img = newImg; ED.crop = 'free'; ED.panX = 0; ED.panY = 0; ED.rotate = 0; ED.scale = 1;
      ED.stats = null;
      ED.filterHistory = [];
      const zs = $('zoomSlider'); if (zs) zs.value = 1;
      const el = $('editImg'); if (el) el.src = url;
      fitImageToPreview();
      if ($('cropLayer')) $('cropLayer').style.display = 'none';
      ED.cropRect = null;
      scheduleToneRegeneration();
      renderPresetSwatches();
    };
    newImg.src = url;
  }, 'image/png');
}
/* =========================================================
   DASHBOARD EDITOR — ČÁST 3/5
   ========================================================= */

/* === EXPORT === */
function setExport(size) {
  ED.export = size;
  ['max', '2000', 'fullhd'].forEach(s => {
    const b = $('ex-' + s);
    if (b) b.classList.toggle('btn-blue', s === size);
  });
}

function getExportDim(w, h) {
  if (ED.export === 'max') return { w, h };
  if (ED.export === '2000') {
    const s = Math.min(1, 2000 / Math.max(w, h));
    return { w: Math.round(w * s), h: Math.round(h * s) };
  }
  if (ED.export === 'fullhd') {
    const s = Math.min(1, 1920 / w, 1080 / h);
    return { w: Math.round(w * s), h: Math.round(h * s) };
  }
  return { w, h };
}

function getSafeCanvasDim(w, h) {
  const max = /iPhone|iPad|iPod|Android/.test(navigator.userAgent) ? 2048 : 4096;
  if (w <= max && h <= max) return { w, h };
  const ratio = Math.min(max / w, max / h);
  return { w: Math.round(w * ratio), h: Math.round(h * ratio) };
}

/* === UPLOAD (PNG + retry) === */
function applySharpen(ctx, w, h, strength) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const out = ctx.createImageData(w, h);
  const od = out.data;
  const { kernel } = sharpenKernelForStrength(strength);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const py = Math.min(h - 1, Math.max(0, y + ky));
          const px = Math.min(w - 1, Math.max(0, x + kx));
          const idx = (py * w + px) * 4;
          const k = kernel[(ky + 1) * 3 + (kx + 1)];
          r += data[idx] * k;
          g += data[idx + 1] * k;
          b += data[idx + 2] * k;
        }
      }
      const i = (y * w + x) * 4;
      od[i] = Math.min(255, Math.max(0, r));
      od[i + 1] = Math.min(255, Math.max(0, g));
      od[i + 2] = Math.min(255, Math.max(0, b));
      od[i + 3] = data[i + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

async function uploadWithRetry(fd, maxRetries) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const r = await fetch('/api/photos/update', { method: 'POST', body: fd });
      if (r.ok) return true;
      if (r.status >= 400 && r.status < 500 && r.status !== 429) throw new Error('Chyba ' + r.status);
      throw new Error('Server ' + r.status);
    } catch (e) {
      if (attempt === maxRetries) throw e;
      await new Promise(res => setTimeout(res, 1000 * attempt));
    }
  }
  return false;
}

async function saveEditor(mode) {
  if (!ED.img) return;
  const img = ED.img;
  let dim = getExportDim(img.naturalWidth, img.naturalHeight);
  dim = getSafeCanvasDim(dim.w, dim.h);
  const out = document.createElement('canvas');
  out.width = dim.w;
  out.height = dim.h;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  const f = ED.filters;
  let filterStr = `brightness(${100 + f.exposure}%) contrast(${100 + f.contrast}%) saturate(${100 + f.saturation}%)`;
  if (f.temp > 0) filterStr += ` sepia(${f.temp * 0.5}%)`;
  else filterStr += ` hue-rotate(${f.temp * 0.3}deg)`;
  if (f.denoise > 0) filterStr += ` blur(${f.denoise * 0.05}px)`;
  ctx.filter = filterStr;
  ctx.save();
  ctx.translate(dim.w / 2, dim.h / 2);
  ctx.rotate((ED.rotate + ED.straighten) * Math.PI / 180);
  const drawScale = Math.min(dim.w / img.naturalWidth, dim.h / img.naturalHeight);
  ctx.drawImage(img, -img.naturalWidth * drawScale / 2, -img.naturalHeight * drawScale / 2, img.naturalWidth * drawScale, img.naturalHeight * drawScale);
  ctx.restore();
  if (toneIsActive(f.shadows, f.highlights, f.blackPoint, f.whitePoint)) {
    applyToneLUT(ctx, dim.w, dim.h, f.shadows, f.highlights, f.blackPoint, f.whitePoint);
  }
  if (f.vibrance) {
    applyVibrance(ctx, dim.w, dim.h, f.vibrance);
  }
  if (f.sharpen > 0) {
    applySharpen(ctx, dim.w, dim.h, f.sharpen);
  }
  if (f.vignette > 0) {
    const grad = ctx.createRadialGradient(dim.w / 2, dim.h / 2, dim.w * 0.25, dim.w / 2, dim.h / 2, dim.w * 0.9);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, `rgba(0,0,0,${f.vignette / 100})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, dim.w, dim.h);
  }
  const blob = await new Promise(r => out.toBlob(r, 'image/png'));
  const fd = new FormData();
  fd.append('file', blob, ED.photo.name || 'edited.png');
  fd.append('galleryId', 'main');
  fd.append('oldKey', ED.photo.key);
  fd.append('mode', mode);
  try {
    await uploadWithRetry(fd, 3);
  } catch (e) {
    showToast('Nepodařilo se uložit fotku po 3 pokusech: ' + e.message, 'error');
    return;
  }
  closeEditor();
  await loadGallery();
  showToast('Fotka uložena', 'success');
}

/* === WYSIWYG TOOLBAR === */
function execCmd(c, v) {
  document.execCommand(c, false, v);
  const ed = document.activeElement;
  if (ed && (ed.id === 'artEditor' || ed.id === 'aboutEditor')) ed.focus();
}
function setFontName(n) { execCmd('fontName', n); }
function setFontSize(s) { execCmd('fontSize', s); }
function setForeColor(c) { execCmd('foreColor', c); }
function setBackColor(c) { execCmd('hiliteColor', c); }
function setHeading(t) { execCmd('formatBlock', t); }
function alignLeft() { execCmd('justifyLeft'); }
function alignCenter() { execCmd('justifyCenter'); }
function alignRight() { execCmd('justifyRight'); }
function alignJustify() { execCmd('justifyFull'); }
function insertBullet() { execCmd('insertUnorderedList'); }
function insertNumber() { execCmd('insertOrderedList'); }
function indentMore() { execCmd('indent'); }
function indentLess() { execCmd('outdent'); }
function insertHR() { execCmd('insertHorizontalRule'); }
function clearFormat() { execCmd('removeFormat'); execCmd('formatBlock', 'div'); }
function editorUndo() { execCmd('undo'); }
function editorRedo() { execCmd('redo'); }
function insertLink() { const u = prompt('Zadej URL:', 'https://'); if (u) execCmd('createLink', u); }
function unlink() { execCmd('unlink'); }
function toggleBold() { execCmd('bold'); }
function toggleItalic() { execCmd('italic'); }
function toggleUnderline() { execCmd('underline'); }
function toggleStrike() { execCmd('strikeThrough'); }

/* === OBRÁZKY V EDITORU === */
let currentActiveImg = null;

function setupArticleEditors() {
  if (typeof restoreRibbonOrder === 'function') restoreRibbonOrder('wysiwyg');
  if (typeof applyRibbonVisibility === 'function') applyRibbonVisibility('wysiwyg');
  ['artEditor', 'aboutEditor'].forEach(id => {
    const ed = $(id);
    if (!ed) return;
    promoteNestedImages(id);
    ed.addEventListener('click', e => {
      const img = e.target.closest('img.editor-img');
      if (!img) {
        ed.querySelectorAll('img.editor-img').forEach(i => { i.style.outline = ''; i.removeAttribute('data-active'); });
        currentActiveImg = null;
        hideImgToolbar();
        return;
      }
      if (img.dataset.justDragged) { delete img.dataset.justDragged; return; }
      e.preventDefault();
      e.stopPropagation();
      ed.querySelectorAll('img.editor-img').forEach(i => { i.style.outline = ''; i.removeAttribute('data-active'); });
      img.style.outline = '3px solid #3b82f6';
      img.setAttribute('data-active', '1');
      currentActiveImg = img;
      showImgToolbar(img);
    });
    ed.addEventListener('dragstart', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });
    initBlockDragSystem(id);
    initImageDirectDrag(id);
  });
  initArticleAutosave();
}

/* === AUTOSAVE KONCEPTU ČLÁNKU ===
   Rozepsaný nadpis + obsah se průběžně ukládá do localStorage tohoto
   prohlížeče (debounce 1,2 s po psaní), aby se neztratil při pádu karty
   nebo zavření prohlížeče. Koncept se váže na konkrétní editovaný článek
   (podle ID), nebo na "nový článek", pokud se zrovna nic needituje. Při
   dalším otevření záložky se nabídne obnovení, pokud koncept existuje. */
let articleDraftTimer = null;
let lastDraftKeyChecked = null;

function articleDraftKey() {
  const id = $('artEditor')?.dataset?.editId;
  return 'articleDraft:' + (id || 'new');
}

function saveArticleDraft() {
  const titleEl = $('artTitle'), editorEl = $('artEditor');
  if (!titleEl || !editorEl) return;
  const title = titleEl.value || '';
  const content = editorEl.innerHTML || '';
  if (!title.trim() && !content.replace(/<[^>]+>/g, '').trim()) {
    localStorage.removeItem(articleDraftKey());
    updateArticleDraftStatus('');
    return;
  }
  const draft = {
    title, content,
    excerpt: $('artExcerpt')?.value || '',
    coverUrl: $('artCoverUrl')?.value || '',
    date: $('artDate')?.value || '',
    place: $('artPlace')?.value || '',
    sectionId: $('artSection')?.value || '',
    subsectionId: $('artSubsection')?.value || '',
    savedAt: Date.now()
  };
  localStorage.setItem(articleDraftKey(), JSON.stringify(draft));
  updateArticleDraftStatus('💾 Koncept uložen ' + new Date(draft.savedAt).toLocaleTimeString('cs', { hour: '2-digit', minute: '2-digit' }));
  scheduleServerDraftSave();
}

function scheduleArticleDraftSave() {
  clearTimeout(articleDraftTimer);
  articleDraftTimer = setTimeout(saveArticleDraft, 1200);
}

/* === SERVEROVÁ ZÁLOHA KONCEPTU ===
   localStorage koncept (výše) žije jen v TOMHLE prohlížeči/zařízení —
   po smazání keší nebo na jiném počítači je nenávratně pryč. Tohle ho
   navíc (s větším zpožděním, ať to zbytečně nemlátí do API při každém
   písmenku) zazálohuje na server přes /api/data/article-draft — stejný
   princip jako existující /api/data/folders pro složky fotek. Lokální
   koncept zůstává primární a okamžitý; server je jen pojistka navíc. */
let serverDraftTimer = null;
function scheduleServerDraftSave() {
  clearTimeout(serverDraftTimer);
  serverDraftTimer = setTimeout(syncDraftToServer, 8000);
}

async function syncDraftToServer() {
  const titleEl = $('artTitle'), editorEl = $('artEditor');
  if (!titleEl || !editorEl) return;
  const title = titleEl.value || '';
  const content = editorEl.innerHTML || '';
  if (!title.trim() && !content.replace(/<[^>]+>/g, '').trim()) return;
  const draft = {
    title, content,
    excerpt: $('artExcerpt')?.value || '',
    coverUrl: $('artCoverUrl')?.value || '',
    date: $('artDate')?.value || '',
    place: $('artPlace')?.value || '',
    sectionId: $('artSection')?.value || '',
    subsectionId: $('artSubsection')?.value || '',
    savedAt: Date.now()
  };
  try {
    const r = await fetch('/api/data/article-draft?key=' + encodeURIComponent(articleDraftKey()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    updateArticleDraftStatus('☁️ Zálohováno na server ' + new Date(draft.savedAt).toLocaleTimeString('cs', { hour: '2-digit', minute: '2-digit' }));
  } catch (e) {
    console.error('/api/data/article-draft (POST) selhalo:', e);
    // Tichý fail — lokální koncept (localStorage) je pořád v bezpečí,
    // server je jen záloha navíc pro případ jiného zařízení.
  }
}

async function fetchServerDraft(key) {
  try {
    const r = await fetch('/api/data/article-draft?key=' + encodeURIComponent(key));
    if (!r.ok) return null;
    const d = await r.json();
    return d && (d.title || d.content) ? d : null;
  } catch (e) {
    console.error('/api/data/article-draft (GET) selhalo:', e);
    return null;
  }
}

function clearArticleDraft(key) {
  const k = key || articleDraftKey();
  localStorage.removeItem(k);
  updateArticleDraftStatus('');
  fetch('/api/data/article-draft?key=' + encodeURIComponent(k), { method: 'DELETE' }).catch(() => {});
}

function injectArticleDraftStatus() {
  if ($('articleDraftStatus')) return;
  const titleEl = $('artTitle');
  if (!titleEl) return;
  const row = titleEl.closest('.form-row') || titleEl.parentElement;
  if (!row || !row.parentElement) return;
  const status = document.createElement('div');
  status.id = 'articleDraftStatus';
  status.style.cssText = 'font-size:11.5px;color:var(--text-faint);font-family:var(--font-mono);margin:-0.5rem 0 0.6rem 2px;min-height:1.2em';
  row.after(status);
}

function updateArticleDraftStatus(text) {
  const el = $('articleDraftStatus');
  if (el) el.textContent = text;
}

/* === POČET SLOV + ODHAD DOBY ČTENÍ ===
   Počítá se z čistého textu (bez HTML značek), rychlost čtení ~200 slov/min
   je běžný odhad pro češtinu i angličtinu u online článků. */
function updateArticleWordCount() {
  const editorEl = $('artEditor');
  const el = $('articleWordCount');
  if (!editorEl || !el) return;
  const text = editorEl.innerText || editorEl.textContent || '';
  const words = (text.trim().match(/\S+/g) || []).length;
  if (!words) { el.textContent = ''; return; }
  const minutes = Math.max(1, Math.round(words / 200));
  el.textContent = `📝 ${words.toLocaleString('cs')} ${words === 1 ? 'slovo' : (words >= 2 && words <= 4 ? 'slova' : 'slov')} · ~${minutes} min čtení`;
}

async function offerDraftRestore(key) {
  let draft;
  try { draft = JSON.parse(localStorage.getItem(key) || 'null'); } catch { draft = null; }
  // Lokální koncept nenalezen (jiné zařízení / vymazaná keš) — zkusit
  // ještě serverovou zálohu, než se vzdáme.
  if (!draft) draft = await fetchServerDraft(key);
  if (!draft) return;
  const when = new Date(draft.savedAt).toLocaleString('cs');
  const preview = (draft.title || '(bez nadpisu)').slice(0, 60);
  const ok = await showConfirm(`Našel jsem neuložený rozepsaný koncept z ${when} ("${preview}"). Chceš ho obnovit?`, { confirmText: 'Obnovit koncept', cancelText: 'Zahodit' });
  if (ok) {
    if ($('artTitle')) $('artTitle').value = draft.title || '';
    if ($('artEditor')) $('artEditor').innerHTML = draft.content || '';
    if ($('artExcerpt')) $('artExcerpt').value = draft.excerpt || '';
    if ($('artCoverUrl')) $('artCoverUrl').value = draft.coverUrl || '';
    if ($('artCoverPreview')) $('artCoverPreview').style.backgroundImage = draft.coverUrl ? `url('${draft.coverUrl}')` : '';
    if ($('artDate')) $('artDate').value = draft.date || '';
    if ($('artPlace')) $('artPlace').value = draft.place || '';
    if ($('artSection') && draft.sectionId) { $('artSection').value = draft.sectionId; await loadArtSubsections(); }
    if ($('artSubsection') && draft.subsectionId) $('artSubsection').value = draft.subsectionId;
    setTimeout(() => { setupArticleEditors(); updateArticleWordCount(); }, 50);
    updateArticleDraftStatus('Koncept obnoven — nezapomeň uložit');
  } else {
    localStorage.removeItem(key);
    fetch('/api/data/article-draft?key=' + encodeURIComponent(key), { method: 'DELETE' }).catch(() => {});
  }
}

function initArticleAutosave() {
  const titleEl = $('artTitle');
  const editorEl = $('artEditor');
  if (!titleEl || !editorEl) return;
  injectArticleDraftStatus();
  if (!titleEl.dataset.draftReady) {
    titleEl.dataset.draftReady = '1';
    titleEl.addEventListener('input', scheduleArticleDraftSave);
  }
  if (!editorEl.dataset.draftReady) {
    editorEl.dataset.draftReady = '1';
    editorEl.addEventListener('input', () => { scheduleArticleDraftSave(); updateArticleWordCount(); });
  }
  updateArticleWordCount();
  // Nabídku obnovy zkontrolovat pokaždé, když se změní kontext (jiný
  // editovaný článek / nový článek) — ne jen při úplně prvním spuštění.
  const key = articleDraftKey();
  if (key !== lastDraftKeyChecked) {
    lastDraftKeyChecked = key;
    offerDraftRestore(key);
  }
}

/* Obrázky vložené postaru (schované uvnitř odstavce) "vytáhne" ven jako
   vlastní blok, aby šly přesouvat myší nezávisle na okolním textu — stejně
   jako nově vkládané obrázky. Bezpečné volat opakovaně (idempotentní). */
function promoteNestedImages(editorId) {
  const ed = $(editorId);
  if (!ed) return;
  ed.querySelectorAll('img.editor-img').forEach(img => {
    if (img.style.cursor === 'pointer' || !img.style.cursor) img.style.cursor = 'grab';
    if (img.parentElement === ed) return;
    // Obrázek s popiskem má vlastní obal (.editor-img-wrap), který je sám
    // top-level blok — ten nerozebírat, jinak by se popisek odtrhl.
    if (img.parentElement && img.parentElement.classList.contains('editor-img-wrap') && img.parentElement.parentElement === ed) return;
    let block = img.parentElement;
    while (block && block.parentElement !== ed) block = block.parentElement;
    if (block && block !== ed && ed.contains(block)) {
      block.after(img);
    }
  });
}

/* === BLOK DRAG & DROP ===
   Malý úchyt (⠿) se objeví při najetí myší/prstem na libovolný blok
   (odstavec, nadpis, obrázek...) přímo v obsahu článku. Chytneš ho a
   přetáhneš na jiné místo v textu — jako sazba novinových sloupců.
   Obrázky navíc dál obtékají text přes stávající zarovnání ◀Vlevo/Vpravo▶. */
function initBlockDragSystem(editorId) {
  const ed = $(editorId);
  if (!ed || ed.dataset.dragReady) return;
  ed.dataset.dragReady = '1';

  const handle = document.createElement('div');
  handle.className = 'block-drag-handle';
  handle.textContent = '⠿';
  handle.title = 'Přetáhni pro přesun bloku';
  document.body.appendChild(handle);

  const indicator = document.createElement('div');
  indicator.className = 'block-drop-indicator';
  document.body.appendChild(indicator);

  let hoveredBlock = null;
  let draggingBlock = null;
  let dropTarget = null;
  let dropBefore = true;

  function topLevelBlockFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    let node = el;
    while (node && node !== ed && node.parentElement !== ed) node = node.parentElement;
    return (node && node !== ed && ed.contains(node)) ? node : null;
  }

  function positionHandle(block) {
    const r = block.getBoundingClientRect();
    let left = r.left - 30;
    if (left < 4) left = r.left + 4;
    handle.style.left = left + 'px';
    handle.style.top = (r.top + 2) + 'px';
    handle.style.display = 'flex';
  }

  ed.addEventListener('mousemove', e => {
    if (draggingBlock || ed._imgDragActive) return;
    const block = topLevelBlockFromPoint(e.clientX, e.clientY);
    if (block) { hoveredBlock = block; positionHandle(block); }
    else { hoveredBlock = null; handle.style.display = 'none'; }
  });
  ed.addEventListener('mouseleave', () => {
    if (!draggingBlock) { hoveredBlock = null; handle.style.display = 'none'; }
  });

  handle.addEventListener('pointerdown', e => {
    if (!hoveredBlock) return;
    e.preventDefault();
    draggingBlock = hoveredBlock;
    draggingBlock.classList.add('block-dragging');
    handle.classList.add('grabbing');
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', e => {
    if (!draggingBlock) return;
    handle.style.left = (e.clientX - 12) + 'px';
    handle.style.top = (e.clientY - 12) + 'px';
    const target = topLevelBlockFromPoint(e.clientX, e.clientY);
    if (target && target !== draggingBlock) {
      const r = target.getBoundingClientRect();
      dropBefore = e.clientY < r.top + r.height / 2;
      dropTarget = target;
      indicator.style.display = 'block';
      indicator.style.left = r.left + 'px';
      indicator.style.width = r.width + 'px';
      indicator.style.top = (dropBefore ? r.top - 2 : r.bottom + 2) + 'px';
    }
  });

  handle.addEventListener('pointerup', e => {
    if (!draggingBlock) return;
    if (dropTarget && dropTarget !== draggingBlock && ed.contains(dropTarget)) {
      if (dropBefore) dropTarget.parentNode.insertBefore(draggingBlock, dropTarget);
      else dropTarget.parentNode.insertBefore(draggingBlock, dropTarget.nextSibling);
    }
    draggingBlock.classList.remove('block-dragging');
    handle.classList.remove('grabbing');
    draggingBlock = null;
    dropTarget = null;
    indicator.style.display = 'none';
    handle.style.display = 'none';
  });
}

/* === PŘÍMÉ TAŽENÍ OBRÁZKŮ MYŠÍ (živé obtékání textu) ===
   Umožňuje chytit obrázek přímo myší (bez nutnosti hledat úchyt ⠿) a
   volně ho přetahovat v textu. Za jízdy — ne až po puštění — se:
   - obrázek podle vodorovné polohy kurzoru sám nastaví na obtékání
     vlevo / vpravo / na střed,
   - a rovnou přesune na novou pozici mezi odstavci,
   takže je hned vidět, jak text kolem něj poteče — skládání layoutu
   jako z kostiček Lega v reálném čase. Krátké kliknutí (bez tažení)
   dál funguje jako dřív a otevře nástrojovou lištu obrázku. */
function initImageDirectDrag(editorId) {
  const ed = $(editorId);
  if (!ed || ed.dataset.imgDragReady) return;
  ed.dataset.imgDragReady = '1';

  let draggingImg = null;
  let startX = 0, startY = 0;
  let dragging = false;

  function topLevelBlockFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    let node = el;
    while (node && node !== ed && node.parentElement !== ed) node = node.parentElement;
    return (node && node !== ed && ed.contains(node)) ? node : null;
  }

  function applyLiveFloat(clientX) {
    const rect = ed.getBoundingClientRect();
    const rel = (clientX - rect.left) / rect.width;
    if (rel < 0.33) {
      draggingImg.style.float = 'left';
      draggingImg.style.margin = '0.5rem 1rem 0.5rem 0';
    } else if (rel > 0.66) {
      draggingImg.style.float = 'right';
      draggingImg.style.margin = '0.5rem 0 0.5rem 1rem';
    } else {
      draggingImg.style.float = 'none';
      draggingImg.style.margin = '0.5rem auto';
    }
    draggingImg.style.display = 'block';
  }

  ed.addEventListener('pointerdown', e => {
    const img = e.target.closest('img.editor-img');
    if (!img) return;
    // Táhneme celý top-level blok, kterým obrázek patří — buď je to
    // samotný <img>, nebo (má-li obrázek popisek) jeho obal .editor-img-wrap.
    let block = img;
    while (block && block.parentElement !== ed) block = block.parentElement;
    if (!block || block.parentElement !== ed) return;
    draggingImg = block;
    startX = e.clientX; startY = e.clientY;
    dragging = false;
  });

  ed.addEventListener('pointermove', e => {
    if (!draggingImg) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!dragging) {
      // malý práh, ať obyčejné kliknutí neomylem nezačne tažení
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      dragging = true;
      ed._imgDragActive = true;
      draggingImg.style.cursor = 'grabbing';
      draggingImg.style.opacity = '0.85';
      try { draggingImg.setPointerCapture(e.pointerId); } catch {}
      ed.style.userSelect = 'none';
    }
    e.preventDefault();
    applyLiveFloat(e.clientX);
    const target = topLevelBlockFromPoint(e.clientX, e.clientY);
    if (target && target !== draggingImg) {
      const r = target.getBoundingClientRect();
      const before = e.clientY < r.top + r.height / 2;
      if (before) target.parentNode.insertBefore(draggingImg, target);
      else target.parentNode.insertBefore(draggingImg, target.nextSibling);
    }
  });

  const endDrag = () => {
    if (draggingImg && dragging) {
      draggingImg.style.cursor = 'grab';
      draggingImg.style.opacity = '';
      draggingImg.dataset.justDragged = '1';
      ed.style.userSelect = '';
    }
    ed._imgDragActive = false;
    draggingImg = null;
    dragging = false;
  };
  ed.addEventListener('pointerup', endDrag);
  ed.addEventListener('pointercancel', endDrag);
}

/* Menu pro úpravu obrázku (velikost/zarovnání/obtékání/pořadí/smazání) je teď
   zakotvené přímo v horní liště WYSIWYG editoru (.editor-toolbar), místo
   plovoucího okna na obrazovce. */
function showImgToolbar(img) {
  const editorEl = img.closest('#artEditor') || img.closest('#aboutEditor');
  const hostToolbar = editorEl ? editorEl.previousElementSibling : null;

  let bar = $('img-toolbar');
  if (bar && hostToolbar && bar.parentElement !== hostToolbar) {
    bar.remove();
    bar = null;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'img-toolbar';
    bar.style.cssText = 'display:none;gap:6px;flex-wrap:wrap;width:100%;margin-top:6px;padding-top:6px;border-top:1px dashed #475569;';
    if (hostToolbar) hostToolbar.appendChild(bar);
    else document.body.appendChild(bar);
  }
  bar.innerHTML = `
    <button onclick="imgToolbarAction('smaller')" class="btn btn-sm">- Menší</button>
    <button onclick="imgToolbarAction('bigger')" class="btn btn-sm">+ Větší</button>
    <button onclick="imgToolbarAction('left')" class="btn btn-sm" title="Obtékat text vpravo od obrázku">◀ Vlevo (obtékat)</button>
    <button onclick="imgToolbarAction('center')" class="btn btn-sm" title="Bez obtékání textu">Střed</button>
    <button onclick="imgToolbarAction('right')" class="btn btn-sm" title="Obtékat text vlevo od obrázku">Vpravo ▶ (obtékat)</button>
    <button onclick="imgToolbarAction('caption')" class="btn btn-sm" title="Přidat/upravit popisek pod obrázkem">💬 Popisek</button>
    <button onclick="imgToolbarAction('up')" class="btn btn-sm">↑ Nahoru</button>
    <button onclick="imgToolbarAction('down')" class="btn btn-sm">↓ Dolů</button>
    <button onclick="imgToolbarAction('delete')" class="btn btn-red btn-sm">🗑 Smazat</button>
  `;
  bar.style.display = 'flex';
}

function hideImgToolbar() {
  const bar = $('img-toolbar');
  if (bar) bar.style.display = 'none';
  currentActiveImg = null;
}

function imgToolbarAction(action) {
  const ed = $('artEditor') || $('aboutEditor');
  if (!ed) return;
  const img = ed.querySelector('img[data-active]') || currentActiveImg;
  if (!img) { hideImgToolbar(); return; }
  let block = img;
  while (block && block.parentElement !== ed) block = block.parentElement;
  if (!block) block = img;

  if (action === 'delete') { block.remove(); hideImgToolbar(); return; }
  if (action === 'up') { const p = block.previousElementSibling; if (p) block.parentNode.insertBefore(block, p); return; }
  if (action === 'down') { const n = block.nextElementSibling; if (n) block.parentNode.insertBefore(n, block); return; }
  if (action === 'smaller') { let w = parseInt(img.style.width) || 300; img.style.width = Math.max(80, w - 40) + 'px'; img.style.maxWidth = img.style.width; if (block !== img) block.style.width = img.style.width; return; }
  if (action === 'bigger') { let w = parseInt(img.style.width) || 300; img.style.width = Math.min(800, w + 40) + 'px'; img.style.maxWidth = img.style.width; if (block !== img) block.style.width = img.style.width; return; }
  if (action === 'left') { block.style.float = 'left'; block.style.margin = '0.5rem 1rem 0.5rem 0'; block.style.display = 'block'; block.style.clear = 'none'; return; }
  if (action === 'right') { block.style.float = 'right'; block.style.margin = '0.5rem 0 0.5rem 1rem'; block.style.display = 'block'; block.style.clear = 'none'; return; }
  if (action === 'center') { block.style.float = 'none'; block.style.margin = '0.5rem auto'; block.style.display = 'block'; block.style.clear = 'both'; return; }
  if (action === 'caption') {
    const capEl = block.querySelector('.editor-img-caption');
    const current = capEl ? capEl.textContent : '';
    const val = prompt('Popisek pod obrázkem (prázdné = smazat):', current);
    if (val === null) return;
    if (val.trim()) {
      if (capEl) {
        capEl.textContent = val.trim();
      } else if (block === img) {
        // obrázek zatím neměl obal — vytvoříme .editor-img-wrap a přeneseme layout
        const wrap = document.createElement('div');
        wrap.className = 'editor-img-wrap';
        wrap.style.cssText = 'display:block;cursor:grab;max-width:300px;width:100%;' +
          'float:' + (img.style.float || 'none') + ';margin:' + (img.style.margin || '0.5rem auto') + ';';
        img.style.float = 'none';
        img.style.margin = '0';
        img.style.width = '100%';
        img.parentNode.insertBefore(wrap, img);
        wrap.appendChild(img);
        const cap = document.createElement('div');
        cap.className = 'editor-img-caption';
        cap.style.cssText = 'font-size:12.5px;color:var(--text-faint);text-align:center;margin-top:0.3rem;font-style:italic';
        cap.textContent = val.trim();
        wrap.appendChild(cap);
      } else {
        const cap = document.createElement('div');
        cap.className = 'editor-img-caption';
        cap.style.cssText = 'font-size:12.5px;color:var(--text-faint);text-align:center;margin-top:0.3rem;font-style:italic';
        cap.textContent = val.trim();
        block.appendChild(cap);
      }
    } else if (capEl) {
      capEl.remove();
    }
    return;
  }
}

function deleteSelectedImg() {
  var ed = $('aboutEditor') || $('artEditor');
  if (!ed) return;
  var img = ed.querySelector('img[data-active]') || currentActiveImg;
  if (img) { img.remove(); hideImgToolbar(); }
}

function moveImageUp() {
  var ed = $('aboutEditor') || $('artEditor');
  if (!ed) return;
  var img = ed.querySelector('img[data-active]') || currentActiveImg;
  if (!img) return;
  var p = img.previousElementSibling;
  if (p) img.parentNode.insertBefore(img, p);
}

function moveImageDown() {
  var ed = $('aboutEditor') || $('artEditor');
  if (!ed) return;
  var img = ed.querySelector('img[data-active]') || currentActiveImg;
  if (!img) return;
  var n = img.nextElementSibling;
  if (n) img.parentNode.insertBefore(n, img);
}

document.addEventListener('click', e => {
  if (!e.target.closest('#img-toolbar') && !e.target.closest('img[data-active]')) {
    hideImgToolbar();
    document.querySelectorAll('img[data-active]').forEach(i => { i.style.outline = ''; i.removeAttribute('data-active'); });
  }
});

/* === SDÍLENÝ PICKER FOTEK Z GALERIE (složky + řazení) ===
   Jedna komponenta pro výběr fotek z galerie, použitá na několika
   místech napříč adminem: vkládání do článků (insertImgTo), cover
   sekce/podsekce (pickSectionCover/pickSubsectionCover), a přes
   timeline-admin.js i pro fotky u milníků Timeline. Dřív měl každé
   z těch míst svoje vlastní kopii kódu (plochý seznam bez filtru
   složky, bez řazení) — teď jde o jedno místo, jedna oprava/vylepšení
   platí všude.

   options:
     title        — nadpis modalu (string)
     multiSelect  — true = zaškrtávání víc fotek + tlačítko "Hotovo",
                    false (výchozí) = klik na fotku rovnou vybere a zavře
     selectedUrls — (jen multiSelect) pole URL, co už jsou vybrané předem
     maxSelect    — (jen multiSelect) volitelný limit počtu
     onSelect(url)         — (jen single-select) zavolá se po kliknutí
     onToggle(url, isNowSelected) — (jen multiSelect) při každém zaškrtnutí/odškrtnutí
     onDone(selectedUrls)  — (jen multiSelect) při zavření (tlačítko Hotovo i klik mimo modal) */
function openGalleryPickerModal(options) {
  options = options || {};
  if (!window.G || !G.photos || !G.photos.length) {
    if (typeof showToast === 'function') showToast('Galerie je prázdná. Nejprve nahraj fotky.', 'info');
    else alert('Galerie je prázdná. Nejprve nahraj fotky.');
    return;
  }
  const multi = !!options.multiSelect;
  const selected = new Set(options.selectedUrls || []);
  const folders = typeof getAllFolders === 'function' ? getAllFolders() : [];

  const m = document.createElement('div');
  m.className = 'modal';
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-modal', 'true');
  m.setAttribute('aria-label', options.title || 'Vybrat fotku');
  m.innerHTML = `
    <div style="background:var(--surface,#131a2c);border-radius:var(--r-lg,12px);max-width:90vw;width:700px;max-height:82vh;display:flex;flex-direction:column;border:1px solid var(--border-soft,#263252);padding:0">
      <div style="padding:1.5rem 1.5rem 0.75rem;flex-shrink:0">
        <h3 style="margin-bottom:0.3rem;color:var(--text,#eef1f8)">${escapeHtml(options.title || 'Vybrat fotku')}</h3>
        ${multi ? `<p id="gpCountLabel" style="color:var(--text-muted,#92a0bc);font-size:12px;margin:0 0 0.75rem"></p>` : `<div style="margin-bottom:0.75rem"></div>`}
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <select id="gpFolderFilter" class="form-select" style="max-width:200px">
            <option value="">📁 Všechny složky</option>
            <option value="__none__">— Bez složky —</option>
            ${folders.map(f => `<option value="${escapeHtml(f)}">📁 ${escapeHtml(f)}</option>`).join('')}
          </select>
          <select id="gpSortMode" class="form-select" style="max-width:170px">
            <option value="newest">Nejnovější</option>
            <option value="oldest">Nejstarší</option>
            <option value="name">Podle názvu</option>
          </select>
          ${multi ? `<button id="gpSelectFolderBtn" class="btn btn-sm btn-blue" style="display:none">📁 Vybrat celou složku</button>` : ''}
        </div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:0 1.5rem">
        <div id="gpGrid"></div>
      </div>
      <div style="padding:1rem 1.5rem;flex-shrink:0;border-top:1px solid var(--border-soft,#263252);display:flex;gap:0.5rem;justify-content:center">
        ${multi ? `<button id="gpDoneBtn" class="btn btn-blue">✅ Hotovo</button>` : ''}
        <button id="gpCloseBtn" class="btn btn-red">Zavřít</button>
      </div>
    </div>`;
  document.body.appendChild(m);

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    m.remove();
    if (multi && options.onDone) options.onDone([...selected]);
  }
  m.onclick = e => { if (e.target === m) finish(); };
  m.querySelector('#gpCloseBtn').onclick = finish;
  const doneBtn = m.querySelector('#gpDoneBtn');
  if (doneBtn) doneBtn.onclick = finish;

  function currentSortedPhotos() {
    const mode = m.querySelector('#gpSortMode')?.value || 'newest';
    let arr = [...G.photos];
    if (mode === 'newest') arr.sort((a, b) => new Date(b.uploaded || b.date || 0) - new Date(a.uploaded || a.date || 0));
    else if (mode === 'oldest') arr.sort((a, b) => new Date(a.uploaded || a.date || 0) - new Date(b.uploaded || b.date || 0));
    else if (mode === 'name') arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return arr;
  }

  function updateCountLabel() {
    const label = m.querySelector('#gpCountLabel');
    if (!label) return;
    label.textContent = options.maxSelect ? `Vybráno ${selected.size}/${options.maxSelect}` : `Vybráno ${selected.size}`;
  }

  function renderGrid() {
    const grid = m.querySelector('#gpGrid');
    if (!grid) return;
    const folderSel = m.querySelector('#gpFolderFilter')?.value || '';
    let photos = currentSortedPhotos();
    if (typeof getPhotoFolder === 'function') {
      if (folderSel === '__none__') photos = photos.filter(p => !getPhotoFolder(p));
      else if (folderSel) photos = photos.filter(p => getPhotoFolder(p) === folderSel);
    }
    currentFilteredPhotos = photos; // pro tlačítko "Vybrat celou složku"

    /* Tlačítko "Vybrat celou složku" dává smysl jen když je vybraná
       KONKRÉTNÍ složka (nebo "Bez složky") — u "Všechny složky" by bylo
       matoucí, kterou složku by vlastně mělo vzít. */
    const folderBtn = m.querySelector('#gpSelectFolderBtn');
    if (folderBtn) {
      folderBtn.style.display = (multi && folderSel) ? 'inline-flex' : 'none';
      const folderLabel = folderSel === '__none__' ? 'bez složky' : folderSel;
      folderBtn.textContent = `📁 Vybrat celou složku (${photos.length})`;
      folderBtn.title = `Vybere naráz všech ${photos.length} fotek ve složce „${folderLabel}“`;
    }

    if (!photos.length) {
      grid.style.display = 'block';
      grid.innerHTML = '<div style="text-align:center;color:var(--text-muted,#92a0bc);padding:1.5rem;font-size:13px">V téhle složce nejsou žádné fotky.</div>';
      return;
    }

    const tile = p => {
      const isSel = selected.has(p.url);
      return `
      <div class="gp-tile" data-url="${escapeHtml(p.url)}" style="position:relative;cursor:pointer">
        <img src="${p.url}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;opacity:${isSel ? '0.55' : '1'}">
        ${isSel ? `<span style="position:absolute;top:6px;right:6px;background:var(--gold,#ffc857);color:#000;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">✓</span>` : ''}
      </div>`;
    };

    if (folderSel) {
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(140px,1fr))';
      grid.style.gap = '0.75rem';
      grid.innerHTML = photos.map(tile).join('');
    } else {
      const groups = new Map();
      photos.forEach(p => {
        const f = (typeof getPhotoFolder === 'function' ? getPhotoFolder(p) : null) || '';
        if (!groups.has(f)) groups.set(f, []);
        groups.get(f).push(p);
      });
      const sortedFolders = [...groups.keys()].sort((a, b) => { if (!a) return 1; if (!b) return -1; return a.localeCompare(b); });
      grid.style.display = 'block';
      grid.innerHTML = sortedFolders.map(f => `
        <div style="margin-bottom:1.1rem">
          <div style="font-size:12px;font-weight:700;color:var(--gold,#ffc857);margin-bottom:0.5rem;font-family:var(--font-mono,monospace)">
            ${f ? '📁 ' + escapeHtml(f) : '— Bez složky —'} <span style="color:var(--text-faint,#5b6584);font-weight:400">(${groups.get(f).length})</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.75rem">
            ${groups.get(f).map(tile).join('')}
          </div>
        </div>`).join('');
    }

    grid.querySelectorAll('.gp-tile').forEach(el => {
      el.addEventListener('click', () => {
        const url = el.dataset.url;
        if (multi) {
          if (selected.has(url)) {
            selected.delete(url);
            if (options.onToggle) options.onToggle(url, false);
          } else {
            if (options.maxSelect && selected.size >= options.maxSelect) {
              if (typeof showToast === 'function') showToast('Max. ' + options.maxSelect + ' fotek.', 'info');
              return;
            }
            selected.add(url);
            if (options.onToggle) options.onToggle(url, true);
          }
          updateCountLabel();
          renderGrid();
        } else {
          finished = true;
          m.remove();
          if (options.onSelect) options.onSelect(url);
        }
      });
    });
  }

  let currentFilteredPhotos = [];
  const folderBtn = m.querySelector('#gpSelectFolderBtn');
  if (folderBtn) {
    folderBtn.addEventListener('click', () => {
      let added = 0, skippedFull = false;
      for (const p of currentFilteredPhotos) {
        if (selected.has(p.url)) continue;
        if (options.maxSelect && selected.size >= options.maxSelect) { skippedFull = true; break; }
        selected.add(p.url);
        added++;
        if (options.onToggle) options.onToggle(p.url, true);
      }
      updateCountLabel();
      renderGrid();
      if (skippedFull) {
        if (typeof showToast === 'function') showToast(`Přidáno ${added} fotek, dál už je limit ${options.maxSelect} fotek.`, 'info');
      } else if (added && typeof showToast === 'function') {
        showToast(`Přidáno ${added} fotek ze složky`, 'success');
      }
    });
  }

  m.querySelector('#gpFolderFilter').addEventListener('change', renderGrid);
  m.querySelector('#gpSortMode').addEventListener('change', renderGrid);

  updateCountLabel();
  renderGrid();
}

function insertImgTo(editorId, align) {
  openGalleryPickerModal({
    title: 'Vložit fotky',
    multiSelect: true,
    onDone: urls => {
      if (!urls.length) return;
      urls.forEach(url => insertImgUrl(editorId, url, align, false));
      setTimeout(() => setupArticleEditors(), 50);
      showToast(`Vloženo ${urls.length} fotek`, 'success');
    }
  });
}

function insertImgUrl(editorId, url, align, closeModal = true) {
  const ed = $(editorId);
  if (!ed) return;
  ed.focus();

  const photoObj = (window.G?.photos || []).find(ph => ph.url === url);
  const caption = photoObj && typeof getPhotoCaption === 'function' ? getPhotoCaption(photoObj) : '';
  // Dočasný identifikátor jen na to, abychom po vložení přesně našli,
  // který <img>/wrapper to byl (insertHTML nevrací referenci na uzel).
  const tmpId = 'tmp-ins-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

  let html;
  if (caption) {
    /* Obrázek s popiskem se vkládá jako blok (div.editor-img-wrap) — layout
       (obtékání/margin) nese tenhle obal, ne samotný <img>, aby popisek
       zůstal vždycky u obrázku i při tažení. */
    let wrapStyle = 'display:block;margin:0.5rem auto;cursor:grab;';
    if (align === 'left') wrapStyle = 'display:block;float:left;margin:0.5rem 1rem 0.5rem 0;cursor:grab;';
    else if (align === 'right') wrapStyle = 'display:block;float:right;margin:0.5rem 0 0.5rem 1rem;cursor:grab;';
    html = `<div class="editor-img-wrap" data-tmp-ins="${tmpId}" style="${wrapStyle}max-width:300px;width:100%">
      <img src="${url}" style="width:100%;height:auto;border-radius:6px;display:block;" class="editor-img" draggable="false">
      <div class="editor-img-caption" style="font-size:12.5px;color:var(--text-faint);text-align:center;margin-top:0.3rem;font-style:italic">${escapeHtml(caption)}</div>
    </div>`;
  } else {
    let style = 'max-width:300px;width:100%;height:auto;border-radius:6px;margin:0.5rem auto;display:block;cursor:grab;';
    if (align === 'left') style = 'max-width:300px;width:100%;height:auto;border-radius:6px;margin:0.5rem 1rem 0.5rem 0;float:left;display:block;cursor:grab;';
    else if (align === 'right') style = 'max-width:300px;width:100%;height:auto;border-radius:6px;margin:0.5rem 0 0.5rem 1rem;float:right;display:block;cursor:grab;';
    html = `<img src="${url}" data-tmp-ins="${tmpId}" style="${style}" class="editor-img" draggable="false">`;
  }

  /* Vkládá se přes execCommand('insertHTML') — ne ručním ed.appendChild/
     range.insertNode jako dřív. Ruční DOM zásah obchází vnitřní historii
     prohlížeče pro contenteditable, takže Ctrl+Z po vložení obrázku buď
     obrázek nevzalo zpět vůbec, nebo rozhodilo zbytek historie Zpět/Vpřed.
     execCommand je "oficiální" cesta, kterou jede i zbytek toolbaru
     (Tučně, Zarovnání...), takže se do stejné historie zapíše správně. */
  const ok = document.execCommand('insertHTML', false, html);
  if (!ok) ed.insertAdjacentHTML('beforeend', html); // záložní cesta pro výjimečné prohlížeče

  const inserted = ed.querySelector(`[data-tmp-ins="${tmpId}"]`);
  if (inserted) {
    inserted.removeAttribute('data-tmp-ins');
    const newRange = document.createRange();
    newRange.setStartAfter(inserted);
    newRange.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(newRange);
  }

  if (closeModal) {
    const modal = document.querySelector('.modal');
    if (modal) modal.remove();
  }
  // promoteNestedImages (uvnitř setupArticleEditors) obrázek případně
  // vytáhne ven jako vlastní top-level blok, stejně jako u starých fotek.
  setTimeout(() => setupArticleEditors(), 50);
}

/* === TITULNÍ FOTKA ČLÁNKU ===
   Stejný princip jako cover sekce/podsekce (výběr z galerie), jen se
   místo okamžitého uložení na server zapíše URL do skrytého pole a
   pošle se až spolu s celým článkem (Vytvořit/Uložit změny). */
function pickArticleCover() {
  openGalleryPickerModal({
    title: 'Titulní fotka článku',
    onSelect: url => setArticleCover(url)
  });
}

function setArticleCover(url) {
  if ($('artCoverUrl')) $('artCoverUrl').value = url;
  const prev = $('artCoverPreview');
  if (prev) prev.style.backgroundImage = `url('${url}')`;
}

function clearArticleCover() {
  if ($('artCoverUrl')) $('artCoverUrl').value = '';
  const prev = $('artCoverPreview');
  if (prev) prev.style.backgroundImage = '';
}

/* === PODSEKCE FORMULÁŘ === */
async function loadArtSubsections() {
  const sec = $('artSection')?.value;
  const sel = $('artSubsection');
  if (!sel) return;
  if (!sec) { sel.innerHTML = '<option value="">— Podsekce —</option>'; return; }
  try {
    const r = await fetch('/api/subsections/by-section?sectionId=' + sec);
    const arr = await r.json();
    sel.innerHTML = '<option value="">— Podsekce —</option>' + arr.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  } catch {
    sel.innerHTML = '<option value="">— Podsekce —</option>';
  }
}
/* =========================================================
   DASHBOARD EDITOR — ČÁST 4/5
   ========================================================= */

/* === ČLÁNKY: seznam === */
function generateSlug(title) {
  if (!title) return 'clanek-' + Date.now();
  return title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60) || 'clanek-' + Date.now();
}

/* === SDÍLENÍ ODKAZU NA ČLÁNEK ===
   Skutečná struktura veřejné URL webu: {doména}/article?id={id} (ověřeno
   na produkci). Šablona jde přesto jednorázově upravit tlačítkem
   "⚙️ Formát URL" v okně sdílení, kdyby se struktura webu v budoucnu
   změnila — uloží se do tohoto prohlížeče a použije se příště automaticky. */
function getArticleUrlPattern() {
  return localStorage.getItem('articleUrlPattern') || (window.location.origin + '/article?id={id}');
}

function setArticleUrlPattern(p) {
  localStorage.setItem('articleUrlPattern', p);
}

function getArticlePublicUrl(article) {
  return getArticleUrlPattern()
    .replace('{slug}', article.slug || '')
    .replace('{section}', article.sectionId || article.section || '')
    .replace('{subsection}', article.subsectionId || article.subsection || '')
    .replace('{id}', article.id || '');
}

function promptArticleUrlPattern() {
  const current = getArticleUrlPattern();
  const val = prompt('Formát veřejné URL článku. Použij {id} jako zástupný text za ID článku (volitelně i {slug}, {section}, {subsection}).', current);
  if (val && val.trim()) setArticleUrlPattern(val.trim());
}

function shareArticle(id) {
  const arr = window._articlesCache || [];
  const a = arr.find(x => x.id === id);
  if (!a) { showToast('Článek nenalezen — zkus obnovit seznam.', 'error'); return; }
  openShareModal(a);
}

function openShareModal(article) {
  const url = getArticlePublicUrl(article);
  const text = article.title || 'Nový článek';

  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `
    <div class="modal-box" style="max-width:440px">
      <h3>🔗 Sdílet článek</h3>
      <p style="color:var(--text-muted);font-size:13px;margin:-0.6rem 0 0.9rem">${escapeHtml(text)}</p>
      <div class="form-row"><input class="form-input" id="shareUrlInput" readonly></div>
      <div class="modal-actions" style="flex-wrap:wrap;justify-content:flex-start;gap:0.5rem">
        <button class="btn btn-blue" id="shareNativeBtn" style="display:none">📱 Nabídka aplikací</button>
        <button class="btn btn-blue" id="shareCopyBtn">📋 Kopírovat odkaz</button>
      </div>
      <div style="margin-top:1rem;display:flex;justify-content:space-between;align-items:center;gap:0.5rem">
        <button class="btn btn-sm" id="shareUrlPatternBtn" title="Uprav formát veřejné URL, pokud neodpovídá tvému webu">⚙️ Formát URL</button>
        <button class="btn btn-red btn-sm" onclick="this.closest('.modal').remove()">Zavřít</button>
      </div>
    </div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);

  const urlInput = m.querySelector('#shareUrlInput');
  urlInput.value = url;
  urlInput.onclick = () => urlInput.select();

  const nativeBtn = m.querySelector('#shareNativeBtn');
  if (navigator.share) {
    nativeBtn.style.display = '';
    nativeBtn.onclick = async () => {
      try { await navigator.share({ title: text, url: urlInput.value }); }
      catch { /* uživatel nabídku zavřel/zrušil — nic se neděje */ }
    };
  }

  m.querySelector('#shareCopyBtn').onclick = () => copyShareLink(urlInput.value);

  m.querySelector('#shareUrlPatternBtn').onclick = () => {
    promptArticleUrlPattern();
    urlInput.value = getArticlePublicUrl(article);
  };
}

function copyShareLink(url) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => showToast('Odkaz zkopírován do schránky', 'success'))
      .catch(() => showToast('Nepodařilo se zkopírovat automaticky — označ a zkopíruj odkaz ručně.', 'info'));
  } else {
    showToast('Kopírování není v tomhle prohlížeči podporované — označ a zkopíruj odkaz ručně.', 'info');
  }
}


/* Vloží panel hromadných akcí (Publikovat/Skrýt/Smazat vybrané) nad seznam
   článků, bez nutnosti mít ho předpřipravený v HTML šabloně. */
function injectArticleBulkBar() {
  if ($('articleBulkBar')) return;
  const box = $('articleList');
  if (!box || !box.parentElement) return;
  const bar = document.createElement('div');
  bar.id = 'articleBulkBar';
  bar.style.cssText = 'display:none;align-items:center;gap:0.5rem;margin-bottom:1rem;padding:0.6rem 0.9rem;background:var(--surface-2);border:1px solid var(--border-soft);border-radius:var(--r-md);flex-wrap:wrap';
  bar.innerHTML = `
    <span id="articleBulkCount" style="color:var(--text-muted);font-size:13px;margin-right:auto"></span>
    <button class="btn btn-sm" style="background:var(--green);border-color:var(--green);color:#06281f" onclick="bulkPublishArticles(true)">👁 Publikovat vybrané</button>
    <button class="btn btn-sm" style="background:#f59e0b;border-color:#f59e0b;color:#fff" onclick="bulkPublishArticles(false)">⏸ Skrýt vybrané</button>
    <button class="btn btn-red btn-sm" onclick="bulkDeleteArticles()">🗑 Smazat vybrané</button>
  `;
  box.parentElement.insertBefore(bar, box);
}

/* Vybere/zruší výběr všech AKTUÁLNĚ ZOBRAZENÝCH článků (respektuje
   filtr hledání/sekce/stavu) — stejný princip jako u galerie. */
function selectAllArticles() {
  const checks = document.querySelectorAll('#articleList .article-check');
  if (!checks.length) { showToast('Podle aktuálního filtru nejsou vidět žádné články.', 'info'); return; }
  checks.forEach(c => { c.checked = true; });
  updateArticleBulkBar();
}

function clearArticleSelection() {
  document.querySelectorAll('#articleList .article-check:checked').forEach(c => { c.checked = false; });
  updateArticleBulkBar();
}

/* Vloží panel hledání/filtrování nad seznam článků. */
function injectArticleFilterBar() {
  if ($('articleFilterBar')) return;
  const box = $('articleList');
  if (!box || !box.parentElement) return;
  const bar = document.createElement('div');
  bar.id = 'articleFilterBar';
  bar.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem;align-items:center';
  bar.innerHTML = `
    <input type="text" id="articleSearch" class="form-input" placeholder="🔍 Hledat podle nadpisu…" style="flex:1;min-width:180px" oninput="filterAndRenderArticles()">
    <select id="articleFilterSection" class="form-select" style="max-width:170px" onchange="filterAndRenderArticles()">
      <option value="">Všechny sekce</option>
      <option value="travel">Cestování</option>
      <option value="photo">Fotografování</option>
      <option value="projects">Projekty</option>
      <option value="about">O Zajdovi</option>
    </select>
    <select id="articleFilterStatus" class="form-select" style="max-width:150px" onchange="filterAndRenderArticles()">
      <option value="">Vše</option>
      <option value="published">✅ Publikované</option>
      <option value="hidden">⏸ Skryté</option>
    </select>
  `;
  box.parentElement.insertBefore(bar, box);
}

function getFilteredArticles() {
  const arr = window._articlesCache || [];
  const q = ($('articleSearch')?.value || '').trim().toLowerCase();
  const sectionFilter = $('articleFilterSection')?.value || '';
  const statusFilter = $('articleFilterStatus')?.value || '';
  return arr.filter(a => {
    if (q && !(a.title || '').toLowerCase().includes(q)) return false;
    if (sectionFilter && (a.sectionId || a.section) !== sectionFilter) return false;
    if (statusFilter === 'published' && !a.published) return false;
    if (statusFilter === 'hidden' && a.published) return false;
    return true;
  });
}

function filterAndRenderArticles() {
  renderArticleList(getFilteredArticles());
}

async function loadArticles() {
  injectArticleFilterBar();
  injectArticleBulkBar();
  try {
    const r = await fetch('/api/articles/list');
    if (!r.ok) throw new Error('Chyba načítání');
    const data = await r.json();
    const arr = Array.isArray(data) ? data : (data.articles || []);
    window._articlesCache = arr;

    /* Naskenuje obsah všech článků a zapamatuje si, které URL fotek se
       v nich objevují — galerie pak u nich zobrazí odznak "V článku". */
    window.usedPhotoUrls = new Set();
    arr.forEach(a => {
      if (!a.content) return;
      const matches = a.content.match(/<img[^>]+src=["']([^"']+)["']/g) || [];
      matches.forEach(tag => {
        const m = tag.match(/src=["']([^"']+)["']/);
        if (m) window.usedPhotoUrls.add(m[1]);
      });
    });
    if (typeof renderGallery === 'function' && $('galleryGrid')) renderGallery();

    renderArticleList(getFilteredArticles());
  } catch (e) {
    console.error('Chyba článků:', e);
    const box = $('articleList');
    if (box) box.innerHTML = '<div style="color:#ef4444;padding:1rem;text-align:center">Nepodařilo se načíst články</div>';
  }
}

function renderArticleList(arr) {
  const box = $('articleList');
  if (!box) return;
  if (!arr.length) {
    const hasAny = (window._articlesCache || []).length > 0;
    box.innerHTML = `<div style="color:#64748b;padding:1rem;text-align:center">${hasAny ? 'Žádné články neodpovídají filtru.' : 'Zatím žádné články'}</div>`;
    updateArticleBulkBar();
    return;
  }
  box.innerHTML = arr.map(a => {
    const excerpt = a.excerpt
      ? a.excerpt
      : (a.content ? a.content.replace(/<[^>]+>/g, '').substring(0, 120) + '...' : '');
    const coverThumb = a.coverUrl
      ? `<img src="${a.coverUrl}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0;border:1px solid #263252">`
      : '';
    const pubStatus = a.published
      ? '<span style="color:#22c55e;font-size:12px">✅ Publikováno</span>'
      : '<span style="color:#ef4444;font-size:12px">⏸ Skryto</span>';
    const toggleBtn = a.published
      ? `<button onclick="unpublishArticle('${a.id}')" class="btn btn-sm" style="background:#f59e0b;color:#fff;border:none;padding:4px 12px;border-radius:6px;cursor:pointer">⏸ Skrýt</button>`
      : `<button onclick="publishArticle('${a.id}')" class="btn btn-sm" style="background:#22c55e;color:#fff;border:none;padding:4px 12px;border-radius:6px;cursor:pointer">👁 Zobrazit</button>`;
    const pinBadge = a.pinned ? '<span style="color:#ffc857;font-size:12px;font-weight:700">📌 Připnuto</span>' : '';
    const pinBtn = a.pinned
      ? `<button onclick="toggleArticlePin('${a.id}', false)" class="btn btn-sm" style="background:#263252;color:#ffc857;border:1px solid #ffc857">📌 Odepnout</button>`
      : `<button onclick="toggleArticlePin('${a.id}', true)" class="btn btn-sm">📌 Připnout</button>`;
    return `
    <div class="card" style="margin-bottom:1rem;padding:1rem;background:#131a2c;border:1px solid ${a.pinned ? '#ffc857' : '#263252'};border-radius:10px;position:relative">
      <input type="checkbox" class="article-check" data-id="${a.id}" onchange="updateArticleBulkBar()" style="position:absolute;top:1rem;left:1rem;width:18px;height:18px;cursor:pointer;accent-color:var(--accent)">
      <div style="display:flex;gap:0.9rem;padding-left:1.75rem">
        ${coverThumb}
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.3rem;gap:0.5rem;flex-wrap:wrap">
            <h4 style="color:#ffc857;margin:0">${escapeHtml(a.title)}</h4>
            <div style="display:flex;gap:0.5rem;align-items:center">${pinBadge}${pubStatus}</div>
          </div>
          <p style="color:#92a0bc;font-size:13px;margin-bottom:0.5rem">
            ${a.section || ''} ${a.subsection || ''} • ${a.place || ''} • ${new Date(a.date || a.created).toLocaleDateString('cs')}
          </p>
          ${excerpt ? `<p style="color:#cbd5e1;font-size:14px;margin-bottom:0.75rem;line-height:1.5">${escapeHtml(excerpt)}</p>` : ''}
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        <button onclick="editArticle('${a.id}')" class="btn btn-blue btn-sm">✏️ Upravit</button>
        <button onclick="shareArticle('${a.id}')" class="btn btn-blue btn-sm">🔗 Sdílet</button>
        <button onclick="duplicateArticle('${a.id}')" class="btn btn-sm">📋 Duplikovat</button>
        ${pinBtn}
        ${toggleBtn}
        <button onclick="deleteArticle('${a.id}')" class="btn btn-red btn-sm">🗑 Smazat</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
  updateArticleBulkBar();
}

/* === ČLÁNKY: editace === */
async function editArticle(id) {
  try {
    const r = await fetch('/api/articles/get?id=' + encodeURIComponent(id));
    if (!r.ok) throw new Error('Server vrátil ' + r.status);
    const a = await r.json();
    if (typeof showTab === 'function') showTab('articles');
    if ($('artTitle')) $('artTitle').value = a.title || '';
    if ($('artEditor')) {
      $('artEditor').innerHTML = a.content || '';
      $('artEditor').dataset.editId = id;
    }
    if ($('artDate')) $('artDate').value = a.date ? a.date.split('T')[0] : '';
    if ($('artPlace')) $('artPlace').value = a.place || '';
    if ($('artExcerpt')) $('artExcerpt').value = a.excerpt || '';
    if ($('artCoverUrl')) $('artCoverUrl').value = a.coverUrl || '';
    if ($('artCoverPreview')) $('artCoverPreview').style.backgroundImage = a.coverUrl ? `url('${a.coverUrl}')` : '';
    if ($('artSection')) {
      $('artSection').value = a.sectionId || a.section || '';
      await loadArtSubsections();
    }
    if ($('artSubsection')) $('artSubsection').value = a.subsectionId || a.subsection || '';

    var btn = document.getElementById('artSubmitBtn');
    if (!btn) btn = document.querySelector('#articles button[onclick*="createArticle"]');
    if (!btn) btn = document.querySelector('#articles button[onclick*="updateArticle"]');
    if (!btn) btn = document.querySelector('#articles .btn-blue');
    if (!btn) btn = document.querySelector('#articles button[type="submit"]');
    if (!btn) btn = document.querySelector('#articles button');
    if (btn) {
      btn.textContent = '💾 Uložit změny a publikovat';
      btn.setAttribute('onclick', 'updateArticle()');
      btn.onclick = updateArticle;
    }
    setTimeout(() => { setupArticleEditors(); updateArticleWordCount(); }, 100);
  } catch (e) {
    showToast('Nepodařilo se načíst článek pro úpravu', 'error');
    console.error(e);
  }
}


/* === ČLÁNKY: vytvoření === */
/* === NÁHLED ČLÁNKU PŘED ZVEŘEJNĚNÍM ===
   Nic neukládá, nic nepublikuje — jen ukáže aktuální rozepsaný obsah
   formuláře stylovaný jako skutečný článek na webu. */
function previewArticle() {
  const title = $('artTitle')?.value.trim() || '(bez nadpisu)';
  const content = $('artEditor')?.innerHTML || '<p style="color:var(--text-faint)">(zatím žádný obsah)</p>';
  const date = $('artDate')?.value;
  const place = $('artPlace')?.value.trim();
  const sectionSel = $('artSection');
  const sectionText = sectionSel && sectionSel.selectedIndex > 0 ? sectionSel.options[sectionSel.selectedIndex].textContent : '';
  const subsectionSel = $('artSubsection');
  const subsectionText = subsectionSel && subsectionSel.selectedIndex > 0 ? subsectionSel.options[subsectionSel.selectedIndex].textContent : '';

  const metaParts = [sectionText, subsectionText, place, date ? new Date(date).toLocaleDateString('cs') : ''].filter(Boolean);

  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `
    <div class="modal-box" style="max-width:720px;width:100%;max-height:88vh;display:flex;flex-direction:column;padding:0">
      <div style="padding:1rem 1.5rem;flex-shrink:0;border-bottom:1px solid var(--border-soft);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;color:var(--text-faint);font-family:var(--font-mono)">👁 NÁHLED — nic se neukládá</span>
        <button class="btn btn-red btn-sm" onclick="this.closest('.modal').remove()">Zavřít</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:2rem 2.25rem">
        <h1 style="font-family:var(--font-display);color:var(--text);font-size:1.9rem;margin:0 0 0.6rem;line-height:1.25">${escapeHtml(title)}</h1>
        ${metaParts.length ? `<p style="color:var(--text-muted);font-size:13.5px;margin:0 0 1.5rem">${metaParts.map(escapeHtml).join(' • ')}</p>` : ''}
        <div class="article-preview-full">${content}</div>
      </div>
    </div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
}

async function createArticle() {
  const title = $('artTitle')?.value.trim();
  const content = $('artEditor')?.innerHTML;
  if (!title || !content) return showToast('Vyplň nadpis a obsah', 'info');
  const payload = {
    title, content,
    excerpt: $('artExcerpt')?.value.trim() || '',
    coverUrl: $('artCoverUrl')?.value || '',
    slug: generateSlug(title),
    sectionId: $('artSection')?.value || null,
    subsectionId: $('artSubsection')?.value || null,
    date: $('artDate')?.value || new Date().toISOString().split('T')[0],
    place: $('artPlace')?.value || '',
    published: true
  };
  let created = null;
  try {
    const r = await fetch('/api/articles/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('Chyba ukládání');
    try { created = await r.json(); } catch { created = null; }
  } catch (e) {
    showToast('Nepodařilo se vytvořit článek', 'error');
    console.error(e);
    return;
  }
  resetArticleForm();
  await loadArticles();
  showToast('Článek vytvořen a publikován', 'success');

  // Rovnou nabídne poslání odkazu na nový článek — použije skutečný záznam
  // z čerstvě načteného seznamu (má jistě správné ID z databáze), případně
  // ID vrácené rovnou z /api/articles/create.
  const realArticle = (window._articlesCache || []).find(a => a.slug === payload.slug)
    || (created?.id ? { ...payload, id: created.id } : null);
  if (realArticle) {
    const shouldShare = await showConfirm('Chceš rovnou poslat odkaz na nový článek?', { confirmText: 'Sdílet odkaz', cancelText: 'Teď ne' });
    if (shouldShare) openShareModal(realArticle);
  }
}

/* === ČLÁNKY: update === */
async function updateArticle() {
  const editorEl = $('artEditor');
  const id = editorEl?.dataset?.editId;
  if (!id) return createArticle();
  const title = $('artTitle')?.value.trim();
  const content = editorEl?.innerHTML;
  if (!title || !content) return showToast('Vyplň nadpis a obsah', 'info');
  const payload = {
    id, title, content,
    excerpt: $('artExcerpt')?.value.trim() || '',
    coverUrl: $('artCoverUrl')?.value || '',
    slug: generateSlug(title),
    sectionId: $('artSection')?.value || null,
    subsectionId: $('artSubsection')?.value || null,
    date: $('artDate')?.value || new Date().toISOString().split('T')[0],
    place: $('artPlace')?.value || '',
    published: true
  };
  try {
    const r = await fetch('/api/articles/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('Chyba ukládání');
  } catch (e) {
    showToast('Nepodařilo se uložit změny', 'error');
    console.error(e);
    return;
  }
  resetArticleForm();
  loadArticles();
  showToast('Změny uloženy', 'success');
}

/* === ČLÁNKY: skrýt/zobrazit === */
async function publishArticle(id) {
  try {
    const r = await fetch('/api/articles/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, published: true })
    });
    if (!r.ok) throw new Error('Chyba publikování');
    loadArticles();
  } catch (e) {
    showToast('Nepodařilo se publikovat článek', 'error');
    console.error(e);
  }
}

async function unpublishArticle(id) {
  try {
    const r = await fetch('/api/articles/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, published: false })
    });
    if (!r.ok) throw new Error('Chyba skrývání');
    loadArticles();
  } catch (e) {
    showToast('Nepodařilo se skrýt článek', 'error');
    console.error(e);
  }
}

/* === ČLÁNKY: připnutí nahoru (nezávisle na datu) ===
   Na veřejném webu (index.html) se připnuté články vždycky zobrazí
   první, bez ohledu na zvolené řazení nejnovější/nejstarší — mezi
   sebou podle pinnedOrder (nižší = víc nahoře). Používá stejný
   /api/articles/update endpoint jako publikovat/skrýt, jen s novými
   poli — pokud ho backend zpracovává jako obecný merge-update (jak to
   dělá u "published"), zafunguje to bez jakékoliv úpravy backendu. */
async function toggleArticlePin(id, pinned) {
  try {
    const payload = { id, pinned };
    if (pinned) {
      // Nové připnutí jde na konec fronty připnutých (nejvyšší dosavadní
      // pinnedOrder + 1) — poslední připnutý se tak neprocpe navrchol
      // před dřív připnuté.
      const arr = window._articlesCache || [];
      const maxOrder = arr.reduce((m, a) => a.pinned && typeof a.pinnedOrder === 'number' ? Math.max(m, a.pinnedOrder) : m, 0);
      payload.pinnedOrder = maxOrder + 1;
    }
    const r = await fetch('/api/articles/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    showToast(pinned ? 'Článek připnut nahoru' : 'Článek odepnut', 'success');
    loadArticles();
  } catch (e) {
    console.error('Chyba připnutí článku:', e);
    showToast('Nepodařilo se změnit připnutí — zkontroluj, že /api/articles/update umí uložit i pole "pinned" (obecný merge-update).', 'error');
  }
}

/* === ČLÁNKY: reset formuláře === */
function resetArticleForm() {
  if (typeof clearArticleDraft === 'function') clearArticleDraft(articleDraftKey());
  if ($('artTitle')) $('artTitle').value = '';
  if ($('artEditor')) {
    $('artEditor').innerHTML = '';
    delete $('artEditor').dataset.editId;
  }
  if ($('artDate')) $('artDate').value = '';
  if ($('artPlace')) $('artPlace').value = '';
  if ($('artExcerpt')) $('artExcerpt').value = '';
  clearArticleCover();
  if ($('artSection')) $('artSection').value = '';
  if ($('artSubsection')) $('artSubsection').innerHTML = '<option value="">— Podsekce —</option>';
  const btn = $('artSubmitBtn')
    || document.querySelector('#articles button[onclick*="updateArticle"]')
    || document.querySelector('#articles button[onclick*="createArticle"]')
    || document.querySelector('#articles .btn-blue');
  if (btn) {
    btn.textContent = 'Vytvořit článek';
    btn.removeAttribute('onclick');
    btn.onclick = createArticle;
  }
  hideImgToolbar();
  updateArticleWordCount();
}

/* === ČLÁNKY: smazání === */
/* === ČLÁNKY: hromadné akce (publikovat/skrýt/smazat víc najednou) === */
function updateArticleBulkBar() {
  const bar = $('articleBulkBar');
  const checks = document.querySelectorAll('.article-check:checked');
  if (!bar) return;
  if (checks.length) {
    bar.style.display = 'flex';
    if ($('articleBulkCount')) $('articleBulkCount').textContent = `Vybráno: ${checks.length} článků`;
  } else {
    bar.style.display = 'none';
  }
}

async function bulkPublishArticles(publish) {
  const ids = Array.from(document.querySelectorAll('.article-check:checked')).map(c => c.dataset.id);
  if (!ids.length) return;
  for (const id of ids) {
    try {
      await fetch('/api/articles/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, published: publish })
      });
    } catch (e) { console.error('Chyba hromadné akce', id, e); }
  }
  showToast(`${ids.length} článků ${publish ? 'publikováno' : 'skryto'}`, 'success');
  loadArticles();
}

async function bulkDeleteArticles() {
  const ids = Array.from(document.querySelectorAll('.article-check:checked')).map(c => c.dataset.id);
  if (!ids.length) return;
  if (!(await showConfirm(`Opravdu smazat ${ids.length} článků?`, { danger: true, confirmText: 'Smazat' }))) return;
  for (const id of ids) {
    try {
      await fetch('/api/articles/delete?id=' + encodeURIComponent(id), { method: 'DELETE' });
    } catch (e) { console.error('Chyba hromadného mazání', id, e); }
  }
  showToast(`${ids.length} článků smazáno`, 'success');
  loadArticles();
}

/* === ČLÁNKY: duplikace (užitečné jako šablona pro podobné příspěvky) === */
async function duplicateArticle(id) {
  try {
    const r = await fetch('/api/articles/get?id=' + encodeURIComponent(id));
    if (!r.ok) throw new Error('Server vrátil ' + r.status);
    const a = await r.json();
    const payload = {
      title: (a.title || '') + ' (kopie)',
      content: a.content || '',
      excerpt: a.excerpt || '',
      coverUrl: a.coverUrl || '',
      slug: generateSlug((a.title || '') + '-kopie-' + Date.now()),
      sectionId: a.sectionId || a.section || null,
      subsectionId: a.subsectionId || a.subsection || null,
      date: new Date().toISOString().split('T')[0],
      place: a.place || '',
      published: false // kopie se rovnou nezveřejní, ať ji stihneš upravit
    };
    const cr = await fetch('/api/articles/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!cr.ok) throw new Error('Chyba ukládání kopie');
    showToast('Článek duplikován (jako skrytý koncept)', 'success');
    loadArticles();
  } catch (e) {
    console.error('Chyba duplikace článku:', e);
    showToast('Nepodařilo se duplikovat článek', 'error');
  }
}

async function deleteArticle(id) {
  if (!(await showConfirm('Opravdu smazat tento článek?', { danger: true, confirmText: 'Smazat' }))) return;
  try {
    const r = await fetch('/api/articles/delete?id=' + encodeURIComponent(id), { method: 'DELETE' });
    if (!r.ok) throw new Error('Chyba mazání');
    loadArticles();
  } catch (e) {
    showToast('Nepodařilo se smazat článek', 'error');
    console.error(e);
  }
}
/* =========================================================
   DASHBOARD EDITOR — ČÁST 5/5
   ========================================================= */

/* === CITÁTY === */
async function loadQuotes() {
  const tbody = $('quoteTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b;padding:1rem">Načítání...</td></tr>';
  try {
    const r = await fetch('/api/quotes/list');
    if (!r.ok) throw new Error();
    const data = await r.json();
    const arr = Array.isArray(data) ? data : [];
    if (!arr.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b;padding:1rem">Žádné citáty.</td></tr>';
      return;
    }
    tbody.innerHTML = arr.map(q => `
      <tr>
        <td style="padding:0.75rem;border-bottom:1px solid #263252">"${escapeHtml(q.text)}"</td>
        <td style="padding:0.75rem;border-bottom:1px solid #263252;color:#92a0bc">${escapeHtml(q.author) || '—'}</td>
        <td style="padding:0.75rem;border-bottom:1px solid #263252">
          <button onclick="deleteQuote('${encodeURIComponent(q.key || q.id)}')" class="btn btn-red btn-sm">Smazat</button>
        </td>
      </tr>`).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#ef4444;padding:1rem">Chyba načítání.</td></tr>';
  }
}

async function createQuote() {
  const text = $('qText')?.value.trim();
  if (!text) return showToast('Zadej text citátu', 'info');
  try {
    await fetch('/api/quotes/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, author: $('qAuthor')?.value.trim() || '' })
    });
    $('qText').value = '';
    $('qAuthor').value = '';
    loadQuotes();
  } catch (e) {
    showToast('Nepodařilo se uložit citát', 'error');
  }
}

async function deleteQuote(key) {
  if (!(await showConfirm('Smazat citát?', { danger: true, confirmText: 'Smazat' }))) return;
  try {
    await fetch('/api/quotes/delete?key=' + key, { method: 'DELETE' });
    loadQuotes();
  } catch {
    showToast('Chyba mazání', 'error');
  }
}

/* === PODSEKCE === */
/* === PODSEKCE + POČET ČLÁNKŮ ===
   Dřív bylo z tabulky vidět jen název/slug/pořadí podsekce — nešlo
   poznat, jestli je v ní vůbec nějaký článek, aniž by se to muselo
   ručně kontrolovat přes filtr v Článcích. Teď se u každé podsekce
   spočítá a zobrazí počet, a prázdné se výrazně označí (červený rámeček
   + ⚠️ odznak), ať jde na první pohled najít, co smazat/sloučit. */
async function loadSubsections() {
  const tbody = $('subsectionTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:1rem">Načítám…</td></tr>';

  const secs = ['travel', 'photo', 'projects', 'about'];
  const all = [];
  for (const sid of secs) {
    try {
      const r = await fetch('/api/subsections/by-section?sectionId=' + sid);
      if (r.ok) { const arr = await r.json(); all.push(...arr); }
    } catch {}
  }
  if (!all.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:1rem">Žádné podsekce.</td></tr>';
    updateSubsectionsSummary(0, 0);
    return;
  }

  // Počty se počítají z /api/articles/list — stejný zdroj, co používá
  // záložka Články, jen natažený zvlášť (Podsekce se může otevřít jako
  // úplně první záložka, bez toho, že by Články něco už nacachovaly).
  let articles = [];
  try {
    const r = await fetch('/api/articles/list');
    if (r.ok) {
      const data = await r.json();
      articles = Array.isArray(data) ? data : (data.articles || []);
    }
  } catch (e) {
    console.error('Nepodařilo se načíst články pro počty v podsekcích:', e);
  }

  const countFor = (sectionId, subsectionId) => articles.filter(a =>
    String(a.sectionId) === String(sectionId) && String(a.subsectionId) === String(subsectionId)
  ).length;

  let emptyCount = 0;
  tbody.innerHTML = all.map(s => {
    const count = countFor(s.sectionId, s.id);
    const isEmpty = count === 0;
    if (isEmpty) emptyCount++;
    const countLabel = count === 1 ? 'článek' : (count >= 2 && count <= 4 ? 'články' : 'článků');
    const countBadge = isEmpty
      ? `<span class="count-badge count-badge-empty">⚠️ Prázdná</span>`
      : `<span class="count-badge">${count} ${countLabel}</span>`;
    return `
    <tr class="${isEmpty ? 'row-flag-empty' : ''}">
      <td data-label="Sekce">${escapeHtml(s.sectionId)}</td>
      <td data-label="Podsekce">
        <div style="display:flex;align-items:center;gap:0.75rem">
          ${s.coverUrl ? `<img src="${s.coverUrl}" style="width:70px;height:50px;object-fit:cover;border-radius:6px;border:1px solid #263252;flex-shrink:0">` : '<div style="width:70px;height:50px;background:#0a0f1c;border-radius:6px;border:1px solid #263252;flex-shrink:0"></div>'}
          <span>${escapeHtml(s.name)}</span>
        </div>
      </td>
      <td data-label="Slug">${escapeHtml(s.slug)}</td>
      <td data-label="Pořadí">${s.order || 0}</td>
      <td data-label="Články">${countBadge}</td>
      <td data-label="Akce">
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button onclick="pickSubsectionCover('${s.id}')" class="btn btn-blue btn-sm">Změnit cover</button>
          <button onclick="deleteSubsection('${s.id}')" class="btn btn-red btn-sm">Smazat</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  updateSubsectionsSummary(all.length, emptyCount);
}

/* Krátký souhrn nad tabulkou — na mobilu, kde se scrolluje hodně dolů,
   je fajn vědět hned nahoře, jestli je vůbec za čím jít hledat. */
function updateSubsectionsSummary(total, empty) {
  const el = $('subsectionsSummary');
  if (!el) return;
  if (!total) { el.textContent = ''; return; }
  el.innerHTML = empty > 0
    ? `📂 ${total} podsekcí celkem · <span style="color:var(--red);font-weight:600">⚠️ ${empty} ${empty === 1 ? 'prázdná' : (empty >= 2 && empty <= 4 ? 'prázdné' : 'prázdných')}</span>`
    : `📂 ${total} podsekcí celkem · ✅ žádná není prázdná`;
}

async function createSubsection() {
  const sec = $('ssSection')?.value;
  const name = $('ssName')?.value.trim();
  if (!sec || !name) return showToast('Vyplň sekci a název', 'info');
  const slug = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  try {
    await fetch('/api/subsections/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: sec, name, slug, order: parseInt($('ssOrder')?.value) || 0 })
    });
    $('ssName').value = '';
    $('ssOrder').value = '0';
    loadSubsections();
  } catch {
    showToast('Chyba vytváření podsekce', 'error');
  }
}

async function deleteSubsection(id) {
  if (!(await showConfirm('Smazat podsekci?', { danger: true, confirmText: 'Smazat' }))) return;
  try {
    await fetch('/api/subsections/delete?id=' + id, { method: 'DELETE' });
    loadSubsections();
  } catch {
    showToast('Chyba mazání', 'error');
  }
}

async function pickSubsectionCover(id) {
  openGalleryPickerModal({
    title: 'Cover podsekce',
    onSelect: url => saveSubsectionCover(id, url)
  });
}

async function saveSubsectionCover(id, url) {
  try {
    await fetch('/api/subsections/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, coverUrl: url })
    });
  } catch {
    showToast('Chyba uložení coveru', 'error');
  } finally {
    loadSubsections();
  }
}

/* === COVER SEKCE === */
async function loadSectionCovers() {
  const box = $('sectionCovers');
  if (!box) return;
  const secs = [
    { id: 'travel', n: 'Cestování' },
    { id: 'photo', n: 'Fotografování' },
    { id: 'projects', n: 'Projekty' },
    { id: 'about', n: 'O Zajdovi' }
  ];
  var ts = Date.now();
  var html = '<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem">';
  for (const s of secs) {
    var url = '';
    try {
      const r = await fetch('/api/sections/cover?sectionId=' + s.id + '&_t=' + ts);
      if (r.ok) {
        const d = await r.json();
        url = d.coverUrl || d.url || '';
      }
    } catch (e) { console.error('Chyba načítání coveru sekce:', e); }
    if (url) url = url + (url.includes('?') ? '&' : '?') + '_t=' + ts;
    html += '<div style="background:#131a2c;padding:0.75rem;border-radius:8px;border:1px solid #263252;text-align:center;min-width:140px"><div style="font-size:0.875rem;margin-bottom:0.5rem;color:#ffc857">' + escapeHtml(s.n) + '</div>' + (url ? '<img src="' + url + '" style="width:120px;height:80px;object-fit:cover;border-radius:6px;margin:0 auto 0.5rem;display:block;border:1px solid #263252">' : '<div style="width:120px;height:80px;background:#0a0f1c;border-radius:6px;margin:0 auto 0.5rem;border:1px solid #263252"></div>') + '<button onclick="pickSectionCover(\'' + s.id + '\')" class="btn btn-blue btn-sm">Změnit cover</button></div>';
  }
  html += '</div>';
  box.innerHTML = html;
}

function pickSectionCover(sectionId) {
  openGalleryPickerModal({
    title: 'Cover sekce: ' + sectionId,
    onSelect: url => saveSectionCover(sectionId, url)
  });
}

async function saveSectionCover(sectionId, url) {
  try {
    var absUrl = url.startsWith('http') ? url : window.location.origin + url;
    var resp = await fetch('/api/sections/cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: sectionId, photoUrl: absUrl })
    });
    if (!resp.ok) {
      var err = await resp.text();
      throw new Error(err);
    }
  } catch (e) {
    console.error('Chyba uložení coveru:', e);
    showToast('Nepodařilo se uložit cover: ' + e.message, 'error');
  } finally {
    loadSectionCovers();
  }
}

/* === O ZAJDOVI === */
async function loadAbout() {
  try {
    const r = await fetch('/api/about/get');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json() || {};
    if ($('aboutTitle')) $('aboutTitle').value = d.title || '';
    if ($('aboutEditor')) {
      $('aboutEditor').innerHTML = d.text || '';
      setupArticleEditors();
    }
    const prev = $('aboutPreview');
    if (prev) prev.innerHTML = `<h4 style="color:#ffc857;margin-bottom:0.5rem">${escapeHtml(d.title || 'O Zajdovi')}</h4><div style="line-height:1.6">${d.text || ''}</div>`;
  } catch (e) {
    console.error('About chyba:', e);
    if ($('aboutTitle')) $('aboutTitle').value = '';
    if ($('aboutEditor')) $('aboutEditor').innerHTML = '';
    if ($('aboutPreview')) $('aboutPreview').innerHTML = '<h4 style="color:#ffc857">O Zajdovi</h4><div></div>';
  }
}

async function saveAbout() {
  const about = {
    title: $('aboutTitle')?.value || '',
    text: $('aboutEditor')?.innerHTML || ''
  };
  try {
    const r = await fetch('/api/about/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(about)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    loadAbout();
    showToast('Uloženo', 'success');
  } catch (e) {
    console.error('Chyba uložení about:', e);
    showToast('Chyba uložení', 'error');
  }
}

/* === CSS STYLY === */
function injectEditorStyles() {
  /* Všechny tyto styly už žijí v style.css (s novým barevným systémem).
     Funkce zůstává kvůli zpětné kompatibilitě volání z initDashboardEditor(),
     ale už nic nevkládá — jinak by starými natvrdo zapsanými barvami
     přepisovala novou paletu. */
  return;
}

/* === INICIALIZACE === */
/* === HARMONIKA PANELŮ FOTOEDITORU (jako ve Photoshopu) ===
   Otevření jednoho panelu (Předvolby, Ořez, Světlo...) automaticky zavře
   ostatní. Díky tomu nikdy nenaroste postranní panel do výšky, se kterou
   by si vnitřní scroll neporadil — hlavně na mobilu, kde je místa málo. */
function initEditorPanelAccordion() {
  const sidebar = document.querySelector('.editor-sidebar');
  if (!sidebar || sidebar.dataset.accordionReady) return;
  sidebar.dataset.accordionReady = '1';
  sidebar.querySelectorAll('.editor-panel').forEach(panel => {
    panel.addEventListener('toggle', () => {
      if (!panel.open) return;
      sidebar.querySelectorAll('.editor-panel').forEach(p => {
        if (p !== panel) p.open = false;
      });
      // Po rozbalení panel doscrolluje do vidu, ať ho na mobilu vidíš celý
      requestAnimationFrame(() => panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    });
  });
}

function initDashboardEditor() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  function onReady() {
    injectEditorStyles();
    initEditorPanelAccordion();
    injectShortcutsHelpButton();
    if ($('artEditor')) setupArticleEditors();
    loadGallery().then(() => {
      if ($('articleList')) loadArticles();
      if ($('quoteTableBody')) loadQuotes();
      if ($('subsectionTableBody')) loadSubsections();
      if ($('sectionCovers')) loadSectionCovers();
      if ($('aboutPreview') || $('aboutEditor')) loadAbout();
      if ($('artSection')) loadArtSubsections();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(m => m.remove());
        hideImgToolbar();
      }

      /* Ctrl+S / Cmd+S uloží rozepsaný článek — funguje jen když je
         záložka Články aktivní (jinak by kradlo Ctrl+S ostatním
         záložkám/prohlížeči zbytečně). */
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        const articlesSection = $('articles');
        if (articlesSection && articlesSection.classList.contains('active')) {
          e.preventDefault();
          const editorEl = $('artEditor');
          if (editorEl?.dataset?.editId) updateArticle();
          else createArticle();
        }
      }

      /* "?" otevře přehled klávesových zkratek — jen mimo psaní do
         textového pole/editoru, ať nekoliduje s běžným psaním otazníku. */
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const tag = document.activeElement?.tagName;
        const typing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
        if (!typing) { e.preventDefault(); showKeyboardShortcutsHelp(); }
      }
    });

    /* === VAROVÁNÍ PŘI ODCHODU S NEULOŽENÝMI ZMĚNAMI ===
       Používá stejný "koncept" mechanismus jako autosave (articleDraftKey)
       — pokud pro aktuální kontext (nový článek / konkrétní editovaný ID)
       existuje neuložený koncept v localStorage, prohlížeč se při zavření
       karty/reloadu zeptá, jestli má strana opravdu odejít. Standardní
       chování prohlížečů ukazuje jen obecnou hlášku (vlastní text
       nejde nastavit), to je normální a neopravitelné omezení, ne bug. */
    window.addEventListener('beforeunload', (e) => {
      let hasDraft = false;
      try { hasDraft = !!localStorage.getItem(articleDraftKey()); } catch {}
      if (hasDraft) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }
}

/* === PŘEHLED KLÁVESOVÝCH ZKRATEK === */
function injectShortcutsHelpButton() {
  if (document.getElementById('shortcutsHelpBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'shortcutsHelpBtn';
  btn.textContent = '?';
  btn.title = 'Klávesové zkratky (nebo stiskni "?")';
  btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:500;width:38px;height:38px;border-radius:50%;background:var(--surface-3,#1c2438);color:var(--text-muted,#92a0bc);border:1px solid var(--border,#334155);font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.35)';
  btn.onclick = showKeyboardShortcutsHelp;
  document.body.appendChild(btn);
}

function showKeyboardShortcutsHelp() {
  if (document.querySelector('.modal[data-shortcuts]')) return;
  const groups = [
    { title: 'Obecné', items: [
      ['Esc', 'Zavřít okno / zrušit výběr'],
      ['?', 'Zobrazit tuhle nápovědu']
    ]},
    { title: 'Galerie', items: [
      ['Delete / Backspace', 'Smazat vybrané fotky (do koše)'],
      ['Esc', 'Zrušit výběr fotek']
    ]},
    { title: 'Články', items: [
      ['Ctrl/Cmd + S', 'Uložit rozepsaný / upravovaný článek'],
    ]},
    { title: 'Galerie — drag & drop', items: [
      ['Přetáhnout soubory', 'Nahrát fotky přímo do galerie'],
    ]}
  ];
  const m = document.createElement('div');
  m.className = 'modal';
  m.setAttribute('data-shortcuts', '1');
  m.innerHTML = `
    <div class="modal-box" style="max-width:440px">
      <h3>⌨️ Klávesové zkratky</h3>
      ${groups.map(g => `
        <div style="margin-bottom:1rem">
          <div style="font-size:11.5px;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:0.4rem">${escapeHtml(g.title)}</div>
          ${g.items.map(([key, desc]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.35rem 0;border-bottom:1px solid var(--border-soft)">
              <span style="color:var(--text-muted);font-size:13px">${escapeHtml(desc)}</span>
              <kbd style="background:var(--surface-3);border:1px solid var(--border);border-radius:5px;padding:2px 8px;font-family:var(--font-mono);font-size:11.5px;color:var(--gold)">${escapeHtml(key)}</kbd>
            </div>`).join('')}
        </div>`).join('')}
      <div class="modal-actions">
        <button class="btn btn-red" onclick="this.closest('.modal').remove()">Zavřít</button>
      </div>
    </div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
}

initDashboardEditor();
