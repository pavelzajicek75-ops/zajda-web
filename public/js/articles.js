export async function loadArticles() {
  try {
    const res = await fetch("/api/articles/list");
    const data = await res.json();

    const list = document.getElementById("articlesList");
    if (!list) return;

    if (!data.articles || data.articles.length === 0) {
      list.innerHTML = "<p>Žádné články zatím nejsou.</p>";
      return;
    }

    list.innerHTML = data.articles
      .map(a => `
        <article style="margin-bottom:40px;">
          <h3>${a.title}</h3>
          <p>${a.text}</p>
        </article>
      `)
      .join("");
  } catch (e) {
    console.error("Chyba při načítání článků:", e);
  }
}

loadArticles();
