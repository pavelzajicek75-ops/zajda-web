// Předpoklad: login ukládá JWT do sessionStorage pod klíčem "authToken"
// verify endpoint: /api/admin/verify (už máš)
// R2 API: /api/admin/photos/* (viz Functions níže)

function getToken() {
  return sessionStorage.getItem("authToken");
}

async function authenticatedFetch(url, options = {}) {
  const token = getToken();
  if (!token) {
    redirectToLogin();
    return;
  }

  const headers = options.headers || {};
  headers["Authorization"] = `Bearer ${token}`;
  options.headers = headers;

  const res = await fetch(url, options);
  if (res.status === 401) {
    redirectToLogin();
    return;
  }
  return res;
}

function redirectToLogin() {
  window.location.href = "/admin/login.html";
}

async function verifyAuth() {
  const res = await authenticatedFetch("/api/admin/verify", {
    method: "POST"
  });
  if (!res) return;
  const data = await res.json();
  if (!data.valid) {
    redirectToLogin();
  }
}

async function loadPhotos() {
  const grid = document.getElementById("photo-grid");
  grid.innerHTML = "Načítám fotky…";

  const res = await authenticatedFetch("/api/admin/photos/list");
  if (!res) return;
  const data = await res.json();

  grid.innerHTML = "";

  data.forEach((item) => {
    const card = document.createElement("div");
    card.className = "photo-card";

    const img = document.createElement("img");
    img.src = item.url;
    img.alt = item.key;

    const meta = document.createElement("div");
    meta.className = "photo-meta";
    meta.textContent = item.key;

    const actions = document.createElement("div");
    actions.className = "photo-actions";

    const infoBtn = document.createElement("button");
    infoBtn.className = "btn-info";
    infoBtn.textContent = "Info";
    infoBtn.addEventListener("click", () => showInfo(item.key));

    const delBtn = document.createElement("button");
    delBtn.className = "btn-delete";
    delBtn.textContent = "Smazat";
    delBtn.addEventListener("click", () => deletePhoto(item.key));

    actions.appendChild(infoBtn);
    actions.appendChild(delBtn);

    card.appendChild(img);
    card.appendChild(meta);
    card.appendChild(actions);

    grid.appendChild(card);
  });
}

async function showInfo(key) {
  const res = await authenticatedFetch(`/api/admin/photos/info?key=${encodeURIComponent(key)}`);
  if (!res) return;
  const data = await res.json();

  const modal = document.getElementById("modal");
  const body = document.getElementById("modal-body");
  body.textContent = JSON.stringify(data, null, 2);
  modal.style.display = "flex";
}

async function deletePhoto(key) {
  if (!confirm(`Opravdu smazat fotku: ${key}?`)) return;

  const res = await authenticatedFetch("/api/admin/photos/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key })
  });
  if (!res) return;
  const data = await res.json();

  const status = document.getElementById("status");
  status.textContent = data.success ? "Fotka smazána." : "Chyba při mazání.";
  await loadPhotos();
}

async function uploadPhoto(file) {
  const status = document.getElementById("status");
  status.textContent = "Nahrávám…";

  const formData = new FormData();
  formData.append("file", file);

  const res = await authenticatedFetch("/api/admin/photos/upload", {
    method: "POST",
    body: formData
  });
  if (!res) return;
  const data = await res.json();

  status.textContent = data.success ? "Fotka nahrána." : "Chyba při nahrávání.";
  await loadPhotos();
}

function initUploadForm() {
  const form = document.getElementById("upload-form");
  const fileInput = document.getElementById("file-input");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const file = fileInput.files[0];
    if (!file) return;
    uploadPhoto(file);
  });
}

function initModal() {
  const modal = document.getElementById("modal");
  const closeBtn = document.getElementById("modal-close");
  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });
}

function initLogout() {
  const btn = document.getElementById("logout-btn");
  btn.addEventListener("click", () => {
    sessionStorage.removeItem("authToken");
    redirectToLogin();
  });
}

window.addEventListener("load", async () => {
  await verifyAuth();
  initUploadForm();
  initModal();
  initLogout();
  await loadPhotos();
});
