// /admin/gallery/app.js

const gallery = document.getElementById("gallery");
const deleteSelectedBtn = document.getElementById("deleteSelected");
const editSelectedBtn = document.getElementById("editSelected");
const viewModeSelect = document.getElementById("viewMode");
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");

const photoCountEl = document.getElementById("photoCount");
const totalSizeEl = document.getElementById("totalSize");

let photos = [];
let selected = new Set();

async function loadGallery() {
  gallery.innerHTML = "<p style='padding:20px;'>Načítám...</p>";

  const res = await fetch("/api/photo?" + Date.now());
  photos = await res.json();

  updateStats();
  renderGallery();
}

function updateStats() {
  photoCountEl.textContent = `${photos.length} fotek`;

  const totalBytes = photos.reduce((sum, p) => sum + (p.size || 0), 0);
  const mb = (totalBytes / (1024 * 1024)).toFixed(2);

  totalSizeEl.textContent = `${mb} MB`;
}

// 🔥 DOPLNĚNO — vložení fotky do editoru článků
function selectPhoto(url) {
  if (window.parent && typeof window.parent.insertPhoto === "function") {
    window.parent.insertPhoto(url);
  } else {
    alert("Editor článků není dostupný.");
  }
}

function renderGallery() {
  gallery.innerHTML = "";

  photos.forEach(p => {
    const item = document.createElement("div");
    item.className = "item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "checkbox";
    checkbox.checked = selected.has(p.filename);
    checkbox.onchange = () => {
      if (checkbox.checked) selected.add(p.filename);
      else selected.delete(p.filename);
    };

    const img = document.createElement("img");
    img.src = `/api/photo/${encodeURIComponent(p.filename)}?t=` + Date.now();
    img.className = "thumb";

    // 🔥 DOPLNĚNO — kliknutí vloží fotku do článku
    img.onclick = () => {
      const url = `/api/photo/${encodeURIComponent(p.filename)}`;
      selectPhoto(url);
    };

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = p.filename;

    const controls = document.createElement("div");
    controls.className = "controls";

    const edit = document.createElement("button");
    edit.textContent = "Upravit";
    edit.onclick = () => {
      const safeFile = encodeURIComponent(p.filename.trim());
      window.location.href = `/admin/editor/?file=${safeFile}`;
    };

    const del = document.createElement("button");
    del.textContent = "Smazat";
    del.onclick = () => deletePhoto(p.filename);

    controls.append(edit, del);
    item.append(checkbox, img, name, controls);
    gallery.appendChild(item);
  });
}

deleteSelectedBtn.onclick = async () => {
  if (selected.size === 0) return alert("Nic není vybráno");

  if (!confirm(`Smazat ${selected.size} fotek?`)) return;

  for (const f of selected) {
    await fetch(`/api/photo/${encodeURIComponent(f)}`, { method: "DELETE" });
  }

  photos = photos.filter(p => !selected.has(p.filename));
  selected.clear();
  updateStats();
  renderGallery();
};

editSelectedBtn.onclick = () => {
  if (selected.size === 0) return alert("Nic není vybráno");

  const arr = [...selected];
  const safeFile = encodeURIComponent(arr[0].trim());
  window.location.href = `/admin/editor/?file=${safeFile}`;
};

viewModeSelect.onchange = () => {
  gallery.className = viewModeSelect.value;
};

uploadBtn.onclick = () => fileInput.click();

fileInput.onchange = async () => {
  await uploadFiles(fileInput.files);
};

document.body.ondragover = e => {
  e.preventDefault();
  dropzone.style.display = "block";
};

document.body.ondrop = async e => {
  e.preventDefault();
  dropzone.style.display = "none";
  await uploadFiles(e.dataTransfer.files);
};

async function uploadFiles(files) {
  for (const file of files) {
    const safeName = normalizeFilename(file.name);

    await fetch(`/api/photo/${encodeURIComponent(safeName)}`, {
      method: "PUT",
      body: file
    });

    photos.push({
      filename: safeName,
      size: file.size,
      url: `/api/photo/${encodeURIComponent(safeName)}`
    });
  }

  updateStats();
  renderGallery();
}

function normalizeFilename(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .trim();
}

loadGallery();
