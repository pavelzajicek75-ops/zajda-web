// /admin/clanky/app.js

let sectionsData = [];

// --- GALERIE ---
function openGallery() {
  document.getElementById("galleryModal").classList.remove("hidden");
}
function closeGallery() {
  document.getElementById("galleryModal").classList.add("hidden");
}

// volá galerie: window.parent.insertPhoto(url)
function insertPhoto(url) {
  const editor = document.getElementById("editor");
  const img = document.createElement("img");
  img.src = url;
  img.className = "article-photo";
  img.style.width = "70%";
  img.draggable = true;
  editor.appendChild(img);
  closeGallery();
  attachImageTools();
}

// --- TEXTOVÝ TOOLBAR ---
function format(cmd) {
  const editor = document.getElementById("editor");
  editor.focus();
  document.execCommand(cmd, false, null);
}

function insertLink() {
  const url = prompt("Zadej URL:");
  if (!url) return;
  const editor = document.getElementById("editor");
  editor.focus();
  document.execCommand("createLink", false, url);
}

function insertQuote() {
  const editor = document.getElementById("editor");
  editor.focus();
  document.execCommand("formatBlock", false, "blockquote");
}

function insertHR() {
  const editor = document.getElementById("editor");
  editor.focus();
  document.execCommand("insertHorizontalRule");
}

// --- OBRÁZKY: MAZÁNÍ, ZMĚNA VELIKOSTI, PŘESUN ---
function attachImageTools() {
  const editor = document.getElementById("editor");
  const imgs = editor.querySelectorAll("img.article-photo");

  imgs.forEach(img => {
    img.onclick = e => showImageTools(img, e);
    img.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", img.src);
      img.classList.add("dragging");
    });
    img.addEventListener("dragend", () => img.classList.remove("dragging"));
  });

  editor.addEventListener("dragover", e => e.preventDefault());
  editor.addEventListener("drop", e => {
    e.preventDefault();
    const dragging = editor.querySelector("img.dragging");
    if (!dragging) return;

    const range = document.caretPositionFromPoint
      ? document.caretPositionFromPoint(e.clientX, e.clientY)
      : document.caretRangeFromPoint(e.clientX, e.clientY);

    if (!range) return;

    const sel = window.getSelection();
    sel.removeAllRanges();

    const r = document.createRange();
    const node = range.offsetNode || range.startContainer;
    const offset = range.offset || range.startOffset;
    r.setStart(node, offset);
    r.collapse(true);
    sel.addRange(r);

    sel.getRangeAt(0).insertNode(dragging);
  });
}

function showImageTools(img, e) {
  const old = document.querySelector(".img-tools");
  if (old) old.remove();

  const box = document.createElement("div");
  box.className = "img-tools";
  box.style.left = e.pageX + "px";
  box.style.top = (e.pageY - 70) + "px";

  const current = parseInt(img.style.width) || 70;

  box.innerHTML = `
    <div>Velikost: <span id="sizeVal">${current}%</span></div>
    <input id="sizeRange" type="range" min="30" max="100" value="${current}">
    <button id="delImg">🗑️ Smazat</button>
  `;

  document.body.appendChild(box);

  const slider = document.getElementById("sizeRange");
  const val = document.getElementById("sizeVal");
  const del = document.getElementById("delImg");

  slider.oninput = () => {
    img.style.width = slider.value + "%";
    val.textContent = slider.value + "%";
  };

  del.onclick = () => {
    img.remove();
    box.remove();
  };
}

