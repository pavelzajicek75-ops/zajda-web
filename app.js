// /app.js

let currentLang = 'cs';

const texts = {
  cs: {
    siteTitle: "Moje diagnóza, můj vesmír",
    navArticles: "Články",
    navQuotes: "Citáty",
    navGallery: "Fotky",
    navContact: "Kontakt",
    sectionArticlesTitle: "Nejnovější články",
    sectionQuotesTitle: "Dnešní citát",
    sectionGalleryTitle: "Náhodná fotka",
    footerText: "© 2026 Moje diagnóza, můj vesmír"
  },
  en: {
    siteTitle: "My Diagnosis, My Universe",
    navArticles: "Articles",
    navQuotes: "Quotes",
    navGallery: "Photos",
    navContact: "Contact",
    sectionArticlesTitle: "Latest Articles",
    sectionQuotesTitle: "Quote of the Day",
    sectionGalleryTitle: "Random Photo",
    footerText: "© 2026 My Diagnosis, My Universe"
  }
};

function applyLang() {
  const t = texts[currentLang];

  document.getElementById("siteTitle").textContent = t.siteTitle;
  document.getElementById("navArticles").textContent = t.navArticles;
  document.getElementById("navQuotes").textContent = t.navQuotes;
  document.getElementById("navGallery").textContent = t.navGallery;
  document.getElementById("navContact").textContent = t.navContact;
  document.getElementById("sectionArticlesTitle").textContent = t.sectionArticlesTitle;
  document.getElementById("sectionQuotesTitle").textContent = t.sectionQuotesTitle;
  document.getElementById("sectionGalleryTitle").textContent = t.sectionGalleryTitle;
  document.getElementById("footerText").textContent = t.footerText;

  document.getElementById("langCs").classList.toggle("active", currentLang === "cs");
  document.getElementById("langEn").classList.toggle("active", currentLang === "en");
}

function setLang(lang) {
  currentLang = lang;
  applyLang();
  loadArticles();
  loadQuote();
  loadFlyingQuotes();
}

// --- ČLÁNKY ---
async function loadArticles() {
  const res = await fetch(`/functions/api/articles/list?lang=${currentLang}`);
  const data = await res.json();

  const box = document.getElementById("articlesList");
  box.innerHTML = "";

  (data.articles || []).slice(0, 5).forEach(a => {
    const div = document.createElement("div");
    div.className = "article";
    const dateStr = a.date ? new Date(a.date).toLocaleDateString(currentLang === 'cs' ? "cs-CZ" : "en-GB") : "";
    div.innerHTML = `
      <h3>${a.title}</h3>
      <small>${a.section} / ${a.subsection} — ${dateStr}</small>
      <p>${(a.content || "").replace(/<[^>]+>/g, "").substring(0, 200)}...</p>
    `;
    box.appendChild(div);
  });
}

// --- DNEŠNÍ CITÁT ---
async function loadQuote() {
  const res = await fetch(`/functions/api/quotes/random?lang=${currentLang}`);
  const data = await res.json();
  document.getElementById("quoteBox").textContent = data.quote || "";
}

// --- LÉTAJÍCÍ CITÁTY ---
async function loadFlyingQuotes() {
  const res = await fetch(`/functions/api/quotes/list?lang=${currentLang}`);
  const data = await res.json();
  const quotes = data.quotes || [];

  const box = document.getElementById("flyingQuotes");
  box.innerHTML = "";

  quotes.slice(0, 5).forEach(q => {
    const span = document.createElement("span");
    span.textContent = q.text || q;

    span.addEventListener("mouseenter", () => {
      span.classList.add("star-glow");
      setTimeout(() => {
        span.classList.remove("star-glow");
      }, 3000);
    });

    box.appendChild(span);
  });
}

// --- NÁHODNÁ FOTKA ---
async function loadRandomPhoto() {
  const res = await fetch("/functions/api/photos/list");
  const data = await res.json();

  if (!data.photos || data.photos.length === 0) return;

  const random = data.photos[Math.floor(Math.random() * data.photos.length)];
  document.getElementById("randomPhoto").src = random.url;
}

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
  applyLang();
  loadArticles();
  loadQuote();
  loadFlyingQuotes();
  loadRandomPhoto();
});
