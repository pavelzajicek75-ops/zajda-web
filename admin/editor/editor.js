let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");
let originalImage = null;
let currentImage = null;
let currentFilename = null;

async function openGallery() {
    let modal = document.getElementById("galleryModal");
    let box = document.getElementById("galleryBox");

    box.innerHTML = "<h2>Načítám...</h2>";

    modal.style.display = "flex";

    let res = await fetch("/api/photo");
    let photos = await res.json();

    box.innerHTML = "";

    photos.forEach(p => {
        let img = document.createElement("img");
        img.src = p.url;
        img.className = "thumb";
        img.onclick = () => loadImage(p.url, p.filename);
        box.appendChild(img);
    });
}

function loadImage(url, filename) {
    currentFilename = filename;

    let img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        originalImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
        currentImage = originalImage;
    };
    img.src = url;

    document.getElementById("galleryModal").style.display = "none";
}

function resetImage() {
    if (!originalImage) return;
    ctx.putImageData(originalImage, 0, 0);
}

async function saveToGallery() {
    if (!currentFilename) {
        alert("Není načtená žádná fotka.");
        return;
    }

    canvas.toBlob(async blob => {
        let res = await fetch(`/api/photo/${currentFilename}`, {
            method: "PUT",
            body: blob
        });

        if (res.ok) {
            alert("Uloženo!");
        } else {
            alert("Chyba při ukládání.");
        }
    }, "image/jpeg", 0.95);
}
