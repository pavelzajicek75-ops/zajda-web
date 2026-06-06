async function loadQuotes() {
  const res = await fetch("/api/quotes/public-list");
  const data = await res.json();

  if (!data.quotes || data.quotes.length === 0) return;

  const container = document.getElementById("quotesContainer");

  let activeQuotes = 0;
  const MAX_QUOTES = 10;

  function splitQuote(text) {
    if (text.length <= 40) return text; // krátké necháme

    const mid = Math.floor(text.length / 2);

    // najdeme nejbližší mezeru kolem středu
    let splitPos = text.indexOf(" ", mid);
    if (splitPos === -1) splitPos = mid;

    const part1 = text.slice(0, splitPos).trim();
    const part2 = text.slice(splitPos).trim();

    return part1 + "\n" + part2;
  }

  function spawnQuote() {
    if (activeQuotes >= MAX_QUOTES) return;

    const q = data.quotes[Math.floor(Math.random() * data.quotes.length)];

    const el = document.createElement("div");
    el.className = "quote";

    // 🔥 automatické rozdělení dlouhých citátů
    el.textContent = splitQuote(q.text);

    const startX = Math.random() * window.innerWidth;
    const startY = Math.random() * window.innerHeight;

    const dx = (Math.random() - 0.5) * 2.2; 
    const dy = (Math.random() - 0.5) * 2.2;

    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    el.style.opacity = 0;

    container.appendChild(el);
    activeQuotes++;

    setTimeout(() => {
      el.style.opacity = 0.5;
    }, 100);

    let x = startX;
    let y = startY;

    const interval = setInterval(() => {
      x += dx;
      y += dy;

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;

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
        }, 1500);
      }
    }, 25);
  }

  setInterval(spawnQuote, 1200);
  spawnQuote();
}

loadQuotes();
