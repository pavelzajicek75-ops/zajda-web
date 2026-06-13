async function verify() {
  const res = await fetch("/functions/api/admin/verify");
  const data = await res.json();

  if (!data.ok) {
    window.location.href = "/admin/login.html";
  }
}

verify();
