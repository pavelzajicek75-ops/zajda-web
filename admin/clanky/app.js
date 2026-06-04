function openPhotoModal() {
  document.getElementById("photoModal").classList.remove("hidden")
}

function closePhotoModal() {
  document.getElementById("photoModal").classList.add("hidden")
}

function insertPhoto(url) {
  const editor = document.getElementById("editor")
  editor.innerHTML += `<img src="${url}" class="article-photo">`
  updatePreview()
  closePhotoModal()
}

function updatePreview() {
  const title = document.getElementById("title").value
  const perex = document.getElementById("perex").value
  const content = document.getElementById("editor").innerHTML

  document.getElementById("preview").innerHTML = `
    <h1>${title}</h1>
    <p><em>${perex}</em></p>
    ${content}
  `
}

async function saveArticle() {
  const data = {
    title: document.getElementById("title").value,
    category: document.getElementById("category").value,
    perex: document.getElementById("perex").value,
    content: document.getElementById("editor").innerHTML,
    created: Date.now()
  }

  const res = await fetch("/functions/api/articles/save", {
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

document.addEventListener("input", (e) => {
  if (["title", "perex", "editor"].includes(e.target.id)) updatePreview()
})
