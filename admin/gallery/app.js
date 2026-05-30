async function loadPhotos() {
  const res = await fetch("/api/photos");
  const photos = await res.json();
  const gallery = document.getElementById("gallery");
  gallery.innerHTML = "";
  photos.forEach(photo => {
    const container = document.createElement("div");
    container.className = "photo-item";

    const img = document.createElement("img");
    img.src = photo.url;   // <<< musí být URL, ne jen name
    img.alt = photo.name;
    img.className = "gallery-photo";

    const caption = document.createElement("p");
    caption.textContent = photo.name;

    container.appendChild(img);
    container.appendChild(caption);
    gallery.appendChild(container);
  });
}
