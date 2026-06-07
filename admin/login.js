document.getElementById("togglePass").onclick = () => {
  const pwd = document.getElementById("password");
  pwd.type = pwd.type === "password" ? "text" : "password";
};

document.getElementById("loginBtn").onclick = () => {
  const login = document.getElementById("login").value.trim();
  const pwd = document.getElementById("password").value.trim();

  if (login === "zajda" && pwd === "Cestmir753") {
    localStorage.setItem("adminAuth", "1");
    window.location.href = "/admin/dashboard.html";
  } else {
    alert("Špatné přihlašovací údaje!");
  }
};
