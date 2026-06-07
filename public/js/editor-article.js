import { initPhotoPicker } from "/js/photo-picker.js";

let subsections = {};

async function loadSections() {
  const sectionSelect = document.getElementById("section");
  const subsectionSelect = document.getElementById("subsection");
  const newSubInput = document.getElementById("newSub");
  const addSubBtn = document.getElementById("addSubBtn");

  const sections = [
    { id: "photography", name: "Fotky / Photography" },
    { id: "travel", name: "Cestování / Travel" },
    { id: "projects", name: "Projekty / Projects" },
    { id: "about", name: "Zajda / About" }
  ];

  sections.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    sectionSelect.appendChild(opt);
  });

  const res = await fetch("/api/subsections/get");
  subsections = await res.json();

  if (!subsections.photography) {
    subsections = {
      photography: [],
      travel: [],
      projects: [],
      about: []
    };
  }

  function renderSubsections() {
    const sec = sectionSelect.value;
    subsectionSelect.innerHTML = "";
    (subsections[sec] || []).forEach(sub => {
      const opt = document.createElement("option");
      opt.value = sub;
      opt.textContent = sub;
      subsectionSelect.appendChild(opt);
    });
  }

  addSubBtn.onclick = async () => {
    const sec = sectionSelect.value;
    const val = newSubInput.value.trim();
    if (!val) return;
    subsections[sec].push(val);
    newSubInput.value = "";

    await fetch("/api/subsections/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subsections)
    });

    renderSubsections();
  };

  sectionSelect.onchange = renderSubsections;
  renderSubsections();
}

document.getElementById("saveBtn").addEventListener("click", async () => {
  const id = Date.now().toString();

  const body = {
    id,
    title: document.getElementById("title").value,
    place: document.getElementById("place").value,
    date: document.getElementById("date").value,
    section: document.getElementById("section").value,
    subsection: document.getElementById("subsection").value,
    content: document.getElementById("content").value,
    created: Date.now()
  };

  const res = await fetch("/api/articles/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (res.ok) {
    alert("✅ Článek uložen!");
  } else {
    alert("❌ Chyba při ukládání článku!");
  }
});

initPhotoPicker();
loadSections();
