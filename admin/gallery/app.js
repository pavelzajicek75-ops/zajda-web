async function loadPhotos() {
  const res = await fetch("/api/photos");
  const photos = await res.json();
  const gallery = document.getElementById("gallery");
  gallery.innerHTML = "";
  if (!Array.isArray(photos) || photos.length === 0) {
    gallery.innerHTML = "<p>Žádné fotky zatím nejsou.</p>";
    return;
  }
  photos.forEach(photo => {
    const container = document.createElement("div");
    container.className = "photo-item";

    const img = document.createElement("img");
    img.src = photo.url;
    img.alt = photo.name;
    img.className = "gallery-photo";

    const caption = document.createElement("p");
    caption.textContent = photo.name;

    const delBtn = document.createElement("button");
    delBtn.textContent = "Smazat";
    delBtn.onclick = async () => {
      await fetch(`/api/delete?file=${photo.id}`);
      loadPhotos();
    };

    container.appendChild(img);
    container.appendChild(caption);
    container.appendChild(delBtn);
    gallery.appendChild(container);
  });
}

document.addEventListener("DOMContentLoaded", loadPhotos);

document.getElementById("uploadForm").addEventListener("submit", async e => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json();

  if (data.success) {
    const gallery = document.getElementById("gallery");
    const container = document.createElement("div");
    container.className = "photo-item";

    const img = document.createElement("img");
    img.src = data.url;
    img.alt = data.fileName;
    img.className = "gallery-photo";

    const caption = document.createElement("p");
    caption.textContent = data.fileName;

    const delBtn = document.createElement("button");
    delBtn.textContent = "Smazat";
    delBtn.onclick = async () => {
      await fetch(`/api/delete?file=${data.fileName}`);
      loadPhotos();
    };

    container.appendChild(img);
    container.appendChild(caption);
    container.appendChild(delBtn);
    gallery.appendChild(container);
  }

  // pro jistotu načteme znovu celý seznam
  loadPhotos();
});
