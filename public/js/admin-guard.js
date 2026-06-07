(async () => {
  const token = localStorage.getItem("adminToken");
  if (!token) return (window.location.href = "/admin/login.html");

  const res = await fetch("/api/auth/verify", {
    headers: {
      Authorization: token   // 🔥 BEZ "Bearer"
    }
  });

  const data = await res.json();

  if (!data.ok) {
    localStorage.removeItem("adminToken");
    window.location.href = "/admin/login.html";
  }
})();
