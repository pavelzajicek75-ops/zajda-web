// /admin/clanky/app.js

let sectionsData = [];

// --- Načtení sekcí ---
async function loadSections() {
  try {
    const res = await fetch("/functions/api/articles/sections/list");
    if (!res.ok) throw new Error("Chyba při načítání sekcí");
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

// --- Přidání nové sekce ---
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

// --- Přidání nové podsekce ---
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

// --- Uložení sekcí na server ---
async function saveSectionsToServer() {
  const res = await fetch("/functions/api/articles/sections/save", {
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

// --- Inicializace ---
document.addEventListener("DOMContentLoaded", () => {
  loadSections();
});
