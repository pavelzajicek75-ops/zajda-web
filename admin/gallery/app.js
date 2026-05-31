let selected = new Set();
let mode = "grid";
let allPhotos = [];

function formatSize(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function updateSelectedCount() {
  document.getElementById("selectedCount").textContent =
    `Vybráno: ${selected.size}`;
}

async function loadGallery() {
  const res = await fetch("/api/photos");
  const data = await res.json();

  allPhotos = data.photos || [];

  const gallery = document.getElementById("gallery");
  gallery.className = mode;
  gallery.innerHTML = "";
  selected.clear();
  updateSelectedCount();

  document.getElementById("photoCount").textContent = `${data.totalCount} fotek`;
  document.getElementById("photoSize").textContent = formatSize(data.totalSize);

  allPhotos.forEach(photo => {
    const item = document.createElement("div");
    item.className = "item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("click", e => {
      e.stopPropagation();
      if (checkbox.checked) selected.add(photo.name);
      else selected.delete(photo.name);
      updateSelectedCount();
    });

    const img = document.createElement("img");
    img.src = `/api/photo/${photo.name}`;
    img.addEventListener("click", () => openModal(photo));

    const del = document.createElement("button");
    del.className = "delete-icon";
    del.textContent = "🗑️";
    del.addEventListener("click", async e => {
      e.stopPropagation();
      await deletePhoto(photo.name);
    });

    item.appendChild(checkbox);
    item.appendChild(img);
    item.appendChild(del);

    gallery.appendChild(item);
  });
}

async function deletePhoto(name) {
  await fetch(`/api/delete?name=${encodeURIComponent(name)}`, {
    method: "DELETE"
  });
  loadGallery();
}

async function deleteSelected() {
  for (const name of selected) {
    await fetch(`/api/delete?name=${encodeURIComponent(name)}`, {
      method: "DELETE"
    });
  }
  loadGallery();
}

async function uploadFiles(files) {
  const form = new FormData();
  for (const file of files) form.append("file", file);

  await fetch("/api/upload", {
    method: "POST",
    body: form
  });

  loadGallery();
}

function openModal(photo) {
  document.getElementById("modalImg").src = `/api/photo/${photo.name}`;
  document.getElementById("modalName").textContent = photo.name;
  document.getElementById("modalResolution").textContent =
    `${photo.width} × ${photo.height}`;
  document.getElementById("modalExif").textContent =
    `ISO: ${photo.exif?.iso || "-"} | Clona: ${photo.exif?.aperture || "-"} | Čas: ${photo.exif?.exposure || "-"}`;
  document.getElementById("modalTags").textContent =
    `${photo.tags?.join(", ") || "-"}`;

  document.getElementById("modal").classList.remove("hidden");
}

window.addEventListener("load", () => {
  loadGallery();

  document.getElementById("refreshBtn").addEventListener("click", loadGallery);
  document.getElementById("deleteSelectedBtn").addEventListener("click", deleteSelected);

  document.getElementById("uploadBtn").addEventListener("click", () => {
    document.getElementById("fileInput").click();
  });

  document.getElementById("fileInput").addEventListener("change", e => {
    uploadFiles(e.target.files);
  });

  document.getElementById("modeGrid").addEventListener("click", () => {
    mode = "grid";
    loadGallery();
  });

  document.getElementById("modeLarge").addEventListener("click", () => {
    mode = "large";
    loadGallery();
  });

  document.getElementById("modeList").addEventListener("click", () => {
    mode = "list";
    loadGallery();
  });

  document.getElementById("closeModal").addEventListener("click", () => {
    document.getElementById("modal").classList.add("hidden");
  });

  document.getElementById("selectAllBtn").addEventListener("click", () => {
    selected = new Set(allPhotos.map(p => p.name));
    updateSelectedCount();
    loadGallery();
  });
});
// rebuild
// rebuild v24
