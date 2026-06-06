// /admin/dashboard.js

// ŽÁDNÉ checkLogin(), ŽÁDNÉ redirecty – to řeší auth.js

async function loadStats() {
  try {
    const res = await authenticatedFetch("/api/admin/stats");
    if (!res) return;

    const data = await res.json();

    document.getElementById("articlesCount").textContent = data.articles || 0;
    document.getElementById("photosCount").textContent = data.photos || 0;
    document.getElementById("quotesCount").textContent = data.quotes || 0;
    document.getElementById("usersCount").textContent = data.users || 0;

  } catch (err) {
    console.error("Chyba při načítání statistik:", err);
  }
}

async function loadArticles() {
  try {
    const res = await authenticatedFetch("/api/articles/list");
    if (!res) return;

    const data = await res.json();
    const tbody = document.getElementById("articlesList");
    tbody.innerHTML = "";

    data.articles.forEach(article => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${article.title}</td>
        <td>${article.category}</td>
        <td>${article.lang}</td>
        <td>${article.date}</td>
        <td><a href="/admin/clanky/edit.html?id=${article.id}">Upravit</a></td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("Chyba při načítání článků:", err);
  }
}
