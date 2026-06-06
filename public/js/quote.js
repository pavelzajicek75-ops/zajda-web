export async function loadQuotes() {
  try {
    const res = await fetch("/api/quotes/public-list");
    const data = await res.json();

    if (!data.quotes || data.quotes.length === 0) return;

    const quoteBox = document.getElementById("quoteBox");
    const quoteAuthor = document.getElementById("quoteAuthor");

    let index = 0;

    function showQuote() {
      const q = data.quotes[index];
      quoteBox.textContent = q.text || "";
      quoteAuthor.textContent = q.author || "";
      index = (index + 1) % data.quotes.length;
    }

    // zobraz první citát
    showQuote();

    // měň citát každých 10 sekund
    setInterval(showQuote, 10000);

  } catch (e) {
    console.error("Chyba při načítání citátů:", e);
  }
}

loadQuotes();
