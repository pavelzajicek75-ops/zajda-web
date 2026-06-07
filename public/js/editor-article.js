document.getElementById("saveBtn").addEventListener("click", async () => {
  const id = Date.now().toString();

  const body = {
    id,
    title: document.getElementById("title").value,
    place: document.getElementById("place").value,
    date: document.getElementById("date").value,
    section: document.getElementById("section").value,
    subsection: document.getElementById("subsection").value,
    content: document.getElementById("content").value,
    created: Date.now()
  };

  const res = await fetch("/api/articles/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },   // 🔥 DŮLEŽITÉ
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    alert("❌ Chyba při ukládání článku!");
    return;
  }

  alert("✅ Článek uložen!");
});
