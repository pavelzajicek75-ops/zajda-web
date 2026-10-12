/* Rychlejší fotky na mobilu: nejdřív se ukáže malý náhled (thumbs/), v pozadí se
   dotáhne plná fotka a vymění se. Při úsporném režimu / pomalém připojení
   (Save-Data, 2G/3G) zůstane jen náhled a plná fotka se načte až v lightboxu. */
(function () {
  'use strict';
  function slow() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return false;
    return !!c.saveData || /^(slow-2g|2g|3g)$/.test(c.effectiveType || '');
  }
  function isPhoto(url) { return typeof url === 'string' && /[?&]key=/.test(url) && url.indexOf('thumbs%2F') < 0 && url.indexOf('thumbs/') < 0; }
  function thumbOf(url) {
    try { return typeof deriveThumbUrl === 'function' ? deriveThumbUrl(url) : url; } catch (e) { return url; }
  }
  function set(img, url) {
    if (!img || !url) return;
    var th = thumbOf(url);
    if (!isPhoto(url) || th === url) { img.src = url; return; }
    img.setAttribute('data-full', url);
    img.decoding = 'async';
    var failed = false;
    img.onerror = function () { if (failed) return; failed = true; img.onerror = null; img.src = url; };
    img.src = th;
    if (slow()) return;
    var big = new Image();
    big.onload = function () { if (img.getAttribute('data-full') === url) { img.onerror = null; img.src = url; } };
    big.src = url;
  }
  /* Fotky už vložené do textu: při pomalém připojení nahradit náhledem. */
  function shrink(root) {
    if (!root || !slow()) return;
    var imgs = root.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i], src = im.getAttribute('src');
      if (!isPhoto(src) || im.hasAttribute('data-full')) continue;
      var th = thumbOf(src);
      if (th === src) continue;
      im.setAttribute('data-full', src);
      im.onerror = (function (el, full) { return function () { el.onerror = null; el.src = full; }; })(im, src);
      im.src = th;
    }
  }
  window.PhotoSpeed = { set: set, shrink: shrink, slow: slow };
})();
