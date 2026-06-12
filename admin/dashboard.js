// ============================================
// DASHBOARD – napojený na centrální autentizaci
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  loadStats();
  loadGalleryPreview();
  loadQuotesPreview();
  loadArticlesPreview();
});

// ============================================
// AUTH FETCH – JEDINÁ SPRÁVNÁ VERZE
// ============================================

async function authenticatedFetch(url, options = {}) {
  const token = sessionStorage.getItem("authToken");

  const res = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (res.status === 401 || res.status === 403) {
    sessionStorage.removeItem("authToken");
    window.location.href = "/admin/login/";
    return null;
  }

  return res;
}

// ===================== STATISTIKY =====================
async function loadStats() {
  const res = await authenticatedFetch("/api/admin/stats");
  if (!res) return;
  const data = await res.json();

  document.getElementById("articlesCount").textContent = data.articles || 0;
  document.getElementById("photosCount").textContent = data.photos || 0;
  document.getElementById("quotesCount").textContent = data.quotes || 0;
  document.getElementById("usersCount").textContent = data.users || 0;
  document.getElementById("sectionsCount").textContent = data.sections || 0;
  document.getElementById("subsectionsCount").textContent = data.subsections || 0;
}

// ===================== GALERIE =====================
async function loadGalleryPreview() {
  const res = await authenticatedFetch("/api/admin/photos/list");
  if (!res) return;
  const data = await res.json();

  const box = document.getElementById("galleryPreview");
  box.innerHTML = "";

  (data.photos || []).slice(0, 6).forEach(photo => {
    const img = document.createElement("img");
    img.src = photo.url;
    img.width = 80;
    img.style.margin = "5px";
    img.style.borderRadius = "6px";
    img.style.boxShadow = "0 0 5px #000";
    box.appendChild(img);
  });
}

// ===================== CITÁTY =====================
async function loadQuotesPreview() {
  const res = await authenticatedFetch("/api/admin/quotes/list");
  if (!res) return;

  const data = await res.json();
  const quotes = Array.isArray(data.quotes) ? data.quotes : data;

  const box = document.getElementById("quotesPreview");
  box.innerHTML = "";

  quotes.slice(0, 3).forEach(q => {
    const div = document.createElement("div");
    div.className = "quote-item";
    div.innerHTML = `<p>"${q.text}"</p><small>– ${q.author || ""}</small>`;
    box.appendChild(div);
  });
}

// ===================== ČLÁNKY =====================
async function loadArticlesPreview() {
  const res = await authenticatedFetch("/api/admin/articles/list");
  if (!res) return;
  const data = await res.json();

  const box = document.getElementById("articlesPreview");
  box.innerHTML = "";

  (data.articles || []).slice(0, 3).forEach(a => {
    const div = document.createElement("div");
    div.className = "article-item";
    div.innerHTML = `<p><strong>${a.title}</strong> <small>${a.date}</small></p>`;
    box.appendChild(div);
  });
}
