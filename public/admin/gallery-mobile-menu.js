/* =========================================================
   gallery-mobile-menu.js
   =========================================================
   Na užších obrazovkách (mobil, iPad na výšku) sbalí celou
   lištu Galerie (Zobrazení ▾ / Složky ▾ / Nahrát fotky ▾ /
   Upravit ▾ / Nástroje ▾ + tlačítka "↕️ Uspořádat" a
   "↺ Obnovit vše") do JEDNOHO tlačítka "☰ Nástroje galerie",
   které otevře spodní výsuvný panel se stejnými ovládacími
   prvky jako předtím.

   NIC se neodstraňuje ani nekopíruje — existující DOM uzly
   (se svými onclick handlery, id, selecty...) se jen fyzicky
   PŘESUNOU do přehlednějšího obalu. Při přechodu zpět na
   širší obrazovku (iPad na šířku, notebook) se přesunou zpátky
   na původní místo v ribbon liště beze změny.

   Načíst AŽ PO gallery-ribbon-ui.js (potřebuje existující
   .ribbon-group[data-for="galleries"] v DOM).
   ========================================================= */
(function () {
  var BREAKPOINT = 900; // px — pod touhle šířkou se lišta sbalí do menu
  var wrapped = false;
  var mq = window.matchMedia('(max-width:' + BREAKPOINT + 'px)');

  function injectStyles() {
    if (document.getElementById('gallery-mobile-menu-styles')) return;
    var style = document.createElement('style');
    style.id = 'gallery-mobile-menu-styles';
    style.textContent = `
      .gmm-toggle {
        display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
        width: 100%;
      }
      .gmm-open-btn { flex: 1 1 auto; min-width: 180px; }
      .gmm-drawer {
        position: fixed; inset: 0;
        background: rgba(5,8,16,0.55);
        z-index: 900;
        display: flex; align-items: flex-end;
        opacity: 0; pointer-events: none;
        transition: opacity 0.18s ease;
      }
      .gmm-drawer.open { opacity: 1; pointer-events: auto; }
      .gmm-drawer-panel {
        background: var(--surface, #0f1524);
        border-top: 1px solid var(--border-soft, #263252);
        border-radius: 14px 14px 0 0;
        width: 100%;
        max-height: 82vh;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding: 0.9rem 1rem 1.4rem;
        transform: translateY(12px);
        transition: transform 0.18s ease;
      }
      .gmm-drawer.open .gmm-drawer-panel { transform: translateY(0); }
      .gmm-drawer-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 0.8rem;
      }
      .gmm-drawer-header h4 { margin: 0; color: var(--gold, #ffc857); font-size: 14px; }
      .gmm-drawer .ribbon-group {
        display: flex !important; flex-direction: column; gap: 0.7rem; width: 100%;
      }
      .gmm-drawer .ribbon-dropdown { width: 100%; }
      .gmm-drawer .ribbon-dropdown-toggle { width: 100%; text-align: left; }
      .gmm-drawer .ribbon-dropdown-panel { position: static; }
      .gmm-drawer #gallerySearch { max-width: none !important; width: 100%; flex: 1 1 auto !important; }
      .gmm-drawer .ribbon-reorder-toggle { width: 100%; margin-right: 0; }
      .gmm-drawer .ribbon-sep { display: none; }
    `;
    document.head.appendChild(style);
  }

  function wrap() {
    if (wrapped) return;
    var group = document.querySelector('.ribbon-group[data-for="galleries"]');
    var toolbar = document.getElementById('ribbonToolbar');
    if (!group || !toolbar) return;

    // "Uspořádat" a "Obnovit vše" jsou globální tlačítka téhle lišty
    // (ne jen galerie) — na mobilu je taky schováme do panelu, ať
    // natvrdo nezabírají místo nahoře.
    var reorderBtns = Array.prototype.slice.call(
      toolbar.querySelectorAll(':scope > .ribbon-reorder-toggle')
    );

    var toggleWrap = document.createElement('div');
    toggleWrap.className = 'gmm-toggle';
    toggleWrap.id = 'gmmToggleWrap';

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn btn-blue btn-sm gmm-open-btn';
    toggle.id = 'gmmOpenBtn';
    toggle.textContent = '☰ Nástroje galerie';
    toggleWrap.appendChild(toggle);

    var pill = document.getElementById('galleryCountPill');
    if (pill) toggleWrap.appendChild(pill); // počítadlo zůstává viditelné i zavřené

    toolbar.insertBefore(toggleWrap, group);

    var drawer = document.createElement('div');
    drawer.className = 'gmm-drawer';
    drawer.id = 'gmmDrawer';
    drawer.innerHTML =
      '<div class="gmm-drawer-panel">' +
        '<div class="gmm-drawer-header">' +
          '<h4>🖼️ Nástroje galerie</h4>' +
          '<button type="button" class="btn btn-red btn-sm" id="gmmCloseBtn">Zavřít</button>' +
        '</div>' +
        '<div id="gmmDrawerBody"></div>' +
      '</div>';
    document.body.appendChild(drawer);

    var body = drawer.querySelector('#gmmDrawerBody');
    reorderBtns.forEach(function (b) { body.appendChild(b); });
    body.appendChild(group);

    function open() { drawer.classList.add('open'); }
    function close() { drawer.classList.remove('open'); }
    toggle.addEventListener('click', open);
    drawer.querySelector('#gmmCloseBtn').addEventListener('click', close);
    drawer.addEventListener('click', function (e) { if (e.target === drawer) close(); });

    wrapped = true;
  }

  function unwrap() {
    if (!wrapped) return;
    var drawer = document.getElementById('gmmDrawer');
    var toolbar = document.getElementById('ribbonToolbar');
    var toggleWrap = document.getElementById('gmmToggleWrap');
    if (!drawer || !toolbar || !toggleWrap) return;

    var body = drawer.querySelector('#gmmDrawerBody');
    var group = body ? body.querySelector('.ribbon-group[data-for="galleries"]') : null;
    var reorderBtns = body ? Array.prototype.slice.call(body.querySelectorAll('.ribbon-reorder-toggle')) : [];
    var pill = toggleWrap.querySelector('#galleryCountPill');

    reorderBtns.forEach(function (b) { toolbar.insertBefore(b, toolbar.firstChild); });
    if (group) {
      toolbar.appendChild(group);
      if (pill) {
        var sep = group.querySelector('.ribbon-sep');
        if (sep) sep.after(pill); else group.appendChild(pill);
      }
    }
    drawer.remove();
    toggleWrap.remove();
    wrapped = false;
  }

  function sync() {
    injectStyles();
    if (mq.matches) wrap(); else unwrap();
  }

  document.addEventListener('DOMContentLoaded', function () {
    sync();
    // Pojistka, kdyby v okamžiku DOMContentLoaded ještě ribbon nebyl hotový
    // (gallery-ribbon-ui.js/dashboard-core.js mohou doplňovat DOM asynchronně).
    setTimeout(sync, 500);
  });

  if (mq.addEventListener) mq.addEventListener('change', sync);
  else if (mq.addListener) mq.addListener(sync); // starší Safari
})();
