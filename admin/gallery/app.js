let selected = new Set();

function formatSize(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

async function loadGallery() {
  const response = await fetch("/api/photos");
  const data = await response.json();

  const gallery = document.getElementById("gallery");
  const photoCount = document.getElementById("photoCount");
  const photoSize = document.getElementById("photoSize");

  gallery.innerHTML = "";
  selected.clear();

  photoCount.textContent = `${data.totalCount} fotek`;
  photoSize.textContent = formatSize(data.totalSize);

  data.photos.forEach(photo => {
    const item = document.createElement("div");
    item.className = "item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selected.add(photo.name);
      else selected.delete(photo.name);
    });

    const img = document.createElement("img");
    img.src = photo.url;

    item.appendChild(checkbox);
    item.appendChild(img);
    gallery.appendChild(item);
  });
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
  loadGallery();
}

async function deleteSelected() {
  if (selected.size === 0) return;

  await fetch("/api/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys: [...selected] })
  });

  loadGallery();
}

document.addEventListener("DOMContentLoaded", () => {
  loadGallery();

  document.getElementById("refreshBtn").addEventListener("click", loadGallery);

  document.getElementById("uploadBtn").addEventListener("click", () => {
    document.getElementById("fileInput").click();
  });

  document.getElementById("fileInput").addEventListener("change", (e) => {
    uploadFiles(e.target.files);
  });

  document.getElementById("deleteSelectedBtn").addEventListener("click", deleteSelected);
});
