// /admin/clanky/app.js

function openGallery() {
  document.getElementById("galleryModal").classList.remove("hidden");
}

function closeGallery() {
  document.getElementById("galleryModal").classList.add("hidden");
}

// === FUNKCE, KTEROU VOLÁ GALERIE ===
function insertPhoto(url) {
  const editor = document.getElementById("editor");
  editor.innerHTML += `<img src="${url}" class="article-photo">`;
  closeGallery();
}

// === ZOOM OVLÁDÁNÍ ===
const zoomRange = document.getElementById("zoomRange");
const zoomVal = document.getElementById("zoomVal");
const editorArea = document.getElementById("editor");

zoomRange.oninput = () => {
  const zoom = zoomRange.value;
  zoomVal.textContent = zoom + "%";
  editorArea.style.zoom = zoom / 100;
};

// === ULOŽENÍ ČLÁNKU ===
async function saveArticle() {
  const data = {
    title: document.getElementById("title").value,
    section: document.getElementById("section").value,
    subsection: document.getElementById("subsection").value,
    place: document.getElementById("place").value,
    content: document.getElementById("editor").innerHTML,
    created: new Date().toISOString()
  };

  const res = await fetch("/functions/api/article/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    alert("❌ Chyba při ukládání článku!");
    return;
  }

  alert("✅ Článek uložen!");
}
