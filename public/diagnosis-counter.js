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
      '.diagnosis-footer{text-align:center;padding:24px 16px 32px;opacity:.9}' +
      '.diagnosis-counter.milestone{font-weight:600;text-shadow:0 0 12px currentColor}' +
      '.dc-confetti{position:fixed;left:0;top:0;width:100%;height:0;pointer-events:none;z-index:9999;overflow:visible}' +
      '.dc-confetti span{position:absolute;top:-20px;font-size:22px;animation:dc-fall linear forwards}' +
      '@keyframes dc-fall{to{transform:translateY(105vh) rotate(540deg);opacity:.9}}';
    document.head.appendChild(s);
  }

  // Kulatý den = 100, 200, 300…, výročí (365, 730…) a 1000+
  function isMilestone(day) {
    return day > 0 && (day % 100 === 0 || day % 365 === 0);
  }

  function celebrate(day) {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var key = 'diagnosisMilestoneShown';
      if (localStorage.getItem(key) === String(day)) return; // jednou za milník
      localStorage.setItem(key, String(day));
    } catch (e) { /* bez localStorage se prostě zobrazí vždy */ }
    var box = document.createElement('div');
    box.className = 'dc-confetti';
    var emojis = ['🎉', '✨', '🚀', '⭐', '🎊'];
    for (var i = 0; i < 28; i++) {
      var s = document.createElement('span');
      s.textContent = emojis[i % emojis.length];
      s.style.left = Math.round(Math.random() * 100) + '%';
      s.style.animationDuration = (2.5 + Math.random() * 2.5) + 's';
      s.style.animationDelay = (Math.random() * 0.8) + 's';
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 6500);
  }

  function render() {
    var day = dayFor(new Date());
    var existing = document.querySelector('.diagnosis-counter');

    if (day < 0) {
      if (existing) existing.remove();
      return;
    }

    var ms = isMilestone(day);
    var label = (ms ? '🎉 ' : '') + 'Den ' + day.toLocaleString('cs-CZ') + ' od diagnózy';

    if (existing) {
      existing.textContent = label;
      existing.classList.toggle('milestone', ms);
      return;
    }

    injectStyle();

    var el = document.createElement('span');
    el.className = 'diagnosis-counter';
    el.textContent = label;
    el.title = 'Počítáno od 1. 6. 2026';
    if (ms) { el.classList.add('milestone'); celebrate(day); }

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

  window.DiagnosisCounter = { dayFor: dayFor, render: render, isMilestone: isMilestone };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
