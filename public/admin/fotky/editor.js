const url = new URL(window.location.href);
const key = url.searchParams.get("key");

const img = document.getElementById("photo");
img.src = `/functions/api/photo/${key}`;

let rotateVal = 0;
let brightnessVal = 0;
let contrastVal = 0;

function rotate() { rotateVal += 90; }
function bright() { brightnessVal += 10; }
function dark() { brightnessVal -= 10; }
function contrast() { contrastVal += 10; }

async function saveEdit() {
    await fetch("/functions/api/photo/edit", {
        method: "POST",
        body: JSON.stringify({
            key,
            rotate: rotateVal,
            brightness: brightnessVal,
            contrast: contrastVal
        })
    });

    alert("Uloženo");
    location.reload();
}
