/* Prohlížeč fotek (jako u článků): posouvání mezi fotkami, zvětšení (dva prsty / dvojklik),
   celá obrazovka, zavření tažením dolů, křížkem, Esc nebo tlačítkem Zpět.
   Po zavření zůstaneš přesně tam, kde jsi byl (u konkrétního milníku). Použití: PhotoViewer.open([url, ...], index) */
(function () {
  'use strict';
  var ov = null, img = null, urls = [], idx = 0, sc = 1, tx = 0, ty = 0, cnt, pb, nb, fsb, pushed = false;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function css() {
    if (document.getElementById('pvCss')) return;
    var s = document.createElement('style'); s.id = 'pvCss';
    s.textContent = '#pv{position:fixed;inset:0;z-index:10000;background:rgba(4,4,10,.96);display:flex;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none;overscroll-behavior:contain}' +
      '#pv img{max-width:100vw;max-height:100vh;max-height:100dvh;object-fit:contain;will-change:transform;transition:transform .2s ease,opacity .2s ease;-webkit-user-drag:none}' +
      '#pv img.pv-drag{transition:none}#pv:fullscreen{background:#000}#pv:-webkit-full-screen{background:#000}' +
      '#pv .pv-b{position:absolute;display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:rgba(20,20,34,.7);border:1px solid rgba(255,255,255,.25);color:#fff;font-size:22px;cursor:pointer;z-index:2;-webkit-tap-highlight-color:transparent}' +
      '#pv .pv-b:hover{background:rgba(255,122,69,.4)}#pv .pv-x{top:calc(12px + env(safe-area-inset-top));right:12px;font-size:28px}#pv .pv-f{top:calc(12px + env(safe-area-inset-top));right:64px;font-size:18px}' +
      '#pv .pv-p{left:12px;top:50%;margin-top:-22px}#pv .pv-n{right:12px;top:50%;margin-top:-22px}' +
      '#pv .pv-c{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom));padding:5px 12px;border-radius:14px;background:rgba(20,20,34,.7);color:#fff;font:600 13px system-ui,sans-serif}' +
      '@media (max-width:700px){#pv .pv-p,#pv .pv-n{display:none!important}}';
    document.head.appendChild(s);
  }
  function apply() { img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ')'; }
  function resetZoom() { sc = 1; tx = 0; ty = 0; img.style.transform = ''; img.style.opacity = ''; }
  function show() {
    resetZoom(); img.src = urls[idx]; img.alt = '';
    var multi = urls.length > 1;
    pb.style.display = nb.style.display = multi ? 'flex' : 'none';
    cnt.style.display = multi ? 'block' : 'none';
    cnt.textContent = (idx + 1) + ' / ' + urls.length;
  }
  function go(d) { if (urls.length < 2) return; idx = (idx + d + urls.length) % urls.length; show(); }
  function isFull() { return document.fullscreenElement || document.webkitFullscreenElement; }
  function toggleFs() {
    if (!isFull()) { if (ov.requestFullscreen) ov.requestFullscreen(); else if (ov.webkitRequestFullscreen) ov.webkitRequestFullscreen(); else zoomToggle(); }
    else { if (document.exitFullscreen) document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); }
  }
  function zoomToggle() { if (sc > 1) resetZoom(); else { sc = 2.5; tx = 0; ty = 0; apply(); } }
  function close(fromPop) {
    if (!ov) return;
    if (isFull()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {} }
    ov.remove(); ov = null; img = null;
    document.removeEventListener('keydown', onKey, true);
    if (pushed && !fromPop) { pushed = false; try { history.back(); } catch (e) {} } else pushed = false;
  }
  function onKey(e) {
    if (!ov) return;
    if (e.key === 'Escape') { if (isFull()) return; e.stopPropagation(); close(); }
    else if (e.key === 'ArrowLeft') { e.stopPropagation(); e.preventDefault(); go(-1); } else if (e.key === 'ArrowRight') { e.stopPropagation(); e.preventDefault(); go(1); }
    else if (e.key === 'f' || e.key === 'F') { e.stopPropagation(); toggleFs(); }
  }
  function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }

  function gestures() {
    var sx = 0, sy = 0, dx = 0, dy = 0, axis = null, drag = false, pinch = 0, base = 1, lastTap = 0, bx = 0, by = 0;
    ov.addEventListener('touchstart', function (e) {
      if (e.target.closest && e.target.closest('.pv-b')) return;
      if (e.touches.length === 2) { pinch = dist(e.touches); base = sc; drag = false; return; }
      if (e.touches.length !== 1) return;
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY; dx = dy = 0; axis = null; drag = true; bx = tx; by = ty;
      img.classList.add('pv-drag');
      var now = Date.now(); if (now - lastTap < 280) { zoomToggle(); drag = false; lastTap = 0; } else lastTap = now;
    }, { passive: true });
    ov.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && pinch) { e.preventDefault(); sc = Math.min(5, Math.max(1, base * dist(e.touches) / pinch)); if (sc === 1) { tx = 0; ty = 0; } apply(); return; }
      if (!drag || e.touches.length !== 1) return;
      var t = e.touches[0]; dx = t.clientX - sx; dy = t.clientY - sy;
      if (sc > 1) { e.preventDefault(); tx = bx + dx; ty = by + dy; apply(); return; }
      if (!axis) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; if (axis === 'y' && dy < 0) axis = null; }
      if (!axis) return;
      e.preventDefault();
      if (axis === 'x') img.style.transform = 'translateX(' + (urls.length > 1 ? dx : dx * 0.25) + 'px)';
      else { var p = Math.min(1, Math.max(0, dy) / 260); img.style.transform = 'translateY(' + dy + 'px) scale(' + (1 - p * .14) + ')'; img.style.opacity = String(1 - p * .5); ov.style.background = 'rgba(4,4,10,' + (.96 * (1 - p * .85)) + ')'; }
    }, { passive: false });
    function end(e) {
      if (e && e.touches && e.touches.length) return;
      pinch = 0;
      if (!drag) return; drag = false; img.classList.remove('pv-drag');
      if (sc > 1) return;
      if (axis === 'x' && urls.length > 1 && Math.abs(dx) > 70) {
        var next = dx < 0; img.style.transform = 'translateX(' + (next ? '-120%' : '120%') + ')'; img.style.opacity = '0';
        setTimeout(function () { if (ov) { go(next ? 1 : -1); } }, reduce ? 0 : 180); return;
      }
      if (axis === 'y' && dy > 110) { img.style.transform = 'translateY(120%) scale(.8)'; img.style.opacity = '0'; ov.style.background = 'rgba(4,4,10,0)'; setTimeout(function () { close(); }, reduce ? 0 : 180); return; }
      img.style.transform = ''; img.style.opacity = ''; ov.style.background = '';
    }
    ov.addEventListener('touchend', end); ov.addEventListener('touchcancel', end);
  }

  function open(list, i) {
    list = (list || []).filter(Boolean); if (!list.length) return;
    close(true); css();
    urls = list; idx = Math.max(0, Math.min(list.length - 1, i || 0));
    ov = document.createElement('div'); ov.id = 'pv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<span class="pv-b pv-x" aria-label="Zavřít" role="button">&times;</span><span class="pv-b pv-f" title="Celá obrazovka" role="button">⛶</span>' +
      '<span class="pv-b pv-p" role="button" aria-label="Předchozí">&#10094;</span><img alt=""><span class="pv-b pv-n" role="button" aria-label="Další">&#10095;</span><span class="pv-c"></span>';
    document.body.appendChild(ov);
    img = ov.querySelector('img'); cnt = ov.querySelector('.pv-c'); pb = ov.querySelector('.pv-p'); nb = ov.querySelector('.pv-n'); fsb = ov.querySelector('.pv-f');
    ov.querySelector('.pv-x').onclick = function (e) { e.stopPropagation(); close(); };
    fsb.onclick = function (e) { e.stopPropagation(); toggleFs(); };
    pb.onclick = function (e) { e.stopPropagation(); go(-1); }; nb.onclick = function (e) { e.stopPropagation(); go(1); };
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    img.addEventListener('dblclick', function (e) { e.stopPropagation(); zoomToggle(); });
    img.addEventListener('wheel', function (e) { e.preventDefault(); sc = Math.min(5, Math.max(1, sc * (e.deltaY < 0 ? 1.15 : 0.87))); if (sc === 1) { tx = 0; ty = 0; } apply(); }, { passive: false });
    document.addEventListener('keydown', onKey, true);
    show(); gestures();
    try { history.pushState({ pv: 1 }, ''); pushed = true; } catch (e) { pushed = false; }
  }
  window.addEventListener('popstate', function () { if (ov) close(true); });
  document.addEventListener('fullscreenchange', function () { if (fsb) fsb.textContent = isFull() ? '⤫' : '⛶'; });
  window.PhotoViewer = { open: open, close: close };
})();
