// /admin/clanky/app.js

/* === GALERIE === */
function openGallery() {
  document.getElementById("galleryModal").classList.remove("hidden");
}
function closeGallery() {
  document.getElementById("galleryModal").classList.add("hidden");
}

/* === VLOŽENÍ FOTKY === */
function insertPhoto(url) {
  const editor = document.getElementById("editor");
  const img = document.createElement("img");
  img.src = url;
  img.className = "article-photo";
  img.style.width = "70%";
  img.setAttribute("draggable", "true");

  editor.appendChild(img);
  closeGallery();

  attachImageTools();
}

/* === TEXTOVÝ TOOLBAR === */
function format(cmd) {
  document.execCommand(cmd, false, null);
}

function insertLink() {
  const url = prompt("Zadej URL:");
  if (url) document.execCommand("createLink", false, url);
}

function insertQuote() {
  document.execCommand("formatBlock", false, "blockquote");
}

function insertHR() {
  document.execCommand("insertHorizontalRule");
}

/* === OBRÁZKY: MAZÁNÍ, ZMĚNA VELIKOSTI, PŘESUN === */
function attachImageTools() {
  const imgs = document.querySelectorAll("#editor img.article-photo");

  imgs.forEach(img => {
    img.onclick = e => showImageTools(img, e);

    img.draggable = true;
    img.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", img.src);
      img.classList.add("dragging");
    });

    img.addEventListener("dragend", () => {
      img.classList.remove("dragging");
    });
  });

  const editor = document.getElementById("editor");

  editor.addEventListener("dragover", e => e.preventDefault());

  editor.addEventListener("drop", e => {
    e.preventDefault();
    const dragging = document.querySelector(".dragging");
    if (!dragging) return;

    const range = document.caretPositionFromPoint(e.clientX, e.clientY);
    const node = range.offsetNode;
    const offset = range.offset;

    const selection = window.getSelection();
    selection.removeAllRanges();

    const newRange = document.createRange();
    newRange.setStart(node, offset);
    newRange.collapse(true);
    selection.addRange(newRange);

    selection.getRangeAt(0).insertNode(dragging);
  });
}

function showImageTools(img, e) {
  const old = document.querySelector(".img-tools");
  if (old) old.remove();

  const box = document.createElement("div");
  box.className = "img-tools";
  box.style.left = e.pageX + "px";
  box.style.top = e.pageY - 60 + "px";

  box.innerHTML = `
    <label>Velikost: <span id="sizeVal">${parseInt(img.style.width) || 70}%</span></label>
    <input id="sizeRange" type="range" min="30" max="100" value="${parseInt(img.style.width) || 70}">
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

/* === ULOŽENÍ ČLÁNKU === */
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

  if (!res.ok) return alert("❌ Chyba při ukládání článku!");

  alert("✅ Článek uložen!");
}
