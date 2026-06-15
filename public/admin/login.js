document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const statusBox = document.getElementById("status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusBox.textContent = "Přihlašuji…";

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: usernameInput.value,
          password: passwordInput.value
        })
      });

      const data = await res.json();

      if (!data.ok) {
        statusBox.textContent = "Špatné jméno nebo heslo!";
        return;
      }

      localStorage.setItem("token", data.token);
      window.location.href = "/admin/";
    } catch (err) {
      console.error(err);
      statusBox.textContent = "Chyba připojení!";
    }
  });
});
