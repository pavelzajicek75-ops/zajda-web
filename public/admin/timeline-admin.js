/* =========================================================
   timeline-admin.js
   =========================================================
   Přidává do administrace novou záložku "📖 Timeline" pro správu
   milníků (datum, název, text, volitelná fotka) — bez úprav
   dashboard-core.js / dashboard-editor.js.

   Proč se nepoužívá vestavěná showTab('timeline')?
   dashboard-core.js má pole RIBBON_TABS = ['galleries','articles',...]
   jako `const` v modulovém rozsahu skriptu — v klasickém (ne-modul)
   <script> se `const`/`let` NEPŘIPOJÍ na `window`, takže zvenku k němu
   není přístup ani ho nejde rozšířit. showTab('timeline') by proto
   tiše přepnulo zpátky na 'galleries'. Tenhle soubor si místo toho
   přepínání záložky implementuje sám, přes stejné (veřejně dostupné,
   protože jde o function deklarace) pomocné funkce jako
   showRibbonGroup() a moveTabIndicator() — výsledek vypadá a chová se
   identicky jako vestavěné záložky.

   Načíst AŽ PO dashboard-core.js a dashboard-editor.js.
   ========================================================= */
(function () {
  function $(id) { return document.getElementById(id); }

  var TIMELINE_TAB_LABEL = '📖 Timeline';
  var timelineCache = [];
  var editingId = null;

  /* === VLOŽENÍ TLAČÍTKA ZÁLOŽKY, RIBBON SKUPINY A SEKCE === */
  function injectTimelineUI() {
    if ($('timelineTabBtn')) return; // idempotentní

    var tabsNav = $('ribbonTabs');
    var aboutTabBtn = tabsNav ? tabsNav.querySelector('.ribbon-tab[data-tab="about"]') : null;
    if (tabsNav) {
      var tabBtn = document.createElement('button');
      tabBtn.className = 'ribbon-tab';
      tabBtn.id = 'timelineTabBtn';
      tabBtn.dataset.tab = 'timeline';
      tabBtn.textContent = TIMELINE_TAB_LABEL;
      tabBtn.addEventListener('click', openTimelineTab);
      if (aboutTabBtn && aboutTabBtn.nextSibling) tabsNav.insertBefore(tabBtn, aboutTabBtn.nextSibling);
      else tabsNav.appendChild(tabBtn);
    }

    var toolbar = $('ribbonToolbar');
    if (toolbar) {
      var group = document.createElement('div');
      group.className = 'ribbon-group';
      group.dataset.for = 'timeline';
      group.innerHTML = '<button class="btn btn-blue btn-sm" onclick="resetTimelineForm()">➕ Nový milník</button>';
      toolbar.appendChild(group);
    }

    var main = document.querySelector('.dash-content');
    if (main) {
      var section = document.createElement('section');
      section.id = 'timeline';
      section.className = 'section';
      section.innerHTML =
        '<div class="form-card">' +
        '<div class="form-row">' +
        '<input type="date" id="tlDate" class="form-input" style="max-width:180px">' +
        '<input type="text" id="tlTitle" class="form-input" placeholder="Název milníku" style="flex:2">' +
        '</div>' +
        '<div class="form-row">' +
        '<textarea id="tlText" class="form-input" rows="4" placeholder="Text — co se stalo, jak jsi se cítil, co to znamenalo…" style="resize:vertical;flex:1"></textarea>' +
        '</div>' +
        '<div class="form-row" style="align-items:center">' +
        '<label style="min-width:110px">Fotka (volitelné)</label>' +
        '<div id="tlPhotoPreview" style="width:90px;height:60px;border-radius:6px;background:var(--surface-2);border:1px solid var(--border-soft);background-size:cover;background-position:center;flex-shrink:0"></div>' +
        '<button type="button" class="btn btn-sm" onclick="pickTimelinePhoto()">🖼️ Vybrat z galerie</button>' +
        '<button type="button" class="btn btn-sm" onclick="clearTimelinePhoto()">✖ Zrušit</button>' +
        '<input type="hidden" id="tlPhotoUrl" value="">' +
        '</div>' +
        '<div class="form-row" style="margin-top:1rem">' +
        '<button id="tlSubmitBtn" class="btn btn-blue" onclick="createTimelineMilestone()">Přidat milník</button>' +
        '</div>' +
        '</div>' +
        '<div id="timelineList" style="margin-top:1rem"></div>';
      main.appendChild(section);
    }
  }

  /* === PŘEPNUTÍ NA ZÁLOŽKU (bez showTab(), viz komentář nahoře) === */
  function openTimelineTab() {
    document.querySelectorAll('.ribbon-tab').forEach(function (t) { t.classList.toggle('active', t.id === 'timelineTabBtn'); });
    document.querySelectorAll('.dash-content .section').forEach(function (s) { s.classList.toggle('active', s.id === 'timeline'); });
    localStorage.setItem('dashActiveTab', 'timeline');
    if (typeof window.showRibbonGroup === 'function') window.showRibbonGroup('timeline');
    if (typeof window.moveTabIndicator === 'function') window.moveTabIndicator();
    loadTimelineData();
  }

  /* === CRUD === */
  async function loadTimelineData() {
    var box = $('timelineList');
    if (!box) return;
    box.innerHTML = '<div style="color:#64748b;padding:1rem;text-align:center">Načítání…</div>';
    try {
      var r = await fetch('/api/timeline/list');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var data = await r.json();
      timelineCache = Array.isArray(data) ? data : [];
      renderTimelineList(timelineCache);
    } catch (e) {
      console.error('Timeline načtení selhalo:', e);
      box.innerHTML = '<div style="color:#ef4444;padding:1rem;text-align:center">Nepodařilo se načíst milníky</div>';
    }
  }

  function renderTimelineList(arr) {
    var box = $('timelineList');
    if (!box) return;
    if (!arr.length) {
      box.innerHTML = '<div style="color:#64748b;padding:1rem;text-align:center">Zatím žádné milníky — přidej první výše.</div>';
      return;
    }
    // V administraci se hodí vidět nejnovější přidané nahoře (na
    // veřejné timeline se pak řadí chronologicky vzestupně, viz
    // frontend) — tady jde hlavně o rychlou orientaci při editaci.
    var sorted = arr.slice().sort(function (a, b) {
      var da = a.date || '', db = b.date || '';
      return da < db ? 1 : da > db ? -1 : 0;
    });
    box.innerHTML = sorted.map(function (m) {
      var dateStr = '';
      try { dateStr = m.date ? new Date(m.date).toLocaleDateString('cs') : ''; } catch (e) {}
      var thumb = m.photoUrl
        ? '<img src="' + m.photoUrl + '" style="width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0;border:1px solid #263252">'
        : '';
      var excerpt = (m.text || '').replace(/<[^>]+>/g, '').substring(0, 140);
      return '<div class="card" style="margin-bottom:1rem;padding:1rem;background:#131a2c;border:1px solid #263252;border-radius:10px">' +
        '<div style="display:flex;gap:0.9rem">' + thumb +
        '<div style="flex:1;min-width:0">' +
        '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.3rem">' +
        '<h4 style="color:#ffc857;margin:0">' + escapeHtml(m.title || 'Bez názvu') + '</h4>' +
        '</div>' +
        '<p style="color:#92a0bc;font-size:13px;margin-bottom:0.5rem">' + escapeHtml(dateStr) + '</p>' +
        (excerpt ? '<p style="color:#cbd5e1;font-size:14px;margin-bottom:0.75rem;line-height:1.5">' + escapeHtml(excerpt) + (excerpt.length >= 140 ? '…' : '') + '</p>' : '') +
        '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">' +
        '<button onclick="editTimelineMilestone(\'' + m.id + '\')" class="btn btn-blue btn-sm">✏️ Upravit</button>' +
        '<button onclick="deleteTimelineMilestone(\'' + m.id + '\')" class="btn btn-red btn-sm">🗑 Smazat</button>' +
        '</div></div></div></div>';
    }).join('');
  }

  window.createTimelineMilestone = async function () {
    var title = $('tlTitle') ? $('tlTitle').value.trim() : '';
    var date = $('tlDate') ? $('tlDate').value : '';
    if (!title || !date) {
      if (typeof showToast === 'function') showToast('Vyplň aspoň datum a název.', 'info');
      return;
    }
    var payload = {
      date: date,
      title: title,
      text: $('tlText') ? $('tlText').value.trim() : '',
      photoUrl: $('tlPhotoUrl') ? $('tlPhotoUrl').value : ''
    };
    try {
      var r = await fetch('/api/timeline/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error('Chyba ukládání');
      resetTimelineForm();
      loadTimelineData();
      if (typeof showToast === 'function') showToast('Milník přidán', 'success');
    } catch (e) {
      console.error(e);
      if (typeof showToast === 'function') showToast('Nepodařilo se uložit milník', 'error');
    }
  };

  window.editTimelineMilestone = function (id) {
    var m = timelineCache.find(function (x) { return String(x.id) === String(id); });
    if (!m) return;
    if ($('tlDate')) $('tlDate').value = m.date || '';
    if ($('tlTitle')) $('tlTitle').value = m.title || '';
    if ($('tlText')) $('tlText').value = m.text || '';
    if ($('tlPhotoUrl')) $('tlPhotoUrl').value = m.photoUrl || '';
    var prev = $('tlPhotoPreview');
    if (prev) prev.style.backgroundImage = m.photoUrl ? "url('" + m.photoUrl + "')" : '';
    editingId = id;
    var btn = $('tlSubmitBtn');
    if (btn) {
      btn.textContent = '💾 Uložit změny';
      btn.onclick = updateTimelineMilestone;
    }
    var section = $('timeline');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.updateTimelineMilestone = async function () {
    if (!editingId) return window.createTimelineMilestone();
    var payload = {
      id: editingId,
      date: $('tlDate') ? $('tlDate').value : '',
      title: $('tlTitle') ? $('tlTitle').value.trim() : '',
      text: $('tlText') ? $('tlText').value.trim() : '',
      photoUrl: $('tlPhotoUrl') ? $('tlPhotoUrl').value : ''
    };
    if (!payload.title || !payload.date) {
      if (typeof showToast === 'function') showToast('Vyplň aspoň datum a název.', 'info');
      return;
    }
    try {
      var r = await fetch('/api/timeline/update', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error('Chyba ukládání');
      resetTimelineForm();
      loadTimelineData();
      if (typeof showToast === 'function') showToast('Změny uloženy', 'success');
    } catch (e) {
      console.error(e);
      if (typeof showToast === 'function') showToast('Nepodařilo se uložit změny', 'error');
    }
  };

  window.deleteTimelineMilestone = async function (id) {
    var ok = typeof showConfirm === 'function'
      ? await showConfirm('Opravdu smazat tento milník?', { danger: true, confirmText: 'Smazat' })
      : confirm('Opravdu smazat tento milník?');
    if (!ok) return;
    try {
      var r = await fetch('/api/timeline/delete?id=' + encodeURIComponent(id), { method: 'DELETE' });
      if (!r.ok) throw new Error('Chyba mazání');
      loadTimelineData();
    } catch (e) {
      console.error(e);
      if (typeof showToast === 'function') showToast('Nepodařilo se smazat milník', 'error');
    }
  };

  window.resetTimelineForm = function () {
    editingId = null;
    if ($('tlDate')) $('tlDate').value = '';
    if ($('tlTitle')) $('tlTitle').value = '';
    if ($('tlText')) $('tlText').value = '';
    window.clearTimelinePhoto();
    var btn = $('tlSubmitBtn');
    if (btn) {
      btn.textContent = 'Přidat milník';
      btn.onclick = window.createTimelineMilestone;
    }
  };

  window.clearTimelinePhoto = function () {
    if ($('tlPhotoUrl')) $('tlPhotoUrl').value = '';
    var prev = $('tlPhotoPreview');
    if (prev) prev.style.backgroundImage = '';
  };

  /* === VÝBĚR FOTKY Z GALERIE (znovu použije window.G.photos, které
     naplňuje dashboard-core.js) === */
  window.pickTimelinePhoto = function () {
    if (!window.G || !G.photos || !G.photos.length) {
      if (typeof showToast === 'function') showToast('Galerie je prázdná. Nejprve nahraj fotky.', 'info');
      return;
    }
    var m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = '<div style="background:var(--surface);padding:1.5rem;border-radius:var(--r-lg);max-width:90vw;max-height:80vh;overflow:auto;border:1px solid var(--border-soft)">' +
      '<h3 style="margin-bottom:1rem;color:var(--text)">Fotka k milníku</h3>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.5rem">' +
      G.photos.map(function (p) {
        return '<img src="' + p.url + '" style="width:100%;height:110px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="setTimelinePhoto(\'' + p.url + '\')">';
      }).join('') +
      '</div><div style="text-align:center;margin-top:1rem"><button onclick="this.closest(\'.modal\').remove()" class="btn btn-red">Zavřít</button></div></div>';
    m.onclick = function (e) { if (e.target === m) m.remove(); };
    document.body.appendChild(m);
  };

  window.setTimelinePhoto = function (url) {
    if ($('tlPhotoUrl')) $('tlPhotoUrl').value = url;
    var prev = $('tlPhotoPreview');
    if (prev) prev.style.backgroundImage = "url('" + url + "')";
    var modal = document.querySelector('.modal');
    if (modal) modal.remove();
  };

  document.addEventListener('DOMContentLoaded', function () {
    injectTimelineUI();
    // Kdyby byla naposledy aktivní záložka "timeline" (localStorage),
    // dashboard-core.js by ji při vlastním startu tiše přehodil zpátky
    // na "galleries" (viz vysvětlení nahoře) — tady se to po jeho
    // inicializaci opraví zpět, ať to působí jako plnohodnotná záložka.
    setTimeout(function () {
      if (localStorage.getItem('dashActiveTab') === 'timeline') openTimelineTab();
    }, 150);
  });
})();
