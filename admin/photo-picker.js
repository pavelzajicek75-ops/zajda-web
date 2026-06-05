// /admin/photo-picker.js

export async function loadPhotoPicker(containerId, callback) {
  const container = document.getElementById(containerId);
  container.innerHTML = "Načítám fotky...";

  const res = await fetch("/api/photo/list");
  const data = await res.json();

  container.innerHTML = "";

  data.files.forEach(file => {
    const img = document.createElement("img");
    img.src = file.url;
    img.style.width = "120px";
    img.style.margin = "10px";
    img.style.cursor = "pointer";

    img.onclick = () => callback(file.url);

    container.appendChild(img);
  });
}
