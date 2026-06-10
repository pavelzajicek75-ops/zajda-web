// ============================================
// DASHBOARD – napojený na centrální autentizaci
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  loadStats();
  loadGalleryPreview();
  loadQuotesPreview();
  loadArticlesPreview();
});

// ===================== STATISTIKY =====================
async function loadStats() {
  try {
    const res = await authenticatedFetch("/api/admin/stats");
    if (!res) return;
    const data = await res.json();

    document.getElementById("articlesCount").textContent = data.articles || 0;
    document.getElementById("photosCount").textContent = data.photos || 0;
    document.getElementById("quotesCount").textContent = data.quotes || 0;
    document.getElementById("usersCount").textContent = data.users || 0;
    document.getElementById("sectionsCount").textContent = data.sections || 0;
    document.getElementById("subsectionsCount").textContent = data.subsections || 0;

  } catch (err) {
    console.error("Chyba při načítání statistik:", err);
  }
}

// ===================== GALERIE =====================
async function loadGalleryPreview() {
  try {
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
  } catch (err) {
    console.error("Chyba při načítání galerie:", err);
  }
}

// ===================== CITÁTY =====================
async function loadQuotesPreview() {
  try {
    const res = await authenticatedFetch("/api/admin/quotes/list");
    if (!res) return;
    const data = await res.json();

    const box = document.getElementById("quotesPreview");
    box.innerHTML = "";

    (data.quotes || []).slice(0, 3).forEach(q => {
      const div = document.createElement("div");
      div.className = "quote-item";
      div.innerHTML = `<p>"${q.text}"</p><small>– ${q.author}</small>`;
      box.appendChild(div);
    });
  } catch (err) {
    console.error("Chyba při načítání citátů:", err);
  }
}

// ===================== ČLÁNKY =====================
async function loadArticlesPreview() {
  try {
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
  } catch (err) {
    console.error("Chyba při načítání článků:", err);
  }
}
