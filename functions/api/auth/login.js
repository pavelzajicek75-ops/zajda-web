document.getElementById("loginBtn").onclick = async () => {
  const pwd = document.getElementById("password").value;

  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: pwd })
  });

  const data = await res.json();
  if (data.token) {
    localStorage.setItem("adminToken", data.token);
    window.location.href = "/admin/dashboard.html";
  } else {
    alert("Špatné heslo!");
  }
};
