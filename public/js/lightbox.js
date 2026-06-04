document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".article img").forEach(img => {
    img.addEventListener("click", () => {
      const overlay = document.createElement("div");
      overlay.className = "lightbox";
      overlay.innerHTML = `<img src="${img.src}" alt="">`;
      overlay.addEventListener("click", () => overlay.remove());
      document.body.appendChild(overlay);
    });
  });
});
