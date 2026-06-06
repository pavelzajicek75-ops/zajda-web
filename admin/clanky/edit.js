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
  const res = await authenticatedFetch("/api/sections/list");
  sections = await res.json();

  const sectionSelect = document.getElementById("section");
  sectionSelect.innerHTML = "";

  sections.forEach(sec => {
    const opt = document.createElement("option");
    opt.value = sec.id;
    opt.textContent = sec.name_cz;
    sectionSelect.appendChild(opt);
  });

  sectionSelect.addEventListener("change", updateSubsections);
  updateSubsections();
}

function updateSubsections() {
  const sectionId = document.getElementById("section").value;
  const section = sections.find(s => s.id === sectionId);

  const subSelect = document.getElementById("subsection");
  subSelect.innerHTML = "";

  (section.subsections || []).forEach(sub => {
    const opt = document.createElement("option");
    opt.value = sub.id;
    opt.textContent = sub.name;
    subSelect.appendChild(opt);
  });
}

// --------------------------------------------------
// ADD NEW SUBSECTION
// --------------------------------------------------
function showNewSub() {
  document.getElementById("newSubWrap").style.display = "block";
}

async function addNewSub() {
  const name = document.getElementById("newSubName").value.trim();
  const sectionId = document.getElementById("section").value;

  if (!name) return alert("Zadej název podsekce");

  const res = await authenticatedFetch("/api/sections/add-subsection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sectionId, name })
  });

  const newSub = await res.json();

  // přidej do seznamu
  const section = sections.find(s => s.id === sectionId);
  section.subsections.push(newSub);

  updateSubsections();
  document.getElementById("subsection").value = newSub.id;

  document.getElementById("newSubWrap").style.display = "none";
  document.getElementById("newSubName").value = "";
}

// --------------------------------------------------
// LOAD ARTICLE
// --------------------------------------------------
async function loadArticle() {
  if (!articleId) return;

  const res = await authenticatedFetch(`/api/articles/get?id=${articleId}`);
  const data = await res.json();

  document.getElementById("title").value = data.title || "";
  document.getElementById("place").value = data.place || "";
  document.getElementById("date").value = data.date || "";
  document.getElementById("section").value = data.section || "";
  updateSubsections();
  document.getElementById("subsection").value = data.subsection || "";
  document.getElementById("editor").innerHTML = data.content || "";
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

  const res = await authenticatedFetch("/api/articles/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  alert("Článek uložen");
  window.location.href = "/admin/clanky/index.html";
}

// --------------------------------------------------
// WYSIWYG
// --------------------------------------------------
function format(cmd) {
  document.execCommand(cmd, false, null);
}

function formatBlock(tag) {
  document.execCommand("formatBlock", false, tag);
}

// --------------------------------------------------
// GALLERY POPUP
// --------------------------------------------------
function openGallery() {
  window.open("/admin/gallery/picker.html", "galleryPicker", "width=900,height=700");
}

window.addEventListener("message", e => {
  if (e.data.type === "imageSelected") {
    document.execCommand("insertHTML", false, `<img src="${e.data.url}">`);
  }
});
