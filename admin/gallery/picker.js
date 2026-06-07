async function loadGallery() {
  const res = await fetch("/api/photo/list");
  const files = await res.json();
  const gallery = document.getElementById("gallery");

  gallery.innerHTML = "";
  files.forEach(file => {
    const img = document.createElement("img");
    img.src = file.url;
    img.className = "thumb";
    img.onclick = () => insertImage(file.url);
    gallery.appendChild(img);
  });
}

function insertImage(url) {
  const editor = document.getElementById("editor");
  editor.value += `<img src="${url}" alt="">`;
}

loadGallery();
