// /admin/clanky/app.js

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
      ?
