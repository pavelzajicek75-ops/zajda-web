// /admin/editor/app.js

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

// aktuální hodnoty sliderů
const state = {
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
  cropRatio: null, // "4:3", "3:4", ...
  freeCropMode: false
};

img.onload = () => {
  originalW = img.width;
  originalH = img.height;

  canvas.width = originalW;
  canvas.height = originalH;

  redraw();
  updateVersionInfo();
};

img.src = `/api/photo/${encodeURIComponent(filename)}?t=` + Date.now();

// Zpět
document.getElementById("backBtn").onclick = () => {
  window.location.href = "/admin/gallery/";
};

// Tabs
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

// Slidery – napojení
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

// Ořez – poměrový
function applyCrop(ratio) {
  if (!ratio || ratio === "free") {
    state.cropRatio = null;
    state.freeCropMode = true;
    canvas.width = originalW;
    canvas.height = originalH;
    redraw();
    updateVersionInfo();
    return;
  }

  state.freeCropMode = false;
  state.cropRatio = ratio;

  const [rw, rh] = ratio.split(":").map(Number);
  const imgW = originalW;
  const imgH = originalH;

  const targetRatio = rw / rh;
  const imgRatio = imgW / imgH;

  let cropW, cropH;

  if (imgRatio > targetRatio) {
    cropH = imgH;
    cropW = cropH * targetRatio;
  } else {
    cropW = imgW;
    cropH = cropW / targetRatio;
  }

  const x = (imgW - cropW) / 2;
  const y = (imgH - cropH) / 2;

  canvas.width = cropW;
  canvas.height = cropH;

  redraw(x, y, cropW, cropH);
  updateVersionInfo();
}

document.querySelectorAll(".btnCrop").forEach(btn => {
  btn.addEventListener("click", () => {
    const r = btn.dataset.ratio;
    applyCrop(r === "free" ? null : r);
  });
});

// VOLNÝ OŘEZ – drag na canvasu (funguje jen když freeCropMode = true)
let isDragging = false;
let dragStart = null;
let dragBox = null;

function getPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = (evt.touches ? evt.touches[0].clientX : evt.clientX) - rect.left;
  const y = (evt.touches ? evt.touches[0].clientY : evt.clientY) - rect.top;
  return { x: x * (canvas.width / rect.width), y: y * (canvas.height / rect.height) };
}

function drawDragOverlay() {
  redraw(); // překreslí fotku s filtry
  if (!dragBox) return;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.clearRect(dragBox.x, dragBox.y, dragBox.w, dragBox.h);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(dragBox.x, dragBox.y, dragBox.w, dragBox.h);
  ctx.restore();
}

function startDrag(evt) {
  if (!state.freeCropMode) return;
  evt.preventDefault();
  isDragging = true;
  const p = getPos(evt);
  dragStart = p;
  dragBox = { x: p.x, y: p.y, w: 0, h: 0 };
  drawDragOverlay();
}

function moveDrag(evt) {
  if (!isDragging || !dragBox) return;
  evt.preventDefault();
  const p = getPos(evt);
  dragBox.w = p.x - dragStart.x;
  dragBox.h = p.y - dragStart.y;

  // normalizace do kladných hodnot
  const x = Math.min(dragStart.x, p.x);
  const y = Math.min(dragStart.y, p.y);
  const w = Math.abs(dragBox.w);
  const h = Math.abs(dragBox.h);
  dragBox = { x, y, w, h };

  drawDragOverlay();
}

function endDrag(evt) {
  if (!isDragging || !dragBox) return;
  evt.preventDefault();
  isDragging = false;

  if (dragBox.w < 10 || dragBox.h < 10) {
    dragBox = null;
    redraw();
    return;
  }

  // aplikace volného ořezu
  const cropX = dragBox.x;
  const cropY = dragBox.y;
  const cropW = dragBox.w;
  const cropH = dragBox.h;

  canvas.width = cropW;
  canvas.height = cropH;

  // přepočet do originálu – freeCropMode vždy začíná z full image
  const scaleX = originalW / canvas.width;
  const scaleY = originalH / canvas.height;

  // ale protože jsme kreslili 1:1 na full image, můžeme použít přímo cropX/Y v originálních souřadnicích
  redraw(cropX, cropY, cropW, cropH);
  dragBox = null;
  updateVersionInfo();
}

canvas.addEventListener("mousedown", startDrag);
canvas.addEventListener("mousemove", moveDrag);
canvas.addEventListener("mouseup", endDrag);
canvas.addEventListener("mouseleave", endDrag);

canvas.addEventListener("touchstart", startDrag, { passive: false });
canvas.addEventListener("touchmove", moveDrag, { passive: false });
canvas.addEventListener("touchend", endDrag, { passive: false });

