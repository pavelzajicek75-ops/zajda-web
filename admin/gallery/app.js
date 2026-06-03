// /admin/gallery/app.js

const gallery = document.getElementById("gallery");

async function loadGallery() {
    gallery.innerHTML = "<p>Načítám...</p>";

    const res = await fetch("/api/photo");
    const photos = await res.json();

    gallery.innerHTML = "";

    photos.forEach(p => {
        const item = document.createElement("div");
        item.className = "item";

        const img = document.createElement("img");
        img.src = p.url + "?t=" + Date.now(); // obejde cache
        img.className = "thumb";

        const name = document.createElement("div");
        name.textContent = p.filename;

        const edit = document.createElement("button");
        edit.textContent = "Upravit";
        edit.onclick = () => {
            window.location.href = `/admin/editor/?file=${encodeURIComponent(p.filename)}`;
        };

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

    await fetch(`/api/photo/${filename}`, { method: "DELETE" });
    loadGallery();
}

loadGallery();
