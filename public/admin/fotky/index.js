async function loadPhotos() {
    const res = await fetch("/functions/api/photo/list");
    const data = await res.json();

    const container = document.getElementById("photos");
    container.innerHTML = "";

    data.items.forEach(item => {
        const div = document.createElement("div");
        div.innerHTML = `
            <img src="/functions/api/photo/${item.key}" width="200">
            <br>
            <button onclick="edit('${item.key}')">Upravit</button>
            <button onclick="del('${item.key}')">Smazat</button>
        `;
        container.appendChild(div);
    });
}

function edit(key) {
    window.location.href = `editor.html?key=${key}`;
}

async function del(key) {
    await fetch(`/functions/api/photo/delete?key=${key}`, { method: "DELETE" });
    loadPhotos();
}

loadPhotos();
