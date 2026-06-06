// /admin/clanky/edit.js

async function loadArticle() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) return;

  try {
    const res = await authenticatedFetch(`/api/articles/get?id=${id}`);
    if (!res) return;

    const data = await res.json();

    document.getElementById("title").value = data.title || "";
    document.getElementById("category").value = data.category || "";
    document.getElementById("lang").value = data.lang || "cs";
    document.getElementById("content").value = data.content || "";

  } catch (err) {
    console.error("Chyba při načítání článku:", err);
  }
}

async function saveArticle(e) {
  e.preventDefault();

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const body = {
    id,
    title: document.getElementById("title").value.trim(),
    category: document.getElementById("category").value.trim(),
    lang: document.getElementById("lang").value.trim(),
    content: document.getElementById("content").value.trim()
  };

  try {
    const res = await authenticatedFetch("/api/articles/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      alert("Chyba při ukládání článku.");
      return;
    }

    alert("Článek uložen.");
    window.location.href = "/admin/clanky/index.html";

  } catch (err) {
    console.error("Chyba při ukládání:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadArticle();
  document.getElementById("articleForm").addEventListener("submit", saveArticle);
});
