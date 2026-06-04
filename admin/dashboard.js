// /admin/dashboard.js

function checkLogin() {
  if (!sessionStorage.getItem("adminToken")) {
    window.location.href = "/admin/login.html";
  }
}

function logout() {
  sessionStorage.removeItem("adminToken");
  window.location.href = "/admin/login.html";
}

async function loadStats() {
  try {
    const [articles, photos, quotes, users] = await Promise.all([
      fetch("/functions/api/articles/list").then(r => r.json()),
      fetch("/functions/api/photos/list").then(r => r.json()),
      fetch("/functions/api/quotes/list").then(r => r.json()),
      fetch("/functions/api/users/online").then(r => r.json())
    ]);

    document.getElementById("articlesCount").textContent = articles.articles?.length || 0;
    document.getElementById("photosCount").textContent = photos.photos?.length || 0;
    document.getElementById("quotesCount").textContent = quotes.quotes?.length || 0;
    document.getElementById("usersCount").textContent = users.online || 0;
  } catch (err) {
    console.error("Chyba při načítání statistik:", err);
  }
}

async function loadArticles() {
  try {
    const res = await fetch("/functions/api/articles/list");
    const data = await res.json();
    const tbody = document.getElementById("articlesList");
    tbody.innerHTML = "";

    data.articles.slice(0, 5).forEach(a => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${a.title}</td>
        <td>${a.section}</td>
        <td>${a.lang || "CZ"}</td>
        <td>${a.date ? new Date(a.date).toLocaleDateString("cs-CZ") : ""}</td>
        <td>
          <button onclick="editArticle('${a.id}')">✏️</button>
          <button onclick="deleteArticle('${a.id}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Chyba při načítání článků:", err);
  }
}

function editArticle(id) {
  window.location.href = `/admin/clanky/index.html?id=${id}`;
}

function deleteArticle(id) {
  if (!confirm("Opravdu smazat článek?")) return;
  fetch(`/functions/api/articles/delete?id=${id}`, { method: "DELETE" })
    .then(() => loadArticles());
}
