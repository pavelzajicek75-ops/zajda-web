// /admin/clanky/edit.js

let articleId = null;
let sections = [];

document.addEventListener("DOMContentLoaded", () => {
  init();
});

async function init() {
  const params = new URLSearchParams(window.location.search);
  articleId = params.get("id") || null;

  await loadSections();   // nejdřív sekce
  await loadArticle();    // pak článek
}

// --------------------------------------------------
// SECTIONS + SUBSECTIONS
// --------------------------------------------------
async function loadSections() {
  try {
    const res = await authenticatedFetch("/api/sections/list");
    if (!res || !res.ok) {
      console.error("Chyba při načítání sekcí", res && res.status);
      return;
    }

    sections = await res.json();
    if (!Array.isArray(sections)) sections = [];

    const sectionSelect = document.getElementById("section");
    sectionSelect.innerHTML = "";

    sections.forEach(sec => {
      const opt = document.createElement("option");
      opt.value = sec.id;
      opt.textContent = sec.name_cz || sec.name || sec.id;
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
  const section = sections.find(s => s.id === sectionId);

  const subSelect = document.getElementById("subsection");
  subSelect.innerHTML = "";

  if (!section || !Array.isArray(section.subsections)) return;

  section.subsections.forEach(sub => {
    const opt = document.createElement("option");
    opt.value = sub.id;
    opt.textContent = sub.name;
    subSelect.appendChild(opt);
  });
}

// --------------------------------------------------
// NOVÁ PODSEKCE
// --------------------------------------------------
function showNewSub() {
  document.getElementById("newSubWrap").style.display = "block";
}

async function addNewSub() {
  const name = document.getElementById("newSubName").value.trim();
  const sectionId = document.getElementById("section").value;

  if (!name) {
    alert("Zadej název podsekce");
    return;
  }

  try {
    const res = await authenticatedFetch("/api/sections/add-subsection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId, name })
    });

    if (!res.ok) {
      alert("Chyba při ukládání podsekce");
      return;
    }

    const newSub = await res.json();

    const section = sections.find(s => s.id === sectionId);
    if (!section.subsections) section.subsections = [];
    section.subsections.push(newSub);

    updateSubsections();
    document.getElementById("subsection").value = newSub.id;

    document.getElementById("newSubWrap").style.display = "none";
    document.getElementById("newSubName").value = "";

  } catch (err) {
    console.error("Chyba při přidávání podsekce:", err);
  }
}

// --------------------------------------------------
// LOAD ARTICLE
// --------------------------------------------------
async function loadArticle() {
  if (!articleId) return;

  try {
    const res = await authenticatedFetch(`/api/articles/get?id=${articleId}`);
    if (!res.ok) return;

    const data = await res.json();

    document.getElementById("title").value = data.title || "";
    document.getElementById("place").value = data.place || "";
    document.getElementById("date").value = data.date || "";

    if (data.section) {
      document.getElementById("section").value = data.section;
      updateSubsections();
    }

    if (data.subsection) {
      document.getElementById("subsection").value = data.subsection;
    }

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
      alert("Chyba při ukládání článku");
      return;
    }

    alert("Článek uložen");
    window.location.href = "/admin/clanky/index.html";

  } catch (err) {
    console.error("Chyba při ukládání článku:", err);
  }
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
  window.open(
    "/admin/gallery/picker.html",
    "galleryPicker",
    "width=900,height=700"
  );
}

window.addEventListener("message", e => {
  if (e.data && e.data.type === "imageSelected" && e.data.url) {
    document.execCommand("insertHTML", false, `<img src="${e.data.url}">`);
  }
});
