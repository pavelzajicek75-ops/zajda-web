/* =========================================================
   gallery-ribbon-ui.js
   =========================================================
   Doplňuje chování k přeuspořádanému ribbonu galerie (viz
   dashboard.html) — nic needituje v dashboard-core.js/dashboard-editor.js,
   napojuje se zvenku stejně jako ostatní doplňkové soubory.

   Řeší dvě věci:
   1) Otevírání/zavírání panelů "📁 Složky ▾" a "⬆️ Nahrát ▾"
      (jen jeden otevřený najednou, klik mimo panel ho zavře).
   2) Zobrazení/skrytí kontextové lišty hromadných akcí — objeví se
      JEN když je aspoň jedna fotka vybraná. Bez zásahu do
      toggleSel()/selectAllVisiblePhotos()/clearPhotoSelection() (ty
      žijí v dashboard-core.js) se to nejjednodušeji a nejspolehlivěji
      řeší krátkým intervalem, co kontroluje G.selected.size — funguje
      to bez ohledu na to, JAK se výběr zrovna změnil.

   Načíst AŽ PO dashboard-core.js a dashboard-editor.js.
   ========================================================= */
(function () {
  function $(id) { return document.getElementById(id); }

  /* === ROZBALOVACÍ PANELY === */
  window.toggleRibbonDropdown = function (btn) {
    var panelId = btn.dataset.panel;
    var panel = $(panelId);
    if (!panel) return;
    var willOpen = panel.hidden;

    // Zavřít všechny ostatní panely v ribbonu (jen jeden otevřený najednou)
    document.querySelectorAll('.ribbon-dropdown-panel').forEach(function (p) {
      if (p !== panel) p.hidden = true;
    });
    document.querySelectorAll('.ribbon-dropdown-toggle').forEach(function (b) {
      if (b !== btn) b.classList.remove('open');
    });

    panel.hidden = !willOpen;
    btn.classList.toggle('open', willOpen);
  };

  document.addEventListener('click', function (e) {
    if (e.target.closest('.ribbon-dropdown')) return;
    document.querySelectorAll('.ribbon-dropdown-panel').forEach(function (p) { p.hidden = true; });
    document.querySelectorAll('.ribbon-dropdown-toggle').forEach(function (b) { b.classList.remove('open'); });
  });

  /* === KONTEXTOVÁ LIŠTA HROMADNÝCH AKCÍ ===
     Krátký, levný interval (300 ms) místo zásahu do dashboard-core.js —
     spolehlivé bez ohledu na to, odkud se G.selected zrovna změnilo
     (checkbox v mřížce, "Vybrat vše", Escape, koš...). */
  var lastSelSize = -1;
  function updateGalleryBulkBar() {
    var bar = $('galleryBulkBar');
    if (!bar) return;
    var size = (window.G && G.selected) ? G.selected.size : 0;
    if (size === lastSelSize) return;
    lastSelSize = size;
    bar.hidden = size === 0;
    var countEl = $('galleryBulkCount');
    if (countEl) countEl.textContent = size ? ('Vybráno: ' + size + (size === 1 ? ' fotka' : (size >= 2 && size <= 4 ? ' fotky' : ' fotek'))) : '';
  }
  setInterval(updateGalleryBulkBar, 300);
  document.addEventListener('DOMContentLoaded', updateGalleryBulkBar);
})();
