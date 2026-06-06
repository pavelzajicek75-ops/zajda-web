// /admin/clanky/edit.js

let articleId = null;
let sections = [];

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  articleId = params.get("id") || null;

  loadSections();
  loadArticle();
});

// --------------------------------------------------
// SECTIONS + SUBSECTIONS
// --------------------------------------------------
async function loadSections() {
  try {
    const res = await authenticatedFetch("/api/sections/list");
    if (!res) return;

    sections = await res.json();

    const sectionSelect = document.getElementById("section");
    sectionSelect.innerHTML = "";

    sections.forEach(sec => {
      const opt = document.createElement("option");
      opt.value = sec.id;
      opt.textContent = sec.name;
      sectionSelect.appendChild(opt);
    });

    sectionSelect.addEventListener("change", updateSubsections);
    updateSubsections();

  } catch (err) {
    console.error("Chyba při načítání sekcí:", err);
  }
}

function updateSubsections() {
  const sectionId = document.getElementById("section").value;
  const section = sections.find(s => s.id == sectionId);

  const subSelect = document.getElementById("subsection");
  subSelect.innerHTML = "";

  if (!section || !section.subsections) return;

  section.subsections.forEach(sub => {
    const opt = document.createElement("option");
    opt.value = sub.id;
    opt.textContent = sub.name;
    subSelect.appendChild(opt);
  });
}

// --------------------------------------------------
// LOAD ARTICLE
// --------------------------------------------------
async function loadArticle() {
  if (!articleId) return;

  try {
    const res = await authenticatedFetch(`/api/articles/get?id=${articleId}`);
    if (!res) return;

    const data = await res.json();

    document.getElementById("title").value = data.title || "";
    document.getElementById("place").value = data.place || "";
    document.getElementById("date").value = data.date || "";
    document.getElementById("section").value = data.section || "";
    updateSubsections();
    document.getElementById("subsection").value = data.subsection || "";
    document.getElementById("editor").innerHTML = data.content || "";

  } catch (err) {
    console.error("Chyba při načítání článku:", err);
  }
}

// --------------------------------------------------
// SAVE ARTICLE
// --------------------------------------------------
async function saveArticle() {
  const body = {
    id: articleId,
    title: document.getElementById("title").value.trim(),
    place: document.getElementById("place").value.trim(),
    date: document.getElementById("date").value,
    section: document.getElementById("section").value,
    subsection: document.getElementById("subsection").value,
    content: document.getElementById("editor").innerHTML.trim()
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
// WYSIWYG FUNKCE
// --------------------------------------------------
function format(cmd) {
  document.execCommand(cmd, false, null);
}

function formatBlock(tag) {
  document.execCommand("formatBlock", false, tag);
}

// --------------------------------------------------
// OBRÁZKY Z GALERIE
// --------------------------------------------------
function openGallery() {
  const win = window.open("/admin/gallery/picker.html", "galleryPicker", "width=900,height=700");
  window.addEventListener("message", e => {
    if (e.data.type === "imageSelected") {
      document.execCommand("insertHTML", false, `<img src="${e.data.url}">`);
    }
  });
}
