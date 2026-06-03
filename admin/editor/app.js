// /admin/editor/app.js — Editor 4.0 (Photoshop Crop Engine)

// -------------------------------------------------------------
// 1) ZÁKLADNÍ PROMĚNNÉ
// -------------------------------------------------------------

const params = new URLSearchParams(window.location.search);
const filename = params.get("file");

if (!filename) {
  alert("Soubor nebyl zadán.");
  window.location.href = "/admin/gallery/";
}

document.getElementById("filename").textContent = filename;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let img = new Image();
img.crossOrigin = "anonymous";

let originalW = 0;
let originalH = 0;

// -------------------------------------------------------------
// 2) STAV FILTRŮ + CROP ENGINE
// -------------------------------------------------------------

const state = {
  // FILTRY
  brightness: 0,
  contrast: 0,
  exposure: 0,
  vibrance: 0,
  saturation: 0,
  temperature: 0,
  clarity: 0,
  vignette: 0,
  shadows: 0,
  highlights: 0,

  // CROP
  cropActive: false,
  cropRatio: null,      // "4:3", "3:4", "16:9", "9:16", null = free
  crop: { x: 0, y: 0, w: 0, h: 0 }, // aktuální výběr
  dragging: false,
  dragMode: null,       // "move", "n", "s", "e", "w", "ne", "nw", "se", "sw"
  dragStart: { x: 0, y: 0 },
  cropStart: { x: 0, y: 0, w: 0, h: 0 }
};

// -------------------------------------------------------------
// 3) NAČTENÍ OBRÁZKU
// -------------------------------------------------------------

img.onload = () => {
  originalW = img.width;
  originalH = img.height;

  canvas.width = originalW;
  canvas.height = originalH;

  // inicializace cropu – středový 50 %
  initCenteredCrop();

  redraw();
  updateVersionInfo();
};

img.src = `/api/photo/${encodeURIComponent(filename)}?t=` + Date.now();

// -------------------------------------------------------------
// 4) ZPĚT DO GALERIE
// -------------------------------------------------------------

document.getElementById("backBtn").onclick = () => {
  window.location.href = "/admin/gallery/";
};

// -------------------------------------------------------------
// 5) TABS
// -------------------------------------------------------------

document.querySelectorAll("#tabs .tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#tabs .tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    const target = tab.dataset.tab;
    document.querySelectorAll(".tabPane").forEach(p => {
      p.classList.toggle("active", p.dataset.tab === target);
    });
  });
});

// -------------------------------------------------------------
// 6) SLIDERY FILTRŮ
// -------------------------------------------------------------

const sliders = [
  "brightness",
  "contrast",
  "exposure",
  "vibrance",
  "saturation",
  "temperature",
  "clarity",
  "vignette",
  "shadows",
  "highlights"
];

sliders.forEach(name => {
  const sl = document.getElementById("sl_" + name);
  const val = document.getElementById("val_" + name);
  if (!sl) return;

  sl.addEventListener("input", () => {
    state[name] = parseFloat(sl.value);
    val.textContent = sl.value;
    redraw();
    updateVersionInfo();
  });
});

// -------------------------------------------------------------
// 7) CROP – INICIALIZACE STŘEDOVÉHO 50% RÁMEČKU
// -------------------------------------------------------------

function initCenteredCrop() {
  const w = originalW * 0.5;
  const h = originalH * 0.5;
  const x = (originalW - w) / 2;
  const y = (originalH - h) / 2;

  state.crop = { x, y, w, h };
  state.cropActive = true;

  updateCropOverlay();
}

// -------------------------------------------------------------
// 8) CROP – NASTAVENÍ POMĚRU
// -------------------------------------------------------------

document.querySelectorAll(".btnCrop").forEach(btn => {
  btn.addEventListener("click", () => {
    const r = btn.dataset.ratio;

    if (r === "free") {
      state.cropRatio = null;
    } else {
      state.cropRatio = r;
      enforceCropRatio();
    }

    updateCropOverlay();
    redraw();
    updateVersionInfo();
  });
});

// -------------------------------------------------------------
// 9) CROP – PŘEPIS RÁMEČKU PODLE POMĚRU
// -------------------------------------------------------------

