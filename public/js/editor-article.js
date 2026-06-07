const sectionSelect = document.getElementById("section");
const subsectionSelect = document.getElementById("subsection");
const editor = document.getElementById("editor");
const galleryModal = document.getElementById("galleryModal");
const gallery = document.getElementById("gallery");

async function loadSections() {
  const res = await fetch("/api/sections/list");
  const sections = await res.json();
  sections.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    sectionSelect.appendChild(opt);
  });
}

sectionSelect.onchange = async () => {
  const res = await fetch(`/api/subsections/get?id=${sectionSelect.value}`);
  const subs = await res.json();
  subsectionSelect.innerHTML = "";
  subs.forEach(sub => {
    const opt = document.createElement("option");
    opt.value = sub.id;
    opt.textContent = sub.name;
    subsectionSelect.appendChild(opt);
  });
};

document.getElementById("openGallery").onclick = async () => {
  galleryModal.style.display = "block";
  const res = await fetch("/api/photo/list");
  const files = await res.json();
  gallery.innerHTML = "";
  files.forEach(f => {
    const img = document.createElement("img");
    img.src = f.url;
    img.onclick = () => {
      editor.value += `<img src="${f.url}" alt="">`;
      galleryModal.style.display = "none";
    };
    gallery.appendChild(img);
  });
};

document.getElementById("saveArticle").onclick = async () => {
  const data = {
    section: sectionSelect.value,
    subsection: subsectionSelect.value,
    content: editor.value
  };
  await fetch("/api/articles/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  alert("Článek uložen!");
};

loadSections();
