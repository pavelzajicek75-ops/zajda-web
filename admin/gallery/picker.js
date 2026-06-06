// /admin/gallery/picker.js

document.addEventListener("DOMContentLoaded", loadGallery);

async function loadGallery() {
  try {
    const res = await authenticatedFetch("/api/photos/list");
    if (!res || !res.ok) {
      console.error("Chyba při načítání fotek", res && res.status);
      return;
    }

    const data = await res.json();
    const container = document.getElementById("gallery");
    container.innerHTML = "";

    (data.photos || []).forEach(photo => {
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
  if (window.opener) {
    window.opener.postMessage({ type: "imageSelected", url }, "*");
  }
  window.close();
}
