async function loadQuotes() {
  const res = await fetch("/api/quotes/list");
  const quotes = await res.json();
  const table = document.getElementById("quotesTable");
  table.innerHTML = "";

  quotes.forEach(q => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${q.text}</td>
      <td>${q.author}</td>
      <td>
        <button onclick="editQuote('${q.author}')">✏️</button>
        <button onclick="deleteQuote('${q.author}')">🗑️</button>
      </td>`;
    table.appendChild(row);
  });
}

loadQuotes();
