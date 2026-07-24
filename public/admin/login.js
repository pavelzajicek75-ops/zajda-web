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
    const data = await res.json();
    if (res.ok) {
      if (!data.token) {
        err.textContent = 'Server nevrátil token — zkontroluj odpověď /api/auth/login.';
        console.error('Login response bez tokenu:', data);
        return;
      }
      localStorage.setItem('token', data.token);
      window.location.href = '/admin/index.html';
    } else {
      err.textContent = data.error || 'Špatné přihlašovací údaje';
    }
  } catch {
    err.textContent = 'Chyba připojení k serveru';
  }
});