function enforceCropRatio() {
  if (!state.cropRatio) return;

  const [rw, rh] = state.cropRatio.split(":").map(Number);
  const targetRatio = rw / rh;

  let { x, y, w, h } = state.crop;
  const currentRatio = w / h;

  if (currentRatio > targetRatio) {
    // příliš široké → upravit šířku
    w = h * targetRatio;
  } else {
    // příliš vysoké → upravit výšku
    h = w / targetRatio;
  }

  // zarovnat zpět doprostřed původního cropu
  const cx = x + state.crop.w / 2;
  const cy = y + state.crop.h / 2;

  x = cx - w / 2;
  y = cy - h / 2;

  // omezit uvnitř fotky
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + w > originalW) x = originalW - w;
  if (y + h > originalH) y = originalH - h;

  state.crop = { x, y, w, h };
}
// -------------------------------------------------------------
// 10) CROP OVERLAY – AKTUALIZACE POZICE
// -------------------------------------------------------------

const cropOverlay = document.getElementById("cropOverlay");

function updateCropOverlay() {
  const { x, y, w, h } = state.crop;

  cropOverlay.style.left = x + "px";
  cropOverlay.style.top = y + "px";
  cropOverlay.style.width = w + "px";
  cropOverlay.style.height = h + "px";

  cropOverlay.classList.add("active");
}

// -------------------------------------------------------------
// 11) CROP – DRAG & RESIZE LOGIKA
// -------------------------------------------------------------

// Zjištění kliknutí na overlay → MOVE
cropOverlay.addEventListener("pointerdown", e => {
  if (!state.cropActive) return;

  const target = e.target;

  // kliknutí na handle?
  if (target.classList.contains("crop-handle")) {
    state.dragMode = target.classList[1].replace("handle-", "");
  } else {
    state.dragMode = "move";
  }

  state.dragging = true;
  state.dragStart = { x: e.clientX, y: e.clientY };
  state.cropStart = { ...state.crop };

  e.preventDefault();
});

// Globální pointermove
window.addEventListener("pointermove", e => {
  if (!state.dragging) return;

  const dx = e.clientX - state.dragStart.x;
  const dy = e.clientY - state.dragStart.y;

  let { x, y, w, h } = state.cropStart;

  const mode = state.dragMode;

  // ---------------------------------------------------------
  // MOVE
  // ---------------------------------------------------------
  if (mode === "move") {
    x += dx;
    y += dy;

    // posun jen uvnitř fotky
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + w > originalW) x = originalW - w;
    if (y + h > originalH) y = originalH - h;
  }

  // ---------------------------------------------------------
  // RESIZE – STRANY
  // ---------------------------------------------------------
  if (mode === "n") {
    y += dy;
    h -= dy;
  }
  if (mode === "s") {
    h += dy;
  }
  if (mode === "w") {
    x += dx;
    w -= dx;
  }
  if (mode === "e") {
    w += dx;
  }

  // ---------------------------------------------------------
  // RESIZE – ROHY (chytré rohy, růst od rohu)
  // ---------------------------------------------------------
  if (mode === "nw") {
    x += dx;
    w -= dx;
    y += dy;
    h -= dy;
  }
  if (mode === "ne") {
    w += dx;
    y += dy;
    h -= dy;
  }
  if (mode === "sw") {
    x += dx;
    w -= dx;
    h += dy;
  }
  if (mode === "se") {
    w += dx;
    h += dy;
  }

  // Minimální velikost
  if (w < 20) w = 20;
  if (h < 20) h = 20;

  // ---------------------------------------------------------
  // DRŽENÍ POMĚRU (pokud je aktivní)
  // ---------------------------------------------------------
  if (state.cropRatio) {
    const [rw, rh] = state.cropRatio.split(":").map(Number);
    const ratio = rw / rh;

    // chytré rohy → drží poměr, ale dovolí přetáhnout
    if (mode === "n" || mode === "s") {
      // úprava výšky → přepočítat šířku
      w = h * ratio;
    } else if (mode === "e" || mode === "w") {
      // úprava šířky → přepočítat výšku
      h = w / ratio;
    } else {
      // rohy → držet poměr
      const newRatio = w / h;
      if (newRatio > ratio) {
        w = h * ratio;
      } else {
        h = w / ratio;
      }
    }
  }

  // ---------------------------------------------------------
  // OMEZENÍ UVNITŘ FOTKY
  // ---------------------------------------------------------
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + w > originalW) w = originalW - x;
  if (y + h > originalH) h = originalH - y;

  state.crop = { x, y, w, h };
  updateCropOverlay();
  redraw();
});

