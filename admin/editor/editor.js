// /admin/editor/editor.js

let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");
let originalImage = null;
let currentFilename = null;

const statusText = document.getElementById("statusText");
const fileInfo = document.getElementById("fileInfo");

// Načtení parametru ?file=...
const params = new URLSearchParams(window.location.search);
const fileParam = params.get("file");

// Pokud je v URL ?file=..., rovnou načteme daný soubor
if (fileParam) {
    loadImage(`/api/photo/${encodeURIComponent(fileParam)}`, fileParam);
} else {
    setStatus("Žádný soubor není vybrán. Otevři fotku z galerie.");
}

// Otevření popup galerie
async function openGallery() {
    let modal = document.getElementById("galleryModal");
    let box = document.getElementById("galleryBox");

    box.innerHTML = "<h2>Načítám...</h2>";
    modal.style.display = "flex";

    try {
        let res = await fetch("/api/photo");
        if (!res.ok) throw new Error("Chyba API");

        let photos = await res.json();
        box.innerHTML = "<h2>Vyber fotku k úpravě</h2>";

        photos.forEach(p => {
            let img = document.createElement("img");
            img.src = p.url;
            img.className = "thumb";
            img.title = p.filename;
            img.onclick = () => {
                loadImage(p.url, p.filename);
                modal.style.display = "none";
            };
            box.appendChild(img);
        });
    } catch (e) {
        box.innerHTML = "<p>Chyba při načítání galerie.</p>";
    }
}

// Načtení obrázku do canvasu
function loadImage(url, filename) {
    currentFilename = filename;
    fileInfo.textContent = "Soubor: " + filename;
    setStatus("Načítám obrázek...");

    let img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        originalImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setStatus(`Načteno: ${filename} (${img.width}×${img.height})`);
    };
    img.onerror = () => {
        setStatus("Chyba při načítání obrázku.");
    };
    img.src = url;
}

// Reset na původní obrázek
function resetImage() {
    if (!originalImage) {
        alert("Není načtená žádná fotka.");
        return;
    }
    ctx.putImageData(originalImage, 0, 0);
    setStatus("Obrázek resetován.");
}

// Uložení zpět do galerie (R2) přes API
async function saveToGallery() {
    if (!currentFilename) {
        alert("Není načtená žádná fotka.");
        return;
    }

    setStatus("Ukládám...");

    canvas.toBlob(async blob => {
        try {
            let res = await fetch(`/api/photo/${encodeURIComponent(currentFilename)}`, {
                method: "PUT",
                body: blob
            });

            if (res.ok) {
                setStatus("Uloženo.");
                alert("Uloženo!");
            } else {
                setStatus("Chyba při ukládání.");
                alert("Chyba při ukládání.");
            }
        } catch (e) {
            setStatus("Chyba při ukládání (výjimka).");
            alert("Chyba při ukládání.");
        }
    }, "image/jpeg", 0.95);
}

// Zpět do galerie
function backToGallery() {
    window.location.href = "/admin/photos/";
}

// Pomocná funkce pro status bar
function setStatus(msg) {
    statusText.textContent = msg;
}

// Zatím jen základ – slidery jsou připravené, ale neaplikují efekty.
// Můžeme je doplnit později, až budeš chtít konkrétní úpravy (jas, kontrast, atd.).