// Přepočet filtrů a překreslení
function redraw(cropX = 0, cropY = 0, cropW = null, cropH = null) {
  if (!cropW || !cropH) {
    cropW = originalW;
    cropH = originalH;
  }

  const b = 1 + state.brightness / 100;
  const c = 1 + state.contrast / 100;
  const s = 1 + state.saturation / 100;
  const exp = Math.pow(2, state.exposure);
  const hue = state.temperature * 0.5;

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.filter = `
    brightness(${b * exp})
    contrast(${c})
    saturate(${s})
    hue-rotate(${hue}deg)
  `;

  ctx.drawImage(
    img,
    cropX, cropY, cropW, cropH,
    0, 0, canvas.width, canvas.height
  );

  ctx.restore();

  // stíny / světla – jednoduchá korekce
  if (state.shadows !== 0 || state.highlights !== 0) {
    const sh = state.shadows / 100;
    const hi = state.highlights / 100;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (lum < 80 && sh !== 0) {
        data[i] += sh * 60;
        data[i + 1] += sh * 60;
        data[i + 2] += sh * 60;
      } else if (lum > 180 && hi !== 0) {
        data[i] -= hi * 60;
        data[i + 1] -= hi * 60;
        data[i + 2] -= hi * 60;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // vinětace
  if (state.vignette !== 0) {
    const strength = state.vignette / 100;
    const grd = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 1.2
    );
    const alpha = Math.abs(strength) * 0.7;
    if (strength > 0) {
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(1, `rgba(0,0,0,${alpha})`);
    } else {
      grd.addColorStop(0, `rgba(255,255,255,${alpha})`);
      grd.addColorStop(1, "rgba(255,255,255,0)");
    }
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // clarity
  if (state.clarity !== 0) {
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const tctx = tmp.getContext("2d");
    tctx.drawImage(canvas, 0, 0);

    ctx.globalAlpha = Math.abs(state.clarity) / 100;
    ctx.globalCompositeOperation = state.clarity > 0 ? "overlay" : "soft-light";
    ctx.drawImage(tmp, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // vibrance
  if (state.vibrance !== 0) {
    const vib = 1 + state.vibrance / 200;
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const tctx = tmp.getContext("2d");
    tctx.filter = `saturate(${vib})`;
    tctx.drawImage(canvas, 0, 0);
    ctx.drawImage(tmp, 0, 0);
  }
}

// odhad velikosti
function estimateSize(w, h) {
  const bytes = w * h * 3 * 0.15;
  return (bytes / (1024 * 1024)).toFixed(2);
}

function updateVersionInfo() {
  const cropW = canvas.width;
  const cropH = canvas.height;

  const versions = [
    { id: "orig", label: "Originál", w: cropW, h: cropH },
    { id: "v2000", label: "2000 px", max: 2000 },
    { id: "fullhd", label: "FullHD", max: 1920 },
    { id: "small", label: "Malá verze", max: 1200 }
  ];

  versions.forEach(v => {
    let w = v.w;
    let h = v.h;

    if (v.max) {
      if (cropW > cropH) {
        w = v.max;
        h = Math.round(cropH / cropW * v.max);
      } else {
        h = v.max;
        w = Math.round(cropW / cropH * v.max);
      }
    }

    const size = estimateSize(w, h);
    const el = document.getElementById("info_" + v.id);
    if (el) {
      el.textContent = `${w} × ${h}px — ~${size} MB`;
    }
  });
}

// generování konkrétní verze
async function generateVersionBlob(maxSize) {
  const srcW = canvas.width;
  const srcH = canvas.height;

  let newW, newH;

  if (srcW > srcH) {
    newW = maxSize;
    newH = Math.round((srcH / srcW) * maxSize);
  } else {
    newH = maxSize;
    newW = Math.round((srcW / srcH) * maxSize);
  }

  const tmp = document.createElement("canvas");
  tmp.width = newW;
  tmp.height = newH;

  const tctx = tmp.getContext("2d");
  tctx.drawImage(canvas, 0, 0, newW, newH);

  return new Promise(resolve => tmp.toBlob(resolve, "image/jpeg", 0.9));
}

// Uložení vybraných verzí
document.getElementById("saveBtn").onclick = async () => {
  const chkOrig = document.getElementById("chk_orig").checked;
  const chk2000 = document.getElementById("chk_v2000").checked;
  const chkFull = document.getElementById("chk_fullhd").checked;
  const chkSmall = document.getElementById("chk_small").checked;

  if (!chkOrig && !chk2000 && !chkFull && !chkSmall) {
    alert("Vyber alespoň jednu verzi k uložení.");
    return;
  }

  const base = filename.replace(/\.[^.]+$/, "");

  const uploads = [];

  if (chkOrig) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    uploads.push({ name: `${base}.jpg`, blob });
  }
  if (chk2000) {
    const blob = await generateVersionBlob(2000);
    uploads.push({ name: `${base}_2000.jpg`, blob });
  }
  if (chkFull) {
    const blob = await generateVersionBlob(1920);
    uploads.push({ name: `${base}_fullhd.jpg`, blob });
  }
  if (chkSmall) {
    const blob = await generateVersionBlob(1200);
    uploads.push({ name: `${base}_small.jpg`, blob });
  }

  for (const u of uploads) {
    await fetch(`/api/photo/${encodeURIComponent(u.name)}`, {
      method: "PUT",
      body: u.blob
    });
  }

  alert("Vybrané verze byly uloženy.");
};

// fullscreen originál
const fullscreen = document.getElementById("fullscreen");
const fullImg = document.getElementById("fullImg");

canvas.onclick = () => {
  fullImg.src = `/api/photo/${encodeURIComponent(filename)}?full=` + Date.now();
  fullscreen.classList.remove("hidden");
};

fullscreen.onclick = () => {
  fullscreen.classList.add("hidden");
};