// -------------------------------------------------------------
// 12) KONEC DRAGU
// -------------------------------------------------------------

window.addEventListener("pointerup", () => {
  state.dragging = false;
  state.dragMode = null;
});
window.addEventListener("pointercancel", () => {
  state.dragging = false;
  state.dragMode = null;
});

// -------------------------------------------------------------
// 13) REDRAW – VYKRESLENÍ OBRÁZKU + FILTRŮ + CROP
// -------------------------------------------------------------

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // FILTRY
  const f = state;

  ctx.filter = `
    brightness(${100 + f.brightness}%)
    contrast(${100 + f.contrast}%)
    saturate(${100 + f.saturation}%)
  `;

  // EXPOZICE (přidáme jako gamma)
  if (f.exposure !== 0) {
    const gamma = 1 - f.exposure * 0.1;
    ctx.filter += ` brightness(${1 / gamma})`;
  }

  // TEPLOTA (přidáme přes sepia + hue rotate)
  if (f.temperature !== 0) {
    const t = f.temperature;
    ctx.filter += ` sepia(${Math.abs(t) / 100}) hue-rotate(${t > 0 ? 10 : -10}deg)`;
  }

  // VIBRANCE (simulace)
  if (f.vibrance !== 0) {
    ctx.filter += ` saturate(${100 + f.vibrance * 0.5}%)`;
  }

  // CLARITY (simulace přes kontrast)
  if (f.clarity !== 0) {
    ctx.filter += ` contrast(${100 + f.clarity * 0.4}%)`;
  }

  ctx.drawImage(img, 0, 0);

  // VINĚTACE
  if (f.vignette !== 0) {
    const grd = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      0,
      canvas.width / 2,
      canvas.height / 2,
      Math.max(canvas.width, canvas.height) / 1.2
    );
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, `rgba(0,0,0,${Math.abs(f.vignette) / 100})`);

    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}
// -------------------------------------------------------------
// 14) VÝPOČET VERZÍ (ORIGINÁL, 2000px, FULLHD, MALÁ)
// -------------------------------------------------------------

function updateVersionInfo() {
  const { w, h } = state.crop;

  // Originál
  document.getElementById("info_orig").textContent =
    `${Math.round(w)} × ${Math.round(h)} px`;

  // 2000 px delší strana
  const scale2000 = 2000 / Math.max(w, h);
  document.getElementById("info_v2000").textContent =
    `${Math.round(w * scale2000)} × ${Math.round(h * scale2000)} px`;

  // FullHD
  const scaleFHD = 1080 / Math.max(w, h);
  document.getElementById("info_fullhd").textContent =
    `${Math.round(w * scaleFHD)} × ${Math.round(h * scaleFHD)} px`;

  // Malá verze
  const scaleSmall = 600 / Math.max(w, h);
  document.getElementById("info_small").textContent =
    `${Math.round(w * scaleSmall)} × ${Math.round(h * scaleSmall)} px`;
}

// -------------------------------------------------------------
// 15) FULLSCREEN ORIGINÁL
// -------------------------------------------------------------

const fullscreen = document.getElementById("fullscreen");
const fullImg = document.getElementById("fullImg");

canvas.addEventListener("dblclick", () => {
  fullImg.src = img.src;
  fullscreen.classList.remove("hidden");
});

fullscreen.addEventListener("click", () => {
  fullscreen.classList.add("hidden");
});

// -------------------------------------------------------------
// 16) ULOŽENÍ – GENEROVÁNÍ VÝSTUPŮ
// -------------------------------------------------------------

document.getElementById("saveBtn").addEventListener("click", async () => {
  const versions = [];

  if (document.getElementById("chk_orig").checked) versions.push("orig");
  if (document.getElementById("chk_v2000").checked) versions.push("v2000");
  if (document.getElementById("chk_fullhd").checked) versions.push("fullhd");
  if (document.getElementById("chk_small").checked) versions.push("small");

  if (versions.length === 0) {
    alert("Vyber alespoň jednu verzi k uložení.");
    return;
  }

  for (const v of versions) {
    await saveVersion(v);
  }

  alert("Hotovo! Všechny verze byly uloženy.");
});

