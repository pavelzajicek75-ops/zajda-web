// /admin/gallery/app.js

const galleryContainer = document.getElementById("gallery");

async function loadGallery() {
    galleryContainer.innerHTML = "<p>Načítám...</p>";

    const res = await fetch("/api/photo");
    const photos = await res.json();

    galleryContainer.innerHTML = "";

    photos.forEach(p => {
        const item = document.createElement("div");
        item.className = "photo-item";

        const img = document.createElement("img");
        img.src = p.url;
        img.className = "thumb";

        const filename = document.createElement("div");
        filename.textContent = p.filename;
        filename.className = "filename";

        const btnRow = document.createElement("div");
        btnRow.className = "btn-row";

        // SMAZAT
        const del = document.createElement("button");
        del.textContent = "Smazat";
        del.onclick = () => deletePhoto(p.filename);

        // UPRAVIT
        const edit = document.createElement("button");
        edit.textContent = "Upravit";
        edit.onclick = () => {
            window.location.href = `/admin/editor/?file=${encodeURIComponent(p.filename)}`;
        };

        btnRow.appendChild(edit);
        btnRow.appendChild(del);

        item.appendChild(img);
        item.appendChild(filename);
        item.appendChild(btnRow);

        galleryContainer.appendChild(item);
    });
}

async function deletePhoto(filename) {
    if (!confirm(`Opravdu smazat ${filename}?`)) return;

    const res = await fetch(`/api/photo/${filename}`, {
        method: "DELETE"
    });

    if (res.ok) {
        loadGallery();
    } else {
        alert("Chyba při mazání.");
    }
}

loadGallery();
