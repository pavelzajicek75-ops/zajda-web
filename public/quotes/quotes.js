async function loadQuotes() {
  const res = await fetch("/api/quotes/list?v=10", {
    headers: {
      "Cache-Control": "no-store"
    }
  });

  const quotes = await res.json();
  const ul = document.getElementById("quotes-list");
  ul.innerHTML = "";

  quotes.forEach((q) => {
    const li = document.createElement("li");
    const text = document.createElement("p");
    text.textContent = `“${q.text}”`;
    const author = document.createElement("span");
    author.textContent = q.author ? `— ${q.author}` : "";
    li.appendChild(text);
    li.appendChild(author);
    ul.appendChild(li);
  });
}

loadQuotes();
