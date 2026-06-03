// /admin/editor/editor.js

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const filename = new URLSearchParams(window.location.search).get("file");

let img = new Image();
let rotation = 0;
let cropMode = false;
let cropStart = null;
let cropEnd = null;

let effects = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  vibrance: 0,
  sharpness: 0,
  denoise: 0,
  filter: "none"
};

img.crossOrigin = "anonymous";
img.src = `/api/photo/${encodeURIComponent(filename)}`;

img.onload = () => {
  const scale = Math.min(1, 2000 / img.width);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  drawImage();
};

function applyEffectsBase() {
  let filter = `
    brightness(${effects.brightness}%)
    contrast(${effects.contrast}%)
    saturate(${effects.saturation}%)
  `;
  if (effects.vibrance !== 0) filter += ` saturate(${100 + effects.vibrance}%)`;
  if (effects.denoise > 0) filter += ` blur(${effects.denoise}px)`;
  ctx.filter = filter;
}

function drawImage() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotation * Math.PI / 180);
  applyEffectsBase();
  ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
  ctx.restore();

  if (effects.sharpness > 0) applySharpness();

  if (cropMode && cropStart && cropEnd) {
    ctx.save();
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(
      cropStart.x,
      cropStart.y,
      cropEnd.x - cropStart.x,
      cropEnd.y - cropStart.y
    );
    ctx.restore();
  }
}

function applySharpness() {
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const out = new Uint8ClampedArray(data.length);

  const kernel = [
    0, -1, 0,
    -1, 5 + effects.sharpness, -1,
    0, -1, 0
  ];
  const side = 3;
  const half = 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;

      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const px = x + kx;
          const py = y + ky;
          if (px < 0 || px >= w || py < 0 || py >= h) continue;

          const idx = (py * w + px) * 4;
          const weight = kernel[(ky + half) * side + (kx + half)];

          r += data[idx] * weight;
          g += data[idx + 1] * weight;
          b += data[idx + 2] * weight;
        }
      }

      const i = (y * w + x) * 4;
      out[i] = Math.min(255, Math.max(0, r));
      out[i + 1] = Math.min(255, Math.max(0, g));
      out[i + 2] = Math.min(255, Math.max(0, b));
      out[i + 3] = 255;
    }
  }

  ctx.putImageData(new ImageData(out, w, h), 0, 0);
}

// slidery
["brightness","contrast","saturation","vibrance","sharpness","denoise"].forEach(id => {
  document.getElementById(id).oninput = e => {
    effects[id] = Number(e.target.value);
    drawImage();
  };
});

// AI funkce
function updateSliders() {
  document.getElementById("brightness").value = effects.brightness;
  document.getElementById("contrast").value = effects.contrast;
  document.getElementById("saturation").value = effects.saturation;
  document.getElementById("vibrance").value = effects.vibrance;
  document.getElementById("sharpness").value = effects.sharpness;
  document.getElementById("denoise").value = effects.denoise;
}

document.getElementById("aiEnhance").onclick = () => {
  Object.assign(effects, {
    brightness: 110,
    contrast: 120,
    saturation: 115,
    vibrance: 20,
    sharpness: 3,
    denoise: 2
  });
  updateSliders();
  drawImage();
};

document.getElementById("hdr").onclick = () => {
  Object.assign(effects, {
    brightness: 120,
    contrast: 140,
    saturation: 130,
    vibrance: 40,
    sharpness: 4,
    denoise: 1
  });
  updateSliders();
  drawImage();
};

document.getElementById("portrait").onclick = () => {
  Object.assign(effects, {
    brightness: 110,
    contrast: 105,
    saturation: 115,
    vibrance: 30,
    sharpness: 2,
    denoise: 3
  });
  updateSliders();
  drawImage();
};

document.getElementById("upscale").onclick = () => {
  const temp = document.createElement("canvas");
  temp.width = canvas.width * 2;
  temp.height = canvas.height * 2;

  const tctx = temp.getContext("2d");
  tctx.imageSmoothingEnabled = true;
  tctx.imageSmoothingQuality = "high";
  tctx.drawImage(canvas, 0, 0, temp.width, temp.height);

  img.src = temp.toDataURL("image/jpeg");
  img.onload = () => {
    canvas.width = temp.width;
    canvas.height = temp.height;
    drawImage();
  };
};

// rotace
document.getElementById("rotateLeft").onclick = () => {
  rotation -= 90;
  drawImage();
};
document.getElementById("rotateRight").onclick = () => {
  rotation += 90;
  drawImage();
};

// crop – myš + dotyk
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  if (e.touches && e.touches.length) {
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
  }
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function startCrop(e) {
  if (!cropMode) return;
  e.preventDefault();
  cropStart = getPos(e);
  cropEnd = { ...cropStart };
  drawImage();
}

function moveCrop(e) {
  if (!cropMode || !cropStart) return;
  e.preventDefault();
  cropEnd = getPos(e);
  drawImage();
}

function endCrop(e) {
  if (!cropMode) return;
  e.preventDefault();
  if (!cropStart || !cropEnd) return;
  drawImage();
}

canvas.addEventListener("mousedown", startCrop);
canvas.addEventListener("mousemove", moveCrop);
canvas.addEventListener("mouseup", endCrop);

canvas.addEventListener("touchstart", startCrop, { passive: false });
canvas.addEventListener("touchmove", moveCrop, { passive: false });
canvas.addEventListener("touchend", endCrop, { passive: false });

document.getElementById("cropMode").onclick = () => {
  cropMode = !cropMode;
  cropStart = null;
  cropEnd = null;
  drawImage();
};

document.getElementById("applyCrop").onclick = () => {
  if (!cropStart || !cropEnd) return;

  const x = Math.min(cropStart.x, cropEnd.x);
  const y = Math.min(cropStart.y, cropEnd.y);
  const w = Math.abs(cropEnd.x - cropStart.x);
  const h = Math.abs(cropEnd.y - cropStart.y);
  if (w < 10 || h < 10) return;

  const temp = document.createElement("canvas");
  temp.width = w;
  temp.height = h;
  const tctx = temp.getContext("2d");
  tctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

  img.src = temp.toDataURL("image/jpeg");
  img.onload = () => {
    canvas.width = w;
    canvas.height = h;
    cropMode = false;
    cropStart = cropEnd = null;
    drawImage();
  };
};

// uložení – přepíše soubor v R2
document.getElementById("save").onclick = async () => {
  const blob = await new Promise(resolve =>
    canvas.toBlob(resolve, "image/jpeg", 0.95)
  );

  const res = await fetch(`/api/photo/${encodeURIComponent(filename)}`, {
    method: "PUT",
    body: blob
  });

  if (res.ok) {
    alert("Uloženo");
    window.location.href = "/admin/gallery/";
  } else {
    alert("Chyba ukládání");
  }
};

// zpět
document.getElementById("back").onclick = () => {
  window.location.href = "/admin/gallery/";
};
