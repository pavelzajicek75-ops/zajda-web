// gallery rebuild v8 – delete fix + bigger list thumbnails

let selected = new Set();
let mode = "grid";
let allPhotos = [];

function updateSelectedCount() {
  document.getElementById("selectedCount").textContent =
    `Vybráno: ${selected.size}`;
}

function formatSize(bytes) {
  if (!bytes) return "0 MB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
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

  document.getElementById("photoCount").textContent =
    `${data.totalCount} fotek`;
  document.getElementById("photoSize").textContent =
    formatSize(data.totalSize);

  allPhotos.forEach(photo => {
    const item = document.createElement("div");
    item.className = "item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("click", e => {
      e.stopPropagation();
      checkbox.checked ? selected.add(photo.name) : selected.delete(photo.name);
      updateSelectedCount();
    });

    const img = document.createElement("img");
    img.src = `/api/photo/${encodeURIComponent(photo.name)}`;
    img.alt = photo.name;
    img.addEventListener("click", () => openModal(photo));

    const del = document.createElement("button");
    del.className = "delete-icon";
    del.textContent = "🗑️";
    del.addEventListener("click", async e => {
      e.stopPropagation();
      await deletePhoto(photo.name);
    });

    const info = document.createElement("div");
    info.className =
