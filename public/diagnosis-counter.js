/* Počítadlo "Den N od diagnózy" — počítá od 1. 6. 2026.
   Vložit před </body> v index.html a article.html:
   <script src="/diagnosis-counter.js?v=1"></script>
*/
(function () {
  'use strict';

  var START = { year: 2026, month: 6, day: 1 };
  var OFFSET = 0; // 0 = den diagnózy je "Den 0"; nastav 1, aby byl "Den 1"

  function dayFor(now) {
    now = now || new Date();
    var today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    var start = Date.UTC(START.year, START.month - 1, START.day);
    return Math.floor((today - start) / 86400000) + OFFSET;
  }

  function injectStyle() {
    if (document.getElementById('diagnosis-counter-style')) return;
    var s = document.createElement('style');
    s.id = 'diagnosis-counter-style';
    s.textContent =
      '.diagnosis-counter{color:var(--nova,#7c5cff);font-family:"Space Grotesk",system-ui,sans-serif;font-size:13px;letter-spacing:.02em;display:inline-block;margin:0 0 6px}' +
      '.diagnosis-footer{text-align:center;padding:24px 16px 32px;opacity:.9}';
    document.head.appendChild(s);
  }

  function render() {
    var day = dayFor(new Date());
    var existing = document.querySelector('.diagnosis-counter');

    if (day < 0) {
      if (existing) existing.remove();
      return;
    }

    var label = 'Den ' + day.toLocaleString('cs-CZ') + ' od diagnózy';

    if (existing) {
      existing.textContent = label;
      return;
    }

    injectStyle();

    var el = document.createElement('span');
    el.className = 'diagnosis-counter';
    el.textContent = label;
    el.title = 'Počítáno od 1. 6. 2026';

    var footer = document.querySelector('.site-footer');
    if (footer) {
      footer.insertBefore(document.createElement('br'), footer.firstChild);
      footer.insertBefore(el, footer.firstChild);
    } else {
      var f = document.createElement('footer');
      f.className = 'diagnosis-footer';
      f.appendChild(el);
      document.body.appendChild(f);
    }
  }

  function init() {
    render();
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) render();
    });
  }

  window.DiagnosisCounter = { dayFor: dayFor, render: render };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
