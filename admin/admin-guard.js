(function () {
  // dashboard používá sessionStorage + authToken
  const token = sessionStorage.getItem("authToken");

  if (!token) {
    window.location.href = "/admin/login.html";
    return;
  }
})();
