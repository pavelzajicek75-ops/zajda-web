document.addEventListener("DOMContentLoaded", () => {

  const pwd = document.getElementById("password");
  const toggle = document.getElementById("togglePass");

  // 🔥 ZOBRAZENÍ / SKRYTÍ HESLA
  toggle.onclick = () => {
    if (pwd.type === "password") {
      pwd.type = "text";
      toggle.textContent = "🙈 skrýt heslo";
    } else {
      pwd.type = "password";
      toggle.textContent = "👁️ zobrazit heslo";
    }
  };

  // 🔥 LOGIN
  document.getElementById("loginBtn").onclick = () => {
    const login = document.getElementById("login").value.trim();
    const pass = pwd.value.trim();

    if (login === "zajda" && pass === "Cestmir753") {
      localStorage.setItem("adminAuth", "1");
      window.location.href = "/admin/dashboard.html";
    } else {
      alert("Špatné přihlašovací údaje!");
    }
  };

});
