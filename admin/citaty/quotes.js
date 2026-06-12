// ============================================
// CITÁTY – ADMINISTRACE
// ============================================

const API_BASE = "/api/quotes";

// ----------------------
// Pomocná fetch funkce
// ----------------------
async function api(url, method = "GET", body = null) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" }
  };
  if (body) options.body = JSON.stringify(body);
  return fetch(url, options);
}

// ----------------------
// Elementy
// ----------------------
const tbody = document.getElementById("quotes-tbody");
const btnAdd = document.getElementById("btn-add");
const btnDeleteSelected = document.getElementById("btn-delete-selected");
const selectAll = document.getElementById("select-all");

const formSection = document.getElementById("form-section");
const listSection = document.querySelector("table");
const form = document.getElementById("quote-form");
const formTitle = document.getElementById("form-title");
const inputId = document.getElementById("quote-id");
const inputText = document.getElementById("quote-text");
const inputAuthor = document.getElementById("quote-author");
const btnCancel = document.getElementById("btn-cancel");

// ----------------------
// Zobrazení formuláře
// ----------------------
function showForm(edit = false, quote = null) {
  formSection.classList.remove("hidden");
  listSection.classList.add("hidden");

  if (edit && quote) {
    formTitle.textContent = "Upravit citát";
    inputId.value = quote.id;
    inputText.value = quote.text;
    inputAuthor.value = quote.author || "";
  } else {
    formTitle.textContent = "Nový citát";
    inputId.value = "";
    inputText.value = "";
    inputAuthor.value = "";
  }
}

function showList() {
  formSection.classList.add("hidden");
  listSection.classList.remove("hidden");
}

// ----------------------
// Načtení citátů
// ----------------------
async function loadQuotes() {
  try {
    const res = await api(`${API_BASE}/list`);
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="6">Chyba API: ${res.status}</td></tr>`;
      return;
    }

    const quotes = await res.json();
    tbody.innerHTML = "";

    quotes.forEach(q => {
      const tr = document.createElement("tr");

      // checkbox
      const tdCheck = document.createElement("td");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "row-check";
      cb.dataset.id = q.id;
      tdCheck.appendChild(cb);

      // text
      const tdText = document.createElement("td");
      tdText.textContent = q.text;

      // autor
      const tdAuthor = document.createElement("td");
      tdAuthor.textContent = q.author || "";

      // created
      const tdCreated = document.createElement("td");
      tdCreated.textContent = q.created
        ? new Date(q.created).toLocaleString()
        : "";

      // updated
      const tdUpdated = document.createElement("td");
      tdUpdated.textContent = q.updated
        ? new Date(q.updated).toLocaleString()
        : "";

      // akce
      const tdActions = document.createElement("td");

      const btnEdit = document.createElement("button");
      btnEdit.textContent = "✏️";
      btnEdit.addEventListener("click", () => showForm(true, q));

      const btnDelete = document.createElement("button");
      btnDelete.textContent = "🗑️";
      btnDelete.addEventListener("click", async () => {
        if (confirm("Smazat tento citát?")) {
          await api(`${API_BASE}/delete`, "POST", { id: q.id });
          await loadQuotes();
        }
      });

      tdActions.append(btnEdit, btnDelete);

      tr.append(tdCheck, tdText, tdAuthor, tdCreated, tdUpdated, tdActions);
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6">Chyba při načítání citátů</td></tr>`;
  }
}

// ----------------------
// Formulář – uložení
// ----------------------
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = inputId.value.trim();
  const payload = {
    text: inputText.value,
    author: inputAuthor.value
  };

  if (id) {
    payload.id = id;
    await api(`${API_BASE}/update`, "POST", payload);
  } else {
    await api(`${API_BASE}/create`, "POST", payload);
  }

  await loadQuotes();
  showList();
});

// ----------------------
// Hromadné mazání
// ----------------------
selectAll.addEventListener("change", () => {
  document.querySelectorAll(".row-check").forEach(cb => {
    cb.checked = selectAll.checked;
  });
});

btnDeleteSelected.addEventListener("click", async () => {
  const ids = Array.from(document.querySelectorAll(".row-check"))
    .filter(cb => cb.checked)
    .map(cb => cb.dataset.id);

  if (!ids.length) return;
  if (!confirm(`Smazat ${ids.length} citát(ů)?`)) return;

  await api(`${API_BASE}/delete`, "POST", { ids });
  await loadQuotes();
});

// ----------------------
// Tlačítka
// ----------------------
btnAdd.addEventListener("click", () => showForm(false, null));
btnCancel.addEventListener("click", () => showList());

// ----------------------
// Start
// ----------------------
loadQuotes();
