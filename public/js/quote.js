export async function loadQuote() {
  try {
    const res = await fetch("/api/quotes/public-list");
    const data = await res.json();

    if (!data.quotes || data.quotes.length === 0) return;

    const q = data.quotes[Math.floor(Math.random() * data.quotes.length)];

    document.getElementById("quoteBox").textContent = q.text;
    document.getElementById("quoteAuthor").textContent = q.author;
  } catch (e) {
    console.error("Chyba při načítání citátu:", e);
  }
}

loadQuote();
