/* =========================================================
   travel-map-core.js
   =========================================================
   Jediný zdroj pravdy pro mapu cest — dřív byla tahle logika
   zkopírovaná 3× (mapa.html, modal na homepage, modal v článku).
   Teď ji obsahuje jen tenhle soubor; každá stránka jen zavolá
   TravelMapCore.render(options) s ID svých vlastních kontejnerů
   (liší se stránka od stránky), zbytek — data, shlukování, barvy,
   trasy, legenda, statistiky, denní/noční přepínač, přehrání trasy —
   je společné.

   ★ ZMĚNA (srpen 2026): CARTO nedávno (během posledních dní) změnilo
   podmínky svých rastrových dlaždic (basemaps.cartocdn.com) — teď
   vyžadují API klíč a bez něj vrací dlaždice s vodoznakem
   "API KEY REQUIRED" přes celou mapu. Netýká se to jen tohohle webu,
   je to čerstvá plošná změna (nahlášeno i u Home Assistant, WordPress
   pluginů, openHAB atd.). Místo zakládání účtu u CARTO kvůli
   bezplatnému klíči se použil jiný, trvale bezklíčový poskytovatel:
   Esri Canvas basemapy (World_Light_Gray_Base / World_Dark_Gray_Base)
   — vizuálně velmi podobné (jemné, "kartografické" pozadí), zdarma bez
   registrace, fungují stejně přímo s Leaflet L.tileLayer.

   Vyžaduje už načtené: Leaflet, Leaflet.markercluster, shared.js
   (kvůli escapeHtml). Načíst TENTO soubor až po nich.

   Použití:
     var map = await TravelMapCore.render({
       mapId: 'travelMap',                 // povinné — id kontejneru mapy
       legendId: 'mapLegend',              // povinné
       statsId: 'mapStats',                // volitelné
       playBtnId: 'mapPlayBtn',            // volitelné
       themeToggleId: 'mapThemeToggle',    // volitelné
       emptyClassName: 'map-empty',        // CSS třída prázdného stavu
       currentArticleId: null              // volitelné (viz article.html)
     });
     // map === null, pokud nejsou žádná data se souřadnicemi
   ========================================================= */
