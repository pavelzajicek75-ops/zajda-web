// ============================================
// LOGIN – přihlášení administrátora
// ============================================

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  const res = await fetch("/functions/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Chyba přihlášení");
    return;
  }

  // Uložit token
  localStorage.setItem("adminToken", data.token);

  // Přesměrování
  window.location.href = "/admin/dashboard.html";
});
