const API_BASE = "/api/quotes";

async function authenticatedFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

const tbody = document.getElementById("quotes-tbody");
const btnAdd = document.getElementById("btn-add");
const btnDeleteSelected = document.getElementById("btn-delete-selected");
const selectAll = document.getElementById("select-all");

const formSection = document.getElementById("form-section");
const listSection = document.getElementById("list-section");
const form = document.getElementById("quote-form");
const formTitle = document.getElementById("form-title");
const inputId = document.getElementById("quote-id");
const inputText = document.getElementById("quote-text");
const inputAuthor = document.getElementById("quote-author");
const btnCancel = document.getElementById("btn-cancel");

function showForm(edit = false, quote = null) {
  formSection.classList.remove("hidden");
  listSection.classList.add("hidden");
  if (edit && quote) {
    formTitle.textContent = "Edit Quote";
    inputId.value = quote.id;
    inputText.value = quote.text;
    inputAuthor.value = quote.author || "";
  } else {
    formTitle.textContent = "New Quote";
    inputId.value = "";
    inputText.value = "";
    inputAuthor.value = "";
  }
}

function showList() {
  formSection.classList.add("hidden");
  listSection.classList.remove("hidden");
}

async function loadQuotes() {
  try {
    const res = await authenticatedFetch(`${API_BASE}/list`);
    if (!res.ok) {
      console.error("API error:", res.status);
      tbody.innerHTML = `<tr><td colspan="6">Error ${res.status}</td></tr>`;
      return;
    }

    const data = await res.json();
    const quotes = Array.isArray(data[0]) ? data[0] : data;

    tbody.innerHTML = "";
    quotes.forEach((q) => {
      const tr = document.createElement("tr");

      const tdCheck = document.createElement("td");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "row-check";
      cb.dataset.id = q.id;
      tdCheck.appendChild(cb);

      const tdText = document.createElement("td");
      tdText.textContent = q.text;

      const tdAuthor = document.createElement("td");
      tdAuthor.textContent = q.author || "";

      const tdCreated = document.createElement("td");
      tdCreated.textContent = q.created
        ? new Date(q.created).toLocaleString()
        : "";

      const tdUpdated = document.createElement("td");
      tdUpdated.textContent = q.updated
        ? new Date(q.updated).toLocaleString()
        : "";

      const tdActions = document.createElement("td");
      const btnEdit = document.createElement("button");
      btnEdit.textContent = "✏️";
      btnEdit.addEventListener("click", () => showForm(true, q));

      const btnDelete = document.createElement("button");
      btnDelete.textContent = "🗑️";
      btnDelete.addEventListener("click", async () => {
        if (confirm("Delete this quote?")) {
          await authenticatedFetch(`${API_BASE}/delete`, {
            method: "POST",
            body: JSON.stringify({ id: q.id }),
          });
          await loadQuotes();
        }
      });

      tdActions.append(btnEdit, btnDelete);

      tr.append(tdCheck, tdText, tdAuthor, tdCreated, tdUpdated, tdActions);
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load quotes:", err);
    tbody.innerHTML = `<tr><td colspan="6">Error loading quotes</td></tr>`;
  }
}

btnAdd.addEventListener("click", () => showForm(false, null));
btnCancel.addEventListener("click", () => showList());

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = inputId.value.trim();
  const payload = {
    text: inputText.value,
    author: inputAuthor.value,
  };

  if (id) {
    payload.id = id;
    await authenticatedFetch(`${API_BASE}/update`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } else {
    await authenticatedFetch(`${API_BASE}/create`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  await loadQuotes();
  showList();
});

selectAll.addEventListener("change", () => {
  document.querySelectorAll(".row-check").forEach((cb) => {
    cb.checked = selectAll.checked;
  });
});

btnDeleteSelected.addEventListener("click", async () => {
  const ids = Array.from(document.querySelectorAll(".row-check"))
    .filter((cb) => cb.checked)
    .map((cb) => cb.dataset.id);

  if (!ids.length) return;
  if (!confirm(`Delete ${ids.length} quote(s)?`)) return;

  await authenticatedFetch(`${API_BASE}/delete`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });

  await loadQuotes();
});

loadQuotes();
