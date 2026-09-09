/* =========================================================
   gallery-ribbon-ui.js
   =========================================================
   Doplňuje chování k ribbonu galerie (viz dashboard.html) — nic
   needituje v dashboard-core.js/dashboard-editor.js, napojuje se
   zvenku stejně jako ostatní doplňkové soubory.

   Řeší dvě věci:
   1) Otevírání/zavírání rozbalovacích panelů (Zobrazení/Složky/
      Nahrát fotky/Upravit/Nástroje) — jen jeden otevřený najednou,
      klik mimo panel ho zavře.
   2) Živé počítadlo výběru přímo v tlačítku "✏️ Upravit (N) ▾" — ať je
      i se zavřeným panelem hned vidět, že něco je vybrané, aniž by
      to muselo být zvláštní vyskakující lišta. Bez zásahu do
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

  /* === ŽIVÉ POČÍTADLO VE TLAČÍTKU "Upravit" ===
     Krátký, levný interval (300 ms) místo zásahu do dashboard-core.js —
     spolehlivé bez ohledu na to, odkud se G.selected zrovna změnilo
     (checkbox v mřížce, "Vybrat vše", Escape...). Díky tomu je i se
     zavřeným panelem hned vidět, že je něco vybrané — bez zvláštní
     vyskakující lišty navíc. */
  var editToggleBaseLabel = '✏️ Upravit ▾';
  var lastSelSize = -1;
  function updateEditDropdownLabel() {
    var btn = document.querySelector('.ribbon-dropdown[data-key="editDropdown"] .ribbon-dropdown-toggle');
    if (!btn) return;
    var size = (window.G && G.selected) ? G.selected.size : 0;
    if (size === lastSelSize) return;
    lastSelSize = size;
    btn.textContent = size ? ('✏️ Upravit (' + size + ') ▾') : editToggleBaseLabel;
    btn.classList.toggle('has-selection', size > 0);
  }
  setInterval(updateEditDropdownLabel, 300);
  document.addEventListener('DOMContentLoaded', updateEditDropdownLabel);
})();