(function () {
  var SECTION_NAMES = { travel: 'Cestování', photo: 'Fotografování', projects: 'Projekty', about: 'O Zajdovi' };
  var sectionNamesLoaded = false;
  async function loadDynamicSectionNames() {
    if (sectionNamesLoaded) return;
    sectionNamesLoaded = true; // i při chybě zkusit jen jednou, ať se to netahá opakovaně
    try {
      var r = await fetch('/api/sections/list');
      if (!r.ok) return;
      var sections = await r.json();
      if (!Array.isArray(sections)) return;
      sections.forEach(function (s) { if (s && s.id) SECTION_NAMES[s.id] = s.name; });
    } catch (e) { /* necháme natvrdo daný fallback výše */ }
  }
  var THEME_COLORS = ['#ff7a45', '#2fe6c9', '#8f6bff'];
  /* Esri Canvas basemapy — zdarma, bez API klíče, žádná registrace.
     {y} přichází PŘED {x} (standardní ArcGIS REST adresace dlaždic,
     jiné pořadí než u XYZ služeb jako CARTO/OSM). Žádné {s}/subdomains
     (Esri běží z jediné domény), a žádné {r} pro retina @2x varianty —
     tenhle konkrétní basemap je jen v jednom rozlišení, což je pro
     mapu bodů/tras plně dostačující. */
  var TILE_THEMES = {
    day: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      icon: '☀️', className: ''
    },
    night: {
      // OpenStreetMap má jen jeden (světlý) styl zdarma bez API klíče —
      // "noc" je proto obyčejný trik invertovat barvy CSS filtrem, ne
      // opravdu jiná sada dlaždic.
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      icon: '🌙', className: 'map-night-tiles'
    }
  };
  var TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  var TILE_MAX_ZOOM = 19;
  var TILE_SUBDOMAINS = 'abc';

  function formatDateCz(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return ''; }
  }

  function colorForIndex(i) {
    if (i < THEME_COLORS.length) return THEME_COLORS[i];
    return 'hsl(' + ((i * 47) % 360) + ', 70%, 62%)';
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  var articlesCachePromise = null;
  async function getAllArticlesForMap() {
    if (window._allArticlesCache) return window._allArticlesCache;
    if (articlesCachePromise) return articlesCachePromise;
    articlesCachePromise = (async function () {
      try {
        var r = await fetch('/api/articles/list');
        if (!r.ok) return [];
        var data = await r.json();
        var arr = Array.isArray(data) ? data : [];
        return arr.filter(function (a) { return a && a.published !== false; });
      } catch (e) { return []; }
    })();
    return articlesCachePromise;
  }

  var subsectionNameCache = {};
  async function getSubsectionName(sectionId, subsectionId) {
    if (!subsectionId) return '';
    var cacheKey = sectionId + ':' + subsectionId;
    if (cacheKey in subsectionNameCache) return subsectionNameCache[cacheKey];
    try {
      var res = await fetch('/api/subsections/by-section?sectionId=' + encodeURIComponent(sectionId));
      var subs = res.ok ? await res.json() : [];
      (subs || []).forEach(function (s) { subsectionNameCache[sectionId + ':' + (s.id || '')] = s.name || ''; });
    } catch (e) {}
    return subsectionNameCache[cacheKey] || '';
  }

  /* Bublinová postavička s očima a pusinkou v barvě dané trasy — místo
     dřívější zářící tečky (viz komentář u .map-blob-pin v shared.css). */
  function starIconForColor(color) {
    var svg = '<svg viewBox="0 0 40 40"><g class="map-blob-body">' +
      '<ellipse cx="20" cy="34" rx="9" ry="3" fill="rgba(0,0,0,0.3)"/>' +
      '<circle cx="20" cy="18" r="15" fill="' + color + '" stroke="#1a1030" stroke-width="2.5"/>' +
      '<circle cx="14" cy="15" r="2.6" fill="#1a1030"/><circle cx="26" cy="15" r="2.6" fill="#1a1030"/>' +
      '<circle cx="14.8" cy="14.2" r="0.9" fill="#fff"/><circle cx="26.8" cy="14.2" r="0.9" fill="#fff"/>' +
      '<path d="M13 22 Q20 28 27 22" stroke="#1a1030" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '</g></svg>';
    return L.divIcon({
      className: 'map-blob-pin', html: svg,
      iconSize: [26, 26], iconAnchor: [13, 22], popupAnchor: [0, -20]
    });
  }

  function clusterIconForColor(color) {
    return function (cluster) {
      var count = cluster.getChildCount();
      var size = count < 10 ? 34 : count < 50 ? 40 : 46;
      return L.divIcon({
        html: '<div class="map-cluster-icon" style="width:' + size + 'px;height:' + size + 'px;font-size:' + (count < 10 ? 13 : 14) + 'px;background:' + color + ';">' + count + '</div>',
        className: '', iconSize: [size, size]
      });
    };
  }

  /* === SRANDA PŘI PŘEHRÁNÍ TRASY === */
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CONFETTI_COLORS = ['#ff5da2', '#ffd23f', '#2fe6c9', '#8f6bff', '#ff7a45', '#5df2ff'];
  var REACTIONS = ['Fůůha!', 'Kodrcá to!', 'Skoro tam!', 'Cililink! 🔔', 'Jé, hospoda!', 'Ouha, kopec!', 'To dáme!', 'Prší mi v botě!', 'BRMBRMBRM'];
  var LOW_BATT_LINES = ['Baterka na doraz!', 'Šlapu už sám!', 'Kde je zásuvka?!'];
  var PUMPA_LINES = [
    'Zastávka: PUMPA ⛽ — kolu a párek, prosím!',
    'Coca-Cola a párek v rohlíku. Klasika. 🌭🥤',
    'Dobíjím baterku párkem. Nefunguje. Chutná.',
    '"Plnou nádrž," řekl. Elektrokolo nemá nádrž.',
    'Pan u pumpy: "Kolik litrů?" — "Jeden párek."',
    'Kola, párek, hořčice. Řetěz může počkat.',
    'Pumpa: dva párky a Coca-Cola. Pro kolo. Jasně.'
  ];

  var PUMPA_LINES_CAR = [
    'Konečně pumpa, co dává smysl! Plná nádrž ⛽🚗',
    'Natankováno. Coca-Cola a párek na cestu 🥤🌭',
    '"Diesel nebo natural?" — "Párek."',
    'Auto sežralo 40 litrů, já jeden párek.',
    'Stěrače, Coca-Cola, párek. Kompletní servis.',
    'Tankuju do auta, kolu do sebe. Spravedlivé.'
  ];

  // Podle délky úseku se přesedá: krátké = kolo, střední = auto, dlouhé = dodávka.
  function vehicleForKm(km) {
    if (km < 30) return { icon: '🚲', energy: '🔋', name: 'kolo', car: false };
    if (km < 400) return { icon: '🚗', energy: '⛽', name: 'auto', car: true };
    return { icon: '🚐', energy: '⛽', name: 'dodávka', car: true };
  }

  function pumpaIcon() {
    var svg = '<svg viewBox="0 0 30 30">' +
      '<rect x="6" y="6" width="14" height="18" rx="2" fill="#ff4757" stroke="#1a1030" stroke-width="2"/>' +
      '<rect x="8" y="9" width="10" height="6" rx="1" fill="#fff8e7"/>' +
      '<circle cx="13" cy="19" r="1.6" fill="#1a1030"/>' +
      '<path d="M20 10 h3 a2 2 0 0 1 2 2 v9" stroke="#1a1030" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '</svg>';
    return L.divIcon({ className: 'map-pumpa-pin', html: svg, iconSize: [26, 26], iconAnchor: [13, 22] });
  }

  function burstConfetti(holder, x, y, big) {
    if (reduceMotion) return;
    var n = big ? 36 : 14;
    for (var i = 0; i < n; i++) {
      var el = document.createElement('div');
      el.className = 'map-confetti-piece';
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      holder.appendChild(el);
      var angle = Math.random() * Math.PI * 2;
      var dist = (big ? 70 : 40) + Math.random() * (big ? 110 : 60);
      var dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist - (big ? 40 : 20);
      if (!el.animate) { setTimeout(function (n) { n.remove(); }, 0, el); continue; }
      el.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (Math.random() * 360) + 'deg)', opacity: 0 }
      ], { duration: (big ? 900 : 650) + Math.random() * 300, easing: 'cubic-bezier(.25,.8,.4,1)' });
      (function (node) { setTimeout(function () { node.remove(); }, 1300); })(el);
    }
  }

  function showBubble(holder, x, y, text, isPumpa) {
    var b = document.createElement('div');
    b.className = 'map-speech-bubble' + (isPumpa ? ' map-pumpa-bubble' : '');
    b.style.left = x + 'px'; b.style.top = y + 'px';
    b.textContent = text;
    holder.appendChild(b);
    setTimeout(function () { b.remove(); }, 1600);
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  async function render(options) {
    var opts = options || {};
    var mapEl = document.getElementById(opts.mapId);
    var legend = opts.legendId ? document.getElementById(opts.legendId) : null;
    var statsEl = opts.statsId ? document.getElementById(opts.statsId) : null;
    var playBtn = opts.playBtnId ? document.getElementById(opts.playBtnId) : null;
    var themeToggleBtn = opts.themeToggleId ? document.getElementById(opts.themeToggleId) : null;
    var emptyClassName = opts.emptyClassName || 'map-empty';
    var currentArticleId = opts.currentArticleId;
    if (!mapEl) return null;

    var articles = await getAllArticlesForMap();
    await loadDynamicSectionNames();
    var withCoords = articles.filter(function (a) {
      return a && typeof a.lat === 'number' && isFinite(a.lat) &&
        typeof a.lng === 'number' && isFinite(a.lng);
    });

    if (!withCoords.length) {
      mapEl.outerHTML = '<div class="' + emptyClassName + '" id="' + opts.mapId + '"><h3>Zatím tu nejsou žádná místa</h3><p>Jakmile u některého článku vyplníš souřadnice místa, objeví se tu jako bod na mapě.</p></div>';
      if (legend) legend.hidden = true;
      if (playBtn) playBtn.hidden = true;
      if (statsEl) statsEl.hidden = true;
      return null;
    }

    withCoords.sort(function (a, b) {
      var da = a.date || a.created || '', db = b.date || b.created || '';
      return da < db ? -1 : da > db ? 1 : 0;
    });

    var groupsMap = {};
    var groupOrder = [];
    withCoords.forEach(function (a) {
      var key = (a.sectionId || '?') + ':' + (a.subsectionId || '');
      if (!groupsMap[key]) {
        groupsMap[key] = { key: key, sectionId: a.sectionId, subsectionId: a.subsectionId, points: [] };
        groupOrder.push(key);
      }
      groupsMap[key].points.push(a);
    });
    for (var gi = 0; gi < groupOrder.length; gi++) {
      var g0 = groupsMap[groupOrder[gi]];
      var secName = SECTION_NAMES[g0.sectionId] || g0.sectionId || 'Ostatní';
      var subName = await getSubsectionName(g0.sectionId, g0.subsectionId);
      g0.label = subName ? secName + ' — ' + subName : secName;
    }
    groupOrder.forEach(function (key, i) { groupsMap[key].color = colorForIndex(i); });

    var map = L.map(opts.mapId, { scrollWheelZoom: false });

    var currentTileTheme = localStorage.getItem('mapTileTheme') === 'night' ? 'night' : 'day';
    var tileLayer = L.tileLayer(TILE_THEMES[currentTileTheme].url, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: TILE_MAX_ZOOM,
      subdomains: TILE_SUBDOMAINS,
      className: TILE_THEMES[currentTileTheme].className
    }).addTo(map);
    if (themeToggleBtn) {
      themeToggleBtn.textContent = TILE_THEMES[currentTileTheme].icon;
      themeToggleBtn.onclick = function () {
        currentTileTheme = currentTileTheme === 'day' ? 'night' : 'day';
        map.removeLayer(tileLayer);
        tileLayer = L.tileLayer(TILE_THEMES[currentTileTheme].url, {
          attribution: TILE_ATTRIBUTION,
          maxZoom: TILE_MAX_ZOOM,
          subdomains: TILE_SUBDOMAINS,
          className: TILE_THEMES[currentTileTheme].className
        }).addTo(map);
        themeToggleBtn.textContent = TILE_THEMES[currentTileTheme].icon;
        localStorage.setItem('mapTileTheme', currentTileTheme);
      };
    }

    map.on('focus', function () { map.scrollWheelZoom.enable(); });
    map.on('blur', function () { map.scrollWheelZoom.disable(); });

    var isTouchDevice = window.matchMedia && window.matchMedia('(hover: none)').matches;

    var allLatLngs = [];
    var legendHtml = '';
    var markerById = {};
    var totalDistanceKm = 0;

    groupOrder.forEach(function (key) {
      var g = groupsMap[key];
      var icon = starIconForColor(g.color);
      var groupLatLngs = [];
      var clusterGroup = L.markerClusterGroup({
        iconCreateFunction: clusterIconForColor(g.color),
        maxClusterRadius: 45,
        disableClusteringAtZoom: 13,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false
      });

      g.points.forEach(function (a) {
        // "Cesta" (2+ zastávek u jednoho článku) vs "bod" (jedna, jako dřív).
        var stops = Array.isArray(a.stops) && a.stops.length >= 2
          ? a.stops.filter(function (s) { return typeof s.lat === 'number' && isFinite(s.lat) && typeof s.lng === 'number' && isFinite(s.lng); })
          : [{ lat: a.lat, lng: a.lng, place: a.place }];
        if (stops.length < 1) return;

        var title = escapeHtml(a.title || 'Bez názvu');
        var dateStr = escapeHtml(formatDateCz(a.date || a.created));
        var articleUrl = '/article?id=' + encodeURIComponent(a.id);
        var tooltipOpenedByTap = false;

        function goToArticle() {
          if (currentArticleId != null && String(a.id) === String(currentArticleId)) {
            if (typeof opts.onSelfClick === 'function') opts.onSelfClick();
            return;
          }
          window.location.href = articleUrl;
        }

        stops.forEach(function (s, si) {
          var ll = [s.lat, s.lng];
          groupLatLngs.push(ll);
          allLatLngs.push(ll);

          // Hlavní (klikací) pin je vždycky jen na PRVNÍ zastávce článku —
          // u "bodu" je to jediná, u "cesty" ten start. Další zastávky jsou
          // jen menší tečky na trase (vizuálně "cesta", ne další samostatný bod).
          if (si === 0) {
            var marker = L.marker(ll, { icon: icon });
            markerById[a.id] = marker;
            var place = escapeHtml(s.place || a.place || '');
            marker.bindTooltip(
              '<span class="map-label-title">' + title + (stops.length > 1 ? ' 🛣️' : '') + '</span>' +
              (place ? '<span class="map-label-meta">' + place + '</span>' : '') +
              (dateStr ? '<span class="map-label-meta">' + dateStr + '</span>' : ''),
              { direction: 'top', offset: [0, -22], className: 'map-point-label', opacity: 1 }
            );
            marker.on('click', function () {
              if (isTouchDevice && !tooltipOpenedByTap) { tooltipOpenedByTap = true; this.openTooltip(); return; }
              goToArticle();
            });
            marker.on('add', function () { var el = marker.getElement(); if (el) el.setAttribute('tabindex', '0'); });
            clusterGroup.addLayer(marker);
          } else {
            var waypoint = L.circleMarker(ll, {
              radius: 5, color: '#1a1030', weight: 1.5, fillColor: g.color, fillOpacity: 1
            });
            var wpPlace = escapeHtml(s.place || '');
            waypoint.bindTooltip(
              '<span class="map-label-title">' + title + '</span>' +
              (wpPlace ? '<span class="map-label-meta">' + wpPlace + '</span>' : ''),
              { direction: 'top', offset: [0, -6], className: 'map-point-label', opacity: 1 }
            );
            waypoint.on('click', function () {
              if (isTouchDevice && !tooltipOpenedByTap) { tooltipOpenedByTap = true; this.openTooltip(); return; }
              goToArticle();
            });
            clusterGroup.addLayer(waypoint);
          }
        });

        // "Cesta" navíc dostane vlastní plnou (nepřerušovanou) čáru mezi
        // svými zastávkami — jasně odlišenou od tečkované spojnice mezi
        // různými články v rámci podsekce.
        if (stops.length > 1) {
          var routeSegment = L.polyline(stops.map(function (s) { return [s.lat, s.lng]; }), {
            color: g.color, weight: 4, opacity: 0.9
          }).addTo(map);
          routeSegment.bindTooltip(title + ' 🛣️', { sticky: true, className: 'map-point-label' });
          routeSegment.on('click', goToArticle);
          if (!g.routeSegments) g.routeSegments = [];
          g.routeSegments.push(routeSegment);
        }
      });

      var polyline = null;
      if (groupLatLngs.length > 1) {
        polyline = L.polyline(groupLatLngs, { color: g.color, weight: 2.5, opacity: 0.65, dashArray: '5 8' }).addTo(map);
        for (var pi = 1; pi < groupLatLngs.length; pi++) {
          totalDistanceKm += haversineKm(groupLatLngs[pi - 1][0], groupLatLngs[pi - 1][1], groupLatLngs[pi][0], groupLatLngs[pi][1]);
        }
      }
      g.polyline = polyline;
      g.clusterGroup = clusterGroup;
      g.visible = true;
      clusterGroup.addTo(map);

      legendHtml += '<span class="legend-item" tabindex="0" role="button" data-group-key="' + escapeHtml(key) + '"><span class="legend-dot" style="background:' + g.color + ';box-shadow:0 0 8px ' + g.color + '99"></span> ' + escapeHtml(g.label) + (groupLatLngs.length > 1 ? '' : ' (1 místo)') + '</span>';
    });

    if (allLatLngs.length === 1) map.setView(allLatLngs[0], 8);
    else map.fitBounds(L.latLngBounds(allLatLngs), { padding: [30, 30] });

    if (legend) {
      legend.innerHTML = legendHtml;
      legend.hidden = false;
      legend.querySelectorAll('.legend-item').forEach(function (item) {
        function toggle() {
          var key = item.getAttribute('data-group-key');
          var g = groupsMap[key];
          if (!g) return;
          g.visible = !g.visible;
          item.classList.toggle('legend-off', !g.visible);
          if (g.visible) {
            g.clusterGroup.addTo(map);
            if (g.polyline) g.polyline.addTo(map);
            (g.routeSegments || []).forEach(function (seg) { seg.addTo(map); });
          } else {
            map.removeLayer(g.clusterGroup);
            if (g.polyline) map.removeLayer(g.polyline);
            (g.routeSegments || []).forEach(function (seg) { map.removeLayer(seg); });
          }
        }
        item.addEventListener('click', toggle);
        item.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      });
    }

    if (statsEl) {
      var tripWord = groupOrder.length === 1 ? 'cesta' : (groupOrder.length >= 2 && groupOrder.length <= 4 ? 'cesty' : 'cest');
      var placeWord = withCoords.length === 1 ? 'místo' : (withCoords.length >= 2 && withCoords.length <= 4 ? 'místa' : 'míst');
      var distancePart = totalDistanceKm > 0 ? '<span>~<strong>' + Math.round(totalDistanceKm).toLocaleString('cs-CZ') + '</strong> km vzdušnou čarou</span>' : '';
      statsEl.innerHTML = '<span><strong>' + groupOrder.length + '</strong> ' + tripWord + '</span><span><strong>' + withCoords.length + '</strong> ' + placeWord + '</span>' + distancePart;
      statsEl.hidden = false;
    }

    if (playBtn) {
      playBtn.hidden = withCoords.length <= 1;
      if (withCoords.length > 1) {
        var isPlaying = false;
        function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

        // HUD (km + baterka + svačina) se tvoří dynamicky — stránky nemusí nic přidávat do HTML.
        var hud = document.createElement('div');
        hud.className = 'map-hud';
        hud.innerHTML =
          '<div class="map-hud-box"><span class="map-hud-icon" data-k="vehIcon">🚲</span><span class="map-hud-val" data-k="km">0,0</span><span>km</span></div>' +
          '<div class="map-hud-box map-hud-batt" data-k="battBox"><span class="map-hud-icon" data-k="battIcon">🔋</span><span class="map-hud-val" data-k="batt">100</span><span>%</span><div class="map-hud-bar"><div class="map-hud-bar-fill" data-k="fill"></div></div></div>' +
          '<div class="map-hud-box"><span class="map-hud-icon">🌭</span><span class="map-hud-val" data-k="parky">0</span><span class="map-hud-icon">🥤</span><span class="map-hud-val" data-k="koly">0</span></div>';
        mapEl.appendChild(hud);
        function hudEl(k) { return hud.querySelector('[data-k="' + k + '"]'); }

        // Vzdálenost po celé přehrávané sekvenci (napříč trasami, v pořadí podle data).
        var legKms = [0];
        var playTotalKm = 0;
        for (var li = 1; li < withCoords.length; li++) {
          var lk = haversineKm(withCoords[li - 1].lat, withCoords[li - 1].lng, withCoords[li].lat, withCoords[li].lng);
          legKms.push(lk); playTotalKm += lk;
        }

        function setBatt(v) {
          var b = Math.max(0, Math.min(100, v));
          hudEl('batt').textContent = Math.round(b);
          var fill = hudEl('fill');
          fill.style.width = b + '%';
          fill.style.background = b < 25 ? '#ff4757' : (b < 55 ? '#ffd23f' : '');
          hudEl('battBox').classList.toggle('map-hud-low', b < 25);
        }

        function rideLeg(rider, from, to, kmBase, legKm, battBase, battDrain) {
          return new Promise(function (resolve) {
            var duration = 1100, start = null;
            map.flyTo(to, 9, { duration: duration / 1000, easeLinearity: 0.3 });
            function frame(ts) {
              if (!start) start = ts;
              var t = Math.min(1, (ts - start) / duration);
              var pt = map.latLngToContainerPoint([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
              rider.style.left = pt.x + 'px'; rider.style.top = pt.y + 'px';
              hudEl('km').textContent = (kmBase + legKm * t).toFixed(1).replace('.', ',');
              setBatt(battBase - battDrain * t);
              if (t < 1) requestAnimationFrame(frame); else resolve();
            }
            requestAnimationFrame(frame);
          });
        }

        playBtn.onclick = async function () {
          if (isPlaying) return;
          isPlaying = true;
          playBtn.disabled = true;
          playBtn.textContent = '🚲 Šlape se…';

          var kmSoFar = 0, battery = 100, parky = 0, koly = 0;
          var currentVehicle = { icon: '🚲', energy: '🔋', name: 'kolo', car: false };
          hudEl('vehIcon').textContent = '🚲'; hudEl('battIcon').textContent = '🔋';
          hudEl('km').textContent = '0,0'; hudEl('parky').textContent = '0'; hudEl('koly').textContent = '0';
          setBatt(100);
          hud.classList.add('show');

          var rider = document.createElement('div');
          rider.className = 'map-rider' + (reduceMotion ? '' : ' map-rider-bounce');
          rider.textContent = '🚲';
          mapEl.appendChild(rider);
          var p0 = map.latLngToContainerPoint([withCoords[0].lat, withCoords[0].lng]);
          rider.style.left = p0.x + 'px'; rider.style.top = p0.y + 'px';

          for (var i = 0; i < withCoords.length; i++) {
            var a = withCoords[i];
            var m = markerById[a.id];
            var pumpaStop = false;

            if (i > 0) {
              var prev = withCoords[i - 1];
              var legKm = legKms[i];
              var drain = playTotalKm > 0 ? (legKm / playTotalKm) * 85 : 0; // aspoň 15 % na dramatický závěr
              var veh = vehicleForKm(legKm);
              if (veh.icon !== currentVehicle.icon) {
                var pv = map.latLngToContainerPoint([prev.lat, prev.lng]);
                showBubble(mapEl, pv.x, pv.y - 30, 'Přesedáme: ' + veh.icon + ' (' + veh.name + ')!', false);
                rider.textContent = veh.icon;
                hudEl('vehIcon').textContent = veh.icon;
                hudEl('battIcon').textContent = veh.energy;
                currentVehicle = veh;
              }
              // Zastávka na pumpě: každý 3. přejezd (a nikdy hned ten první), i když je to elektrokolo
              pumpaStop = (i % 3 === 0) && i < withCoords.length - 1;
              await rideLeg(rider, [prev.lat, prev.lng], [a.lat, a.lng], kmSoFar, legKm, battery, drain);
              kmSoFar += legKm; battery = Math.max(0, battery - drain);
            } else {
              map.flyTo([a.lat, a.lng], 9, { duration: 1 });
              await sleep(1100);
            }

            var pt = map.latLngToContainerPoint([a.lat, a.lng]);
            var isLast = i === withCoords.length - 1;
            burstConfetti(mapEl, pt.x, pt.y, isLast);
            if (m) { try { m.openTooltip(); } catch (e) {} }
            showBubble(mapEl, pt.x, pt.y - 30, battery < 25 && Math.random() < 0.6 ? pick(LOW_BATT_LINES) : pick(REACTIONS), false);
            await sleep(1300);
            if (m) { try { m.closeTooltip(); } catch (e) {} }

            if (pumpaStop) {
              var pm = L.marker([a.lat, a.lng], { icon: pumpaIcon(), interactive: false, zIndexOffset: 800 }).addTo(map);
              var pp = map.latLngToContainerPoint([a.lat, a.lng]);
              showBubble(mapEl, pp.x, pp.y - 30, pick(currentVehicle.car ? PUMPA_LINES_CAR : PUMPA_LINES), true);
              parky++; koly++;
              hudEl('parky').textContent = parky; hudEl('koly').textContent = koly;
              battery = Math.min(100, battery + 6); // vtip: "dobil" pár procent, i když párek elektrokolo nenabije
              setBatt(battery);
              await sleep(1700);
              map.removeLayer(pm);
            }
          }

          var lastPt = map.latLngToContainerPoint([withCoords[withCoords.length - 1].lat, withCoords[withCoords.length - 1].lng]);
          showBubble(mapEl, lastPt.x, lastPt.y - 30,
            'Dojeto! ' + kmSoFar.toFixed(1).replace('.', ',') + ' km · 🌭×' + parky + ' 🥤×' + koly, true);
          await sleep(1800);

          rider.remove();
          hud.classList.remove('show');
          hudEl('vehIcon').textContent = '🚲'; hudEl('battIcon').textContent = '🔋';
          if (allLatLngs.length > 1) map.fitBounds(L.latLngBounds(allLatLngs), { padding: [30, 30] });
          playBtn.disabled = false;
          playBtn.textContent = '▶️ Přehrát trasu';
          isPlaying = false;
        };
      }
    }

    return map;
  }

  window.TravelMapCore = { render: render, getAllArticlesForMap: getAllArticlesForMap };
})();
