const API_BASE = '/functions/api/admin';

function getAuthHeaders() {
  const token = sessionStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function login(password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (!res.ok) {
    throw new Error('Login failed');
  }

  const data = await res.json();
  sessionStorage.setItem('authToken', data.token);
  return data.token;
}

async function verify() {
  const res = await fetch(`${API_BASE}/verify`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error('Not authenticated');
  }

  return res.json();
}

async function listPhotos() {
  const res = await fetch(`${API_BASE}/photos/list`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error('Failed to list photos');
  }

  return res.json();
}

async function getPhotoInfo(key) {
  const res = await fetch(`${API_BASE}/photos/info?key=${encodeURIComponent(key)}`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error('Failed to get photo info');
  }

  return res.json();
}

async function deletePhoto(key) {
  const res = await fetch(`${API_BASE}/photos/delete`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ key }),
  });

  if (!res.ok) {
    throw new Error('Failed to delete photo');
  }

  return res.json();
}

async function uploadPhoto(file, key) {
  const formData = new FormData();
  formData.append('file', file);
  if (key) formData.append('key', key);

  const token = sessionStorage.getItem('authToken');
  const res = await fetch(`${API_BASE}/photos/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Failed to upload photo');
  }

  return res.json();
}

// Dashboard init
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await verify();
    console.log('Admin authenticated');
    loadDashboard();
  } catch (err) {
    console.error('Auth failed:', err);
    showLoginForm();
  }
});

function showLoginForm() {
  // Implement your login form display
}

function loadDashboard() {
  // Implement your dashboard load
}
