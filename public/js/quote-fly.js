async function loadQuotes() {
  const res = await fetch("/api/quotes/public-list");
  const data = await res.json();

  if (!data.quotes || data.quotes.length === 0) return;

  const container = document.getElementById("quotesContainer");

  let activeQuotes = 0;
  const MAX_QUOTES = 10;

  function spawnQuote() {
    if (activeQuotes >= MAX_QUOTES) return;

    const q = data.quotes[Math.floor(Math.random() * data.quotes.length)];

    const el = document.createElement("div");
    el.className = "quote";
    el.textContent = q.text;

    // náhodná startovní pozice
    const startX = Math.random() * window.innerWidth;
    const startY = Math.random() * window.innerHeight;

    // náhodný směr a rychlost (rychlejší než předtím)
    const dx = (Math.random() - 0.5) * 1.2; 
    const dy = (Math.random() - 0.5) * 1.2;

    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    el.style.opacity = 0;

    container.appendChild(el);
    activeQuotes++;

    // fade-in
    setTimeout(() => {
      el.style.opacity = 0.7;
    }, 100);

    let x = startX;
    let y = startY;

    const interval = setInterval(() => {
      x += dx;
      y += dy;

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;

      // fade-out + odstranění
      if (
        x < -300 || 
        x > window.innerWidth + 300 || 
        y < -300 || 
        y > window.innerHeight + 300
      ) {
        el.style.opacity = 0;
        clearInterval(interval);
        setTimeout(() => {
          el.remove();
          activeQuotes--;
        }, 800);
      }
    }, 25); // rychlejší pohyb
  }

  // generuj nový citát každých 1.2 sekundy
  setInterval(spawnQuote, 1200);
  spawnQuote();
}

loadQuotes();
