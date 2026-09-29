/* =========================================================
   article-map-picker.js
   =========================================================
   Doplňuje formulář článku (dashboard-editor.js) o volitelnou
   TRASU — jednu nebo víc zastávek s klikací mapou pro jejich zadání.
   1 zastávka = článek je na mapě "bod" (jako dřív). 2 a víc zastávek
   = "cesta" (čára mezi nimi). Když článek patří do podsekce, kde už
   je starší článek s trasou, první zastávka se předvyplní poslední
   zastávkou toho předchozího článku — ať na sebe cesty v rámci
   podsekce chronologicky navazují (lze ručně přepsat).

   DŮLEŽITÉ: tenhle soubor NIC needituje v dashboard-core.js ani
   dashboard-editor.js. Napojuje se na ně zvenku:

   1) Stejným trikem, jaký dashboard-core.js už používá pro
      Authorization hlavičku (patch window.fetch) — do těla POST na
      /api/articles/create a PUT na /api/articles/update se před
      odesláním domíchá pole "stops" (a pro zpětnou kompatibilitu i
      staré lat/lng = první zastávka).
   2) "Obalí" (wrapne) stávající editArticle(), resetArticleForm()
      a showTab() — nejdřív nechá proběhnout původní funkci beze
      změny, pak už jen navíc doplní/vyčistí trasu a mapu.
   3) Na select #artSubsection si navěsí VLASTNÍ posluchač (žádný tam
      dřív nebyl), který — jen u NOVÉHO článku, nikdy při editaci
      existujícího — zkusí předvyplnit start trasy.

   Načíst AŽ PO dashboard-core.js a dashboard-editor.js, např.:
     <script src="/admin/dashboard-core.js"></script>
     <script src="/admin/dashboard-editor.js"></script>
     <script src="/admin/article-map-picker.js"></script>
   ========================================================= */
