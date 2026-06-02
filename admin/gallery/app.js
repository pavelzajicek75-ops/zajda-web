// /admin/gallery/app.js

const gallery = document.getElementById("gallery");

async function loadGallery() {
    gallery.innerHTML = "<p>Načítám...</p>";

    let res = await fetch("/api/photo");
    let photos = await res.json();

    gallery.innerHTML = "";

    photos.forEach(p => {
        // 1) Ignoruj neobrázky
        if (!p.filename.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
            console.warn("Ignoruji neobrázek:", p.filename);
            return;
        }

        const item = document.createElement("div");
        item.className = "item";

        // Obrázek
        const img = document.createElement("img");
        img.src = p.url;
        img.className = "thumb";
        img.alt = p.filename;

        img.onerror = () => {
            console.error("Chyba načítání obrázku:", p.url);
            img.style.opacity = "0.3";
            img.title = "Chyba načítání";
        };

        // Název
        const name = document.createElement("div");
        name.textContent = p.filename;

        // Tlačítko UPRAVIT
        const edit = document.createElement("button");
        edit.textContent = "Upravit";
        edit.onclick = () => {
            window.location.href = `/admin/editor/?file=${encodeURIComponent(p.filename)}`;
        };

        // Tlačítko SMAZAT
        const del = document.createElement("button");
        del.textContent = "Smazat";
        del.onclick = () => deletePhoto(p.filename);

        item.appendChild(img);
        item.appendChild(name);
        item.appendChild(edit);
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
