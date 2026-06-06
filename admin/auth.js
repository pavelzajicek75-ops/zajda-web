// ============================================
// CENTRÁLNÍ ADMIN AUTENTIZACE – FINÁLNÍ VERZE
// ============================================

function getToken() {
  return localStorage.getItem("adminToken");
}

async function verifyToken() {
  const token = getToken();
  if (!token) return false;

  try {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    if (!res.ok) return false;

    const data = await res.json();
    return data.valid === true;
  } catch {
    return false;
  }
}

function redirectToLogin() {
  window.location.href = "/admin/login.html";
}

function logout() {
  localStorage.removeItem("adminToken");
  redirectToLogin();
}

function displayUsername() {
  const token = getToken();
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const usernameEl = document.getElementById("username");
    if (usernameEl) usernameEl.textContent = payload.username;
  } catch {}
}

async function checkAuth() {
  const path = window.location.pathname;

  if (path === "/admin/login.html") return;

  const ok = await verifyToken();
  if (!ok) {
    redirectToLogin();
    return false;
  }

  displayUsername();
  return true;
}

async function authenticatedFetch(url, options = {}) {
  const token = getToken();
  if (!token) {
    redirectToLogin();
    return null;
  }

  const headers = options.headers || {};
  headers["Authorization"] = `Bearer ${token}`;

  return fetch(url, { ...options, headers });
}

window.addEventListener("DOMContentLoaded", () => {
  checkAuth();
});
