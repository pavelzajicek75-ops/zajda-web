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
  editor.innerHTML += `<img src="${url}" class="article-photo" style="max-width:100%;">`;
  updatePreview();
  closeGallery();
  attachImageEditor();
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

// === NAČTENÍ SEKCÍ A PODSEKCÍ ===
async function loadSections() {
  const res = await fetch("/functions/api/sections/list");
  if (!res.ok) return;

  const data = await res.json();

  const sectionSelect = document.getElementById("section");
  const subsectionSelect = document.getElementById("subsection");

  sectionSelect.innerHTML = "";
  subsectionSelect.innerHTML = "";

  data.sections.forEach(sec => {
    const opt = document.createElement("option");
    opt.value = sec.name;
    opt.textContent = sec.name;
    sectionSelect.appendChild(opt);
  });

  sectionSelect.onchange = () => {
    const selected = data.sections.find(s => s.name === sectionSelect.value);
    subsectionSelect.innerHTML = "";
    selected.subsections.forEach(sub => {
      const opt = document.createElement("option");
      opt.value = sub;
      opt.textContent = sub;
      subsectionSelect.appendChild(opt);
    });
  };

  sectionSelect.dispatchEvent(new Event("change"));
}

document.addEventListener("DOMContentLoaded", () => {
  loadSections();
  attachImageEditor();
});

// === EDITOR VELIKOSTI OBRÁZKŮ ===
function attachImageEditor() {
  const imgs = document.querySelectorAll("#editor img");

  imgs.forEach(img => {
    img.onclick = () => showImageTools(img);
  });
}

function showImageTools(img) {
  // Pokud už panel existuje → smažeme
  const old = document.getElementById("imgTools");
  if (old) old.remove();

  const box = document.createElement("div");
  box.id = "imgTools";
  box.style.position = "absolute";
  box.style.background = "white";
  box.style.border = "1px solid #ccc";
  box.style.padding = "10px";
  box.style.borderRadius = "6px";
  box.style.zIndex = "9999";

  const rect = img.getBoundingClientRect();
  box.style.left = rect.left + "px";
  box.style.top = rect.top - 60 + "px";

  box.innerHTML = `
    <label>Velikost: <span id="imgSizeVal">${img.style.width || "100%"}</span></label>
    <input id="imgSize" type="range" min="20" max="100" value="${parseInt(img.style.width) || 100}">
    <button id="resetImg">Reset</button>
  `;

  document.body.appendChild(box);

  const slider = document.getElementById("imgSize");
  const val = document.getElementById("imgSizeVal");
  const reset = document.getElementById("resetImg");

  slider.oninput = () => {
    img.style.width = slider.value + "%";
    val.textContent = img.style.width;
    updatePreview();
  };

  reset.onclick = () => {
    img.style.width = "100%";
    slider.value = 100;
    val.textContent = "100%";
    updatePreview();
  };
}
