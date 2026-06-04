// /admin/clanky/app.js

let sectionsData = [];

// --- GALERIE ---
function openGallery() {
  document.getElementById("galleryModal").classList.remove("hidden");
}
function closeGallery() {
  document.getElementById("galleryModal").classList.add("hidden");
}

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
  document.getElementById("editor").focus();
  document.execCommand("createLink", false, url);
}

function insertQuote() {
  document.getElementById("editor").focus();
  document.execCommand("formatBlock", false, "blockquote");
}

function insertHR() {
  document.getElementById("editor").focus();
  document.execCommand("insertHorizontalRule");
}

// --- OBRÁZKY ---
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

  document.getElementById("sizeRange").oninput = e => {
    img.style.width = e.target.value + "%";
    document.getElementById("sizeVal").textContent = e.target.value + "%";
  };

  document.getElementById("delImg").onclick = () => {
    img.remove();
    box.remove();
  };
}

// --- SEKCE / PODSEKCE ---
async function loadSections() {
  const res = await fetch("/functions/api/articles/sections/list");
  const data = await res.json();
  sectionsData = data.sections;

  const sectionSelect = document.getElementById("section");
  const subsectionSelect = document.getElementById("subsection");

  sectionSelect.innerHTML = "";
  sectionsData.forEach(sec => {
    const opt = document.createElement("option");
    opt.value = sec.name;
    opt.textContent = sec.name;
    sectionSelect.appendChild(opt);
  });

  sectionSelect.onchange = () => {
    const sec = sectionsData.find(s => s.name === sectionSelect.value);
    subsectionSelect.innerHTML = "";
    sec.subsections.forEach(sub => {
      const opt = document.createElement("option");
      opt.value = sub;
      opt.textContent = sub;
      subsectionSelect.appendChild(opt);
    });
  };

  sectionSelect.dispatchEvent(new Event("change"));
}

async function addSection() {
  const name = prompt("Název nové sekce:");
  if (!name) return;

  sectionsData.push({ name, subsections: [] });
  await saveSections();
  await loadSections();
  document.getElementById("section").value = name;
}

async function addSubsection() {
  const section = document.getElementById("section").value;
  const name = prompt("Název nové podsekce:");
  if (!name) return;

  const sec = sectionsData.find(s => s.name === section);
  sec.subsections.push(name);

  await saveSections();
  await loadSections();
  document.getElementById("section").value = section;
  document.getElementById("subsection").value = name;
}

async function saveSections() {
  await fetch("/functions/api/articles/sections/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sections: sectionsData })
  });
}

// --- ULOŽENÍ ČLÁNKU ---
async function saveArticle() {
  const payload = {
    title: document.getElementById("title").value,
    section: document.getElementById("section").value,
    subsection: document.getElementById("subsection").value,
    place: document.getElementById("place").value,
    date: document.getElementById("date").value,
    content: document.getElementById("editor").innerHTML,
    created: new Date().toISOString()
  };

  await fetch("/functions/api/article/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  alert("Článek uložen.");
}

// --- NÁHLED ---
function previewArticle() {
  const w = window.open("", "_blank");
  w.document.write(document.getElementById("editor").innerHTML);
}

// --- ZPĚT ---
function goBack() {
  history.back();
}

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
  loadSections();
  attachImageTools();
});
