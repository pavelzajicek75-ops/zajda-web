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
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(cropStart.x, cropStart.y, cropEnd.x - cropStart.x, cropEnd.y - cropStart.y);
  }
}

function applySharpness() {
  const w = canvas.width, h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const out = new Uint8ClampedArray(data.length);
  const kernel = [0, -1, 0, -1, 5 + effects.sharpness, -1, 0, -1, 0];
  const side = 3, half = 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const px = x + kx, py = y + ky;
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
["brightness","contrast","saturation","vibrance","sharpness","denoise"].forEach(id=>{
  document.getElementById(id).oninput=e=>{
    effects[id]=Number(e.target.value);
    drawImage();
  };
});

// AI funkce
document.getElementById("aiEnhance").onclick=()=>{
  Object.assign(effects,{brightness:110,contrast:120,saturation:115,vibrance:20,sharpness:3,denoise:2});
  updateSliders(); drawImage();
};
document.getElementById("hdr").onclick=()=>{
  Object.assign(effects,{brightness:120,contrast:140,saturation:130,vibrance:40,sharpness:4,denoise:1});
  updateSliders(); drawImage();
};
document.getElementById("portrait").onclick=()=>{
  Object.assign(effects,{brightness:110,contrast:105,saturation:115,vibrance:30,sharpness:2,denoise:3});
  updateSliders(); drawImage();
};
document.getElementById("upscale").onclick=()=>{
  const temp=document.createElement("canvas");
  temp.width=canvas.width*2; temp.height=canvas.height*2;
  const tctx=temp.getContext("2d");
  tctx.imageSmoothingEnabled=true; tctx.imageSmoothingQuality="high";
  tctx.drawImage(canvas,0,0,temp.width,temp
