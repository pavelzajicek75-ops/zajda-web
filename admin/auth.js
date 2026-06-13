// ============================================
// AUTH – přidání tokenu do všech fetch požadavků
// ============================================

export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem("adminToken");

  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };

  const res = await fetch(url, {
    ...options,
    headers
  });

  if (res.status === 401) {
    // token neplatný → logout
    localStorage.removeItem("adminToken");
    window.location.href = "/admin/login.html";
    return;
  }

  return res;
}