(function () {
  function $(id) { return document.getElementById(id); }
  function emptyStop() { return { place: '', lat: null, lng: null }; }

  /* stops[i] = { place, lat, lng }. Vždy aspoň jeden řádek (i prázdný),
     ať je UI o co zachytit. Do KV se posílá jen to, co má platné
     souřadnice — viz patchFetchWithLocationData. */
  let stops = [emptyStop()];
  let activeStopIndex = 0;

  (function patchFetchWithLocationData() {
    const originalFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      try {
        const urlStr = typeof input === 'string' ? input : (input && input.url) || '';
        const method = ((init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET').toUpperCase();
        const isArticleWrite = /\/api\/articles\/(create|update)(\?|$)/.test(urlStr) && (method === 'POST' || method === 'PUT');
        if (isArticleWrite && init && typeof init.body === 'string') {
          const body = JSON.parse(init.body);
          const valid = stops.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
          body.stops = valid.length >= 2 ? valid : [];
          if (valid.length) {
            // Zpětná kompatibilita: staré lat/lng = první zastávka trasy
            // (nebo prostě ten jediný bod, když zastávka je jen jedna).
            body.lat = valid[0].lat;
            body.lng = valid[0].lng;
            if (!body.place && valid[0].place) body.place = valid[0].place;
          } else {
            body.lat = null;
            body.lng = null;
          }
          init = Object.assign({}, init, { body: JSON.stringify(body) });
        }
      } catch (e) {
        console.error('article-map-picker: fetch patch selhal, ukládám bez polohy', e);
      }
      return originalFetch(input, init);
    };
  })();

  let mapInstance = null;
  let markers = [];
  let routeLine = null;
  let leafletPromise = null;

  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Leaflet se nepodařilo načíst'));
      document.head.appendChild(script);
    });
    return leafletPromise;
  }

  function numberedPinIcon(n, isActive) {
    // Admin nenačítá shared.css, proto je vzhled i mini-animace přímo tady inline.
    const bg = isActive ? '#2fe6c9' : '#ff7a45';
    const svg = '<svg viewBox="0 0 40 40" style="width:100%;height:100%;overflow:visible">' +
      '<style>@keyframes abp-drop{0%{transform:translateY(-18px);opacity:0}60%{transform:translateY(2px);opacity:1}100%{transform:translateY(0)}}</style>' +
      '<g style="animation:abp-drop .4s cubic-bezier(.34,1.56,.64,1)">' +
      '<ellipse cx="20" cy="34" rx="9" ry="3" fill="rgba(0,0,0,0.35)"/>' +
      '<circle cx="20" cy="18" r="15" fill="' + bg + '" stroke="#1a1030" stroke-width="2.5"/>' +
      '<text x="20" y="23" font-size="15" font-weight="800" text-anchor="middle" fill="#1a1030">' + n + '</text>' +
      '</g></svg>';
    return L.divIcon({ className: '', html: svg, iconSize: [34, 34], iconAnchor: [17, 29] });
  }

  async function initMap() {
    try { await loadLeaflet(); } catch (e) { console.error(e); return; }
    const el = $('artLocationMap');
    if (!el || mapInstance) return;
    mapInstance = L.map(el).setView([49.8, 15.5], 6); // výchozí pohled: ČR
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
      maxZoom: 16
    }).addTo(mapInstance);
    mapInstance.on('click', function (e) {
      setActiveStopLatLng(e.latlng.lat, e.latlng.lng);
    });
    renderStopsOnMap();
  }

  function renderStopsOnMap() {
    if (!mapInstance) return;
    markers.forEach(m => mapInstance.removeLayer(m));
    markers = [];
    if (routeLine) { mapInstance.removeLayer(routeLine); routeLine = null; }
    const valid = stops.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    stops.forEach((s, i) => {
      if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return;
      const m = L.marker([s.lat, s.lng], { icon: numberedPinIcon(stops.indexOf(s) + 1, i === activeStopIndex) }).addTo(mapInstance);
      markers.push(m);
    });
    if (valid.length >= 2) {
      routeLine = L.polyline(valid.map(s => [s.lat, s.lng]), { color: '#ff7a45', weight: 3, dashArray: '7 7' }).addTo(mapInstance);
    }
    if (valid.length) {
      const bounds = L.latLngBounds(valid.map(s => [s.lat, s.lng]));
      if (valid.length === 1) mapInstance.setView(bounds.getCenter(), Math.max(mapInstance.getZoom(), 6));
      else mapInstance.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  function setActiveStopLatLng(lat, lng) {
    if (!stops[activeStopIndex]) stops[activeStopIndex] = emptyStop();
    stops[activeStopIndex].lat = lat;
    stops[activeStopIndex].lng = lng;
    renderStopRows();
    renderStopsOnMap();
  }

  window.addArticleStop = function () {
    stops.push(emptyStop());
    activeStopIndex = stops.length - 1;
    renderStopRows();
  };

  window.removeArticleStop = function (i) {
    stops.splice(i, 1);
    if (!stops.length) stops.push(emptyStop());
    activeStopIndex = Math.min(activeStopIndex, stops.length - 1);
    renderStopRows();
    renderStopsOnMap();
  };

  window.focusArticleStop = function (i) {
    activeStopIndex = i;
    renderStopRows();
    renderStopsOnMap();
  };

  window.updateArticleStopPlace = function (i, value) {
    if (stops[i]) stops[i].place = value;
  };

  window.geocodeArticleStop = async function (i) {
    activeStopIndex = i;
    const placeVal = (stops[i] && stops[i].place || '').trim();
    const btn = $('artStopGeocodeBtn' + i);
    if (!placeVal) {
      if (typeof showToast === 'function') showToast('Nejdřív napiš název místa.', 'info');
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(placeVal);
      const r = await fetch(url, { headers: { 'Accept-Language': 'cs' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (!data || !data.length) {
        if (typeof showToast === 'function') showToast('Místo "' + placeVal + '" se nepodařilo najít — zkus přesnější název, nebo klikni do mapy ručně.', 'info');
        return;
      }
      stops[i].lat = parseFloat(data[0].lat);
      stops[i].lng = parseFloat(data[0].lon);
      if (!mapInstance) await initMap(); else renderStopsOnMap();
      renderStopRows();
      if (typeof showToast === 'function') showToast('Nalezeno: ' + (data[0].display_name || placeVal), 'success');
    } catch (e) {
      console.error('Geokódování selhalo:', e);
      if (typeof showToast === 'function') showToast('Hledání se nezdařilo — zkus to znovu nebo klikni do mapy ručně.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔍'; }
    }
  };

  window.clearArticleLocation = function () {
    stops = [emptyStop()];
    activeStopIndex = 0;
    renderStopRows();
    renderStopsOnMap();
  };

  function renderStopRows() {
    const box = $('artStopsRows');
    if (!box) return;
    box.innerHTML = stops.map((s, i) => {
      const coordText = Number.isFinite(s.lat) && Number.isFinite(s.lng)
        ? s.lat.toFixed(4) + ', ' + s.lng.toFixed(4)
        : '— zatím bez souřadnic —';
      const activeStyle = i === activeStopIndex ? 'border-color:var(--nova,#2fe6c9)' : '';
      return '' +
        '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;padding:4px 6px;border:1px solid var(--border-soft,#263252);border-radius:8px;' + activeStyle + '">' +
        '<span style="flex:0 0 auto;font-weight:700;color:var(--text-faint);width:1.4em">' + (i + 1) + '.</span>' +
        '<input type="text" value="' + (s.place || '').replace(/"/g, '&quot;') + '" placeholder="Název místa (' + (i === 0 ? 'start' : 'zastávka') + ')" ' +
        'class="form-input" style="flex:1;min-width:0" ' +
        'onfocus="focusArticleStop(' + i + ')" ' +
        'oninput="updateArticleStopPlace(' + i + ', this.value)" ' +
        'onkeydown="if(event.key===\'Enter\'){event.preventDefault();geocodeArticleStop(' + i + ');}">' +
        '<button type="button" id="artStopGeocodeBtn' + i + '" class="btn btn-sm" onclick="geocodeArticleStop(' + i + ')" title="Najít podle názvu" style="flex:0 0 auto">🔍</button>' +
        '<span style="flex:0 0 auto;font-size:11px;color:var(--text-faint);white-space:nowrap;min-width:110px">' + coordText + '</span>' +
        (stops.length > 1 ? '<button type="button" class="btn btn-sm" onclick="removeArticleStop(' + i + ')" title="Odebrat zastávku" style="flex:0 0 auto">✕</button>' : '') +
        '</div>';
    }).join('') +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">' +
      '<button type="button" class="btn btn-sm" onclick="addArticleStop()">➕ Přidat zastávku</button>' +
      '<span style="font-size:11px;color:var(--text-faint)">' + (stops.filter(s => Number.isFinite(s.lat)).length >= 2 ? '🛣️ cesta (' + stops.filter(s => Number.isFinite(s.lat)).length + ' zastávek)' : '📍 bod') + '</span>' +
      '</div>';
  }

  function injectUI() {
    if ($('artLocationMap')) { renderStopRows(); return; }
    const placeEl = $('artPlace');
    if (!placeEl) return;
    const row = placeEl.closest('.form-row') || placeEl.parentElement;
    if (!row || !row.parentElement) return;
    const wrap = document.createElement('details');
    wrap.className = 'form-row editor-panel';
    wrap.id = 'artLocationRow';
    wrap.style.cssText = 'display:block;width:100%;margin:0.6rem 0 1rem';
    wrap.innerHTML =
      '<summary id="artLocationSummary">🛣️ Trasa na mapě <span id="artLocationSummaryHint" style="font-weight:400;color:var(--text-faint);margin-left:0.4em">(nepovinné — 1 zastávka = bod, 2+ = cesta)</span></summary>' +
      '<div class="editor-panel-body">' +
      '<div id="artStopsRows" style="max-width:640px;margin-bottom:8px"></div>' +
      '<div id="artLocationMap" style="display:block;width:100%;height:300px;border-radius:10px;overflow:hidden;border:1px solid var(--border-soft,#263252)"></div>' +
      '<p style="font-size:11px;color:var(--text-faint);margin:6px 0 0">Klik do mapy nastaví souřadnice zastávce, na kterou ses naposledy zaměřil (klikni na její řádek, nebo do jejího políčka).</p>' +
      '</div>';
    row.after(wrap);
    renderStopRows();

    wrap.addEventListener('toggle', function () {
      if (wrap.open) {
        requestAnimationFrame(function () {
          if (!mapInstance) initMap();
          else mapInstance.invalidateSize();
        });
      }
    });
  }

  /* === Předvyplnění startu trasy koncem poslední cesty ve stejné
     podsekci — jen u NOVÉHO článku (žádné editId), jen když trasa
     zatím je prázdná (ať nepřepíšeme něco rozepsaného). === */
  async function prefillFromLastArticleInSubsection(subsectionId) {
    if (!subsectionId) return;
    const pristine = stops.length === 1 && !stops[0].place && !Number.isFinite(stops[0].lat);
    if (!pristine) return;

    let all = window._articlesCache;
    if (!all || !all.length) {
      try {
        const r = await fetch('/api/articles/list');
        all = r.ok ? await r.json() : [];
      } catch (e) { all = []; }
    }
    const inSub = (all || [])
      .filter(a => a.subsectionId === subsectionId)
      .sort((a, b) => new Date(b.date || b.created || 0) - new Date(a.date || a.created || 0));
    if (!inSub.length) return;

    const last = inSub[0];
    let point = null;
    if (Array.isArray(last.stops) && last.stops.length) point = last.stops[last.stops.length - 1];
    else if (Number.isFinite(last.lat) && Number.isFinite(last.lng)) point = { place: last.place, lat: last.lat, lng: last.lng };
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;

    stops = [{ place: point.place || '', lat: point.lat, lng: point.lng }];
    activeStopIndex = 0;
    injectUI();
    const panel = $('artLocationRow');
    if (panel && !panel.open) panel.open = true;
    renderStopRows();
    if (!mapInstance) await initMap(); else renderStopsOnMap();
    if (typeof showToast === 'function') {
      showToast('Start předvyplněn koncem předchozí cesty v týhle podsekci ("' + (last.title || '') + '") — klidně přepiš.', 'info');
    }
  }

  if (typeof window.editArticle === 'function') {
    const originalEditArticle = window.editArticle;
    window.editArticle = async function (id) {
      const result = await originalEditArticle(id);
      try {
        const r = await fetch('/api/articles/get?id=' + encodeURIComponent(id));
        if (r.ok) {
          const a = await r.json();
          injectUI();
          if (Array.isArray(a.stops) && a.stops.length >= 2) {
            stops = a.stops.map(s => ({ place: s.place || '', lat: s.lat, lng: s.lng }));
          } else if (Number.isFinite(a.lat) && Number.isFinite(a.lng)) {
            stops = [{ place: a.place || '', lat: a.lat, lng: a.lng }];
          } else {
            stops = [emptyStop()];
          }
          activeStopIndex = 0;
          const hasLocation = stops.some(s => Number.isFinite(s.lat));
          const panel = $('artLocationRow');
          if (hasLocation && panel && !panel.open) panel.open = true;
          renderStopRows();
          if (mapInstance) renderStopsOnMap();
          else if (hasLocation) await initMap();
        }
      } catch (e) {
        console.error('article-map-picker: nepodařilo se dotáhnout trasu článku', e);
      }
      return result;
    };
  }

  if (typeof window.resetArticleForm === 'function') {
    const originalResetArticleForm = window.resetArticleForm;
    window.resetArticleForm = function () {
      const result = originalResetArticleForm.apply(this, arguments);
      window.clearArticleLocation();
      const panel = $('artLocationRow');
      if (panel) panel.open = false; // nový/vyresetovaný formulář vždy začíná sbalený
      return result;
    };
  }

  if (typeof window.showTab === 'function') {
    const originalShowTab = window.showTab;
    window.showTab = function (name) {
      const result = originalShowTab.apply(this, arguments);
      if (name === 'articles') {
        injectUI();
        const panel = $('artLocationRow');
        if (panel && panel.open && mapInstance) {
          requestAnimationFrame(function () { mapInstance.invalidateSize(); });
        }
      }
      return result;
    };
  }

  function hookSubsectionAutoPrefill() {
    const sel = $('artSubsection');
    if (!sel || sel.dataset.stopsHooked) return;
    sel.dataset.stopsHooked = '1';
    sel.addEventListener('change', function () {
      const editing = !!$('artEditor')?.dataset?.editId;
      if (editing) return; // u existujícího článku se start nepředvyplňuje
      prefillFromLastArticleInSubsection(sel.value);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectUI();
    hookSubsectionAutoPrefill();
    setTimeout(function () { injectUI(); hookSubsectionAutoPrefill(); }, 500);
    setTimeout(function () { injectUI(); hookSubsectionAutoPrefill(); }, 1500);
  });
})();
