/* Světlý / tmavý režim. Výchozí je tmavý (vzhled blogu); volba se pamatuje v prohlížeči.
   Světlý režim = chytré převrácení barev stránky, fotky/mapy/videa se vracejí zpět. */
(function () {
  'use strict';
  var KEY = 'zajdaTheme', root = document.documentElement;
  function read() { try { var v = localStorage.getItem(KEY); return v === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function apply(v) {
    if (v === 'light') root.setAttribute('data-theme', 'light'); else root.removeAttribute('data-theme');
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', v === 'light' ? '#f7f7f0' : '#08080f');
  }
  apply(read()); // ještě před vykreslením, ať nebliká

  var css = 'html[data-theme="light"]{filter:invert(1) hue-rotate(180deg);background:#fff}' +
    'html[data-theme="light"] img,html[data-theme="light"] video,html[data-theme="light"] canvas,html[data-theme="light"] iframe,' +
    'html[data-theme="light"] .leaflet-container,html[data-theme="light"] [style*="background-image"]{filter:invert(1) hue-rotate(180deg)}' +
    '#themeToggle{position:fixed;left:14px;bottom:14px;z-index:9990;width:42px;height:42px;border-radius:50%;cursor:pointer;font-size:19px;line-height:1;' +
    'display:flex;align-items:center;justify-content:center;color:#f8f5ef;background:rgba(20,21,38,.88);border:1px solid rgba(140,150,255,.4);padding:0}' +
    '#themeToggle:hover{border-color:#ff7a45}#themeToggle:focus-visible{outline:3px solid #2fe6c9;outline-offset:2px}' +
    '@media print{#themeToggle{display:none}}';

  function mount() {
    if (document.getElementById('themeToggle')) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var b = document.createElement('button'); b.id = 'themeToggle'; b.type = 'button';
    function paint() {
      var light = read() === 'light';
      b.textContent = light ? '🌙' : '☀️';
      b.setAttribute('aria-pressed', light ? 'true' : 'false');
      var label = light ? 'Přepnout na tmavý režim' : 'Přepnout na světlý režim';
      b.setAttribute('aria-label', label); b.title = label;
    }
    b.addEventListener('click', function () { var n = read() === 'light' ? 'dark' : 'light'; save(n); apply(n); paint(); });
    paint(); document.body.appendChild(b);
  }
  /* styl světlého režimu musí platit hned (ne až po DOMContentLoaded) */
  var early = document.createElement('style'); early.textContent = css; (document.head || root).appendChild(early);
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  window.ZajdaTheme = { get: read, set: function (v) { save(v); apply(v); } };
})();
