document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const passwordInput = document.getElementById("password");
  const statusBox = document.getElementById("status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusBox.textContent = "Přihlašuji…";

    try {
      const res = await fetch("/functions/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: passwordInput.value
        })
      });

      const data = await res.json();

      if (!data.ok) {
        statusBox.textContent = "Špatné heslo!";
        return;
      }

      // 🔥 ULOŽIT TOKEN DO LOCALSTORAGE
      localStorage.setItem("token", data.token);

      statusBox.textContent = "OK, přesměrovávám…";

      // 🔥 PŘESMĚROVAT DO ADMIN DASHBOARDU
      window.location.href = "/admin/";
    } catch (err) {
      console.error(err);
      statusBox.textContent = "Chyba připojení!";
    }
  });
});
