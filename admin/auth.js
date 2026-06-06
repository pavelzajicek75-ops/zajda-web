// ============================================
// BEZPEČNÉ PŘIHLÁŠENÍ S JWT
// ============================================

let authToken = localStorage.getItem("adminToken");

// Kontrola přihlášení
function checkAuth() {
  const token = localStorage.getItem("adminToken");
  if (!token) {
    window.location.href = "/admin/login.html";
    return false;
  }
  return true;
}

// Přihlášení
async function login(username, password) {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }

    // Ulož token
    localStorage.setItem("adminToken", data.token);
    authToken = data.token;
    
    return { success: true, username: data.username };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Odhlášení
function logout() {
  localStorage.removeItem("adminToken");
  window.location.href = "/admin/login.html";
}

// Zobraz uživatele
function displayUsername() {
  const token = localStorage.getItem("adminToken");
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const usernameEl = document.getElementById("username");
      if (usernameEl) {
        usernameEl.textContent = payload.username;
      }
    } catch (err) {
      console.error("Error parsing token:", err);
    }
  }
}

// API request s autentifikací
async function authenticatedFetch(url, options = {}) {
  const token = localStorage.getItem("adminToken");
  if (!token) {
    window.location.href = "/admin/login.html";
    return null;
  }

  const headers = options.headers || {};
  headers["Authorization"] = `Bearer ${token}`;

  return fetch(url, {
    ...options,
    headers
  });
}

// Inicializuj při loadování
window.addEventListener("DOMContentLoaded", () => {
  checkAuth();
  displayUsername();
});
