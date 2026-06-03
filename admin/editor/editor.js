// /admin/editor/editor.js

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const filename = new URLSearchParams(window.location.search).get("file");
document.getElementById("filename").textContent = "Soubor: " + filename;

const brightnessSlider = document.getElementById("brightness");
const contrastSlider = document.getElementById("contrast");
const saturationSlider = document.getElementById("saturation");
const vibranceSlider = document.getElementById("vibrance");
const sharpnessSlider = document.getElementById("sharpness");
const denoiseSlider = document.getElementById("denoise");

const rotateLeftBtn = document.getElementById("rotateLeft");
const rotateRightBtn = document.getElementById("rotateRight");
const cropModeBtn = document.getElementById("cropMode");
const applyCropBtn = document.getElementById("applyCrop");
const saveBtn = document.getElementById("save");
const backBtn = document.getElementById("back");

const aiEnhanceBtn = document.getElementById("aiEnhance");
const hdrBtn = document.getElementById("hdr");
const portraitBtn = document.getElementById("portrait");
const upscaleBtn = document.getElementById("upscale");

let img = new Image();
let rotation = 0;

let effects = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    vibrance: 0,
    sharpness: 0,
    denoise: 0,
    filter: "none"
};

let cropMode = false;
let cropStart = null;
let cropEnd = null;

// načtení obrázku z API
img.crossOrigin = "anonymous";
img.src = `/api/photo/${encodeURIComponent(filename)}`;

img.onload = () => {
    const maxW = 2000;
    const scale = Math.min(1, maxW / img.width);

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

    if (effects.vibrance !== 0) {
        filter += ` saturate(${100 + effects.vibrance}%)`;
    }

    if (effects.denoise > 0) {
        filter += ` blur(${effects.denoise}px)`;
    }

    if (effects.filter === "warm") filter += " sepia(20%)";
    if (effects.filter === "cool") filter += " hue-rotate(200deg)";
    if (effects.filter === "bw") filter += " grayscale(100%)";

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

    if (effects.sharpness > 0) {
        applySharpness();
    }

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

    const s = 3;
    const half = 1;
    const amount = Number(effects.sharpness);

    const kernel = [
        0, -1, 0,
        -1, 4 + amount, -1,
        0, -1, 0
    ];

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, b = 0, a = 0;

            for (let ky = -half; ky <= half; ky++) {
                for (let kx = -half; kx <= half; kx++) {
                    const px = x + kx;
                    const py = y + ky;
                    if (px < 0 || px >= w || py < 0 || py >= h) continue;

                    const idx = (py * w + px) * 4;
                    const weight = kernel[(ky + half) * s + (kx + half)];

                    r += data[idx] * weight;
                    g += data[idx + 1] * weight;
                    b += data[idx + 2] * weight;
                    a += data[idx + 3];
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
brightnessSlider.oninput = e => {
    effects.brightness = Number(e.target.value);
    drawImage();
};
contrastSlider.oninput = e => {
    effects.contrast = Number(e.target.value);
    drawImage();
};
saturationSlider.oninput = e => {
    effects.saturation = Number(e.target.value);
    drawImage();
};
vibranceSlider.oninput = e => {
    effects.vibrance = Number(e.target.value);
    drawImage();
};
sharpnessSlider.oninput = e => {
    effects.sharpness = Number(e.target.value);
    drawImage();
};
denoiseSlider.oninput = e => {
    effects.denoise = Number(e.target.value);
    drawImage();
};

// filtry
document.querySelectorAll(".filter").forEach(btn => {
    btn.onclick = () => {
        effects.filter = btn.dataset.filter;
        drawImage();
    };
});

// rotace
rotateLeftBtn.onclick = () => {
    rotation -= 90;
    drawImage();
};
rotateRightBtn.onclick = () => {
    rotation += 90;
    drawImage();
};

// AI tlačítka
aiEnhanceBtn.onclick = () => {
    effects.brightness = 110;
    effects.contrast = 120;
    effects.saturation = 115;
    effects.vibrance = 20;
    effects.sharpness = 3;
    effects.denoise = 2;
    effects.filter = "none";

    brightnessSlider.value = effects.brightness;
    contrastSlider.value = effects.contrast;
    saturationSlider.value = effects.saturation;
    vibranceSlider.value = effects.vibrance;
    sharpnessSlider.value = effects.sharpness;
    denoiseSlider.value = effects.denoise;

    drawImage();
};

hdrBtn.onclick = () => {
    effects.brightness = 120;
    effects.contrast = 140;
    effects.saturation = 130;
    effects.vibrance = 40;
    effects.sharpness = 4;
    effects.denoise = 1;

    brightnessSlider.value = effects.brightness;
    contrastSlider.value = effects.contrast;
    saturationSlider.value = effects.saturation;
    vibranceSlider.value = effects.vibrance;
    sharpnessSlider.value = effects.sharpness;
    denoiseSlider.value = effects.denoise;

    drawImage();
};

portraitBtn.onclick = () => {
    effects.brightness = 110;
    effects.contrast = 105;
    effects.saturation = 115;
    effects.vibrance = 30;
    effects.sharpness = 2;
    effects.denoise = 3;
    effects.filter = "warm";

    brightnessSlider.value = effects.brightness;
    contrastSlider.value = effects.contrast;
    saturationSlider.value = effects.saturation;
    vibranceSlider.value = effects.vibrance;
    sharpnessSlider.value = effects.sharpness;
    denoiseSlider.value = effects.denoise;

    drawImage();
};

upscaleBtn.onclick = () => {
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

cropModeBtn.onclick = () => {
    cropMode = !cropMode;
    cropStart = null;
    cropEnd = null;
    drawImage();
};

applyCropBtn.onclick = () => {
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
saveBtn.onclick = async () => {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.95));

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
backBtn.onclick = () => {
    window.location.href = "/admin/gallery/";
};
