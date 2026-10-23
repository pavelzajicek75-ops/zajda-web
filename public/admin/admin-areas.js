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
    { id: 'dnes', i: '🏠', n: 'Dnes', tools: [] },
    { id: 'tvorit', i: '✍️', n: 'Tvořit', tools: [
      { k: 'articles', i: '📝', n: 'Články', a: TAB, t: 'articles' },
      { k: 'timeline', i: '🌌', n: 'Milníky', a: TAB, t: 'timeline' },
      { k: 'quotes', i: '💬', n: 'Citáty', a: TAB, t: 'quotes' },
      { k: 'galleries', i: '🖼️', n: 'Fotky a galerie', a: TAB, t: 'galleries' },
      { k: 'about', i: '👤', n: 'O Zajdovi', a: TAB, t: 'about' },
      { k: 'subsections', i: '📂', n: 'Struktura a covery', a: TAB, t: 'subsections' },
      { k: 'ideas', i: '💡', n: 'Nápady', a: BOX, t: 'admin', b: 'ideasBox' },
      { k: 'share', i: '📲', n: 'Z mobilu', a: BOX, t: 'admin', b: 'shareBox' }
    ] },
    { id: 'ohlas', i: '💬', n: 'Ohlas', tools: [
      { k: 'comments', i: '💬', n: 'Komentáře', a: BOX, t: 'admin', b: 'commentsBox', cnt: 'comments' },
      { k: 'messages', i: '✉️', n: 'Zprávy', a: BOX, t: 'admin', b: 'messagesBox', cnt: 'messages' },
      { k: 'reactions', i: '😀', n: 'Reakce', a: TAB, t: 'reactions' },
      { k: 'mood', i: '🌡️', n: 'Nálada', a: BOX, t: 'overview', b: 'moodBox' },
      { k: 'errors', i: '🐞', n: 'Hlášené chyby', a: BOX, t: 'tools', b: 'errorsBox', cnt: 'errors' }
    ] },
    { id: 'web', i: '🗺️', n: 'Web', tools: [
      { k: 'featured', i: '🌟', n: 'Začni tady', a: BOX, t: 'admin', b: 'featuredBox' },
      { k: 'site', i: '⚙️', n: 'Nastavení webu', a: BOX, t: 'admin', b: 'siteBox' },
      { k: 'push', i: '📣', n: 'Oznámení', a: BOX, t: 'admin', b: 'pushBox' },
      { k: 'users', i: '👥', n: 'Přístupy', a: BOX, t: 'admin', b: '_rest', load: true }
    ] },
    { id: 'provoz', i: '📊', n: 'Provoz', tools: [
      { k: 'usage', i: '📈', n: 'Stav a využití', a: BOX, t: 'overview', b: '_rest', load: true },
      { k: 'traffic', i: '👣', n: 'Návštěvnost', a: BOX, t: 'overview', b: 'trafficBox' },
      { k: 'weekly', i: '🗓️', n: 'Týdenní souhrn', a: BOX, t: 'overview', b: 'weeklyBox' },
      { k: 'kv', i: '☁️', n: 'Spotřeba KV', a: BOX, t: 'overview', b: 'kvMetricsBox' },
      { k: 'backup', i: '💾', n: 'Zálohy', a: BOX, t: 'tools', b: 'autoBackupBox' },
      { k: 'restore', i: '♻️', n: 'Obnova', a: BOX, t: 'tools', b: 'restoreBox' },
      { k: 'selftest', i: '🩺', n: 'Diagnostika', a: BOX, t: 'tools', b: 'selftestBox' },
      { k: 'linkcheck', i: '🔎', n: 'Kontrola odkazů', a: BOX, t: 'tools', b: 'linkcheckBox' },
      { k: 'thumbs', i: '🖼️', n: 'Náhledy fotek', a: BOX, t: 'tools', b: 'thumbsBox' },
      { k: 'geo', i: '📍', n: 'Doplnit polohy', a: BOX, t: 'tools', b: 'geoFillBox' },
      { k: 'checklist', i: '✅', n: 'Testovací den', a: BOX, t: 'tools', b: 'checklistBox' },
      { k: 'guide', i: '📖', n: 'Příručka', a: BOX, t: 'tools', b: 'guideBox' },
      { k: 'links', i: '🔗', n: 'Záloha, odkazy, složky', a: BOX, t: 'tools', b: '_rest' }
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
  function areaBadge(a) { return a.id === 'ohlas' ? counts.comments + counts.messages + counts.errors : 0; }

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
      '.dn-empty{color:var(--text-muted,#92a0bc);font-size:13.5px;padding:6px 2px}' +
      /* spodní lišta (telefon) + plovoucí ＋ */
      '#areaBar{display:none}' +
      '#areaFab,#areaFabMenu{display:none}' +
      '@media (max-width:767px){' +
        '#areaTabs{display:none}' +
        '#areaChips{padding:8px 10px}' +
        '#areaBar{display:grid;grid-template-columns:repeat(5,1fr);position:fixed;left:0;right:0;bottom:0;z-index:950;background:#0e1424;border-top:1px solid var(--border,#263252);padding-bottom:env(safe-area-inset-bottom)}' +
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
    if (t) { activateTool(t.dataset.tool); return; }
    if (a) {
      var ar = areaOf(a.dataset.area); if (!ar) return;
      if (ar.id === 'dnes') { activateDnes(); return; }
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
    chips.innerHTML = ar.tools.map(function (t) {
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
    var sec = $('dnes'); if (!sec) return;
    var drafts = dnesData.drafts, recent = dnesData.recent;
    sec.innerHTML =
      '<div class="dn-tiles">' +
        '<button class="dn-tile' + (counts.comments ? ' hot' : '') + '" data-go="comments"><strong>' + counts.comments + '</strong><span>komentářů ke schválení</span></button>' +
        '<button class="dn-tile' + (counts.messages ? ' hot' : '') + '" data-go="messages"><strong>' + counts.messages + '</strong><span>nepřečtených zpráv</span></button>' +
        '<button class="dn-tile' + (counts.errors ? ' hot' : '') + '" data-go="errors"><strong>' + counts.errors + '</strong><span>hlášených chyb</span></button>' +
        '<button class="dn-tile" data-go="usage"><strong>✅</strong><span>stav a využití</span></button>' +
      '</div>' +
      '<div class="dn-h">Rychle přidat</div>' +
      '<div class="dn-quick"><button class="btn btn-blue" data-q="article">📝 Článek</button><button class="btn" data-q="milestone">🌌 Milník</button><button class="btn" data-q="quote">💬 Citát</button><button class="btn" data-q="photos">⬆️ Fotky</button></div>' +
      '<div class="dn-h">Rozepsané</div><div class="dn-list">' +
        (drafts.length ? drafts.map(rowHtml).join('') : '<div class="dn-empty">' + (dnesData.ok ? 'Žádný rozepsaný článek.' : 'Načítám…') + '</div>') +
      '</div>' +
      '<div class="dn-h">Naposledy upraveno</div><div class="dn-list">' +
        (recent.length ? recent.map(rowHtml).join('') : '<div class="dn-empty">' + (dnesData.ok ? 'Zatím nic.' : 'Načítám…') + '</div>') +
      '</div>';
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
      if (cur.area === 'dnes') renderDnes();
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
    if (saved && saved !== 'dnes' && findTool(saved)) activateTool(saved); else activateDnes();
    loadDnes(true);
  }

  function start() {
    css(); build(); bindDnes(); hook(); watchBoxes();
    // pojistka: kdyby základní skript showTab nezavolal (např. už byl přihlášen dřív), spustí se výchozí obrazovka sám
    setTimeout(function () { if (!inited) { inited = true; var saved = ''; try { saved = localStorage.getItem(KEY) || ''; } catch (e) {} startWith(saved); } }, 2500);
  }
  window.AdminAreas = { activateTool: activateTool, activateDnes: activateDnes, refresh: function () { loadDnes(true); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
