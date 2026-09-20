/* =========================================================
   admin-nav-mobile.js
   =========================================================
   Na užších obrazovkách (mobil, iPad na výšku) sbalí hlavní navigaci
   záložek (Galerie / Články / Citáty / Podsekce / O Zajdovi / Reakce /
   ADMIN) do JEDNOHO tlačítka "☰ [Aktuální záložka] ▾", které otevře
   spodní výsuvné menu se stejnými záložkami jako svislý seznam —
   mnohem snazší na dotek než vodorovné rolování přes 7 tlačítek vedle
   sebe. Na širších obrazovkách (iPad na šířku, notebook) zůstává
   původní vodorovná lišta beze změny — tam je na všechny záložky vedle
   sebe dost místa.

   Stejný princip jako gallery-mobile-menu.js — existující DOM uzly
   (#ribbonTabs se svými tlačítky a onclick handlery) se jen fyzicky
   PŘESOUVAJÍ tam a zpátky podle šířky obrazovky, nic se nekopíruje ani
   neodstraňuje, takže showTab()/moveTabIndicator() fungují úplně
   stejně jako dřív.

   Načíst AŽ PO dashboard-core.js (potřebuje hotovou funkci showTab a
   existující #ribbonTabs v DOM). */
(function () {
  var BREAKPOINT = 760; // stejná hranice, jakou už admin jinde používá pro mobilní úpravy
  var wrapped = false;
  var mq = window.matchMedia('(max-width:' + BREAKPOINT + 'px)');

  function injectStyles() {
    if (document.getElementById('admin-nav-mobile-styles')) return;
    var style = document.createElement('style');
    style.id = 'admin-nav-mobile-styles';
    style.textContent = `
      .anm-open-btn {
        display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
        width: 100%; text-align: left;
      }
      .anm-drawer {
        position: fixed; inset: 0; z-index: 900;
        background: rgba(5,8,16,0.55);
        display: flex; align-items: flex-end;
        opacity: 0; pointer-events: none;
        transition: opacity 0.18s ease;
      }
      .anm-drawer.open { opacity: 1; pointer-events: auto; }
      .anm-drawer-panel {
        background: var(--surface, #0f1524);
        border-top: 1px solid var(--border-soft, #263252);
        border-radius: 14px 14px 0 0;
        width: 100%;
        max-height: 78vh;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding: 0.9rem 1rem 1.4rem;
        transform: translateY(12px);
        transition: transform 0.18s ease;
      }
      .anm-drawer.open .anm-drawer-panel { transform: translateY(0); }
      .anm-drawer-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 0.7rem;
      }
      .anm-drawer-header h4 { margin: 0; color: var(--gold, #ffc857); font-size: 14px; }
      .anm-drawer #ribbonTabs {
        display: flex !important; flex-direction: column; overflow: visible;
        background: transparent; border: none; padding: 0; gap: 0.4rem;
      }
      .anm-drawer #ribbonTabIndicator { display: none; }
      .anm-drawer .ribbon-tab {
        width: 100%; text-align: left; padding: 0.7rem 0.9rem; border-radius: 10px;
        background: var(--surface-2, #131a2c); border: 1px solid var(--border-soft, #263252);
      }
      .anm-drawer .ribbon-tab.active { border-color: var(--gold, #ffc857); color: var(--gold, #ffc857); }
    `;
    document.head.appendChild(style);
  }

  function currentTabLabel() {
    var active = document.querySelector('#ribbonTabs .ribbon-tab.active') || document.querySelector('#ribbonTabs .ribbon-tab');
    return active ? active.textContent.trim() : 'Menu';
  }

  function wrap() {
    if (wrapped) return;
    var tabs = document.getElementById('ribbonTabs');
    var nav = tabs ? tabs.parentNode : null;
    if (!tabs || !nav) return;

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn btn-blue anm-open-btn';
    toggle.id = 'anmOpenBtn';
    toggle.innerHTML = '<span id="anmOpenBtnLabel">☰ ' + currentTabLabel() + '</span><span>▾</span>';
    nav.insertBefore(toggle, tabs);

    var drawer = document.createElement('div');
    drawer.className = 'anm-drawer';
    drawer.id = 'anmDrawer';
    drawer.innerHTML =
      '<div class="anm-drawer-panel">' +
        '<div class="anm-drawer-header">' +
          '<h4>📑 Přejít na</h4>' +
          '<button type="button" class="btn btn-red btn-sm" id="anmCloseBtn">Zavřít</button>' +
        '</div>' +
        '<div id="anmDrawerBody"></div>' +
      '</div>';
    document.body.appendChild(drawer);
    drawer.querySelector('#anmDrawerBody').appendChild(tabs);

    function open() { drawer.classList.add('open'); }
    function close() { drawer.classList.remove('open'); }
    toggle.addEventListener('click', open);
    drawer.querySelector('#anmCloseBtn').addEventListener('click', close);
    drawer.addEventListener('click', function (e) { if (e.target === drawer) close(); });

    // Kliknutí na kteroukoliv záložku uvnitř menu ho hned zase zavře a
    // aktualizuje popisek na tlačítku — jinak by admin musel menu
    // zavírat ručně po každém přepnutí záložky.
    tabs.addEventListener('click', function (e) {
      if (e.target.closest('.ribbon-tab')) {
        close();
        setTimeout(function () {
          var label = document.getElementById('anmOpenBtnLabel');
          if (label) label.textContent = '☰ ' + currentTabLabel();
        }, 30);
      }
    });

    wrapped = true;
  }

  function unwrap() {
    if (!wrapped) return;
    var drawer = document.getElementById('anmDrawer');
    var toggle = document.getElementById('anmOpenBtn');
    var tabs = document.getElementById('ribbonTabs');
    if (!drawer || !toggle || !tabs) return;

    toggle.parentNode.insertBefore(tabs, toggle);
    drawer.remove();
    toggle.remove();
    wrapped = false;
    if (typeof moveTabIndicator === 'function') {
      // Indikátor ("pilulka" pod aktivní záložkou) se přes 'reactions'
      // resize/DOM přesun rozhodí — po návratu do vodorovné lišty ho
      // stačí přepočítat.
      requestAnimationFrame(moveTabIndicator);
    }
  }

  function sync() {
    injectStyles();
    if (mq.matches) wrap(); else unwrap();
  }

  document.addEventListener('DOMContentLoaded', function () {
    sync();
    setTimeout(sync, 500); // pojistka, kdyby v okamžiku DOMContentLoaded ještě #ribbonTabs nebyl hotový
  });

  if (mq.addEventListener) mq.addEventListener('change', sync);
  else if (mq.addListener) mq.addListener(sync); // starší Safari
})();
