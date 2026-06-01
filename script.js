const words = [
  "fotky",
  "cestování",
  "projekty",
  "zážitky",
  "weby",
  "příběhy"
];

let index = 0;
const dynamic = document.getElementById("dynamicText");

function rotateWords() {
  index = (index + 1) % words.length;
  dynamic.textContent = words[index];
}

setInterval(rotateWords, 2000);

/* rebuild main v1 */
