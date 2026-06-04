function togglePassword() {
  const pass = document.getElementById("password");
  pass.type = pass.type === "password" ? "text" : "password";
}

function login() {
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();

  const savedPass = localStorage.getItem("adminPassword") || "vesmir2026";

  if (user === "admin" && pass === savedPass) {
    sessionStorage.setItem("adminToken", "active");
    window.location.href = "/admin/dashboard.html";
  } else {
    alert("❌ Nesprávné jméno nebo heslo.");
  }
}
