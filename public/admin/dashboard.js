async function verify() {
    const res = await fetch("/functions/api/admin/verify", {
        credentials: "include"
    });

    const data = await res.json();

    if (!data.ok) {
        window.location.href = "/admin/login.html";
        return;
    }

    loadDashboard();
}

function loadDashboard() {
    document.getElementById("content").innerHTML = `
        <a href="/admin/fotky/index.html">📸 Galerie</a><br>
        <a href="/admin/quotes/index.html">💬 Citáty</a><br>
        <a href="/admin/sections/index.html">📂 Sekce</a><br>
    `;
}

verify();
