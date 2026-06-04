const quill = new Quill('#editor', {
  theme: 'snow'
});

const params = new URLSearchParams(window.location.search);
const editKey = params.get("edit");

if (editKey) {
  loadArticle(editKey);
}

async function loadArticle(key) {
  const res = await fetch(`/api/articles/get?key=${encodeURIComponent(key)}`);
  if (!res.ok) {
    alert("Nepodařilo se načíst článek");
    return;
  }
  const data = await res.json();

  document.getElementById("title").value = data.title;
  document.getElementById("section").value = data.section;
  document.getElementById("subsection").value = data.subsection;
  document.getElementById("date").value = data.date;
  document.getElementById("place").value = data.place;
  document.getElementById("leadImage").value = data.leadImage || "";
  document.getElementById("leadCaption").value = data.leadCaption || "";
  quill.root.innerHTML = data.content;
}

document.getElementById("insert-photo").addEventListener("click", async () => {
  const popup = document.getElementById("gallery-popup");
  const gallery = document.getElementById("gallery");

  popup.classList.remove("hidden");
  gallery.innerHTML = "Načítám...";

  const res = await fetch("/api/photo/list");
  const photos = await res.json();

  gallery.innerHTML = "";

  photos.forEach(photo => {
    const img = document.createElement("img");
    img.src = `/photos/${photo}`;
    img.addEventListener("click", () => {
      const range = quill.getSelection(true);
      quill.insertEmbed(range.index, "image", `/photos/${photo}`);
      popup.classList.add("hidden");
    });
    gallery.appendChild(img);
  });
});

document.getElementById("save").addEventListener("click", async () => {
  const data = {
    title: document.getElementById("title").value.trim(),
    section: document.getElementById("section").value,
    subsection: document.getElementById("subsection").value.trim(),
    date: document.getElementById("date").value,
    place: document.getElementById("place").value.trim(),
    leadImage: document.getElementById("leadImage").value.trim(),
    leadCaption: document.getElementById("leadCaption").value.trim(),
    content: quill.root.innerHTML
  };

  if (!data.title || !data.section || !data.subsection || !data.date || !data.place || !data.content.trim()) {
    alert("Vyplň název, sekci, podsekci, datum, místo a obsah!");
    return;
  }

  const slug = data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const form = new FormData();
  form.append("data", JSON.stringify(data));
  form.append("slug", slug);
  if (editKey) form.append("editKey", editKey);

  const res = await fetch("/api/articles/save", {
    method: "POST",
    body: form
  });

  if (!res.ok) {
    alert("Chyba při ukládání článku");
    return;
  }

  alert("Článek uložen");
});
