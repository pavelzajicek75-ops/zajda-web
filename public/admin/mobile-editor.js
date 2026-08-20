/* =========================================================
   mobile-editor.js
   =========================================================
   Řeší dva problémy s psaním článků na mobilu/tabletu:

   1) Na iPadu se po otevření klávesnice schová panel nástrojů
      (formátování, vkládání obrázků...) — byl součástí normálního
      toku stránky, takže s ní "odjel" mimo viditelnou oblast.

   2) Celý formulář (nadpis, sekce, datum, editor, tlačítko Uložit...)
      byl jeden dlouhý scroll — na dlouhém článku bylo pořád nutné
      scrollovat celou stránku tam a zpátky jen kvůli psaní textu.

   Řešení (jako ve Wordu): panel nástrojů + samotný text se zabalí do
   společného rámečku s VLASTNÍM scrollem a omezenou výškou. Panel
   nástrojů je uvnitř tohoto rámečku "přilepený" nahoře (position:
   sticky) — zůstává vidět i při scrollování/psaní/otevřené klávesnici.
   Zbytek formuláře (nadpis, sekce, datum...) scrolluje normálně s
   celou stránkou nezávisle na tomhle rámečku.

   Nic v dashboard-core.js / dashboard-editor.js se neupravuje — tenhle
   skript jen za běhu obalí existující prvky (#artEditor, #aboutEditor
   a jejich předchozí .editor-toolbar) do nového wrapperu a přidá CSS.
   Načíst AŽ PO dashboard-editor.js (potřebuje, aby toolbar/editor už
   byly v DOM).
   ========================================================= */
(function () {
  function injectStyles() {
    if (document.getElementById('mobile-editor-styles')) return;
    var style = document.createElement('style');
    style.id = 'mobile-editor-styles';
    style.textContent = `
      .editor-scroll-wrap {
        position: relative;
        max-height: 62vh;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        border: 1px solid var(--border-soft, #263252);
        border-radius: var(--r-md, 10px);
        background: var(--surface, #0f1524);
      }
      .editor-scroll-wrap .editor-toolbar {
        position: sticky;
        top: 0;
        z-index: 30;
        background: var(--surface-2, #131a2c);
        border-bottom: 1px solid var(--border-soft, #263252);
        border-radius: var(--r-md, 10px) var(--r-md, 10px) 0 0;
        /* Původní .editor-toolbar mívá vlastní okraj/mezeru od
           sousedních prvků — uvnitř wrapperu už není potřeba. */
        margin: 0 !important;
      }
      .editor-scroll-wrap [contenteditable] {
        border: none !important;
        min-height: 260px;
        border-radius: 0 !important;
      }
      @media (max-width: 700px) {
        .editor-scroll-wrap { max-height: 48vh; }
      }
      /* Na iPadu/mobilu se často píše dlouho — drobná vizuální
         připomínka, že se dá scrollovat, ať to nepůsobí "uříznuté". */
      .editor-scroll-wrap::after {
        content: '';
        position: sticky; bottom: 0; left: 0; right: 0; height: 14px;
        display: block; pointer-events: none;
        background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.25));
        margin-top: -14px;
      }
      /* Zaškrtávací pole při výběru VÍC fotek najednou (vkládání do
         článku) — na dotykovém displeji byla 20×20px moc malá na
         přesné trefení prstem. */
      .img-picker-check {
        width: 28px !important;
        height: 28px !important;
        top: 8px !important;
        left: 8px !important;
      }
    `;
    document.head.appendChild(style);
  }

  function wrapEditor(editorId) {
    var editor = document.getElementById(editorId);
    if (!editor || editor.closest('.editor-scroll-wrap')) return; // idempotentní
    var toolbar = editor.previousElementSibling;
    if (!toolbar || !toolbar.classList.contains('editor-toolbar')) return;
    var wrap = document.createElement('div');
    wrap.className = 'editor-scroll-wrap';
    toolbar.parentNode.insertBefore(wrap, toolbar);
    wrap.appendChild(toolbar);
    wrap.appendChild(editor);
  }

  function init() {
    injectStyles();
    wrapEditor('artEditor');
    wrapEditor('aboutEditor');
  }

  document.addEventListener('DOMContentLoaded', function () {
    init();
    // Formulář pro editaci existujícího článku/about textu se plní až
    // po async fetch (editArticle/loadAbout) — wrapEditor() je
    // idempotentní, takže zkusit znovu o chvíli později nevadí a
    // pojistí to i pozdější vykreslení.
    setTimeout(init, 500);
    setTimeout(init, 1500);
  });
})();
