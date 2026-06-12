// ============================================
// HLAVNÍ WEB – CITÁTY S EFEKTY (GLOW + FADE-IN + ROTACE)
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  loadQuotesToMain();
});

async function loadQuotesToMain() {
  try {
    const res = await fetch("/api/quotes");
    if (!res.ok) return;

    const data = await res.json();
    const quotes = Array.isArray(data) ? data : [];

    if (!quotes.length) return;

    const container = document.getElementById("quotesSection");
    container.innerHTML = "";

    // vytvoříme element pro citát
    const quoteBox = document.createElement("div");
    quoteBox.id = "quoteBox";
    quoteBox.className = "quote-box";
    container.appendChild(quoteBox);

    let index = 0;

    function showQuote() {
      const q = quotes[index];

      quoteBox.innerHTML = `
        <div class="quote-text">"${q.text}"</div>
        <div class="quote-author">– ${q.author}</div>
      `;

      // animace
      quoteBox.classList.remove("fade-in");
      void quoteBox.offsetWidth; // reset animace
      quoteBox.classList.add("fade-in");

      index = (index + 1) % quotes.length;
    }

    showQuote();
    setInterval(showQuote, 5000); // rotace každých 5 sekund

  } catch (err) {
    console.error("Chyba při načítání citátů:", err);
  }
}
