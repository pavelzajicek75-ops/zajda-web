export async function initPhotoPicker() {
  const pickerBtn = document.getElementById("galleryBtn");
  const modal = document.createElement("div");
  modal.id = "photoPicker";
  modal.style.display = "none";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.background = "rgba(0,0,0,0.8)";
  modal.style.zIndex = "9999";
  modal.style.overflow = "auto";
  modal.style.padding = "20px";

  document.body.appendChild(modal);

  pickerBtn.onclick = async () => {
    const res = await fetch("/api/photo/list");
    const data = await res.json();

    modal.innerHTML = "";
    data.photos.forEach(p => {
      const img = document.createElement("img");
      img.src = p.url;
      img.style.width = "150px";
      img.style.margin = "10px";
      img.style.cursor = "pointer";
      img.onclick = () => {
        insertPhotoToEditor(p.url);
        modal.style.display = "none";
      };
      modal.appendChild(img);
    });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Zavřít";
    closeBtn.style.display = "block";
    closeBtn.style.margin = "20px auto";
    closeBtn.onclick = () => (modal.style.display = "none");
    modal.appendChild(closeBtn);

    modal.style.display = "block";
  };

  function insertPhotoToEditor(url) {
    const editor = document.getElementById("content");
    editor.value += `<img src="${url}" alt="">\n`;
  }
}
