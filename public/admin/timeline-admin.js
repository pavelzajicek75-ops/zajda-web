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
        '<button type="button" class="btn btn-sm" onclick="captureTimelinePhoto()">📷 Vyfotit</button>' +
        '<button type="button" class="btn btn-sm" onclick="clearTimelinePhoto()">✖ Zrušit</button>' +
        '<input type="hidden" id="tlPhotoUrl" value="">' +
        '<input type="file" id="tlCameraInput" accept="image/*" capture="environment" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden" onchange="handleTimelineCameraCapture(this)">' +
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
    // Nejnovější nahoře — hledáš typicky čerstvě nahranou fotku, ne
    // něco z galerie starého data.
    var sortedPhotos = G.photos.slice().sort(function (a, b) {
      var da = a.uploaded || a.date || 0, db = b.uploaded || b.date || 0;
      return new Date(db) - new Date(da);
    });
    var m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = '<div style="background:var(--surface);padding:1.5rem;border-radius:var(--r-lg);max-width:90vw;max-height:80vh;overflow:auto;border:1px solid var(--border-soft)">' +
      '<h3 style="margin-bottom:1rem;color:var(--text)">Fotka k milníku</h3>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.5rem">' +
      sortedPhotos.map(function (p) {
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

  /* === VYFOTIT PŘÍMO Z TELEFONU (mimo galerii) ===
     input[type=file][capture=environment] otevře na mobilu rovnou
     fotoaparát (na desktopu klasický výběr souboru — capture se tam
     prostě ignoruje, žádná újma). Po vyfocení se ukáže náhled s možností
     otočit (na výšku/na šířku se to z fotoaparátu občas plete) — to je
     ta "drobná úprava" — a teprve po potvrzení se fotka zmenší na
     rozumné rozlišení (max. 1600 px) a nahraje do galerie přes stejný
     /api/photos/upload endpoint, co používá běžné nahrávání. */
  window.captureTimelinePhoto = function () {
    var input = $('tlCameraInput');
    if (!input) return;
    input.value = ''; // reset, ať jde vyfotit i stejnou scénu podruhé
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
    m._cropAspect = null; // null = volný poměr, jinak číslo (w/h)
    m._cropRect = null;   // { x, y, w, h } v ZOBRAZENÝCH pixelech (relativně k <img>)
    window._camModal = m;

    var previewImg = $('camPreviewImg');
    previewImg.onload = function () { updateCamSizeHint(m); };

    $('camConfirmBtn').onclick = function () { confirmCameraPhoto(m); };
    $('camCancelBtn').onclick = function () { closeCameraPreviewModal(m); };
    m.onclick = function (e) { if (e.target === m) closeCameraPreviewModal(m); };
    $('camQualitySelect').onchange = function () { updateCamSizeHint(m); };
    $('camMaxResSelect').onchange = function () { updateCamSizeHint(m); };

    initCamCropDragging(m);
  }

  function closeCameraPreviewModal(m) {
    if (m._objectUrl) URL.revokeObjectURL(m._objectUrl);
    m.remove();
    if (window._camModal === m) window._camModal = null;
  }

  // ★ ZMĚNA: dřív jen odhad ROZMĚRŮ (px) — teď se obrázek se zvolenou
  // kvalitou/rozlišením/ořezem skutečně vyrenderuje do canvasu a přečte
  // se REÁLNÁ velikost výsledného souboru (ne odhad), přesně to, co je
  // vidět při výběru kvality nejužitečnější. Volá se při změně kvality,
  // rozlišení, nebo po dokončení ořezu (viz initCamCropDragging/
  // setCamCropMode níž) — ne při tažení posuvníků jasu/sytosti, ty
  // velikost souboru ovlivňují jen zanedbatelně a přepočet by zbytečně
  // zatěžoval prohlížeč při každém tiku posuvníku.
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

    // Token proti "race condition" — když uživatel rychle překlikává
    // kvalitu/rozlišení, ať se nezobrazí zastaralý výsledek pomalejšího
    // předchozího výpočtu PO tom novějším.
    m._sizeHintToken = (m._sizeHintToken || 0) + 1;
    var myToken = m._sizeHintToken;
    canvas.toBlob(function (blob) {
      if (myToken !== m._sizeHintToken) return; // zastaralé, zahodit
      if (!blob) { hint.textContent = dw + '×' + dh + ' px'; return; }
      hint.textContent = 'Výsledek přibližně ' + dw + '×' + dh + ' px · ~' + formatBytesApprox(blob.size);
    }, 'image/jpeg', quality);
  }

  function formatBytesApprox(bytes) {
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /* === OTOČENÍ — "zapeče" se rovnou do náhledu (nový <img> src z canvasu),
     ať se nemusí řešit rotace při výpočtu ořezu později. Ořez se proto
     po otočení resetuje (rozměry/orientace se změnily). === */
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

  /* === OŘEZ === */
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
    var dragging = null; // 'move' | 'resize'
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
      // "timeline" je samostatný prostor odděleně od hlavní galerie —
      // fotky z fotoaparátu se v záložce Galerie neukazují, jsou jen
      // pro milníky.
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
        window.setTimelinePhoto(uploadedUrl);
        if (typeof showToast === 'function') showToast('Fotka přidána', 'success');
      } else if (typeof showToast === 'function') {
        showToast('Fotka se nahrála, ale nepodařilo se zjistit její adresu — napiš mi prosím, jak vypadá odpověď /api/photos/upload, ať to doladím.', 'info');
      }
      closeCameraPreviewModal(m);
    } catch (e) {
      console.error('Nahrání vyfocené fotky selhalo:', e);
      if (typeof showToast === 'function') showToast('Nepodařilo se zpracovat/nahrát fotku. Zkus to znovu.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '✅ Použít fotku'; }
    }
  }

  // Aplikuje ořez (pokud je nastavený), jas/sytost (přes canvas filter —
  // podporováno ve všech moderních prohlížečích) a zmenšení na zvolené
  // maximální rozlišení. Vrací JPEG blob v ZVOLENÉ kvalitě.
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
      // Bere se z AKTUÁLNÍHO src náhledu (po případném otočení už jde
      // o "zapečenou" verzi, viz rotateCamPreview) — ne z původního souboru.
      img.src = previewImg.src;
    });
  }

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
