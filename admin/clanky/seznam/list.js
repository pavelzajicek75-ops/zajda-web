async function loadArticles() {
  const res = await fetch("/api/articles/list");
  const items = await res.json();

  const list = document.getElementById("list");
  list.innerHTML = "";

  items.forEach(a => {
    const row = document.createElement("div");
    row.className = "row";

    row.innerHTML = `
      <strong>${a.title}</strong>
      <span>${a.section} / ${a.subsection}</span>
      <span>${a.date}</span>
      <button class="edit">Upravit</button>
      <button class="delete">Smazat</button>
    `;

    row.querySelector(".edit").addEventListener("click", () => {
      window.location.href = `/admin/clanky/?edit=${encodeURIComponent(a.key)}`;
    });

    row.querySelector(".delete").addEventListener("click", async () => {
      if (!confirm("Opravdu smazat článek?")) return;

      const res = await fetch("/api/articles/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: a.key })
      });

      if (res.ok) {
        row.remove();
      } else {
        alert("Chyba při mazání");
      }
    });

    list.appendChild(row);
  });
}

loadArticles();
