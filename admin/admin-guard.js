// ============================================
// ADMIN GUARD – kontrola přihlášení
// ============================================

(function () {
  const token = localStorage.getItem("adminToken");

  if (!token) {
    window.location.href = "/admin/login.html";
    return;
  }
})();
