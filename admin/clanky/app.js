// /admin/clanky/app.js

// OCHRANA ADMINU
if (!sessionStorage.getItem("adminToken")) {
  window.location.href = "/admin/login.html";
}

let sectionsData = [];

// --- Načtení sekcí ---
async function loadSections(selectedSection = null, selectedSubsection = null) {
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

  if (selectedSection) sectionSelect.value = selectedSection;

  const sec = sectionsData.find(s => s.name === sectionSelect.value);
  subsectionSelect.innerHTML = "";
  sec.subsections.forEach(sub => {
    const opt = document.createElement("option");
    opt.value = sub;
    opt.textContent = sub;
    subsectionSelect.appendChild(opt);
  });

  if (selectedSubsection) subsectionSelect.value = selectedSubsection;

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
}

// --- Přidání nové podsekce ---
function addSubsection() {
  const section = document.getElementById("section").value;
  const name = prompt("Název nové podsekce:");
  if (!name) return;

  const sec = sectionsData.find(s => s.name === section);
  sec.subsections.push(name);

  const subsectionSelect = document.getElementById("subsection");
  subsectionSelect.innerHTML = "";
  sec.subsections.forEach(sub => {
    const opt = document.createElement("option");
    opt.value = sub;
    opt.textContent = sub;
    subsectionSelect.appendChild(opt);
  });

  subsectionSelect.value = name;
}

// --- Uložení článku ---
async function saveArticle() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  const payload = {
    id,
    title: document.getElementById("title").value,
    section: document.getElementById("section").value,
    subsection: document.getElementById("subsection").value,
    place: document.getElementById("place").value,
    date: document.getElementById("date").value,
    content: document.getElementById("editor").innerHTML,
    created: new Date().toISOString()
  };

  const res = await fetch("/functions/api/article/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  alert("Článek uložen.");
  window.location.href = `/admin/clanky/index.html?id=${data.id}`;
}

// --- Načtení článku ---
async function loadArticle() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");
  if (!id) return;

  const res = await fetch(`/functions/api/article/get?id=${id}`);
  const a = await res.json();

  document.getElementById("title").value = a.title;
  document.getElementById("place").value = a.place;
  document.getElementById("date").value = a.date;
  document.getElementById("editor").innerHTML = a.content;

  await loadSections(a.section, a.subsection);
}

// --- Otevření galerie ---
function openGallery() {
  document.getElementById("galleryModal").classList.remove("hidden");
}

// --- Zavření galerie ---
function closeGallery() {
  document.getElementById("galleryModal").classList.add("hidden");
}

// --- Náhled ---
function previewArticle() {
  const w = window.open("", "_blank");
  w.document.write(document.getElementById("editor").innerHTML);
}

// --- Zpět ---
function goBack() {
  history.back();
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  loadSections();
  loadArticle();
});
