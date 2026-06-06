async function loadQuotes() {
  const res = await fetch("/api/quotes/public-list");
  const data = await res.json();

  if (!data.quotes || data.quotes.length === 0) return;

  const container = document.getElementById("quotesContainer");

  function spawnQuote() {
    const q = data.quotes[Math.floor(Math.random() * data.quotes.length)];

    const el = document.createElement("div");
    el.className = "quote";
    el.textContent = q.text;

    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    container.appendChild(el);

    setTimeout(() => {
      el.remove();
    }, 15000);
  }

  setInterval(spawnQuote, 1200);
  spawnQuote();
}

loadQuotes();
