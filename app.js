// /app.js

// --- LÉTAJÍCÍ CITÁTY PO CELÉ STRÁNCE ---
async function loadFloatingQuotes() {
  const res = await fetch("/functions/api/quotes/list");
  const data = await res.json();
  const quotes = data.quotes || [];

  const container = document.getElementById("floatingQuotesContainer");
  container.innerHTML = "";

  quotes.forEach((q, i) => {
    const div = document.createElement("div");
    div.className = "floating-quote";

    // náhodná pozice
    div.style.top = Math.random() * 90 + "vh";
    div.style.left = Math.random() * 90 + "vw";
    div.style.animationDelay = (Math.random() * 5) + "s";

    div.innerHTML = `
      <div class="quote-cz">${q.cz}</div>
      <div class="quote-en">${q.en}</div>
    `;

    // hvězdný efekt
    div.addEventListener("mouseenter", () => {
      div.classList.add("star-glow");
      setTimeout(() => {
        div.classList.remove("star-glow");
      }, 3000);
    });

    container.appendChild(div);
  });
}

// --- ČLÁNKY: CESTOVÁNÍ ---
async function loadTravelArticles() {
  const res = await fetch("/functions/api/articles/list?section=travel");
  const data = await res.json();

  const box = document.getElementById("travelArticles");
  box.innerHTML = "";

  (data.articles || []).forEach(a => {
    const div = document.createElement("div");
    div.className = "article";
    div.innerHTML = `<h3>${a.title}</h3><p>${a.content.substring(0,150)}...</p>`;
    box.appendChild(div);
  });
}

// --- ČLÁNKY: PROJEKTY ---
async function loadProjectArticles() {
  const res = await fetch("/functions/api/articles/list?section=projects");
  const data = await res.json();

  const box = document.getElementById("projectArticles");
  box.innerHTML = "";

  (data.articles || []).forEach(a => {
    const div = document.createElement("div");
    div.className = "article";
    div.innerHTML = `<h3>${a.title}</h3><p>${a.content.substring(0,150)}...</p>`;
    box.appendChild(div);
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
  loadFloatingQuotes();
  loadTravelArticles();
  loadProjectArticles();
  loadRandomPhoto();
});
