// /app.js

async function loadFloatingQuotes() {
  const res = await fetch("/functions/api/quotes/list");
  const data = await res.json();
  const quotes = data.quotes || [];

  const container = document.getElementById("floatingQuotesContainer");
  container.innerHTML = "";

  quotes.forEach(q => {
    const div = document.createElement("div");
    div.className = "floating-quote";

    div.style.top = Math.random() * 90 + "vh";
    div.style.left = Math.random() * 90 + "vw";
    div.style.animationDelay = (Math.random() * 10) + "s";

    div.innerHTML = `<div>${q}</div>`;

    div.addEventListener("mouseenter", () => {
      div.classList.add("star-glow");
      setTimeout(() => div.classList.remove("star-glow"), 3000);
    });

    container.appendChild(div);
  });
}

document.addEventListener("DOMContentLoaded", loadFloatingQuotes);
