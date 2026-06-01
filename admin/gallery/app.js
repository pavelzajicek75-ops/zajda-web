// rebuild gallery v5 – full working delete, list/grid/large, EXIF, modal

let selected = new Set();
let mode = "grid";
let allPhotos = [];

// -----------------------------
// Pomocné funkce
// -----------------------------
function updateSelectedCount() {
  document.getElementById("selectedCount").textContent =
    `Vybráno: ${selected.size}`;
}

function formatSize(bytes) {
  if (!bytes) return "0 MB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

// -----------------------------
// Načtení galerie
// -----------------------------
async function loadGallery() {
  try {
    const res = await fetch("/api/photos");
    if (!res.ok) {
      console.error("Chyba /api/photos:", await res.text());
      return;
    }

    const data = await res.json();
    allPhotos = data.photos || [];

    const gallery = document.getElementById("gallery");
    gallery.className = mode;
    gallery.innerHTML = "";
    selected.clear();
    updateSelectedCount();

    document.getElementById("photoCount").textContent =
      `${data.totalCount} fotek`;
    document.getElementById("photoSize").textContent =
      formatSize(data.totalSize);

    allPhotos.forEach(photo => {
      const item = document.createElement("div");
      item.className = "item";

      // checkbox
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.addEventListener("click", e => {
        e.stopPropagation();
        checkbox.checked ? selected.add(photo.name) : selected.delete(photo.name);
        updateSelectedCount();
      });

      // obrázek
      const img = document.createElement("img");
      img.src = `/api/photo/${encodeURIComponent(photo.name)}`;
      img.alt = photo.name;
      img.addEventListener("click", () => openModal(photo));

      // delete button
      const del = document.createElement("button");
      del.className = "delete-icon";
      del.textContent = "🗑️";
      del.addEventListener("click", async e => {
        e.stopPropagation();
        await deletePhoto(photo.name);
      });

      // info blok
      const info = document.createElement("div");
      info.className = "info";

      const exif = photo.exif || {};
      info.innerHTML = `
        <strong>${photo.name}</strong><br>
        ${photo.width || "?"}×${photo.height || "?"}<br>
        ISO ${exif.iso ?? "-"}, f/${exif.aperture ?? "-"}, ${exif.exposure ?? "-"}
      `;

      item.appendChild(checkbox);
      item.appendChild(img);

      if (mode === "list") {
        item.appendChild(info);
        item.appendChild(del);
      } else {
        item.appendChild(del);
        item.appendChild(info);
      }

      gallery.appendChild(item);
    });

  } catch (err) {
    console.error("Chyba loadGallery:", err);
  }
}

// -----------------------------
// MAZÁNÍ FOTKY
// -----------------------------
async function deletePhoto(name) {
  try {
    const res = await fetch(`/api/photo/${encodeURIComponent(name)}`, {
      method: "DELETE"
    });

    if (!res.ok) {
      console.error("Mazání selhalo:", await res.text());
      return;
    }

    await loadGallery();

  } catch (err) {
    console.error("Chyba při mazání:", err);
  }
}

// -----------------------------
// MAZÁNÍ VÍCE FOTEK
// -----------------------------
async function deleteSelected() {
  for (const name of selected) {
    await fetch(`/api/photo/${encodeURIComponent(name)}`, {
      method: "DELETE"
    });
  }
  await loadGallery();
}

// -----------------------------
// UPLOAD
// -----------------------------
async function uploadFiles(files) {
  if (!files || files.length === 0) return;

  const form = new FormData();
  for (const file of files) form.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: form
  });

  if (!res.ok) {
    console.error("Upload selhal:", await res.text());
    return;
  }

  await loadGallery();
}

// -----------------------------
// MODAL
// -----------------------------
function openModal(photo) {
  document.getElementById("modalImg").src =
    `/api/photo/${encodeURIComponent(photo.name)}`;
  document.getElementById("modalName").textContent = photo.name;
  document.getElementById("modalResolution").textContent =
    `${photo.width || "?"} × ${photo.height || "?"}`;

  const exif = photo.exif || {};
  document.getElementById("modalExif").textContent =
    `ISO ${exif.iso ?? "-"}, f/${exif.aperture ?? "-"}, ${exif.exposure ?? "-"}`;

  document.getElementById("modal").classList.remove("hidden");
}

// -----------------------------
// INIT
// -----------------------------
window.addEventListener("load", () => {
  loadGallery();

  document.getElementById("refreshBtn").onclick = loadGallery;
  document.getElementById("deleteSelectedBtn").onclick = deleteSelected;

  document.getElementById("uploadBtn").onclick = () =>
    document.getElementById("fileInput").click();

  document.getElementById("fileInput").onchange = e =>
    uploadFiles(e.target.files);

  document.getElementById("modeGrid").onclick = () => { mode = "grid"; loadGallery(); };
  document.getElementById("modeLarge").onclick = () => { mode = "large"; loadGallery(); };
  document.getElementById("modeList").onclick = () => { mode = "list"; loadGallery(); };

  document.getElementById("closeModal").onclick = () =>
    document.getElementById("modal").classList.add("hidden");
});
