document.getElementById("uploadForm").addEventListener("submit", async e => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json();

  if (data.success) {
    const gallery = document.getElementById("gallery");
    const container = document.createElement("div");
    container.className = "photo-item";

    // Tady je klíč: použít URL z backendu
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
