document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('error');
  err.textContent = '';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
      })
    });
    if (res.ok) {
      window.location.href = '/admin/dashboard.html';
    } else {
      err.textContent = 'Špatné přihlašovací údaje';
    }
  } catch {
    err.textContent = 'Chyba připojení';
  }
});
