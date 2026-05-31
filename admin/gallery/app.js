let selected = new Set();
let mode = "grid";
let allPhotos = [];
let theme = "light";

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
  const photoCount = document.getElementById("photoCount");
  const photoSize = document.getElementById("photoSize");

  gallery.className = mode;
  gallery.innerHTML = "";
  selected.clear();
  updateSelectedCount();

  photoCount.textContent = `${data.totalCount} fotek`;
  photoSize.textContent = formatSize(data.totalSize);

  allPhotos.forEach(photo => {
    const item = document.createElement("div");
    item.className = "item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selected.add(photo.name);
        item.classList.add("selected");
      } else {
        selected.delete(photo.name);
        item.classList.remove("selected");
      }
      updateSelectedCount();
    });

    const img = document.createElement("img");
    img.src = photo.url;
    img.alt = photo.name;
    img.addEventListener("click", () => openModal(photo, img));

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = photo.name;

    const deleteIcon = document.createElement("button");
    deleteIcon.className = "delete-icon";
    deleteIcon.textContent = "🗑️";
    deleteIcon.addEventListener("click", async (e) => {
      e.stopPropagation();
      await deleteOne(photo.name);
    });

    if (mode === "list") {
      const info = document.createElement("div");
      info.className = "list-info";

      info.innerHTML = `
        <div class="list-name">${photo.name}</div>
        <div class="list-size">${formatSize(photo.size)}</div>
        <div class="list-exif">
          ISO: ${photo.exif?.iso || "-"},
          čas: ${photo.exif?.shutter || "-"},
          clona: ${photo.exif?.aperture || "-"},
          ohnisko: ${photo.exif?.focal || "-"},
          datum: ${photo.exif?.date || "-"}
        </div>
      `;

      item.appendChild(checkbox);
      item.appendChild(img);
      item.appendChild(info);
      item.appendChild(deleteIcon);
    } else {
      item.appendChild(checkbox);
      item.appendChild(img);
      item.appendChild(label);
      item.appendChild(deleteIcon);
    }

    gallery.appendChild(item);
  });
}

function openModal(photo, imgEl) {
  const modal = document.getElementById("modal");
  const modalImg = document.getElementById("modalImg");
  const modalName = document.getElementById("modalName");
  const modalResolution = document.getElementById("modalResolution");
  const modalExif = document.getElementById("modalExif");
  const modalTags = document.getElementById("modalTags");

  modalImg.src = photo.url;
  modalName.textContent = photo.name;

  const w = imgEl.naturalWidth;
  const h = imgEl.naturalHeight;
  modalResolution.textContent = `Rozlišení: ${w} × ${h}`;

  const exif = photo.exif || {};
  modalExif.innerHTML = `
    <p><b>Velikost:</b> ${formatSize(photo.size)}</p>
    <p><b>ISO:</b> ${exif.iso || "-"}</p>
    <p><b>Čas:</b> ${exif.shutter || "-"}</p>
    <p><b>Clona:</b> ${exif.aperture || "-"}</p>
    <p><b>Ohnisko:</b> ${exif.focal || "-"}</p>
    <p><b>Datum:</b> ${exif.date || "-"}</p>
  `;

  const tags = photo.tags || [];
  modalTags.textContent = tags.length ? `Tagy: ${tags.join(", ")}` : "";

  modal.classList.remove("hidden");
}

async function uploadFiles(files) {
  for (const file of files) {
    const form = new FormData();
    form.append("file", file);
    await fetch("/api/upload", {
      method: "POST",
      body: form
    });
  }
  await loadGallery();
}

async function deleteSelected() {
  if (selected.size === 0) return;

  await fetch("/api/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys: [...selected] })
  });

  await loadGallery();
}

async function deleteOne(name) {
  await fetch("/api/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys: [name] })
  });

  await loadGallery();
}

function toggleTheme() {
  const body = document.body;
  if (theme === "light") {
    theme = "dark";
    body.classList.remove("light");
    body.classList.add("dark");
  } else {
    theme = "light";
    body.classList.remove("dark");
    body.classList.add("light");
  }
}

function selectAll() {
  const gallery = document.getElementById("gallery");
  const items = gallery.querySelectorAll(".item");
  const checkboxes = gallery.querySelectorAll('input[type="checkbox"]');

  if (selected.size === allPhotos.length && allPhotos.length > 0) {
    selected.clear();
    items.forEach(i => i.classList.remove("selected"));
    checkboxes.forEach(c => (c.checked = false));
  } else {
    selected = new Set(allPhotos.map(p => p.name));
    items.forEach(i => i.classList.add("selected"));
    checkboxes.forEach(c => (c.checked = true));
  }

  updateSelectedCount();
}

document.addEventListener("DOMContentLoaded", () => {
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

  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
  document.getElementById("selectAllBtn").addEventListener("click", selectAll);
});

