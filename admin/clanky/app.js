// /admin/clanky/app.js

let sectionsData = [];

// --- Načtení sekcí ---
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
});
