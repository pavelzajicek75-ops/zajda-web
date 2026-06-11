async function loadRandomQuote() {
  const res = await fetch("/api/quotes/random?v=3", {
    headers: {
      "Cache-Control": "no-store"
    }
  });

  const q = await res.json();

  document.getElementById("quote-text").textContent = q.text;
  document.getElementById("quote-author").textContent = q.author;
}

loadRandomQuote();
