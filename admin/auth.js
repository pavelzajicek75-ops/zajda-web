// ============================================
// CENTRÁLNÍ ADMIN AUTENTIZACE – STABILNÍ VERZE
// ============================================

function getToken() {
  return sessionStorage.getItem("authToken");
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

    // 🔥 prodloužení platnosti tokenu (pokud backend podporuje)
    if (data.exp && Date.now() / 1000 > data.exp) {
      console.warn("Token expiroval – přihlášení vyžaduje obnovu.");
      return false;
    }

    return data.valid === true;
  } catch (err) {
    console.error("Chyba při ověřování tokenu:", err);
    return false;
  }
}

function redirectToLogin() {
  window.location.href = "/admin/login.html";
}

function logout() {
  sessionStorage.removeItem("authToken");
  redirectToLogin();
}

function displayUsername() {
  const token = getToken();
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const usernameEl = document.getElementById("username");
    if (usernameEl) usernameEl.textContent = payload.username;
  } catch (err) {
    console.error("Chyba při dekódování tokenu:", err);
  }
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
