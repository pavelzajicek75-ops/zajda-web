const gallery = document.getElementById("gallery");

async function loadGallery() {
    gallery.innerHTML = "<p>Načítám...</p>";

    const res = await fetch("/api/photo");
    const photos = await res.json();

    gallery.innerHTML = "";

    photos.forEach(p => {
        // Ignoruj neobrázkové soubory (např. .json, .txt)
        if (!p.filename.match(/\.(jpg|jpeg|png|webp)$/i)) return;

        const item = document.createElement("div");
        item.className = "item";

        const img = document.createElement("img");
        img.src = p.url;
        img.className = "thumb";
        img.alt = p.filename;

        img.onerror = () => {
            console.warn("Chyba načítání:", p.filename);
            item.style.opacity = "0.3";
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
