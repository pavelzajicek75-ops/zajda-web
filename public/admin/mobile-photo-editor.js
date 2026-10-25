/* =========================================================
   mobile-photo-editor.js — editor fotek pro telefon a iPad na výšku (do 900 px)
   =========================================================
   Vzor: Snapseed / Lightroom Mobile. Fotka je velká nahoře, dole je lišta nástrojů a jen jeden panel najednou.
   Nic se nepřepisuje: používají se stejné panely, posuvníky a funkce jako na počítači, jen se jinak zobrazí.
   • horní lišta: zavřít, předchozí/další fotka, zpět/znovu, „před“ (podržet), uložit
   • dole ikony: Auto · Styly · Ořez · Světlo · Barva · Efekty · Export
   • tah prstem vlevo/vpravo po fotce mění vybraný posuvník (Světlo, Barva, Efekty); klepnutím na řádek se vybere jiný
   • dva prsty: přiblížení a posun fotky
   • dvojklep na posuvník ho vrátí na výchozí hodnotu
   Na počítači s myší a na telefonu naležato se nic nemění. Načíst AŽ PO dashboard-editor.js. */
(function () {
  'use strict';
  var MQ = '((max-width: 900px) or (pointer: coarse)) and (min-height: 501px)';   // telefon, iPad na výšku i naležato (dotykové zařízení)
  var TOOLS = [
    { k: 'auto', i: '✨', n: 'Auto', p: ['Automaticky'] },
    { k: 'style', i: '🎞️', n: 'Styly', p: ['Předvolby'] },
    { k: 'crop', i: '✂️', n: 'Ořez', p: ['Ořez', 'Transformace'] },
    { k: 'light', i: '☀️', n: 'Světlo', p: ['Světlo'], gesture: true },
    { k: 'color', i: '🎨', n: 'Barva', p: ['Barva'], gesture: true },
    { k: 'fx', i: '💫', n: 'Efekty', p: ['Efekty'], gesture: true },
    { k: 'export', i: '📤', n: 'Export', p: ['Export'] }
  ];
  var modal, box, body, preview, sidebar, top, tabs, hud, sheet;
  var tool = 'auto', activeRange = null, mql = window.matchMedia ? window.matchMedia(MQ) : null;

  function $(id) { return document.getElementById(id); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 6); } catch (e) {} }
  function isMobile() { return !!(mql && mql.matches); }

  /* ---------- styly ---------- */
  function css() {
    var s = document.createElement('style'); s.id = 'mpeCss';
    s.textContent =
      '#editorModal .me-top,#editorModal .me-tabs,#editorModal .me-hud,#editorModal .me-sheet{display:none}' +
      '#editorModal.me-mobile .editor-box{width:100vw;max-width:none;height:100vh;height:100dvh;border-radius:0;border:0}' +
      '#editorModal.me-mobile .editor-footer{display:none}' +
      '#editorModal.me-mobile .editor-body{flex-direction:column;position:relative}' +
      '#editorModal.me-mobile .editor-preview{order:1;flex:1 1 auto!important;max-height:none!important;min-height:120px}' +
      '#editorModal.me-mobile .editor-sidebar{order:2;width:100%;flex:0 0 auto;max-height:36dvh;max-height:36vh;border:0;border-top:1px solid var(--border-soft);padding:.5rem .6rem;gap:.5rem}' +
      '#editorModal.me-mobile .editor-panel{display:none;border:0;background:none}' +
      '#editorModal.me-mobile .editor-panel.me-on{display:block}' +
      '#editorModal.me-mobile .editor-panel summary{display:none}' +
      '#editorModal.me-mobile .editor-panel-body{padding:.1rem .1rem .3rem;gap:.55rem}' +
      /* horní lišta */
      '#editorModal.me-mobile .me-top{display:flex;align-items:center;gap:4px;padding:calc(6px + env(safe-area-inset-top)) 6px 6px;background:var(--surface-2);border-bottom:1px solid var(--border-soft)}' +
      '.me-ib{flex:0 1 auto;min-width:40px;width:42px;height:44px;border:0;border-radius:12px;background:var(--surface,#131a2c);color:var(--text,#eef1f8);font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;touch-action:manipulation}' +
      '.me-ib:active{background:var(--surface-3,#212c46)}.me-ib[disabled]{opacity:.35}' +
      '.me-sp{flex:1}' +
      '.me-save{flex:0 0 auto;height:44px;padding:0 12px;margin-left:2px;border:0;border-radius:12px;background:linear-gradient(135deg,#ff7a1a,#e0457b);color:#fff;font:700 15px var(--font-display,inherit);cursor:pointer}' +
      /* dolní lišta nástrojů */
      '#editorModal.me-mobile .me-tabs{order:3;display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;background:var(--surface-2);border-top:1px solid var(--border-soft);padding:4px 4px calc(4px + env(safe-area-inset-bottom))}' +
      '.me-tabs::-webkit-scrollbar{display:none}' +
      '.me-tab{flex:1 0 auto;min-width:58px;display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 6px 4px;border:0;border-radius:12px;background:none;color:var(--text-muted,#92a0bc);font:600 11px var(--font-display,inherit);cursor:pointer;touch-action:manipulation}' +
      '.me-tab .e{font-size:22px;line-height:1.15}' +
      '.me-tab.on{color:#fff;background:var(--surface,#131a2c);box-shadow:inset 0 -2.5px 0 var(--accent,#ff7a1a)}' +
      /* posuvníky pro prst */
      '#editorModal.me-mobile .filter-row{padding:6px 8px;border-radius:10px;border:1px solid transparent}' +
      '#editorModal.me-mobile .filter-row.me-active{border-color:var(--accent,#ff7a1a);background:rgba(255,122,26,.07)}' +
      '#editorModal.me-mobile .filter-row label{font-size:13px}' +
      '#editorModal.me-mobile .editor-sidebar input[type=range]{height:34px;touch-action:pan-y}' +
      '#editorModal.me-mobile .editor-sidebar .btn-sm{min-height:44px;font-size:13px}' +
      '#editorModal.me-mobile .crop-mode-row .btn{flex:1 0 auto}' +
      /* hláška při tahu */
      '#editorModal.me-mobile .me-hud{position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:20;padding:8px 16px;border-radius:999px;background:rgba(10,15,28,.82);border:1px solid var(--border,#263252);color:#fff;font:600 15px var(--font-display,inherit);pointer-events:none;white-space:nowrap;opacity:0;transition:opacity .15s}' +
      '#editorModal.me-mobile .me-hud.on{display:block;opacity:1}' +
      /* uložit – nabídka */
      '#editorModal.me-mobile .me-sheet{position:absolute;right:8px;top:calc(62px + env(safe-area-inset-top));z-index:30;flex-direction:column;gap:6px;padding:8px;background:var(--surface,#131a2c);border:1px solid var(--border,#263252);border-radius:14px;box-shadow:0 14px 34px rgba(0,0,0,.55)}' +
      '#editorModal.me-mobile .me-sheet.on{display:flex}' +
      '.me-sheet button{min-height:48px;padding:0 18px;border:0;border-radius:10px;background:var(--surface-2,#1a2338);color:#fff;font:600 15px var(--font-body,inherit);text-align:left;cursor:pointer}' +
      '.me-sheet button.go{background:#1f9d74}' +
      '@media (min-width:901px){#editorModal.me-mobile .editor-sidebar{max-height:34dvh;max-height:34vh;padding:.5rem 1.2rem}#editorModal.me-mobile .editor-panel-body{max-width:760px;margin:0 auto;width:100%}}' +
      '#editorModal .me-only{display:none}#editorModal.me-mobile .me-only{display:flex;flex-direction:column;gap:8px}' +
      '.me-save-title{font:700 13px var(--font-display,inherit);color:var(--gold,#ffc857);margin-top:4px}' +
      '.me-big{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:56px;padding:10px 14px;border:1px solid var(--border,#263252);border-radius:12px;background:var(--surface-2,#1a2338);color:#fff;font:600 15px var(--font-body,inherit);text-align:left;cursor:pointer;touch-action:manipulation}' +
      '.me-big small{font:400 12px var(--font-body,inherit);color:var(--text-muted,#92a0bc)}' +
      '.me-big.go{background:rgba(31,157,116,.2);border-color:rgba(52,211,153,.55)}.me-big.warn{background:rgba(255,93,122,.1);border-color:rgba(255,93,122,.45)}' +
      '.me-sheet small{color:var(--text-muted,#92a0bc);font-size:12px;padding:0 4px}';
    document.head.appendChild(s);
  }

  /* ---------- sestavení ovládání ---------- */
  function build() {
    modal = $('editorModal'); if (!modal || $('mpeTop')) return;
    box = modal.querySelector('.editor-box'); body = modal.querySelector('.editor-body');
    preview = $('editPreview'); sidebar = modal.querySelector('.editor-sidebar');
    if (!box || !body || !preview || !sidebar) return;

    top = document.createElement('div'); top.id = 'mpeTop'; top.className = 'me-top';
    top.innerHTML =
      '<button class="me-ib" data-a="close" aria-label="Zavřít">✕</button>' +
      '<button class="me-ib" data-a="prev" aria-label="Předchozí fotka">‹</button>' +
      '<button class="me-ib" data-a="next" aria-label="Další fotka">›</button>' +
      '<span class="me-sp"></span>' +
      '<button class="me-ib" data-a="undo" aria-label="Zpět">↶</button>' +
      '<button class="me-ib" data-a="redo" aria-label="Znovu">↷</button>' +
      '<button class="me-ib" data-a="before" aria-label="Podrž pro původní fotku">👁</button>' +
      '<button class="me-save" data-a="save">Uložit</button>';
    box.insertBefore(top, box.firstChild);

    sheet = document.createElement('div'); sheet.className = 'me-sheet';
    sheet.innerHTML = '<button class="go" data-a="saveNew">💾 Uložit jako novou</button><button data-a="saveReplace">💾 Přepsat originál</button><small>Přepsání nejde vrátit.</small>';
    box.appendChild(sheet);

    tabs = document.createElement('div'); tabs.className = 'me-tabs'; tabs.setAttribute('role', 'tablist');
    tabs.innerHTML = TOOLS.map(function (t) { return '<button class="me-tab" role="tab" data-t="' + t.k + '"><span class="e">' + t.i + '</span>' + t.n + '</button>'; }).join('');
    body.appendChild(tabs);

    hud = document.createElement('div'); hud.className = 'me-hud'; body.appendChild(hud);

    top.addEventListener('click', onTop);
    sheet.addEventListener('click', onTop);
    tabs.addEventListener('click', function (e) { var b = e.target.closest('.me-tab'); if (b) { buzz(); setTool(b.dataset.t); } });
    document.addEventListener('click', function (e) { if (sheet && !e.target.closest('.me-sheet,[data-a="save"]')) sheet.classList.remove('on'); });

    // „před“ – podržet
    var bb = top.querySelector('[data-a="before"]');
    var on = function (e) { e.preventDefault(); if (typeof showBeforePreview === 'function') showBeforePreview(true); };
    var off = function () { if (typeof showBeforePreview === 'function') showBeforePreview(false); };
    bb.addEventListener('touchstart', on, { passive: false });
    bb.addEventListener('touchend', off); bb.addEventListener('touchcancel', off);
    bb.addEventListener('mousedown', on); bb.addEventListener('mouseup', off); bb.addEventListener('mouseleave', off);

    // výběr posuvníku klepnutím na řádek
    sidebar.addEventListener('click', function (e) {
      var row = e.target.closest('.filter-row'); if (!row) return;
      var r = row.querySelector('input[type=range]'); if (r) selectRange(r, false);
    });
    bindDoubleTap();
    bindGestures();
  }

  function onTop(e) {
    var b = e.target.closest('[data-a]'); if (!b) return;
    var a = b.dataset.a;
    if (a === 'close') closeEditor();
    else if (a === 'prev') editorStep(-1);
    else if (a === 'next') editorStep(1);
    else if (a === 'undo') { buzz(); undoFilterChange(); }
    else if (a === 'redo') { buzz(); redoFilterChange(); }
    else if (a === 'save') { e.stopPropagation(); sheet.classList.toggle('on'); }
    else if (a === 'saveNew') { sheet.classList.remove('on'); saveEditor('new'); }
    else if (a === 'saveReplace') { sheet.classList.remove('on'); if (confirm('Přepsat originál? Nejde to vrátit.')) saveEditor('replace'); }
  }

  /* ---------- nástroje ---------- */
  function panelByName(name) {
    var all = sidebar.querySelectorAll('details.editor-panel');
    for (var i = 0; i < all.length; i++) { var s = all[i].querySelector('summary'); if (s && s.textContent.indexOf(name) !== -1) return all[i]; }
    return null;
  }
  function setTool(k) {
    var t = TOOLS.filter(function (x) { return x.k === k; })[0] || TOOLS[0];
    tool = t.k;
    sidebar.querySelectorAll('details.editor-panel').forEach(function (d) { d.classList.remove('me-on'); });
    t.p.forEach(function (n) { var d = panelByName(n); if (d) { d.classList.add('me-on'); d.open = true; } });
    tabs.querySelectorAll('.me-tab').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t.k); });
    var on = tabs.querySelector('.me-tab.on'); if (on && on.scrollIntoView) { try { on.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {} }
    sidebar.scrollTop = 0;
    activeRange = null;
    if (t.gesture) {
      var p = panelByName(t.p[0]), r = p && p.querySelector('input[type=range]');
      if (r) selectRange(r, true);
    } else clearActive();
  }
  function clearActive() { sidebar.querySelectorAll('.filter-row.me-active').forEach(function (r) { r.classList.remove('me-active'); }); activeRange = null; }
  function labelOf(r) {
    var row = r.closest('.filter-row'), l = row && row.querySelector('label');
    if (!l) return '';
    var txt = ''; for (var i = 0; i < l.childNodes.length; i++) if (l.childNodes[i].nodeType === 3) txt += l.childNodes[i].textContent;
    return txt.trim();
  }
  function selectRange(r, hint) {
    clearActive();
    var row = r.closest('.filter-row'); if (row) row.classList.add('me-active');
    activeRange = r;
    if (hint) flash('↔ táhni po fotce: ' + labelOf(r));
  }
  var hudT;
  function flash(msg) {
    if (!hud) return;
    hud.textContent = msg; hud.classList.add('on');
    clearTimeout(hudT); hudT = setTimeout(function () { hud.classList.remove('on'); }, 1400);
  }

  /* ---------- dvojklep = výchozí hodnota ---------- */
  function defaultOf(r) {
    var id = r.id || '', min = parseFloat(r.min), max = parseFloat(r.max);
    if (id.indexOf('whitePoint') !== -1) return max;
    if (id.indexOf('presetIntensity') !== -1) return 100;
    return (min <= 0 && max >= 0) ? 0 : min;
  }
  function resetRange(r) {
    r.value = defaultOf(r);
    r.dispatchEvent(new Event('input', { bubbles: true }));
    buzz(10); flash('↺ ' + labelOf(r) + ' vráceno');
  }
  function bindDoubleTap() {
    var last = { el: null, t: 0 };
    sidebar.addEventListener('touchend', function (e) {
      var r = e.target.closest && e.target.closest('input[type=range]'); if (!r) return;
      var now = Date.now();
      if (last.el === r && now - last.t < 320) { resetRange(r); last.t = 0; } else { last.el = r; last.t = now; }
    });
    sidebar.addEventListener('dblclick', function (e) { var r = e.target.closest && e.target.closest('input[type=range]'); if (r) resetRange(r); });
  }

  /* ---------- gesta na fotce ---------- */
  function bindGestures() {
    var mode = null, sx = 0, sy = 0, startVal = 0, pinch = null;
    function dist(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
    preview.addEventListener('touchstart', function (e) {
      if (!isMobile()) return;
      if (e.touches.length === 2) {
        pinch = { d: dist(e.touches[0], e.touches[1]), scale: ED.scale, mx: (e.touches[0].clientX + e.touches[1].clientX) / 2, my: (e.touches[0].clientY + e.touches[1].clientY) / 2, px: ED.panX, py: ED.panY };
        mode = 'pinch'; e.stopPropagation(); e.preventDefault(); return;
      }
      var g = TOOLS.filter(function (x) { return x.k === tool; })[0];
      if (g && g.gesture && activeRange && e.touches.length === 1) {
        mode = 'adjust'; sx = e.touches[0].clientX; sy = e.touches[0].clientY; startVal = parseFloat(activeRange.value);
        e.stopPropagation();
      } else mode = null;
    }, { capture: true, passive: false });
    preview.addEventListener('touchmove', function (e) {
      if (!isMobile() || !mode) return;
      if (mode === 'pinch' && e.touches.length === 2 && pinch && ED.img) {
        var d = dist(e.touches[0], e.touches[1]);
        var ns = Math.max(0.05, Math.min(6, pinch.scale * d / Math.max(10, pinch.d)));
        ED.scale = ns;
        ED.panX = pinch.px + ((e.touches[0].clientX + e.touches[1].clientX) / 2 - pinch.mx);
        ED.panY = pinch.py + ((e.touches[0].clientY + e.touches[1].clientY) / 2 - pinch.my);
        var zs = $('zoomSlider'); if (zs) { if (ns > parseFloat(zs.max)) zs.max = ns; if (ns < parseFloat(zs.min)) zs.min = ns; zs.value = ns; }
        updatePreviewTransform();
        e.stopPropagation(); e.preventDefault(); return;
      }
      if (mode === 'adjust' && activeRange && e.touches.length === 1) {
        var dx = e.touches[0].clientX - sx;
        if (Math.abs(dx) < 4) { e.stopPropagation(); return; }
        var min = parseFloat(activeRange.min), max = parseFloat(activeRange.max), step = parseFloat(activeRange.step) || 1;
        var span = max - min, w = Math.max(200, preview.clientWidth * 0.8);
        var v = startVal + dx / w * span * 0.4;
        v = Math.max(min, Math.min(max, Math.round(v / step) * step));
        if (String(v) !== activeRange.value) {
          activeRange.value = v;
          activeRange.dispatchEvent(new Event('input', { bubbles: true }));
          flash(labelOf(activeRange) + ' ' + (v > 0 && min < 0 ? '+' : '') + v);
        }
        e.stopPropagation(); e.preventDefault();
      }
    }, { capture: true, passive: false });
    var end = function (e) { if (mode === 'pinch' && e.touches && e.touches.length < 2) pinch = null; if (!e.touches || e.touches.length === 0) mode = null; };
    preview.addEventListener('touchend', end, { capture: true }); preview.addEventListener('touchcancel', end, { capture: true });
  }

  /* ---------- zapnutí / vypnutí ---------- */
  function sync() {
    if (!modal) return;
    var open = !modal.classList.contains('hidden');
    var m = isMobile();
    modal.classList.toggle('me-mobile', m);
    if (m && open) {
      var i = (window.G && G.photos && ED && ED.photo) ? G.photos.findIndex(function (x) { return x.id === ED.photo.id; }) : -1;
      var p = top.querySelector('[data-a="prev"]'), n = top.querySelector('[data-a="next"]');
      if (p) p.disabled = i <= 0; if (n) n.disabled = i < 0 || i >= G.photos.length - 1;
    }
  }
  var wasOpen = false;
  function watch() {
    new MutationObserver(function () {
      var open = !modal.classList.contains('hidden');
      if (open && !wasOpen) { sync(); if (isMobile()) { setTool(tool || 'auto'); if (typeof fitImageToPreview === 'function') fitImageToPreview(); } }   // fotka se po změně rozvržení znovu vměstná do náhledu
      else if (open) sync();
      if (!open) { sheet && sheet.classList.remove('on'); }
      wasOpen = open;
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    if (mql && mql.addEventListener) mql.addEventListener('change', function () { sync(); if (!modal.classList.contains('hidden')) { if (isMobile()) setTool(tool); if (typeof fitImageToPreview === 'function') fitImageToPreview(); } });
    // při přepnutí na jinou fotku (‹ ›) se jen obnoví stav tlačítek
    var img = $('editImg'); if (img) new MutationObserver(sync).observe(img, { attributes: true, attributeFilter: ['src'] });
  }

  function start() {
    css(); build(); if (!modal || !top) return; watch(); sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
