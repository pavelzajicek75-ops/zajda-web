// /admin/gallery/picker.js

document.addEventListener("DOMContentLoaded", loadGallery);

async function loadGallery() {
  try {
    const res = await authenticatedFetch("/api/photos/list");
    if (!res) return;

    const data = await res.json();
    const container = document.getElementById("gallery");

    data.photos.forEach(photo => {
      const img = document.createElement("img");
      img.src = photo.url;
      img.onclick = () => selectImage(photo.url);
      container.appendChild(img);
    });

  } catch (err) {
    console.error("Chyba při načítání galerie:", err);
  }
}

function selectImage(url) {
  window.opener.postMessage({ type: "imageSelected", url }, "*");
  window.close();
}
