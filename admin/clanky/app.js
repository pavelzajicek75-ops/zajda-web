function openGallery() {
  document.getElementById("galleryModal").classList.remove("hidden")
}

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

function updatePreview() {
  const title = document.getElementById("title").value
  const intro = document.getElementById("intro").value
  const content = document.getElementById("editor").innerHTML

  document.getElementById("preview").innerHTML = `
    <h1>${title}</h1>
    <p>${intro}</p>
    ${content}
  `
}

async function saveArticle() {
  const data = {
    title: document.getElementById("title").value,
    section: document.getElementById("section").value,
    subsection: document.getElementById("subsection").value,
    intro: document.getElementById("intro").value,
    content: document.getElementById("editor").innerHTML,
    created: Date.now()
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
