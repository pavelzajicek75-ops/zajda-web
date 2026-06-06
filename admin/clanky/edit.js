// /admin/clanky/edit.js

let articleId = null;

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  articleId = params.get("id") || null;

  loadArticle();
  setupLivePreview();
});

// --------------------------------------------------
// Načtení článku
// --------------------------------------------------
async function loadArticle() {
  if (!articleId) return;

  try {
    const res = await authenticatedFetch(`/api/articles/get?id=${articleId}`);
    if (!res) return;

    const data = await res.json();

    document.getElementById("editor").value = data.content || "";
    updatePreview();

  } catch (err) {
    console.error("Chyba při načítání článku:", err);
  }
}

// --------------------------------------------------
// Uložení článku
// --------------------------------------------------
async function saveArticle() {
  const content = document.getElementById("editor").value.trim();

  const body = {
    id: articleId,
    content
  };

  try {
    const res = await authenticatedFetch("/api/articles/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      alert("Chyba při ukládání článku.");
      return;
    }

    alert("Článek uložen.");
    window.location.href = "/admin/clanky/index.html";

  } catch (err) {
    console.error("Chyba při ukládání:", err);
  }
}

// --------------------------------------------------
// Toolbar funkce
// --------------------------------------------------
function wrap(before, after) {
  const editor = document.getElementById("editor");
  const start = editor.selectionStart;
  const end = editor.selectionEnd;

  const selected = editor.value.substring(start, end);
  const newText = before + selected + after;

  editor.setRangeText(newText, start, end, "end");
  updatePreview();
}

function insertImage() {
  const url = prompt("URL obrázku:");
  if (!url) return;

  const editor = document.getElementById("editor");
  const insert = `\n![popis obrázku](${url})\n`;

  editor.setRangeText(insert, editor.selectionStart, editor.selectionEnd, "end");
  updatePreview();
}

// --------------------------------------------------
// Živý náhled
// --------------------------------------------------
function setupLivePreview() {
  document.getElementById("editor").addEventListener("input", updatePreview);
  updatePreview();
}

function updatePreview() {
  const text = document.getElementById("editor").value;

  // jednoduchý markdown → HTML
  let html = text
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<b>$1</b>")
    .replace(/\*(.*?)\*/gim, "<i>$1</i>")
    .replace(/!

\[(.*?)\]

\((.*?)\)/gim, "<img src='$2' alt='$1' style='max-width:100%;'>")
    .replace(/\n/g, "<br>");

  document.getElementById("preview").innerHTML = html;
}
