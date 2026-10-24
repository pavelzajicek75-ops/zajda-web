/* =========================================================
   admin-areas.js — nová navigace adminu: 5 oblastí místo 10 záložek
   =========================================================
   🏠 Dnes · ✍️ Tvořit · 💬 Ohlas · 🗺️ Web · 📊 Provoz

   Nic se neodebírá ani nepřepisuje: původní záložky (sekce #galleries, #articles, … #tools) a panely
   (commentsBox, siteBox, …) zůstávají přesně jak byly. Tenhle skript jen
     • schová starou lištu záložek a nabídne novou (nahoře na PC/iPadu, dole na telefonu),
     • pod oblastmi ukáže „chipy“ s jednotlivými nástroji (každý otevře svou záložku, nebo jen svůj panel),
     • přidá úvodní obrazovku „Dnes“ (co čeká, rychlé přidání, rozepsané) a plovoucí ＋.
   Načíst AŽ PO dashboard-core.js a timeline-admin.js. */
(function () {
  'use strict';
  var TAB = 'tab', BOX = 'box';
  /* Nástroj: { k: klíč, i: ikona, n: název, a: kind (tab|box), t: záložka/sekce, b: id panelu | '_rest' } */
  var AREAS = [
    { id: 'dnes', i: '✍️', n: 'Tvořit', tools: [
      { k: 'articles', i: '📝', n: 'Články', a: TAB, t: 'articles' },
      { k: 'galleries', i: '🖼️', n: 'Fotky', a: TAB, t: 'galleries' },
      { k: 'timeline', i: '🌌', n: 'Milníky', a: TAB, t: 'timeline' },
      { k: 'quotes', i: '💬', n: 'Citáty', a: TAB, t: 'quotes' },
      { k: 'subsections', i: '📂', n: 'Struktura', a: TAB, t: 'subsections' }
    ] },
    { id: 'ohlas', i: '💬', n: 'Ohlas', tools: [
      { k: 'comments', i: '💬', n: 'Komentáře', a: BOX, t: 'admin', b: 'commentsBox', cnt: 'comments' },
      { k: 'messages', i: '✉️', n: 'Zprávy', a: BOX, t: 'admin', b: 'messagesBox', cnt: 'messages' },
      { k: 'reactions', i: '😀', n: 'Reakce', a: TAB, t: 'reactions' },
      { k: 'mood', i: '🌡️', n: 'Nálada', a: BOX, t: 'overview', b: 'moodBox' }
    ] },
    { id: 'expert', i: '⚙️', n: 'Expert', tools: [
      { g: 'Vzhled a obsah', k: 'about', i: '👤', n: 'O Zajdovi', a: TAB, t: 'about' },
      { g: 'Vzhled a obsah', k: 'featured', i: '🌟', n: 'Začni tady', a: BOX, t: 'admin', b: 'featuredBox' },
      { g: 'Vzhled a obsah', k: 'site', i: '⚙️', n: 'Nastavení webu', a: BOX, t: 'admin', b: 'siteBox' },
      { g: 'Vzhled a obsah', k: 'ideas', i: '💡', n: 'Nápady', a: BOX, t: 'admin', b: 'ideasBox' },
      { g: 'Vzhled a obsah', k: 'share', i: '📲', n: 'Z mobilu', a: BOX, t: 'admin', b: 'shareBox' },
      { g: 'Vzhled a obsah', k: 'push', i: '📣', n: 'Oznámení', a: BOX, t: 'admin', b: 'pushBox' },
      { g: 'Provoz a bezpečnost', k: 'usage', i: '📈', n: 'Stav a využití', a: BOX, t: 'overview', b: '_rest', load: true },
      { g: 'Provoz a bezpečnost', k: 'traffic', i: '👣', n: 'Návštěvnost', a: BOX, t: 'overview', b: 'trafficBox' },
      { g: 'Provoz a bezpečnost', k: 'weekly', i: '🗓️', n: 'Týdenní souhrn', a: BOX, t: 'overview', b: 'weeklyBox' },
      { g: 'Provoz a bezpečnost', k: 'kv', i: '☁️', n: 'Spotřeba KV', a: BOX, t: 'overview', b: 'kvMetricsBox' },
      { g: 'Provoz a bezpečnost', k: 'backup', i: '💾', n: 'Zálohy', a: BOX, t: 'tools', b: 'autoBackupBox' },
      { g: 'Provoz a bezpečnost', k: 'restore', i: '♻️', n: 'Obnova', a: BOX, t: 'tools', b: 'restoreBox' },
      { g: 'Provoz a bezpečnost', k: 'users', i: '👥', n: 'Přístupy a uživatelé', a: BOX, t: 'admin', b: '_rest', load: true },
      { g: 'Provoz a bezpečnost', k: 'errors', i: '🐞', n: 'Hlášené chyby', a: BOX, t: 'tools', b: 'errorsBox', cnt: 'errors' },
      { g: 'Provoz a bezpečnost', k: 'selftest', i: '🩺', n: 'Diagnostika', a: BOX, t: 'tools', b: 'selftestBox' },
      { g: 'Provoz a bezpečnost', k: 'linkcheck', i: '🔎', n: 'Kontrola odkazů', a: BOX, t: 'tools', b: 'linkcheckBox' },
      { g: 'Provoz a bezpečnost', k: 'thumbs', i: '🖼️', n: 'Náhledy fotek', a: BOX, t: 'tools', b: 'thumbsBox' },
      { g: 'Provoz a bezpečnost', k: 'geo', i: '📍', n: 'Doplnit polohy', a: BOX, t: 'tools', b: 'geoFillBox' },
      { g: 'Provoz a bezpečnost', k: 'checklist', i: '✅', n: 'Testovací den', a: BOX, t: 'tools', b: 'checklistBox' },
      { g: 'Provoz a bezpečnost', k: 'guide', i: '📖', n: 'Příručka', a: BOX, t: 'tools', b: 'guideBox' },
      { g: 'Provoz a bezpečnost', k: 'links', i: '🔗', n: 'Záloha, odkazy, složky', a: BOX, t: 'tools', b: '_rest' }
    ] }
  ];
  var SECTIONS_WITH_BOXES = ['admin', 'overview', 'tools'];
  var KEY = 'dashAreaTool';
  var cur = { area: 'dnes', tool: '' };
  var counts = { comments: 0, messages: 0, errors: 0, at: 0 };
  var inited = false, origShowTab = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function areaOf(id) { return AREAS.filter(function (a) { return a.id === id; })[0]; }
  function findTool(k) { for (var i = 0; i < AREAS.length; i++) for (var j = 0; j < AREAS[i].tools.length; j++) if (AREAS[i].tools[j].k === k) return { area: AREAS[i], tool: AREAS[i].tools[j] }; return null; }
  function toolForTab(tab) { for (var i = 0; i < AREAS.length; i++) for (var j = 0; j < AREAS[i].tools.length; j++) { var t = AREAS[i].tools[j]; if (t.a === TAB && t.t === tab) return { area: AREAS[i], tool: t }; } return null; }
  function badgeFor(k) { return k === 'comments' ? counts.comments : k === 'messages' ? counts.messages : k === 'errors' ? counts.errors : 0; }
  function areaBadge(a) { return a.id === 'ohlas' ? counts.comments + counts.messages : a.id === 'expert' ? counts.errors : 0; }

  /* ---------- styly ---------- */
  function css() {
    var s = document.createElement('style'); s.id = 'areasCss';
    s.textContent =
      '#ribbonTabs,#ribbonTabIndicator,#anmOpenBtn{display:none!important}' +
      '.area-hide{display:none!important}' +
      '#areaNav{background:var(--bg,#0a0f1c);border-bottom:1px solid var(--border-soft,rgba(255,255,255,.07))}' +
      '#areaTabs{display:flex;gap:4px;padding:8px 14px 0;overflow-x:auto;scrollbar-width:none}' +
      '#areaTabs::-webkit-scrollbar,#areaChips::-webkit-scrollbar{display:none}' +
      '.ar-tab{position:relative;flex:0 0 auto;display:flex;align-items:center;gap:6px;min-height:44px;padding:8px 16px;border:0;border-radius:12px 12px 0 0;background:none;color:var(--text-muted,#92a0bc);font:600 14.5px var(--font-display,inherit);cursor:pointer;white-space:nowrap}' +
      '.ar-tab:hover{color:var(--text,#eef1f8)}' +
      '.ar-tab.on{color:#fff;background:var(--surface-2,#1a2338);box-shadow:inset 0 -2.5px 0 var(--accent,#ff7a1a)}' +
      '.ar-badge{display:inline-block;min-width:19px;padding:0 6px;border-radius:10px;background:#ff5d7a;color:#fff;font:700 11px/19px var(--font-display,inherit);text-align:center}' +
      '#areaChips{display:flex;gap:6px;padding:10px 14px;overflow-x:auto;scrollbar-width:none}' +
      '.ar-chip{flex:0 0 auto;display:flex;align-items:center;gap:6px;min-height:38px;padding:6px 14px;border-radius:999px;border:1px solid var(--border,#263252);background:var(--surface-2,#1a2338);color:#cfd6ec;font:500 13.5px var(--font-body,inherit);cursor:pointer;white-space:nowrap}' +
      '.ar-chip.on{border-color:#2fe6c9;color:#fff;box-shadow:0 0 12px rgba(47,230,201,.22)}' +
      '#areaChips:empty{display:none}' +
      /* Dnes */
      '#dnes{padding:4px 0 24px}' +
      '.dn-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:6px}' +
      '.dn-tile{text-align:left;background:var(--surface-2,#1a2338);border:1px solid var(--border,#263252);border-radius:14px;padding:12px 14px;cursor:pointer;color:var(--text,#eef1f8);font:inherit}' +
      '.dn-tile:hover{border-color:var(--accent,#ff7a1a)}' +
      '.dn-tile strong{display:block;font:700 26px var(--font-display,inherit)}' +
      '.dn-tile span{font-size:12.5px;color:var(--text-muted,#92a0bc)}' +
      '.dn-tile.hot strong{color:var(--accent,#ff7a1a)}' +
      '.dn-h{font:600 12px var(--font-display,inherit);letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted,#92a0bc);margin:18px 0 8px}' +
      '.dn-quick{display:flex;flex-wrap:wrap;gap:8px}' +
      '.dn-list{display:flex;flex-direction:column;gap:6px}' +
      '.dn-row{display:flex;justify-content:space-between;gap:10px;align-items:center;text-align:left;width:100%;background:var(--surface-2,#1a2338);border:1px solid var(--border,#263252);border-radius:12px;padding:10px 12px;color:var(--text,#eef1f8);font:inherit;font-size:14px;cursor:pointer}' +
      '.dn-row:hover{border-color:var(--accent,#ff7a1a)}' +
      '.dn-row small{color:var(--text-muted,#92a0bc);white-space:nowrap}' +
      '.dn-big{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
      '.dn-bt{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:104px;padding:14px 8px;border-radius:16px;border:1px solid var(--border,#263252);background:var(--surface-2,#1a2338);color:var(--text,#eef1f8);font:600 15px var(--font-display,inherit);cursor:pointer}' +
      '.dn-bt i{font-style:normal;font-size:30px;line-height:1.1}' +
      '.dn-bt small{font:400 12px var(--font-body,inherit);color:var(--text-muted,#92a0bc)}' +
      '.dn-bt.main{border:0;background:linear-gradient(135deg,#ff7a1a,#e0457b);color:#fff}.dn-bt.main small{color:#ffe6d2}' +
      '.dn-bt.wide{grid-column:1/-1;min-height:74px;flex-direction:row;gap:10px}.dn-bt.wide small{display:none}' +
      '.dn-bt:hover{filter:brightness(1.1)}' +
      '.dn-empty{color:var(--text-muted,#92a0bc);font-size:13.5px;padding:6px 2px}' +
      /* spodní lišta (telefon) + plovoucí ＋ */
      '#areaBar{display:none}' +
      '#areaFab,#areaFabMenu{display:none}' +
      '@media (max-width:767px){' +
        '#areaTabs{display:none}' +
        '#areaChips{padding:8px 10px}' +
        '#areaBar{display:grid;grid-template-columns:repeat(3,1fr);position:fixed;left:0;right:0;bottom:0;z-index:950;background:#0e1424;border-top:1px solid var(--border,#263252);padding-bottom:env(safe-area-inset-bottom)}' +
        '.ar-bt{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-height:58px;border:0;background:none;color:var(--text-muted,#92a0bc);font:600 10.5px var(--font-display,inherit);cursor:pointer}' +
        '.ar-bt .e{font-size:21px;line-height:1.1}' +
        '.ar-bt.on{color:#fff}' +
        '.ar-bt.on::before{content:"";position:absolute;top:0;width:34px;height:3px;border-radius:0 0 3px 3px;background:var(--accent,#ff7a1a)}' +
        '.ar-bt .ar-badge{position:absolute;top:5px;left:calc(50% + 6px);min-width:17px;font-size:10px;line-height:17px;padding:0 5px}' +
        '.dash-content{padding-bottom:calc(90px + env(safe-area-inset-bottom))!important}' +
        '#areaFab{bottom:calc(72px + env(safe-area-inset-bottom))}#areaFabMenu{bottom:calc(132px + env(safe-area-inset-bottom))}' +
      '}' +
      '@media (max-width:1100px){' +
        '#areaFab{display:flex;position:fixed;right:16px;bottom:20px;width:54px;height:54px;border-radius:50%;border:0;align-items:center;justify-content:center;font-size:30px;line-height:1;color:#fff;background:linear-gradient(135deg,#ff7a45,#8f6bff);box-shadow:0 8px 22px rgba(255,122,69,.42);z-index:960;cursor:pointer}' +
        '#areaFabMenu{position:fixed;right:16px;bottom:84px;z-index:960;flex-direction:column;gap:2px;background:var(--surface,#131a2c);border:1px solid var(--border,#263252);border-radius:14px;padding:6px;box-shadow:0 12px 30px rgba(0,0,0,.5)}' +
        '#areaFabMenu.on{display:flex}' +
        '#areaFabMenu button{min-height:44px;padding:8px 16px;border:0;border-radius:10px;background:none;color:var(--text,#eef1f8);font:500 15px var(--font-body,inherit);text-align:left;cursor:pointer}' +
        '#areaFabMenu button:hover{background:var(--surface-2,#1a2338)}' +
      '}' +
      '@media (max-width:767px){#areaFab{bottom:calc(72px + env(safe-area-inset-bottom))}}' +
      '@media (pointer:coarse){.ribbon-toolbar .btn,.form-card .btn{min-height:42px}}';
    document.head.appendChild(s);
  }

  /* ---------- sestavení navigace ---------- */
  function build() {
    var top = document.querySelector('.dash-topbar');
    if (!top || $('areaNav')) return;
    var nav = document.createElement('nav'); nav.id = 'areaNav'; nav.setAttribute('aria-label', 'Oblasti administrace');
    nav.innerHTML = '<div id="areaTabs" role="tablist"></div><div id="areaChips"></div>';
    var rt = $('ribbonTabs');
    if (rt && rt.parentNode === top) top.insertBefore(nav, rt); else top.appendChild(nav);

    var bar = document.createElement('div'); bar.id = 'areaBar'; document.body.appendChild(bar);
    var fab = document.createElement('button'); fab.id = 'areaFab'; fab.type = 'button'; fab.setAttribute('aria-label', 'Rychle přidat'); fab.textContent = '＋'; document.body.appendChild(fab);
    var menu = document.createElement('div'); menu.id = 'areaFabMenu';
    menu.innerHTML = '<button data-q="article">📝 Nový článek</button><button data-q="milestone">🌌 Nový milník</button><button data-q="quote">💬 Nový citát</button><button data-q="photos">⬆️ Nahrát fotky</button>';
    document.body.appendChild(menu);

    var main = document.querySelector('.dash-content');
    if (main && !$('dnes')) {
      var sec = document.createElement('section'); sec.id = 'dnes'; sec.className = 'section'; main.insertBefore(sec, main.firstChild);
    }

    nav.addEventListener('click', onNav); bar.addEventListener('click', onNav);
    fab.addEventListener('click', function (e) { e.stopPropagation(); menu.classList.toggle('on'); });
    menu.addEventListener('click', function (e) { var b = e.target.closest('button[data-q]'); if (b) { menu.classList.remove('on'); quick(b.dataset.q); } });
    document.addEventListener('click', function (e) { if (!e.target.closest('#areaFab,#areaFabMenu')) menu.classList.remove('on'); });
    paintNav();
  }

  function onNav(e) {
    var a = e.target.closest('[data-area]'), t = e.target.closest('[data-tool]');
    if (e.target.closest('[data-home]')) { activateDnes(); return; }
    if (e.target.closest('[data-expert-home]')) { activateExpert(); return; }
    if (t) { activateTool(t.dataset.tool); return; }
    if (a) {
      var ar = areaOf(a.dataset.area); if (!ar) return;
      if (ar.id === 'dnes') { activateDnes(); return; }
      if (ar.id === 'expert') { activateExpert(); return; }
      // ve stejné oblasti zůstane poslední nástroj, jinak první
      var remembered = ar.tools.filter(function (x) { return x.k === cur.tool; })[0];
      activateTool((remembered || ar.tools[0]).k);
    }
  }

  function paintNav() {
    var tabs = $('areaTabs'), bar = $('areaBar'), chips = $('areaChips');
    if (!tabs) return;
    tabs.innerHTML = AREAS.map(function (a) {
      var b = areaBadge(a);
      return '<button class="ar-tab' + (a.id === cur.area ? ' on' : '') + '" role="tab" data-area="' + a.id + '">' + a.i + ' ' + a.n + (b ? '<span class="ar-badge">' + b + '</span>' : '') + '</button>';
    }).join('');
    bar.innerHTML = AREAS.map(function (a) {
      var b = areaBadge(a);
      return '<button class="ar-bt' + (a.id === cur.area ? ' on' : '') + '" data-area="' + a.id + '"><span class="e">' + a.i + '</span>' + a.n + (b ? '<span class="ar-badge">' + b + '</span>' : '') + '</button>';
    }).join('');
    var ar = areaOf(cur.area);
    var tools = ar.tools, lead = '';
    if (ar.id === 'expert') { tools = ar.tools.filter(function (t) { return t.k === cur.tool; }); lead = '<button class="ar-chip" data-expert-home="1">‹ Všechny nástroje</button>'; }
    else if (ar.id === 'dnes') { lead = '<button class="ar-chip' + (cur.tool ? '' : ' on') + '" data-home="1">🏠 Úvod</button>'; }
    chips.innerHTML = ((ar.id === 'expert' || ar.id === 'dnes') && !cur.tool ? '' : lead + '') + (((ar.id === 'expert' || ar.id === 'dnes') && !cur.tool) ? [] : tools).map(function (t) {
      var b = badgeFor(t.k);
      return '<button class="ar-chip' + (t.k === cur.tool ? ' on' : '') + '" data-tool="' + t.k + '">' + t.i + ' ' + esc(t.n) + (b ? '<span class="ar-badge">' + b + '</span>' : '') + '</button>';
    }).join('');
    var on = chips.querySelector('.ar-chip.on'); if (on && on.scrollIntoView) { try { on.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {} }
  }

  /* ---------- přepínání obsahu ---------- */
  function setActiveSection(id) {
    document.querySelectorAll('.ribbon-tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.dash-content .section').forEach(function (s) { s.classList.toggle('active', s.id === id); });
    var tb = $('ribbonToolbar'); if (tb) tb.style.display = (id === 'dnes' || SECTIONS_WITH_BOXES.indexOf(id) !== -1) ? 'none' : '';   // v panelech nástrojů je lišta zbytečná
    try { if (typeof window.showRibbonGroup === 'function') window.showRibbonGroup(id); } catch (e) {}
    window.scrollTo(0, 0);
  }

  function applyFocus(secId) {
    var sec = $(secId); if (!sec) return;
    var key = sec.dataset.focus || '';
    Array.prototype.forEach.call(sec.children, function (ch) {
      if (/Boxes$/.test(ch.id)) {
        Array.prototype.forEach.call(ch.children, function (b) { b.classList.toggle('area-hide', !!key && b.id !== key); });
      } else { ch.classList.toggle('area-hide', !!key && key !== '_rest'); }
    });
  }
  function setFocus(secId, key) {
    SECTIONS_WITH_BOXES.forEach(function (id) {
      var s = $(id); if (!s) return;
      if (id === secId) s.dataset.focus = key || ''; else s.dataset.focus = '';
      applyFocus(id);
    });
  }
  function watchBoxes() {
    if (!window.MutationObserver) return;
    SECTIONS_WITH_BOXES.forEach(function (id) {
      var s = $(id); if (!s) return;
      var t = null;
      var ob = new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { applyFocus(id); }, 30); });
      ob.observe(s, { childList: true, subtree: true });
    });
  }

  function openTab(name) {
    if (name === 'timeline') {
      var b = $('timelineTabBtn');
      if (b) { b.click(); return; }
      name = 'galleries';
    }
    var tb = $('ribbonToolbar'); if (tb) tb.style.display = '';
    if (typeof origShowTab === 'function') origShowTab(name);
  }

  function activateDnes() {
    cur = { area: 'dnes', tool: '' };
    try { localStorage.setItem(KEY, 'dnes'); } catch (e) {}
    setFocus('', '');
    setActiveSection('dnes'); paintNav(); renderDnes();
  }

  function activateExpert() {
    cur = { area: 'expert', tool: '' };
    try { localStorage.setItem(KEY, 'expert'); } catch (e) {}
    setFocus('', '');
    setActiveSection('dnes'); paintNav(); renderExpert();
  }

  function activateTool(k) {
    var f = findTool(k); if (!f) return activateDnes();
    var t = f.tool;
    cur = { area: f.area.id, tool: k };
    try { localStorage.setItem(KEY, k); } catch (e) {}
    if (t.a === TAB) {
      setFocus('', '');
      openTab(t.t);
    } else {
      setFocus(t.t, t.b);
      if (t.load && typeof origShowTab === 'function') origShowTab(t.t);   // pro tyhle dva se doplní i data (přístupy, využití)
      else setActiveSection(t.t);
      setFocus(t.t, t.b);
    }
    paintNav();
  }

  /* ---------- Dnes ---------- */
  var dnesData = { drafts: [], recent: [], ok: false };
  function ago(ts) {
    var d = Math.floor((Date.now() - Number(ts || 0)) / 86400000);
    return !ts ? '' : d <= 0 ? 'dnes' : d === 1 ? 'včera' : d < 14 ? 'před ' + d + ' dny' : new Date(Number(ts)).toLocaleDateString('cs');
  }
  function renderDnes() {
    var sec = $('dnes'); if (!sec || cur.area !== 'dnes') return;
    var drafts = dnesData.drafts, recent = dnesData.recent;
    var waiting = [];
    if (counts.comments) waiting.push('<button class="dn-row" data-go="comments"><span>💬 Komentáře ke schválení</span><small class="ar-badge">' + counts.comments + '</small></button>');
    if (counts.messages) waiting.push('<button class="dn-row" data-go="messages"><span>✉️ Nepřečtené zprávy</span><small class="ar-badge">' + counts.messages + '</small></button>');
    if (counts.errors) waiting.push('<button class="dn-row" data-go="errors"><span>🐞 Hlášené chyby</span><small class="ar-badge">' + counts.errors + '</small></button>');
    sec.innerHTML =
      '<div class="dn-h">Co chceš udělat?</div>' +
      '<div class="dn-big">' +
        '<button class="dn-bt main" data-q="article"><i>✍️</i>Nový článek<small>psaní a vkládání</small></button>' +
        '<button class="dn-bt main" data-go="galleries"><i>🖼️</i>Fotky<small>galerie a úpravy</small></button>' +
        '<button class="dn-bt" data-go="timeline"><i>🌌</i>Milníky<small>timeline</small></button>' +
        '<button class="dn-bt" data-go="quotes"><i>💬</i>Citáty<small>přidat / smazat</small></button>' +
        '<button class="dn-bt wide" data-go="subsections"><i>📂</i>Struktura<small>sekce, podsekce a covery</small></button>' +
      '</div>' +
      '<div class="dn-h">Čeká na tebe</div><div class="dn-list">' +
        (waiting.length ? waiting.join('') : '<div class="dn-empty">' + (dnesData.ok ? 'Nic nečeká. 🎉' : 'Načítám…') + '</div>') +
      '</div>' +
      '<div class="dn-h">Rozepsané</div><div class="dn-list">' +
        (drafts.length ? drafts.map(rowHtml).join('') : '<div class="dn-empty">' + (dnesData.ok ? 'Žádný rozepsaný článek.' : 'Načítám…') + '</div>') +
      '</div>' +
      '<div class="dn-h">Naposledy upraveno</div><div class="dn-list">' +
        (recent.length ? recent.map(rowHtml).join('') : '<div class="dn-empty">' + (dnesData.ok ? 'Zatím nic.' : 'Načítám…') + '</div>') +
      '</div>';
  }
  function renderExpert() {
    var sec = $('dnes'); if (!sec) return;
    var ar = areaOf('expert'), groups = [], map = {};
    ar.tools.forEach(function (t) { if (!map[t.g]) { map[t.g] = []; groups.push(t.g); } map[t.g].push(t); });
    sec.innerHTML = groups.map(function (g) {
      return '<div class="dn-h">' + esc(g) + '</div><div class="dn-list">' + map[g].map(function (t) {
        var b = badgeFor(t.k);
        return '<button class="dn-row" data-go="' + t.k + '"><span>' + t.i + ' ' + esc(t.n) + '</span>' + (b ? '<small class="ar-badge">' + b + '</small>' : '<small>›</small>') + '</button>';
      }).join('') + '</div>';
    }).join('');
  }
  function rowHtml(a) {
    return '<button class="dn-row" data-edit="' + esc(a.id) + '"><span>' + esc(a.title || 'Bez názvu') + '</span><small>' + esc(a.published === false ? 'koncept · ' + ago(a.updated || a.created) : ago(a.updated || a.created)) + '</small></button>';
  }
  function jget(u) { return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  function loadDnes(force) {
    if (!force && Date.now() - counts.at < 60000) { renderDnes(); return; }
    Promise.all([jget('/api/comments/pending'), jget('/api/messages/list'), jget('/api/errors/list'), jget('/api/articles/list')]).then(function (r) {
      counts.comments = Array.isArray(r[0]) ? r[0].length : 0;
      counts.messages = Array.isArray(r[1]) ? r[1].filter(function (m) { return !m.read; }).length : 0;
      counts.errors = r[2] && Array.isArray(r[2].items) ? r[2].items.length : 0;
      counts.at = Date.now();
      var arts = Array.isArray(r[3]) ? r[3] : [];
      arts.sort(function (a, b) { return (b.updated || b.created || 0) - (a.updated || a.created || 0); });
      dnesData.drafts = arts.filter(function (a) { return a.published === false; }).slice(0, 5);
      dnesData.recent = arts.slice(0, 5);
      dnesData.ok = true;
      paintNav();
      if (cur.area === 'dnes' && !cur.tool) renderDnes(); else if (cur.area === 'expert' && !cur.tool) renderExpert();
    });
  }

  function quick(what) {
    if (what === 'article') { activateTool('articles'); setTimeout(function () { if (typeof window.resetArticleForm === 'function') window.resetArticleForm(); }, 60); }
    else if (what === 'milestone') { activateTool('timeline'); setTimeout(function () { if (typeof window.resetTimelineForm === 'function') window.resetTimelineForm(); }, 120); }
    else if (what === 'quote') { activateTool('quotes'); setTimeout(function () { var q = $('qText'); if (q) q.focus(); }, 120); }
    else if (what === 'photos') { activateTool('galleries'); var fi = $('fileInput'); if (fi) fi.click(); }
  }

  function bindDnes() {
    document.addEventListener('click', function (e) {
      var g = e.target.closest('#dnes [data-go]'); if (g) { activateTool(g.dataset.go); return; }
      var q = e.target.closest('#dnes [data-q]'); if (q) { quick(q.dataset.q); return; }
      var ed = e.target.closest('#dnes [data-edit]');
      if (ed) { var id = ed.dataset.edit; activateTool('articles'); setTimeout(function () { if (typeof window.editArticle === 'function') window.editArticle(id); }, 250); }
    });
  }

  /* ---------- napojení na stávající showTab ---------- */
  function hook() {
    origShowTab = window.showTab;
    if (typeof origShowTab !== 'function') return;
    window.showTab = function (name) {
      if (!inited) { inited = true; var saved = ''; try { saved = localStorage.getItem(KEY) || ''; } catch (e) {} return startWith(saved); }
      origShowTab.apply(this, arguments);
      var f = toolForTab(name);               // někdo jiný přepnul záložku → jen zvýrazni odpovídající nástroj
      if (f && (cur.tool !== f.tool.k)) { cur = { area: f.area.id, tool: f.tool.k }; setFocus('', ''); paintNav(); }
    };
  }
  function startWith(saved) {
    if (saved === 'expert') activateExpert(); else if (saved && saved !== 'dnes' && findTool(saved)) activateTool(saved); else activateDnes();
    loadDnes(true);
  }

  function start() {
    css(); build(); bindDnes(); hook(); watchBoxes();
    // pojistka: kdyby základní skript showTab nezavolal (např. už byl přihlášen dřív), spustí se výchozí obrazovka sám
    setTimeout(function () { if (!inited) { inited = true; var saved = ''; try { saved = localStorage.getItem(KEY) || ''; } catch (e) {} startWith(saved); } }, 2500);
  }
  window.AdminAreas = { activateTool: activateTool, activateDnes: activateDnes, activateExpert: activateExpert, refresh: function () { loadDnes(true); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
