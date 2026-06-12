// ============================================
// LOGIN – uloží token a přesměruje do dashboardu
// ============================================

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    alert("Špatné přihlášení!");
    return;
  }

  const data = await res.json();

  // 🔥 ULOŽENÍ TOKENU – TOTO JE KLÍČOVÉ
  sessionStorage.setItem("authToken", data.token);

  // přesměrování
  window.location.href = "/admin/dashboard/";
});
