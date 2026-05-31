let currentMode = "grid";

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
  gallery.className = currentMode;

  photoCount.textContent = `${data.totalCount} fotek`;
  photoSize.textContent = formatSize(data.totalSize);

  data.photos.forEach(photo => {
    if (currentMode === "list") {
      const item = document.createElement("div");
      item.className = "item";

      const img = document.createElement("img");
      img.src = photo.url;

      const info = document.createElement("div");
      info.textContent = `${photo.name} — ${formatSize(photo.size)}`;

      item.appendChild(img);
      item.appendChild(info);
      gallery.appendChild(item);
    } else {
      const img = document.createElement("img");
      img.src = photo.url;
      gallery.appendChild(img);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadGallery();

  document.getElementById("refreshBtn").addEventListener("click", loadGallery);

  document.getElementById("modeGrid").addEventListener("click", () => {
    currentMode = "grid";
    loadGallery();
  });

  document.getElementById("modeLarge").addEventListener("click", () => {
    currentMode = "large";
    loadGallery();
  });

  document.getElementById("modeList").addEventListener("click", () => {
    currentMode = "list";
    loadGallery();
  });
});
