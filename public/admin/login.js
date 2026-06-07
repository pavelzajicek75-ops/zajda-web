document.getElementById("loginBtn").onclick = () => {
  const pwd = document.getElementById("password").value;

  if (pwd === "Zajda2025") {
    localStorage.setItem("adminAuth", "1");
    window.location.href = "/admin/dashboard.html";
  } else {
    alert("Špatné heslo!");
  }
};
