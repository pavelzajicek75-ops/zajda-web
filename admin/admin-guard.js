// ============================================
// ADMIN GUARD – kontrola přihlášení
// ============================================

(function () {
  const token = sessionStorage.getItem("authToken");

  // není token → login
  if (!token) {
    window.location.href = "/admin/login/";
    return;
  }
})();
