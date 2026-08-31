/* =========================================================
   article-map-picker.js
   =========================================================
   Doplňuje formulář článku (dashboard-editor.js) o volitelné
   souřadnice místa — s klikací mapou pro jejich zadání. Po vyplnění
   se článek objeví na veřejné /mapa.html.

   DŮLEŽITÉ: tenhle soubor NIC needituje v dashboard-core.js ani
   dashboard-editor.js. Napojuje se na ně zvenku:

   1) Stejným trikem, jaký dashboard-core.js už používá pro
      Authorization hlavičku (patch window.fetch) — do těla POST na
      /api/articles/create a PUT na /api/articles/update se před
      odesláním domíchá lat/lng z políček v téhle vrstvě.
   2) "Obalí" (wrapne) stávající editArticle() a resetArticleForm()
      — nejdřív nechá proběhnout původní funkci beze změny, pak už jen
      navíc doplní/vyčistí souřadnice a marker na mapě.

   Načíst AŽ PO dashboard-core.js a dashboard-editor.js, např.:
     <script src="/admin/dashboard-core.js"></script>
     <script src="/admin/dashboard-editor.js"></script>
     <script src="/admin/article-map-picker.js"></script>
   ========================================================= */
(function () {
  function $(id) { return document.getElementById(id); }

  (function patchFetchWithLocationData() {
    const originalFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      try {
        const urlStr = typeof input === 'string' ? input : (input && input.url) || '';
        const method = ((init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET').toUpperCase();
        const isArticleWrite = /\/api\/articles\/(create|update)(\?|$)/.test(urlStr) && (method === 'POST' || method === 'PUT');
        if (isArticleWrite && init && typeof init.body === 'string') {
          const body = JSON.parse(init.body);
          const latEl = $('artLat'), lngEl = $('artLng');
          const lat = latEl ? parseFloat(latEl.value) : NaN;
          const lng = lngEl ? parseFloat(lngEl.value) : NaN;
          body.lat = Number.isFinite(lat) ? lat : null;
          body.lng = Number.isFinite(lng) ? lng : null;
          init = Object.assign({}, init, { body: JSON.stringify(body) });
        }
      } catch (e) {
        console.error('article-map-picker: fetch patch selhal, ukládám bez souřadnic', e);
      }
      return originalFetch(input, init);
    };
  })();

  let mapInstance = null;
  let marker = null;
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

  function setMarker(lat, lng, skipInputSync) {
    if (!mapInstance) return;
    if (marker) mapInstance.removeLayer(marker);
    marker = L.marker([lat, lng]).addTo(mapInstance);
    mapInstance.setView([lat, lng], Math.max(mapInstance.getZoom(), 6));
    if (!skipInputSync) {
      if ($('artLat')) $('artLat').value = lat.toFixed(5);
      if ($('artLng')) $('artLng').value = lng.toFixed(5);
    }
  }

  window.clearArticleLocation = function () {
    if ($('artLat')) $('artLat').value = '';
    if ($('artLng')) $('artLng').value = '';
    if (marker && mapInstance) { mapInstance.removeLayer(marker); marker = null; }
  };

  window.syncLocationMapFromInputs = function () {
    const lat = parseFloat($('artLat')?.value);
    const lng = parseFloat($('artLng')?.value);
    if (Number.isFinite(lat) && Number.isFinite(lng) && mapInstance) setMarker(lat, lng, true);
  };

  window.geocodeArticlePlace = async function () {
    const placeVal = $('artPlace')?.value.trim();
    const btn = $('artGeocodeBtn');
    if (!placeVal) {
      if (typeof showToast === 'function') showToast('Nejdřív vyplň pole "Místo".', 'info');
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Hledám…'; }
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(placeVal);
      const r = await fetch(url, { headers: { 'Accept-Language': 'cs' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (!data || !data.length) {
        if (typeof showToast === 'function') showToast('Místo "' + placeVal + '" se nepodařilo najít — zkus přesnější název, nebo klikni do mapy ručně.', 'info');
        return;
      }
      const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
      if (!mapInstance) await initMap();
      setMarker(lat, lng);
      if (typeof showToast === 'function') showToast('Nalezeno: ' + (data[0].display_name || placeVal), 'success');
    } catch (e) {
      console.error('Geokódování selhalo:', e);
      if (typeof showToast === 'function') showToast('Hledání se nezdařilo — zkus to znovu nebo zadej souřadnice ručně.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔍 Najít podle názvu'; }
    }
  };

  /* ★ ZMĚNA (srpen 2026): CARTO dlaždice (basemaps.cartocdn.com) nedávno
     přešly na povinný API klíč a bez něj ukazují jen text
     "API KEY REQUIRED" přes celou mapu — netýkalo se to jen tohohle
     souboru, stejný problém byl i ve travel-map-core.js (veřejný web).
     Nahrazeno Esri Canvas dlaždicemi (bezplatné, bez registrace). Tmavá
     varianta (World_Dark_Gray_Base) vizuálně odpovídá původnímu
     tmavému stylu dark_all, co se tu používal. */
  async function initMap() {
    try { await loadLeaflet(); } catch (e) { console.error(e); return; }
    const el = $('artLocationMap');
    if (!el || mapInstance) return;
    mapInstance = L.map(el).setView([49.8, 15.5], 6); // výchozí pohled: ČR
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
      maxZoom: 16
    }).addTo(mapInstance);
    mapInstance.on('click', function (e) { setMarker(e.latlng.lat, e.latlng.lng); });

    const lat = parseFloat($('artLat')?.value);
    const lng = parseFloat($('artLng')?.value);
    if (Number.isFinite(lat) && Number.isFinite(lng)) setMarker(lat, lng, true);
  }

  function injectUI() {
    if ($('artLocationMap')) return;
    const placeEl = $('artPlace');
    if (!placeEl) return;
    const row = placeEl.closest('.form-row') || placeEl.parentElement;
    if (!row || !row.parentElement) return;
    const wrap = document.createElement('div');
    wrap.className = 'form-row';
    wrap.id = 'artLocationRow';
    wrap.style.cssText = 'display:block;width:100%;margin:0.6rem 0 1rem';
    wrap.innerHTML =
      '<label style="display:block;margin-bottom:6px">📍 Poloha na mapě <span style="font-weight:400;color:var(--text-faint)">(nepovinné — vyplň, ať se článek objeví na Mapě cest)</span></label>' +
      '<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;max-width:520px">' +
      '<button type="button" id="artGeocodeBtn" class="btn btn-sm" onclick="geocodeArticlePlace()" title="Zkusí najít souřadnice podle textu v poli Místo výše">🔍 Najít podle názvu</button>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:8px;max-width:420px">' +
      '<input type="number" id="artLat" class="form-input" placeholder="Šířka (lat)" step="any" style="flex:1;min-width:0" oninput="syncLocationMapFromInputs()">' +
      '<input type="number" id="artLng" class="form-input" placeholder="Délka (lng)" step="any" style="flex:1;min-width:0" oninput="syncLocationMapFromInputs()">' +
      '<button type="button" class="btn btn-sm" onclick="clearArticleLocation()" title="Smazat polohu" style="flex:0 0 auto">✕</button>' +
      '</div>' +
      '<div id="artLocationMap" style="display:block;width:100%;height:300px;border-radius:10px;overflow:hidden;border:1px solid var(--border-soft,#263252)"></div>';
    row.after(wrap);
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
          if (Number.isFinite(a.lat) && Number.isFinite(a.lng)) {
            if ($('artLat')) $('artLat').value = a.lat;
            if ($('artLng')) $('artLng').value = a.lng;
            if (mapInstance) setMarker(a.lat, a.lng, true);
            else await initMap();
          } else {
            window.clearArticleLocation();
          }
        }
      } catch (e) {
        console.error('article-map-picker: nepodařilo se dotáhnout souřadnice článku', e);
      }
      return result;
    };
  }

  if (typeof window.resetArticleForm === 'function') {
    const originalResetArticleForm = window.resetArticleForm;
    window.resetArticleForm = function () {
      const result = originalResetArticleForm.apply(this, arguments);
      window.clearArticleLocation();
      return result;
    };
  }

  if (typeof window.showTab === 'function') {
    const originalShowTab = window.showTab;
    window.showTab = function (name) {
      const result = originalShowTab.apply(this, arguments);
      if (name === 'articles') {
        injectUI();
        requestAnimationFrame(function () {
          if (!mapInstance) initMap();
          else mapInstance.invalidateSize();
        });
      }
      return result;
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectUI();
    setTimeout(injectUI, 500);
    setTimeout(injectUI, 1500);
  });
})();
