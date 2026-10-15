/* ✨ Jemné objevování karet při rolování. Bez JS i při „omezit pohyb“ je všechno hned vidět. */
(function () {
  'use strict';
  if (!('IntersectionObserver' in window) || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  var SEL = '.related-card, .latest-item, .stat-card, .journey-card, .article-nav-link, .trip-nav, .article-footer';
  var seen = new WeakSet(), batch = 0, t = null;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
  function scan() {
    var n = 0;
    document.querySelectorAll(SEL).forEach(function (el) {
      if (seen.has(el)) return; seen.add(el);
      el.style.setProperty('--rv-d', Math.min(n++, 5) * 70 + 'ms');
      el.classList.add('rv'); io.observe(el);
    });
  }
  function later() { clearTimeout(t); t = setTimeout(scan, 80); }
  function start() {
    scan();
    if (window.MutationObserver) new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
    // pojistka: kdyby se něco nikdy neukázalo, po 4 s se odkryje všechno
    setTimeout(function () { document.querySelectorAll('.rv:not(.rv-in)').forEach(function (el) { el.classList.add('rv-in'); }); }, 4000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
