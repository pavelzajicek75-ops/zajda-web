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
  modal.style.background = "rgba(0,0,0,0.9)";
  modal.style.zIndex = "9999";
  modal.style.overflow = "auto";
  modal.style.padding = "40px";
  document.body.appendChild(modal);

  pickerBtn.onclick = async () => {
    try {
      const res = await fetch("/api/photo/list");
      const data = await res.json();

      modal.innerHTML = "";
      const grid = document.createElement("div");
      grid.style.display = "flex";
      grid.style.flexWrap = "wrap";
      grid.style.gap = "20px";
      grid.style.justifyContent = "center";

      if (!data.photos || data.photos.length === 0) {
        const msg = document.createElement("p");
        msg.textContent = "Žádné fotky v galerii.";
        msg.style.color = "#fff";
        msg.style.textAlign = "center";
        modal.appendChild(msg);
      } else {
        data.photos.forEach(p => {
          const img = document.createElement("img");
          img.src = p.url;
          img.style.width = "180px";
          img.style.height = "120px";
          img.style.objectFit = "cover";
          img.style.borderRadius = "8px";
          img.style.cursor = "pointer";
          img.onclick = () => {
            insertPhotoToEditor(p.url);
            modal.style.display = "none";
          };
          grid.appendChild(img);
        });
      }

      const closeBtn = document.createElement("button");
      closeBtn.textContent = "Zavřít";
      closeBtn.style.display = "block";
      closeBtn.style.margin = "30px auto";
      closeBtn.onclick = () => (modal.style.display = "none");

      modal.appendChild(grid);
      modal.appendChild(closeBtn);
      modal.style.display = "block";
    } catch (err) {
      alert("❌ Chyba při načítání fotek!");
      console.error(err);
    }
  };

  function insertPhotoToEditor(url) {
    const editor = document.getElementById("content");
    editor.value += `<img src="${url}" alt="">\n`;
  }
}
