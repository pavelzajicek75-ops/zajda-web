export async function loadQuote() {
  try {
    const res = await fetch("/api/quotes/public-list");
    const data = await res.json();

    if (!data.quotes || data.quotes.length === 0) return;

    // Vyber náhodný citát
    const q = data.quotes[Math.floor(Math.random() * data.quotes.length)];

    // Ověř, že má text a autora
    const text = q.text || "";
    const author = q.author || "";

    // Vlož čistý text
    const quoteBox = document.getElementById("quoteBox");
    const quoteAuthor = document.getElementById("quoteAuthor");

    if (quoteBox) quoteBox.textContent = text;
    if (quoteAuthor) quoteAuthor.textContent = author;
  } catch (e) {
    console.error("Chyba při načítání citátu:", e);
  }
}

loadQuote();
