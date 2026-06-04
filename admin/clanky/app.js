// /admin/clanky/app.js

// === OTEVŘENÍ A ZAVŘENÍ GALERIE ===
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
  updatePreview();
  closeGallery();
}

// === DRAG & DROP PODPORA ===
const editor = document.getElementById("editor");

editor.addEventListener("dragover", e => e.preventDefault());
editor.addEventListener("drop", e => {
  e.preventDefault();
  const url = e.dataTransfer.getData("text/plain");
  if (url) insertPhoto(url);
});

// === NÁHLED ČLÁNKU ===
function updatePreview() {
  const title = document.getElementById("title").value;
  const place = document.getElementById("place").value;
  const content = document.getElementById("editor").innerHTML;

  document.getElementById("preview").innerHTML = `
    <h1>${title}</h1>
    <p><em>${place}</em></p>
    ${content}
  `;
}

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
