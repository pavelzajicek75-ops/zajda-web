let quotes = [];

document.addEventListener("DOMContentLoaded", loadQuotes);

async function loadQuotes() {
  const res = await authenticatedFetch("/api/quotes/list");
  const data = await res.json();
  quotes = data.quotes || [];
  renderQuotes();
}

function renderQuotes() {
  const tbody = document.querySelector("#quotesTable tbody");
  tbody.innerHTML = "";

  quotes.forEach(q => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${q.text}</td>
      <td>${q.author}</td>
      <td>
        <button onclick="editQuote('${q.id}')">✏️</button>
        <button onclick="deleteQuote('${q.id}')">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openNew() {
  document.getElementById("quoteId").value = "";
  document.getElementById("quoteText").value = "";
  document.getElementById("quoteAuthor").value = "";
  document.getElementById("modalTitle").textContent = "Nový citát";
  document.getElementById("editModal").style.display = "flex";
}

function editQuote(id) {
  const q = quotes.find(x => x.id === id);
  if (!q) return;

  document.getElementById("quoteId").value = q.id;
  document.getElementById("quoteText").value = q.text;
  document.getElementById("quoteAuthor").value = q.author;
  document.getElementById("modalTitle").textContent = "Upravit citát";
  document.getElementById("editModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("editModal").style.display = "none";
}

async function saveQuote() {
  const id = document.getElementById("quoteId").value;
  const text = document.getElementById("quoteText").value.trim();
  const author = document.getElementById("quoteAuthor").value.trim();

  const body = id ? { id, text, author } : { text, author };

  const res = await authenticatedFetch("/api/quotes/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (res.ok) {
    closeModal();
    loadQuotes();
  } else {
    alert("Chyba při ukládání citátu");
  }
}

async function deleteQuote(id) {
  if (!confirm("Opravdu smazat?")) return;

  const res = await authenticatedFetch(`/api/quotes/delete?id=${id}`);
  if (res.ok) loadQuotes();
}