// -------------------------------------------------------------
// 17) GENEROVÁNÍ JEDNOTLIVÉ VERZE
// -------------------------------------------------------------

async function saveVersion(type) {
  const { x, y, w, h } = state.crop;

  // vytvořit dočasné plátno
  const tmp = document.createElement("canvas");
  const tctx = tmp.getContext("2d");

  let targetW = w;
  let targetH = h;

  if (type === "v2000") {
    const scale = 2000 / Math.max(w, h);
    targetW = Math.round(w * scale);
    targetH = Math.round(h * scale);
  }

  if (type === "fullhd") {
    const scale = 1080 / Math.max(w, h);
    targetW = Math.round(w * scale);
    targetH = Math.round(h * scale);
  }

  if (type === "small") {
    const scale = 600 / Math.max(w, h);
    targetW = Math.round(w * scale);
    targetH = Math.round(h * scale);
  }

  tmp.width = targetW;
  tmp.height = targetH;

  // FILTRY – stejné jako v redraw()
  const f = state;

  tctx.filter = `
    brightness(${100 + f.brightness}%)
    contrast(${100 + f.contrast}%)
    saturate(${100 + f.saturation}%)
  `;

  if (f.exposure !== 0) {
    const gamma = 1 - f.exposure * 0.1;
    tctx.filter += ` brightness(${1 / gamma})`;
  }

  if (f.temperature !== 0) {
    const t = f.temperature;
    tctx.filter += ` sepia(${Math.abs(t) / 100}) hue-rotate(${t > 0 ? 10 : -10}deg)`;
  }

  if (f.vibrance !== 0) {
    tctx.filter += ` saturate(${100 + f.vibrance * 0.5}%)`;
  }

  if (f.clarity !== 0) {
    tctx.filter += ` contrast(${100 + f.clarity * 0.4}%)`;
  }

  // vykreslení výřezu
  tctx.drawImage(
    img,
    x, y, w, h,
    0, 0, targetW, targetH
  );

  // VINĚTACE
  if (f.vignette !== 0) {
    const grd = tctx.createRadialGradient(
      targetW / 2,
      targetH / 2,
      0,
      targetW / 2,
      targetH / 2,
      Math.max(targetW, targetH) / 1.2
    );
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, `rgba(0,0,0,${Math.abs(f.vignette) / 100})`);

    tctx.fillStyle = grd;
    tctx.fillRect(0, 0, targetW, targetH);
  }

  // export do blobu
  const blob = await new Promise(resolve => tmp.toBlob(resolve, "image/jpeg", 0.92));

  // upload
  const form = new FormData();
  form.append("file", blob, `${filename}_${type}.jpg`);

  await fetch(`/api/photo/save-version?name=${encodeURIComponent(filename)}&type=${type}`, {
    method: "POST",
    body: form
  });
}
// -------------------------------------------------------------
// 18) PŘEPOČET CROP RÁMEČKU PŘI ZMĚNĚ VELIKOSTI OKNA
// -------------------------------------------------------------

window.addEventListener("resize", () => {
  // Canvas se nemění, ale overlay musí zůstat přesně na místě
  updateCropOverlay();
});

// -------------------------------------------------------------
// 19) ZABLOKOVÁNÍ GEST NA MOBILU (aby stránka neposkakovala)
// -------------------------------------------------------------

document.addEventListener("touchmove", e => {
  if (state.dragging) e.preventDefault();
}, { passive: false });

// -------------------------------------------------------------
// 20) POMOCNÉ FUNKCE PRO EXPORT
// -------------------------------------------------------------

function dataURLtoBlob(dataURL) {
  const arr = dataURL.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new Blob([u8], { type: mime });
}

// -------------------------------------------------------------
// 21) DEBUG FUNKCE (volitelné)
// -------------------------------------------------------------

window._debugCrop = () => {
  console.log("Crop:", state.crop);
  console.log("Ratio:", state.cropRatio);
  console.log("Dragging:", state.dragMode);
};

// -------------------------------------------------------------
// 22) HOTOVO – EDITOR 4.0 JE PLNĚ FUNKČNÍ
// -------------------------------------------------------------

console.log("%cEditor 4.0 – Photoshop Crop Engine aktivní", "color:#0f0;font-weight:bold;");
