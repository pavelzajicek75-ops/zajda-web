// /admin/login.js
function login() {
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();

  if (user === "admin" && pass === "vesmir2026") {
    sessionStorage.setItem("adminToken", "active");
    window.location.href = "/admin/dashboard.html";
  } else {
    alert("❌ Nesprávné jméno nebo heslo.");
  }
}
