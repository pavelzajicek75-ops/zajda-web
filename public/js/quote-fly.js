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

    // náhodná startovní pozice
    const startX = Math.random() * window.innerWidth;
    const startY = Math.random() * window.innerHeight;

    // náhodný směr a rychlost
    const dx = (Math.random() - 0.5) * 0.4; // horizontální rychlost
    const dy = (Math.random() - 0.5) * 0.4; // vertikální rychlost

    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    el.style.opacity = 0;

    container.appendChild(el);

    // fade-in
    setTimeout(() => {
      el.style.opacity = 0.6;
    }, 100);

    // animace pohybu
    let x = startX;
    let y = startY;

    const interval = setInterval(() => {
      x += dx;
      y += dy;

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;

      // fade-out + odstranění
      if (x < -200 || x > window.innerWidth + 200 || y < -200 || y > window.innerHeight + 200) {
        el.style.opacity = 0;
        clearInterval(interval);
        setTimeout(() => el.remove(), 1000);
      }
    }, 30);
  }

  // generuj nový citát každých 1.5 sekundy
  setInterval(spawnQuote, 1500);
  spawnQuote();
}

loadQuotes();
