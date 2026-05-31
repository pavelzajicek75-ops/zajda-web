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
  photoSize.text
