async function loadQuotesPreview() {
  try {
    const res = await authenticatedFetch("/api/quotes/list");
    if (!res.ok) {
      console.error("Chyba API:", res.status);
      return;
    }

    const quotes = await res.json(); // 🔥 JSON je přímo pole

    const box = document.getElementById("quotesPreview");
    box.innerHTML = "";

    quotes.slice(0, 5).forEach(q => {
      const div = document.createElement("div");
      div.className = "quote-item";
      div.innerHTML = `
        <p>"${q.text}"</p>
        <small>– ${q.author || ""}</small>
      `;
      box.appendChild(div);
    });

  } catch (err) {
    console.error("Chyba při načítání citátů:", err);
  }
}
