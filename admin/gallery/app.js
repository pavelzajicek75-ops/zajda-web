document.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch("/api/photos");
  const photos = await res.json();
  const gallery = document.getElementById("gallery");

  photos.forEach(photo => {
    const img = document.createElement("img");
    // Použij skutečný public endpoint pro svůj bucket
    img.src = `https://pub-04881c4bbea24b2ab23b9be5a7bd0aa1.r2.dev/${photo.name}`;
    img.alt = photo.name;
    gallery.appendChild(img);
  });
});
