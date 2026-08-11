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

  /* === 1) PATCH FETCH: domíchá lat/lng do těla create/update požadavků ===
     Obalený originalFetch je v okamžiku načtení tohoto souboru už
     variantou patchnutou dashboard-core.js (kvůli Bearer tokenu) —
     voláním přes něj se tedy zachová i přihlašovací hlavička, jen se
     navíc doplní souřadnice do těla požadavku. */
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

  /* === 2) UI: pole + klikací mapa ve formuláři článku === */
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

  // Globální (volané i z inline onclick/oninput atributů v injektovaném HTML)
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

  async function initMap() {
    try { await loadLeaflet(); } catch (e) { console.error(e); return; }
    const el = $('artLocationMap');
    if (!el || mapInstance) return;
    mapInstance = L.map(el).setView([49.8, 15.5], 6); // výchozí pohled: ČR
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 19
    }).addTo(mapInstance);
    mapInstance.on('click', function (e) { setMarker(e.latlng.lat, e.latlng.lng); });

    const lat = parseFloat($('artLat')?.value);
    const lng = parseFloat($('artLng')?.value);
    if (Number.isFinite(lat) && Number.isFinite(lng)) setMarker(lat, lng, true);
  }

  function injectUI() {
    if ($('artLocationMap')) return; // už vloženo (idempotentní)
    const placeEl = $('artPlace');
    if (!placeEl) return; // formulář zatím není v DOM, zkusí se to znovu (viz níž)
    const row = placeEl.closest('.form-row') || placeEl.parentElement;
    if (!row || !row.parentElement) return;
    const wrap = document.createElement('div');
    wrap.className = 'form-row';
    wrap.id = 'artLocationRow';
    // ★ ZMĚNA: .form-row v CSS administrace dělá display:flex na PŘÍMÝCH
    // potomcích — proto se popisek, řádek s čísly a mapa naskládaly vedle
    // sebe do jednoho řádku (na desktopu), zatímco na mobilu to zachránil
    // nějaký media query. Inline styl display:block tohle přebije a vynutí
    // sloupcové řazení vždy, nezávisle na šířce obrazovky — přesně to,
    // jak už to vypadalo na mobilu.
    wrap.style.cssText = 'display:block;width:100%;margin:0.6rem 0 1rem';
    wrap.innerHTML =
      '<label style="display:block;margin-bottom:6px">📍 Poloha na mapě <span style="font-weight:400;color:var(--text-faint)">(nepovinné — vyplň, ať se článek objeví na Mapě cest)</span></label>' +
      '<div style="display:flex;gap:8px;margin-bottom:8px;max-width:420px">' +
      '<input type="number" id="artLat" class="form-input" placeholder="Šířka (lat)" step="any" style="flex:1;min-width:0" oninput="syncLocationMapFromInputs()">' +
      '<input type="number" id="artLng" class="form-input" placeholder="Délka (lng)" step="any" style="flex:1;min-width:0" oninput="syncLocationMapFromInputs()">' +
      '<button type="button" class="btn btn-sm" onclick="clearArticleLocation()" title="Smazat polohu" style="flex:0 0 auto">✕</button>' +
      '</div>' +
      '<div id="artLocationMap" style="display:block;width:100%;height:300px;border-radius:10px;overflow:hidden;border:1px solid var(--border-soft,#263252)"></div>';
    row.after(wrap);
    // ★ initMap() se odsud ZÁMĚRNĚ nevolá — v okamžiku, kdy tohle běží
    // (DOMContentLoaded), je výchozí aktivní záložka "Galerie", takže
    // panel Články má display:none. Leaflet inicializovaný do skrytého
    // (0×0) kontejneru zůstane navždy prázdný/rozbitý, i po pozdějším
    // zviditelnění. Mapa se proto vytváří lazy, až při reálném otevření
    // záložky Články — viz wrap kolem showTab() níže.
  }

  /* === 3) Předvyplnění při editaci existujícího článku ===
     editArticle() v dashboard-editor.js o lat/lng neví (a neupravujeme
     ho) — proto se článek při editaci dotáhne ZNOVA, samostatně, jen
     kvůli souřadnicím. Jeden fetch navíc je přijatelná cena za to, že
     se vůbec nemusí sahat do původní (dlouhé) funkce. */
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

  /* === 4) Vyčištění při resetu formuláře (nový článek / po uložení) === */
  if (typeof window.resetArticleForm === 'function') {
    const originalResetArticleForm = window.resetArticleForm;
    window.resetArticleForm = function () {
      const result = originalResetArticleForm.apply(this, arguments);
      window.clearArticleLocation();
      return result;
    };
  }

  /* === 5) Mapa se vytvoří/zviditelní přesně v okamžiku otevření záložky
     Články === Řeší to hlavní problém: Leaflet inicializovaný do
     skrytého (display:none) panelu skončí s kontejnerem o velikosti
     0×0 a zůstane prázdný napořád, i po pozdějším zviditelnění panelu.
     Řešení: mapu vůbec nezakládat, dokud záložka Články není fakticky
     vidět — a když se do ní uživatel vrátí znovu, jen zavolat
     invalidateSize() (Leaflet potřebuje vědět, že se kontejner mohl
     mezitím přeměřit). */
  if (typeof window.showTab === 'function') {
    const originalShowTab = window.showTab;
    window.showTab = function (name) {
      const result = originalShowTab.apply(this, arguments);
      if (name === 'articles') {
        injectUI(); // pole (idempotentní), kdyby ještě nebyla vložená
        // requestAnimationFrame necháme CSS domalovat layout záložky,
        // teprve pak má smysl Leaflet měřit/inicializovat.
        requestAnimationFrame(function () {
          if (!mapInstance) initMap();
          else mapInstance.invalidateSize();
        });
      }
      return result;
    };
  }

  /* === Inicializace polí, jakmile je formulář Články v DOM ===
     Jen vloží HTML (inputy + prázdný <div> pro mapu) — samotnou mapu
     zakládá až showTab('articles') výše, viz důvod tamtéž. injectUI()
     je idempotentní, takže opakované volání nevadí. */
  document.addEventListener('DOMContentLoaded', function () {
    injectUI();
    setTimeout(injectUI, 500);
    setTimeout(injectUI, 1500);
    // Kdyby byla záložka Články uložená jako aktivní už z minula
    // (localStorage dashActiveTab) a dashboard-core.js ji tedy otevře
    // hned při startu, tenhle wrap kolem showTab výše to zachytí
    // automaticky — nic navíc tu řešit netřeba.
  });
})();
