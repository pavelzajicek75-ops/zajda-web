async function loadGallery() {
  const response = await fetch("/api/photos");
  const photos = await response.json();

  const gallery = document.getElementById("gallery");
  gallery.innerHTML = "";

  photos.forEach(photo => {
    const img = document.createElement("img");
    img.src = photo.url;
    img.alt = "Photo";
    gallery.appendChild(img);
  });
}

document.addEventListener("DOMContentLoaded", loadGallery);
