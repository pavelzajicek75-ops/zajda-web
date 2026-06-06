// /admin/login.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const errorBox = document.getElementById("login-error");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      showError("Vyplň uživatelské jméno i heslo.");
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok || !data.token) {
        showError(data.error || "Přihlášení selhalo.");
        return;
      }

      // Uložit JWT
      localStorage.setItem("adminToken", data.token);

      // Přesměrování na dashboard
      window.location.href = "/admin/dashboard.html";
    } catch (err) {
      showError("Chyba připojení k serveru.");
    }
  });

  function showError(msg) {
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.style.display = "block";
    } else {
      alert(msg);
    }
  }
});
