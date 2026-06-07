document.getElementById("loginBtn").onclick = () => {
  const pwd = document.getElementById("password").value;

  if (pwd === "Zajda2025") {   // 🔥 tvoje heslo
    localStorage.setItem("adminAuth", "OK");
    window.location.href = "/admin/dashboard.html";
  } else {
    alert("Špatné heslo!");
  }
};