// --- SEKCE / PODSEKCE ---
async function loadSections() {
  try {
    const res = await fetch("/functions/api/sections/list");
    if (!res.ok) return;
    const data = await res.json();
    sectionsData = data.sections || [];

    const sectionSelect = document.getElementById("section");
    const subsectionSelect = document.getElementById("subsection");

    sectionSelect.innerHTML = "";
    subsectionSelect.innerHTML = "";

    sectionsData.forEach(sec => {
      const opt = document.createElement("option");
      opt.value = sec.name;
      opt.textContent = sec.name;
      sectionSelect.appendChild(opt);
    });

    sectionSelect.onchange = () => {
      const selected = sectionsData.find(s => s.name === sectionSelect.value);
      subsectionSelect.innerHTML = "";
      if (!selected) return;
      selected.subsections.forEach(sub => {
        const opt = document.createElement("option");
        opt.value = sub;
        opt.textContent = sub;
        subsectionSelect.appendChild(opt);
      });
    };

    if (sectionsData.length > 0) {
      sectionSelect.value = sectionsData[0].name;
      sectionSelect.dispatchEvent(new Event("change"));
    }
  } catch (e) {
    console.error("Sections load error", e);
  }
}

async function addSection() {
  const name = prompt("Název nové sekce:");
  if (!name) return;

  if (sectionsData.some(s => s.name === name)) {
    alert("Sekce s tímto názvem už existuje.");
    return;
  }

  sectionsData.push({ name, subsections: [] });
  await saveSectionsToServer();
  await loadSections();
  document.getElementById("section").value = name;
  document.getElementById("section").dispatchEvent(new Event("change"));
}

async function addSubsection() {
  const sectionSelect = document.getElementById("section");
  const currentSection = sectionSelect.value;
  if (!currentSection) {
    alert("Nejprve vyber sekci.");
    return;
  }

  const name = prompt("Název nové podsekce:");
  if (!name) return;

  const sec = sectionsData.find(s => s.name === currentSection);
  if (!sec) return;

  if (sec.subsections.includes(name)) {
    alert("Podsekce s tímto názvem už existuje.");
    return;
  }

  sec.subsections.push(name);
  await saveSectionsToServer();
  await loadSections();
  document.getElementById("section").value = currentSection;
  document.getElementById("section").dispatchEvent(new Event("change"));
  document.getElementById("subsection").value = name;
}

async function saveSectionsToServer() {
  const res = await fetch("/functions/api/sections/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sections: sectionsData })
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("Sections save error:", t);
    alert("❌ Chyba při ukládání sekcí.");
  }
}

// --- ULOŽENÍ ČLÁNKU ---
async function saveArticle() {
  const payload = {
    title: document.getElementById("title").value.trim(),
    section: document.getElementById("section").value,
    subsection: document.getElementById("subsection").value,
    place: document.getElementById("place").value.trim(),
    date: document.getElementById("date").value,
    content: document.getElementById("editor").innerHTML,
    created: new Date().toISOString()
  };

  if (!payload.title || !payload.section || !payload.subsection || !payload.content) {
    alert("Vyplň název, sekci, podsekci a obsah.");
    return;
  }

  const res = await fetch("/functions/api/article/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const t = await res.text();
    console.error(t);
    alert("❌ Chyba při ukládání článku.");
    return;
  }

  alert("✅ Článek uložen.");
}

// --- NÁHLED ČLÁNKU (rychlý) ---
function previewArticle() {
  const title = document.getElementById("title").value;
  const place = document.getElementById("place").value;
  const date = document.getElementById("date").value;
  const content = document.getElementById("editor").innerHTML;

  const w = window.open("", "_blank");
  w.document.write(`
    <html><head><meta charset="utf-8"><title>${title}</title></head>
    <body style="font-family:Segoe UI,Arial,sans-serif;max-width:900px;margin:40px auto;line-height:1.7;background:#0d0d0d;color:#eee;">
      <h1>${title}</h1>
      <div style="color:#aaa;font-style:italic;">${place}</div>
      <div style="color:#888;font-size:0.9em;margin-bottom:15px;">${date ? new Date(date).toLocaleDateString("cs-CZ") : ""}</div>
      ${content}
    </body></html>
  `);
  w.document.close();
}

// --- ZPĚT ---
function goBack() {
  history.back();
}

// --- DEFAULT DATUM ---
function setDefaultDate() {
  const dateInput = document.getElementById("date");
  if (!dateInput.value) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  }
}

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
  loadSections();
  attachImageTools();
  setDefaultDate();
});
