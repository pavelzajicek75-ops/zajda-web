async function loadGallery() {
  const response = await fetch("/api/photos");
  const photos = await response.json();

  const gallery = document.getElementById("gallery");
  gallery.innerHTML = "";

  photos.forEach(photo => {
    const img = document.createElement("img");
    img.src = photo.url;
    img.alt = photo.name;
    gallery.appendChild(img);
  });
}

loadGallery();
