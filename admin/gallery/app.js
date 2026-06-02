// /admin/gallery/app.js

const gallery = document.getElementById("gallery");

async function loadGallery() {
    gallery.innerHTML = "<p>Načítám...</p>";

    let res = await fetch("/api/photo");
    let photos = await res.json();

    gallery.innerHTML = "";

    photos.forEach(p => {
        // 1) Ignoruj neobrázkové soubory
        if (!p.filename.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
            console.warn("Ignoruji neobrázek:", p.filename);
            return;
        }

        const item = document.createElement("div");
        item.className = "item";

        const img = document.createElement("img");
        img.src = p.url;
        img.className = "thumb";
        img.alt = p.filename;

        // 2) Pokud se obrázek nenačte → nezastaví to galerii
        img.onerror = () => {
            console.error("Chyba načítání obrázku:", p.url);
            img.style.opacity = "0.3";
            img.title = "Chyba načítání";
        };

        const name = document.createElement("div");
        name.textContent = p.filename;

        const del = document.createElement("button");
        del.textContent = "Smazat";
        del.onclick = () => deletePhoto(p.filename);

        item.appendChild(img);
        item.appendChild(name);
        item.appendChild(del);

        gallery.appendChild(item);
    });
}

async function deletePhoto(filename) {
    if (!confirm("Smazat " + filename + "?")) return;

    await fetch(`/api/photo/${filename}/delete`, { method: "POST" });
    loadGallery();
}

loadGallery();
