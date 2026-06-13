const API_BASE = "/functions/api/admin";

function getAuthHeaders() {
  const token = sessionStorage.getItem("authToken");
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
}

async function login(password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");

  sessionStorage.setItem("authToken", data.token);
  return data.token;
}

async function verifyToken() {
  const res = await fetch(`${API_BASE}/verify`, {
    method: "POST",
    headers: getAuthHeaders()
  });

  if (!res.ok) return false;

  const data = await res.json();
  return data.valid === true;
}

async function listPhotos() {
  const res = await fetch(`${API_BASE}/photos/list`, {
    headers: getAuthHeaders()
  });

  if (!res.ok) throw new Error("Failed to list photos");
  return res.json();
}

async function getPhotoInfo(key) {
  const res = await fetch(`${API_BASE}/photos/info?key=${encodeURIComponent(key)}`, {
    headers: getAuthHeaders()
  });

  if (!res.ok) throw new Error("Failed to get photo info");
  return res.json();
}

async function deletePhoto(key) {
  const res = await fetch(`${API_BASE}/photos/delete`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ key })
  });

  if (!res.ok) throw new Error("Failed to delete photo");
  return res.json();
}

async function uploadPhoto(file, key) {
  const formData = new FormData();
  formData.append("file", file);
  if (key) formData.append("key", key);

  const token = sessionStorage.getItem("authToken");

  const res = await fetch(`${API_BASE}/photos/upload`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` },
    body: formData
  });

  if (!res.ok) throw new Error("Failed to upload photo");
  return res.json();
}

async function adminGuard() {
  const token = sessionStorage.getItem("authToken");
  if (!token) {
    window.location.href = "/admin/login.html";
    return false;
  }

  const valid = await verifyToken();
  if (!valid) {
    sessionStorage.removeItem("authToken");
    window.location.href = "/admin/login.html";
    return false;
  }

  return true;
}
