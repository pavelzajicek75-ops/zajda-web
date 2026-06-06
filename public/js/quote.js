export async function loadQuote() {
  try {
    const res = await fetch("/api/quotes/public-list");
    const data = await res.json();

    if (!data.quotes || data.quotes.length === 0) return;

    const q = data.quotes[Math.floor(Math.random() * data.quotes.length)];

    const el = document.getElementById("quoteBox");
    if (!el) return;

    el.innerHTML = `
      <div style="font-size:22px; color:#ffffff; text-align:center; margin-top:20px;">
        ${q.text}
        <div style="margin-top:8px; font-size:18px; opacity:0.7;">${q.author}</div>
      </div>
    `;
  } catch (e) {
    console.error("Chyba při načítání citátu:", e);
  }
}

loadQuote();
