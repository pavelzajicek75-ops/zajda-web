// ============================================
// CENTRÁLNÍ ADMIN AUTENTIZACE – FINÁLNÍ VERZE
// ============================================

// Získání tokenu
function getToken() {
  return localStorage.getItem("adminToken");
}

// Ověření tokenu přes backend
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
  } catch (err) {
    return false;
  }
}

// Přesměrování na login
function redirectToLogin() {
  window.location.href = "/admin/login.html";
}

// Odhlášení
function logout() {
  localStorage.removeItem("adminToken");
  redirectToLogin();
}

// Zobrazení jména uživatele
function displayUsername() {
  const token = getToken();
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const usernameEl = document.getElementById("username");
    if (usernameEl) {
      usernameEl.textContent = payload.username;
    }
  } catch (err) {
    console.error("Token decode error:", err);
  }
}

// API request s JWT
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

// Inicializace na každé admin stránce
window.addEventListener("DOMContentLoaded", async () => {
  const path = window.location.pathname;

  // Login stránka se neověřuje
  if (path === "/admin/login.html") return;

  const valid = await verifyToken();
  if (!valid) {
    redirectToLogin();
    return;
  }

  displayUsername();
});
