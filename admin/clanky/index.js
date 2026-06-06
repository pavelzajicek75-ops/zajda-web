// /admin/clanky/index.js

async function loadArticles() {
  try {
    const res = await authenticatedFetch("/api/articles/list");
    if (!res) return;

    const data = await res.json();
    const tbody = document.getElementById("articlesList");
    tbody.innerHTML = "";

    if (!data.articles || data.articles.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="5" style="text-align:center; color:#aaa;">Žádné články</td></tr>
      `;
      return;
    }

    data.articles.forEach(article => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${article.title}</td>
        <td>${article.category}</td>
        <td>${article.lang}</td>
        <td>${article.date}</td>
        <td>
          <a href="/admin/clanky/edit.html?id=${article.id}">Upravit</a>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("Chyba při načítání článků:", err);
  }
}

document.addEventListener("DOMContentLoaded", loadArticles);
