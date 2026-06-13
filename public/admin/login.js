async function login() {
    const password = document.getElementById("password").value;

    const res = await fetch("/functions/api/login", {
        method: "POST",
        body: JSON.stringify({ password })
    });

    const data = await res.json();

    if (!data.ok) {
        alert("Špatné heslo");
        return;
    }

    window.location.href = "/admin/dashboard.html";
}
