document.addEventListener("DOMContentLoaded", async () => {
  const loading = document.getElementById("loading");
  const dashboard = document.getElementById("dashboard");
  const logoutBtn = document.getElementById("logout");

  const token = localStorage.getItem("token");

  if (!token) {
    loading.textContent = "Nepřihlášen — přesměrovávám…";
    window.location.href = "/admin/login.html";
    return;
  }

  try {
    const res = await fetch("/api/verify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (!data.ok) {
      loading.textContent = "Session expirovala — přesměrovávám…";
      localStorage.removeItem("token");
      window.location.href = "/admin/login.html";
      return;
    }

    loading.style.display = "none";
    dashboard.style.display = "block";
  } catch (err) {
    console.error(err);
    loading.textContent = "Chyba serveru!";
  }

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "/admin/login.html";
  });
});
