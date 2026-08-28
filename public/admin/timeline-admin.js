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
  var tlPhotos = [];   // URL fotek aktuálně rozepsaného milníku (max 3)
  var camQueue = [];   // fronta souborů čekajících na úpravu (při výběru víc najednou z telefonu)

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
        '<div class="form-row">' +
        '<select id="tlLinkedArticle" class="form-select" style="flex:1">' +
        '<option value="">— Propojit s článkem (nepovinné) —</option>' +
        '</select>' +
        '</div>' +
        '<div class="form-row" style="align-items:flex-start;flex-wrap:wrap;gap:0.6rem">' +
        '<label style="min-width:110px;padding-top:6px">Fotky (max 3)</label>' +
        '<div style="flex:1;min-width:200px">' +
        '<div id="tlPhotosPreview" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"></div>' +
        '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">' +
        '<button type="button" id="tlAddGalleryBtn" class="btn btn-sm" onclick="pickTimelinePhoto()">🖼️ Z galerie webu</button>' +
        '<button type="button" id="tlAddLibraryBtn" class="btn btn-sm" onclick="pickTimelineFromLibrary()">📱 Z telefonu</button>' +
        '<button type="button" id="tlAddCameraBtn" class="btn btn-sm" onclick="captureTimelinePhoto()">📷 Vyfotit</button>' +
        '</div></div>' +
        '<input type="file" id="tlCameraInput" accept="image/*" capture="environment" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden" onchange="handleTimelineCameraCapture(this)">' +
        '<input type="file" id="tlLibraryInput" accept="image/*" multiple style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden" onchange="handleTimelineLibraryFiles(this)">' +
        '</div>' +
        '<div class="form-row" style="margin-top:1rem">' +
        '<button id="tlSubmitBtn" class="btn btn-blue" onclick="createTimelineMilestone()">Přidat milník</button>' +
        '</div>' +
        '</div>' +
        '<div id="timelineList" style="margin-top:1rem"></div>';
      main.appendChild(section);
      loadArticlesForLinking();
    }
  }

  /* === PROPOJENÍ S ČLÁNKEM ===
     Natáhne seznam článků jednou a naplní <select>, ať jde milník
     volitelně propojit s tím, o kterém píše víc. */
  var articlesForLinkingCache = null;
  async function loadArticlesForLinking() {
    var select = $('tlLinkedArticle');
    if (!select) return;
    try {
      var r = await fetch('/api/articles/list');
      if (!r.ok) return;
      var data = await r.json();
      var arr = Array.isArray(data) ? data : [];
      articlesForLinkingCache = arr.filter(function (a) { return a && a.published !== false; });
      articlesForLinkingCache.sort(function (a, b) {
        var da = a.date || a.created || '', db = b.date || b.created || '';
        return da < db ? 1 : da > db ? -1 : 0;
      });
      var options = '<option value="">— Propojit s článkem (nepovinné) —</option>' +
        articlesForLinkingCache.map(function (a) {
          return '<option value="' + a.id + '">' + escapeHtml(a.title || 'Bez názvu') + '</option>';
        }).join('');
      select.innerHTML = options;
    } catch (e) {
      console.error('Nepodařilo se natáhnout seznam článků pro propojení:', e);
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
    function timelineSortKey(m) {
      if (typeof m.order === 'number' && isFinite(m.order)) return m.order;
      var parsed = m.date ? Date.parse(m.date) : NaN;
      return isFinite(parsed) ? parsed : 0;
    }
    var sorted = arr.slice().sort(function (a, b) { return timelineSortKey(b) - timelineSortKey(a); });
    box.innerHTML = sorted.map(function (m) {
      var dateStr = '';
      try { dateStr = m.date ? new Date(m.date).toLocaleDateString('cs') : ''; } catch (e) {}
      var firstPhoto = (m.photos && m.photos.length) ? m.photos[0] : (m.photoUrl || '');
      var thumb = firstPhoto
        ? '<img src="' + firstPhoto + '" style="width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0;border:1px solid #263252">'
        : '';
      var excerpt = (m.text || '').replace(/<[^>]+>/g, '').substring(0, 140);
      return '<div class="card timeline-card-admin" data-id="' + m.id + '" style="margin-bottom:1rem;padding:1rem;background:#131a2c;border:1px solid #263252;border-radius:10px">' +
        '<div style="display:flex;gap:0.7rem;align-items:flex-start">' +
        '<span class="tl-drag-handle" title="Přetáhni pro změnu pořadí" style="cursor:grab;color:#64748b;font-size:20px;line-height:1;padding:4px 2px;user-select:none;touch-action:none;flex-shrink:0">⠿</span>' +
        thumb +
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
    initTimelineDragReorder(box);
  }

  function initTimelineDragReorder(box) {
    var draggingCard = null;

    box.querySelectorAll('.tl-drag-handle').forEach(function (handle) {
      handle.addEventListener('pointerdown', function (e) {
        var card = handle.closest('.timeline-card-admin');
        if (!card) return;
        e.preventDefault();
        draggingCard = card;
        card.style.opacity = '0.55';
        card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
        try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      });
    });

    box.addEventListener('pointermove', function (e) {
      if (!draggingCard) return;
      e.preventDefault();
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var targetCard = el ? el.closest('.timeline-card-admin') : null;
      if (targetCard && targetCard !== draggingCard && box.contains(targetCard)) {
        var rect = targetCard.getBoundingClientRect();
        var before = (e.clientY - rect.top) < rect.height / 2;
        box.insertBefore(draggingCard, before ? targetCard : targetCard.nextSibling);
      }
    });

    function endDrag() {
      if (!draggingCard) return;
      draggingCard.style.opacity = '';
      draggingCard.style.boxShadow = '';
      draggingCard = null;
      persistTimelineOrder(box);
    }
    box.addEventListener('pointerup', endDrag);
    box.addEventListener('pointercancel', endDrag);
  }

  async function persistTimelineOrder(box) {
    var cards = Array.prototype.slice.call(box.querySelectorAll('.timeline-card-admin'));
    var n = cards.length;
    var updates = [];
    cards.forEach(function (card, index) {
      var id = card.getAttribute('data-id');
      var newOrder = n - index;
      var m = timelineCache.find(function (x) { return String(x.id) === String(id); });
      if (m && m.order !== newOrder) {
        m.order = newOrder;
        updates.push({ id: id, order: newOrder });
      }
    });
    if (!updates.length) return;
    try {
      for (var i = 0; i < updates.length; i++) {
        await fetch('/api/timeline/update', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: updates[i].id, order: updates[i].order })
        });
      }
      if (typeof showToast === 'function') showToast('Pořadí uloženo', 'success');
    } catch (e) {
      console.error('Uložení pořadí selhalo:', e);
      if (typeof showToast === 'function') showToast('Pořadí se nepodařilo uložit', 'error');
    }
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
      photos: tlPhotos.slice(0, 3),
      linkedArticleId: $('tlLinkedArticle') ? ($('tlLinkedArticle').value || null) : null
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
    if ($('tlLinkedArticle')) $('tlLinkedArticle').value = m.linkedArticleId || '';
    tlPhotos = (m.photos && m.photos.length) ? m.photos.slice(0, 3) : (m.photoUrl ? [m.photoUrl] : []);
    renderTlPhotosPreview();
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
      photos: tlPhotos.slice(0, 3),
      linkedArticleId: $('tlLinkedArticle') ? ($('tlLinkedArticle').value || null) : null
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
    if ($('tlLinkedArticle')) $('tlLinkedArticle').value = '';
    tlPhotos = [];
    camQueue = [];
    renderTlPhotosPreview();
    var btn = $('tlSubmitBtn');
    if (btn) {
      btn.textContent = 'Přidat milník';
      btn.onclick = window.createTimelineMilestone;
    }
  };

  /* === SPRÁVA POLE FOTEK (max 3) === */
  function renderTlPhotosPreview() {
    var box = $('tlPhotosPreview');
    if (!box) return;
    box.innerHTML = tlPhotos.map(function (url, i) {
      return '<div style="position:relative;width:74px;height:74px;flex-shrink:0">' +
        '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;border:1px solid var(--border-soft)">' +
        '<button type="button" onclick="removeTlPhoto(' + i + ')" title="Odebrat" ' +
        'style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--red,#ef4444);color:#fff;border:none;cursor:pointer;font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center">✕</button>' +
        '</div>';
    }).join('');
    updateTlPhotoButtonsState();
  }

  function updateTlPhotoButtonsState() {
    var full = tlPhotos.length >= 3;
    ['tlAddGalleryBtn', 'tlAddLibraryBtn', 'tlAddCameraBtn'].forEach(function (id) {
      var b = $(id);
      if (b) b.disabled = full;
    });
  }

  window.removeTlPhoto = function (i) {
    tlPhotos.splice(i, 1);
    renderTlPhotosPreview();
  };

  /* === VÝBĚR Z GALERIE WEBU ===
     Používá sdílený picker openGalleryPickerModal() z dashboard-editor.js
     (musí se načíst PŘED tímhle souborem) — stejná zkušenost (složky +
     řazení) jako u vkládání fotek do článků a coverů sekcí/podsekcí,
     místo dřívější vlastní ploché (jen řazené podle data) kopie. */
  window.pickTimelinePhoto = function () {
    if (tlPhotos.length >= 3) {
      if (typeof showToast === 'function') showToast('Milník může mít max. 3 fotky.', 'info');
      return;
    }
    if (typeof openGalleryPickerModal !== 'function') {
      if (typeof showToast === 'function') showToast('Sdílený picker fotek (dashboard-editor.js) není načtený — zkontroluj pořadí <script> tagů.', 'error');
      return;
    }
    openGalleryPickerModal({
      title: 'Fotky k milníku',
      multiSelect: true,
      maxSelect: 3,
      selectedUrls: tlPhotos.slice(),
      onDone: function (urls) {
        tlPhotos = urls.slice(0, 3);
        renderTlPhotosPreview();
      }
    });
  };

  /* === VÝBĚR FOTEK PŘÍMO Z TELEFONU (mimo galerii webu) === */
  window.pickTimelineFromLibrary = function () {
    if (tlPhotos.length >= 3) {
      if (typeof showToast === 'function') showToast('Milník může mít max. 3 fotky.', 'info');
      return;
    }
    var input = $('tlLibraryInput');
    if (!input) return;
    input.value = '';
    input.click();
  };

  window.handleTimelineLibraryFiles = function (input) {
    var files = Array.prototype.slice.call(input.files || []);
    if (!files.length) return;
    var remaining = 3 - tlPhotos.length;
    if (remaining <= 0) {
      if (typeof showToast === 'function') showToast('Milník může mít max. 3 fotky.', 'info');
      return;
    }
    if (files.length > remaining && typeof showToast === 'function') {
      showToast('Vybráno víc fotek, než je volných míst — použije se jen prvních ' + remaining + '.', 'info');
    }
    camQueue = files.slice(0, remaining);
    processNextQueuedPhoto();
  };

  function processNextQueuedPhoto() {
    if (!camQueue.length) return;
    var file = camQueue.shift();
    openCameraPreviewModal(file);
  }

  window.captureTimelinePhoto = function () {
    var input = $('tlCameraInput');
    if (!input) return;
    input.value = '';
    input.click();
  };

  window.handleTimelineCameraCapture = function (input) {
    var file = input.files && input.files[0];
    if (!file) return;
    openCameraPreviewModal(file);
  };

  function openCameraPreviewModal(file) {
    var objectUrl = URL.createObjectURL(file);
    var m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML =
      '<div style="background:var(--surface);padding:1.5rem;border-radius:var(--r-lg);max-width:92vw;width:460px;max-height:92vh;overflow-y:auto;border:1px solid var(--border-soft)">' +
      '<h3 style="margin-bottom:1rem;color:var(--text)">📷 Nová fotka</h3>' +

      '<div id="camPreviewWrap" style="position:relative;display:inline-block;line-height:0;max-width:100%;background:#0a0f1c;border-radius:10px;overflow:hidden">' +
      '<img id="camPreviewImg" src="' + objectUrl + '" style="display:block;max-width:100%;max-height:46vh;filter:brightness(100%) saturate(100%)">' +
      '<div id="camCropRect" style="position:absolute;display:none;border:2px solid var(--gold,#ffc857);box-shadow:0 0 0 2000px rgba(0,0,0,0.45);cursor:move"><div id="camCropHandle" style="position:absolute;right:-7px;bottom:-7px;width:16px;height:16px;background:var(--gold,#ffc857);border-radius:50%;cursor:nwse-resize"></div></div>' +
      '</div>' +

      '<div style="margin-top:0.9rem">' +
      '<div style="font-size:11.5px;color:var(--text-faint);margin-bottom:4px">Otočení</div>' +
      '<div style="display:flex;gap:0.5rem">' +
      '<button type="button" class="btn btn-sm" onclick="rotateCamPreview(-90)">⟲ Otočit</button>' +
      '<button type="button" class="btn btn-sm" onclick="rotateCamPreview(90)">⟳ Otočit</button>' +
      '</div></div>' +

      '<div style="margin-top:0.9rem">' +
      '<div style="font-size:11.5px;color:var(--text-faint);margin-bottom:4px">Ořez</div>' +
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap">' +
      '<button type="button" class="btn btn-sm btn-blue" data-crop="none" onclick="setCamCropMode(\'none\')">Bez ořezu</button>' +
      '<button type="button" class="btn btn-sm" data-crop="free" onclick="setCamCropMode(\'free\')">Volný</button>' +
      '<button type="button" class="btn btn-sm" data-crop="1:1" onclick="setCamCropMode(\'1:1\')">1:1</button>' +
      '<button type="button" class="btn btn-sm" data-crop="4:3" onclick="setCamCropMode(\'4:3\')">4:3</button>' +
      '<button type="button" class="btn btn-sm" data-crop="3:4" onclick="setCamCropMode(\'3:4\')">3:4</button>' +
      '<button type="button" class="btn btn-sm" data-crop="16:9" onclick="setCamCropMode(\'16:9\')">16:9</button>' +
      '</div></div>' +

      '<div style="margin-top:0.9rem">' +
      '<label style="font-size:11.5px;color:var(--text-faint);display:flex;justify-content:space-between">Jas <span id="camExposureVal">0</span></label>' +
      '<input type="range" id="camExposureSlider" min="-60" max="60" value="0" style="width:100%" oninput="setCamAdjust(\'exposure\', this.value)">' +
      '</div>' +
      '<div style="margin-top:0.6rem">' +
      '<label style="font-size:11.5px;color:var(--text-faint);display:flex;justify-content:space-between">Sytost <span id="camSaturationVal">0</span></label>' +
      '<input type="range" id="camSaturationSlider" min="-100" max="100" value="0" style="width:100%" oninput="setCamAdjust(\'saturation\', this.value)">' +
      '</div>' +

      '<div style="display:flex;gap:0.75rem;margin-top:0.9rem">' +
      '<div style="flex:1">' +
      '<label style="font-size:11.5px;color:var(--text-faint);display:block;margin-bottom:4px">Kvalita</label>' +
      '<select id="camQualitySelect" class="form-select" style="width:100%">' +
      '<option value="0.6">Nízká (nejmenší soubor)</option>' +
      '<option value="0.75">Nižší</option>' +
      '<option value="0.85" selected>Střední</option>' +
      '<option value="0.95">Vysoká</option>' +
      '</select></div>' +
      '<div style="flex:1">' +
      '<label style="font-size:11.5px;color:var(--text-faint);display:block;margin-bottom:4px">Max. rozlišení</label>' +
      '<select id="camMaxResSelect" class="form-select" style="width:100%">' +
      '<option value="800">800 px</option>' +
      '<option value="1200">1200 px</option>' +
      '<option value="1600" selected>1600 px</option>' +
      '<option value="2000">2000 px</option>' +
      '<option value="0">Originál</option>' +
      '</select></div>' +
      '</div>' +

      '<p id="camSizeHint" style="font-size:11px;color:var(--text-faint);margin-top:0.6rem;text-align:center"></p>' +

      '<div style="display:flex;gap:0.5rem;justify-content:center;margin-top:1rem">' +
      '<button type="button" class="btn btn-blue" id="camConfirmBtn">✅ Použít fotku</button>' +
      '<button type="button" class="btn btn-red" id="camCancelBtn">Zrušit</button>' +
      '</div></div>';
    document.body.appendChild(m);

    m._file = file;
    m._objectUrl = objectUrl;
    m._exposure = 0;
    m._saturation = 0;
    m._cropMode = 'none';
    m._cropAspect = null;
    m._cropRect = null;
    window._camModal = m;

    var previewImg = $('camPreviewImg');
    previewImg.onload = function () { updateCamSizeHint(m); };

    $('camConfirmBtn').onclick = function () { confirmCameraPhoto(m); };
    $('camCancelBtn').onclick = function () { closeCameraPreviewModal(m); processNextQueuedPhoto(); };
    m.onclick = function (e) { if (e.target === m) { closeCameraPreviewModal(m); processNextQueuedPhoto(); } };
    $('camQualitySelect').onchange = function () { updateCamSizeHint(m); };
    $('camMaxResSelect').onchange = function () { updateCamSizeHint(m); };

    initCamCropDragging(m);
  }

  function closeCameraPreviewModal(m) {
    if (m._objectUrl) URL.revokeObjectURL(m._objectUrl);
    m.remove();
    if (window._camModal === m) window._camModal = null;
  }

  function updateCamSizeHint(m) {
    var hint = $('camSizeHint');
    var img = $('camPreviewImg');
    if (!hint || !img || !img.naturalWidth) return;
    hint.textContent = 'Počítám odhad velikosti…';

    var quality = parseFloat($('camQualitySelect').value) || 0.85;
    var maxRes = parseInt($('camMaxResSelect').value) || 0;
    var srcX = 0, srcY = 0, srcW = img.naturalWidth, srcH = img.naturalHeight;
    if (m._cropRect && img.clientWidth) {
      var scale = img.naturalWidth / img.clientWidth;
      srcX = Math.round(m._cropRect.x * scale);
      srcY = Math.round(m._cropRect.y * scale);
      srcW = Math.round(m._cropRect.w * scale);
      srcH = Math.round(m._cropRect.h * scale);
    }
    var dw = srcW, dh = srcH;
    if (maxRes && Math.max(dw, dh) > maxRes) {
      var s = maxRes / Math.max(dw, dh);
      dw = Math.round(dw * s); dh = Math.round(dh * s);
    }

    var canvas = document.createElement('canvas');
    canvas.width = dw; canvas.height = dh;
    var ctx = canvas.getContext('2d');
    ctx.filter = 'brightness(' + (100 + m._exposure) + '%) saturate(' + (100 + m._saturation) + '%)';
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, dw, dh);

    m._sizeHintToken = (m._sizeHintToken || 0) + 1;
    var myToken = m._sizeHintToken;
    canvas.toBlob(function (blob) {
      if (myToken !== m._sizeHintToken) return;
      if (!blob) { hint.textContent = dw + '×' + dh + ' px'; return; }
      hint.textContent = 'Výsledek přibližně ' + dw + '×' + dh + ' px · ~' + formatBytesApprox(blob.size);
    }, 'image/jpeg', quality);
  }

  function formatBytesApprox(bytes) {
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  window.rotateCamPreview = function (deg) {
    var m = window._camModal;
    if (!m) return;
    var img = $('camPreviewImg');
    if (!img || !img.naturalWidth) return;
    var w = img.naturalWidth, h = img.naturalHeight;
    var swapped = Math.abs(deg) === 90;
    var canvas = document.createElement('canvas');
    canvas.width = swapped ? h : w;
    canvas.height = swapped ? w : h;
    var ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(deg * Math.PI / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    if (m._objectUrl) URL.revokeObjectURL(m._objectUrl);
    m._objectUrl = null;
    img.src = canvas.toDataURL('image/jpeg', 0.95);
    m._cropRect = null;
    setCamCropMode('none');
    img.onload = function () { updateCamSizeHint(m); };
  };

  window.setCamAdjust = function (key, val) {
    var m = window._camModal;
    if (!m) return;
    m['_' + key] = parseInt(val);
    var label = $('cam' + key.charAt(0).toUpperCase() + key.slice(1) + 'Val');
    if (label) label.textContent = val;
    var img = $('camPreviewImg');
    if (img) img.style.filter = 'brightness(' + (100 + m._exposure) + '%) saturate(' + (100 + m._saturation) + '%)';
  };

  window.setCamCropMode = function (mode) {
    var m = window._camModal;
    if (!m) return;
    m._cropMode = mode;
    document.querySelectorAll('[data-crop]').forEach(function (b) {
      b.classList.toggle('btn-blue', b.dataset.crop === mode);
    });
    var rectEl = $('camCropRect');
    var img = $('camPreviewImg');
    if (mode === 'none') {
      m._cropRect = null;
      m._cropAspect = null;
      if (rectEl) rectEl.style.display = 'none';
      updateCamSizeHint(m);
      return;
    }
    m._cropAspect = mode === 'free' ? null :
      (mode === '1:1' ? 1 : mode === '4:3' ? 4 / 3 : mode === '3:4' ? 3 / 4 : 16 / 9);
    if (!img || !img.clientWidth) return;
    var W = img.clientWidth, H = img.clientHeight;
    var w = W * 0.8, h = m._cropAspect ? w / m._cropAspect : H * 0.8;
    if (h > H * 0.95) { h = H * 0.95; w = m._cropAspect ? h * m._cropAspect : w; }
    m._cropRect = { x: (W - w) / 2, y: (H - h) / 2, w: w, h: h };
    renderCamCropRect(m);
    if (rectEl) rectEl.style.display = 'block';
    updateCamSizeHint(m);
  };

  function renderCamCropRect(m) {
    var rectEl = $('camCropRect');
    if (!rectEl || !m._cropRect) return;
    var r = m._cropRect;
    rectEl.style.left = r.x + 'px';
    rectEl.style.top = r.y + 'px';
    rectEl.style.width = r.w + 'px';
    rectEl.style.height = r.h + 'px';
  }

  function initCamCropDragging(m) {
    var wrap = $('camPreviewWrap');
    var rectEl = $('camCropRect');
    var handle = $('camCropHandle');
    if (!wrap || !rectEl || !handle) return;
    var dragging = null;
    var startX = 0, startY = 0, startRect = null;

    function pointerDown(target, e) {
      var t = e.touches ? e.touches[0] : e;
      startX = t.clientX; startY = t.clientY;
      startRect = { x: m._cropRect.x, y: m._cropRect.y, w: m._cropRect.w, h: m._cropRect.h };
      dragging = target;
      e.preventDefault();
      e.stopPropagation();
    }
    rectEl.addEventListener('mousedown', function (e) { if (m._cropRect) pointerDown('move', e); });
    rectEl.addEventListener('touchstart', function (e) { if (m._cropRect) pointerDown('move', e); }, { passive: false });
    handle.addEventListener('mousedown', function (e) { if (m._cropRect) pointerDown('resize', e); });
    handle.addEventListener('touchstart', function (e) { if (m._cropRect) pointerDown('resize', e); }, { passive: false });

    function onMove(e) {
      if (!dragging || !m._cropRect) return;
      var t = e.touches ? e.touches[0] : e;
      var dx = t.clientX - startX, dy = t.clientY - startY;
      var img = $('camPreviewImg');
      var W = img.clientWidth, H = img.clientHeight;
      if (dragging === 'move') {
        var x = Math.max(0, Math.min(startRect.x + dx, W - startRect.w));
        var y = Math.max(0, Math.min(startRect.y + dy, H - startRect.h));
        m._cropRect.x = x; m._cropRect.y = y;
      } else {
        var w = Math.max(40, startRect.w + dx);
        var h = m._cropAspect ? w / m._cropAspect : Math.max(40, startRect.h + dy);
        w = Math.min(w, W - startRect.x);
        h = Math.min(h, H - startRect.y);
        if (m._cropAspect) { w = Math.min(w, h * m._cropAspect); h = w / m._cropAspect; }
        m._cropRect.w = w; m._cropRect.h = h;
      }
      renderCamCropRect(m);
      e.preventDefault();
    }
    function onUp() { dragging = null; if (window._camModal) updateCamSizeHint(window._camModal); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
  }

  async function confirmCameraPhoto(m) {
    var btn = $('camConfirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Zpracovávám…'; }
    try {
      var quality = parseFloat($('camQualitySelect').value) || 0.85;
      var maxRes = parseInt($('camMaxResSelect').value) || 0;
      var blob = await processCameraImage(m, quality, maxRes);
      var filename = 'timeline-' + Date.now() + '.jpg';
      var fd = new FormData();
      fd.append('file', blob, filename);
      fd.append('galleryId', 'timeline');
      var r = await fetch('/api/photos/upload', { method: 'POST', body: fd });
      if (!r.ok) throw new Error('Nahrání selhalo (HTTP ' + r.status + ')');

      var uploadedUrl = null;
      try {
        var respData = await r.clone().json();
        uploadedUrl = respData.url || respData.fileUrl || respData.publicUrl ||
          (respData.photo && respData.photo.url) || null;
      } catch (e) {}

      if (!uploadedUrl) {
        try {
          var listRes = await fetch('/api/photos/list?galleryId=timeline');
          if (listRes.ok) {
            var listData = await listRes.json();
            var arr = Array.isArray(listData) ? listData : (listData.photos || []);
            var found = arr.find(function (p) { return p.name === filename; });
            if (found) uploadedUrl = found.url;
          }
        } catch (e) { console.error('Fallback hledání nahrané fotky selhalo:', e); }
      }

      if (uploadedUrl) {
        if (tlPhotos.length < 3) tlPhotos.push(uploadedUrl);
        renderTlPhotosPreview();
        if (typeof showToast === 'function') showToast('Fotka přidána', 'success');
      } else if (typeof showToast === 'function') {
        showToast('Fotka se nahrála, ale nepodařilo se zjistit její adresu — napiš mi prosím, jak vypadá odpověď /api/photos/upload, ať to doladím.', 'info');
      }
      closeCameraPreviewModal(m);
      processNextQueuedPhoto();
    } catch (e) {
      console.error('Nahrání vyfocené fotky selhalo:', e);
      if (typeof showToast === 'function') showToast('Nepodařilo se zpracovat/nahrát fotku. Zkus to znovu.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '✅ Použít fotku'; }
    }
  }

  function processCameraImage(m, quality, maxRes) {
    return new Promise(function (resolve, reject) {
      var previewImg = $('camPreviewImg');
      var img = new Image();
      img.onload = function () {
        var srcX = 0, srcY = 0, srcW = img.naturalWidth, srcH = img.naturalHeight;
        if (m._cropRect && previewImg && previewImg.clientWidth) {
          var scale = img.naturalWidth / previewImg.clientWidth;
          srcX = Math.round(m._cropRect.x * scale);
          srcY = Math.round(m._cropRect.y * scale);
          srcW = Math.round(m._cropRect.w * scale);
          srcH = Math.round(m._cropRect.h * scale);
        }
        var dw = srcW, dh = srcH;
        if (maxRes && Math.max(dw, dh) > maxRes) {
          var s = maxRes / Math.max(dw, dh);
          dw = Math.round(dw * s); dh = Math.round(dh * s);
        }
        var canvas = document.createElement('canvas');
        canvas.width = dw; canvas.height = dh;
        var ctx = canvas.getContext('2d');
        ctx.filter = 'brightness(' + (100 + m._exposure) + '%) saturate(' + (100 + m._saturation) + '%)';
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, dw, dh);
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob); else reject(new Error('Canvas export selhal'));
        }, 'image/jpeg', quality);
      };
      img.onerror = function () { reject(new Error('Obrázek se nepodařilo načíst')); };
      img.src = previewImg.src;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectTimelineUI();
    setTimeout(function () {
      if (localStorage.getItem('dashActiveTab') === 'timeline') openTimelineTab();
    }, 150);
  });
})();
