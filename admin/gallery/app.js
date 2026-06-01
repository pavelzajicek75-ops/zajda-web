let selected = new Set();
let mode = "grid";
let allPhotos = [];

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

  document.getElementById("photoCount").textContent =
    `${data.totalCount} fotek`;
  document.getElementById("photoSize").textContent =
    `${(data.totalSize / 1024 / 1024).toFixed(2)} MB`;

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
    img.addEventListener("click", () => openModal(photo));

    const del = document.createElement("button");
    del.className = "delete-icon";
    del.textContent = "🗑️";
    del.addEventListener("click", async e => {
      e.stopPropagation();
      await deletePhoto(photo.name);
    });

    const info = document.createElement("div");
    info.className = "info";

    const exif = photo.exif || {};
    info.innerHTML = `
      <strong>${photo.name}</strong><br>
      ${photo.width}×${photo.height}<br>
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
}

async function deletePhoto(name) {
  const res = await fetch(`/api/delete?name=${encodeURIComponent(name)}`, {
    method: "DELETE"
  });

  if (res.ok) loadGallery();
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
  for (const f of files) form.append("file", f);

  await fetch("/api/upload", {
    method: "POST",
    body: form
  });

  loadGallery();
}

function openModal(photo) {
  document.getElementById("modalImg").src =
    `/api/photo/${encodeURIComponent(photo.name)}`;
  document.getElementById("modalName").textContent = photo.name;
  document.getElementById("modalResolution").textContent =
    `${photo.width} × ${photo.height}`;

  const exif = photo.exif || {};
  document.getElementById("modalExif").textContent =
    `ISO ${exif.iso ?? "-"}, f/${exif.aperture ?? "-"}, ${exif.exposure ?? "-"}`;

  document.getElementById("modal").classList.remove("hidden");
}

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
