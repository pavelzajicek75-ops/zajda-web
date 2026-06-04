// Otevření galerie
function openGallery() {
  document.getElementById("galleryModal").classList.remove("hidden")
}

// Zavření galerie
function closeGallery() {
  document.getElementById("galleryModal").classList.add("hidden")
}

// Voláno z galerie: window.parent.insertPhoto(url)
function insertPhoto(url) {
  const editor = document.getElementById("editor")
  editor.innerHTML += `<img src="${url}" class="article-photo">`
  updatePreview()
  closeGallery()
}

// Načtení sekcí a podsekcí
async function loadSections() {
  const res = await fetch("/functions/api/sections/list")
  if (!res.ok) return
  const data = await res.json()
  const sectionSelect = document.getElementById("section")
  const subsectionSelect = document.getElementById("subsection")

  sectionSelect.innerHTML = ""
  data.sections.forEach(sec => {
    const opt = document.createElement("option")
    opt.value = sec.name
    opt.textContent = sec.name
    sectionSelect.appendChild(opt)
  })

  sectionSelect.addEventListener("change", () => {
    const selected = data.sections.find(s => s.name === sectionSelect.value)
    subsectionSelect.innerHTML = ""
    selected.subsections.forEach(sub => {
      const opt = document.createElement("option")
      opt.value = sub
      opt.textContent = sub
      subsectionSelect.appendChild(opt)
    })
  })
}

// Náhled článku
function updatePreview() {
  const title = document.getElementById("title").value
  const place = document.getElementById("place").value
  const content = document.getElementById("editor").innerHTML
  document.getElementById("preview").innerHTML = `
    <h1>${title}</h1>
    <p><em>${place}</em></p>
    ${content}
  `
}

// Uložení článku
async function saveArticle() {
  const data = {
    title: document.getElementById("title").value,
    section: document.getElementById("section").value,
    subsection: document.getElementById("subsection").value,
    place: document.getElementById("place").value,
    content: document.getElementById("editor").innerHTML,
    created: new Date().toISOString()
  }

  const res = await fetch("/functions/api/article/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })

  if (!res.ok) {
    alert("❌ Chyba při ukládání článku!")
    return
  }

  alert("✅ Článek uložen!")
}

document.addEventListener("DOMContentLoaded", loadSections)
