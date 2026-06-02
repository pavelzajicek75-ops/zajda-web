async function loadGallery() {
  const res = await fetch("/api/photo");
  const photos = await res.json();

  const gallery = document.getElementById("gallery");
  gallery.innerHTML = "";

  photos.forEach(filename => {
    const div = document.createElement("div");
    div.className = "photo-item";

    const img = document.createElement("img");
    img.src = `/api/photo/${filename}`;
    img.alt = filename;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = filename;

    div.appendChild(img);
    div.appendChild(checkbox);
    gallery.appendChild(div);
  });
}

async function deleteSelected() {
  const checkboxes = document.querySelectorAll("input[type=checkbox]:checked");

  for (const cb of checkboxes) {
    const filename = cb.value;

    await fetch(`/api/photo/${filename}/delete`, {
      method: "DELETE"
    });
  }

  await loadGallery();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("deleteSelected").addEventListener("click", deleteSelected);
  loadGallery();
});
