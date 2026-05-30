async function loadPhotos() {
  try {
    const res = await fetch("/api/photos");
    const photos = await res.json();
    const gallery = document.getElementById("gallery");
    gallery.innerHTML = "";

    photos.forEach(photo => {
      const container = document.createElement("div");
      container.className = "photo-item";

      const img = document.createElement("img");
      img.src = photo.url;   // URL z API
      img.alt = photo.name;
      img.className = "gallery-photo";

      const caption = document.createElement("p");
      caption.textContent = photo.name;

      container.appendChild(img);
      container.appendChild(caption);
      gallery.appendChild(container);
    });
  } catch (err) {
    console.error("Chyba při načítání fotek:", err);
  }
}

document.addEventListener("DOMContentLoaded", loadPhotos);
