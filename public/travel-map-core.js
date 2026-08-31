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
  var THEME_COLORS = ['#ff7a45', '#2fe6c9', '#8f6bff'];
  /* Esri Canvas basemapy — zdarma, bez API klíče, žádná registrace.
     {y} přichází PŘED {x} (standardní ArcGIS REST adresace dlaždic,
     jiné pořadí než u XYZ služeb jako CARTO/OSM). Žádné {s}/subdomains
     (Esri běží z jediné domény), a žádné {r} pro retina @2x varianty —
     tenhle konkrétní basemap je jen v jednom rozlišení, což je pro
     mapu bodů/tras plně dostačující. */
  var TILE_THEMES = {
    day: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      icon: '☀️'
    },
    night: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      icon: '🌙'
    }
  };
  var TILE_ATTRIBUTION = 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, and the GIS user community';
  var TILE_MAX_ZOOM = 16; // Esri Canvas basemapy nejdou do tak vysokého přiblížení jako CARTO/OSM

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

  function starIconForColor(color) {
    return L.divIcon({
      className: '',
      html: '<div class="star-pin" style="background:radial-gradient(circle,#fff 0%,' + color + ' 45%,transparent 75%);box-shadow:0 0 10px ' + color + ',0 0 22px ' + color + '99;"></div>',
      iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -10]
    });
  }

  function clusterIconForColor(color) {
    return function (cluster) {
      var count = cluster.getChildCount();
      var size = count < 10 ? 32 : count < 50 ? 38 : 44;
      return L.divIcon({
        html: '<div class="map-cluster-icon" style="width:' + size + 'px;height:' + size + 'px;font-size:' + (count < 10 ? 13 : 14) + 'px;background:' + color + ';box-shadow:0 0 12px ' + color + 'aa;">' + count + '</div>',
        className: '', iconSize: [size, size]
      });
    };
  }

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
      maxZoom: TILE_MAX_ZOOM
    }).addTo(map);
    if (themeToggleBtn) {
      themeToggleBtn.textContent = TILE_THEMES[currentTileTheme].icon;
      themeToggleBtn.onclick = function () {
        currentTileTheme = currentTileTheme === 'day' ? 'night' : 'day';
        map.removeLayer(tileLayer);
        tileLayer = L.tileLayer(TILE_THEMES[currentTileTheme].url, {
          attribution: TILE_ATTRIBUTION,
          maxZoom: TILE_MAX_ZOOM
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
        var ll = [a.lat, a.lng];
        groupLatLngs.push(ll);
        allLatLngs.push(ll);
        var marker = L.marker(ll, { icon: icon });
        markerById[a.id] = marker;
        var title = escapeHtml(a.title || 'Bez názvu');
        var place = escapeHtml(a.place || '');
        var dateStr = escapeHtml(formatDateCz(a.date || a.created));
        var articleUrl = '/article?id=' + encodeURIComponent(a.id);

        marker.bindTooltip(
          '<span class="map-label-title">' + title + '</span>' +
          (place ? '<span class="map-label-meta">' + place + '</span>' : '') +
          (dateStr ? '<span class="map-label-meta">' + dateStr + '</span>' : ''),
          { direction: 'top', offset: [0, -10], className: 'map-point-label', opacity: 1 }
        );
        var tooltipOpenedByTap = false;
        marker.on('click', function () {
          if (isTouchDevice && !tooltipOpenedByTap) {
            tooltipOpenedByTap = true;
            this.openTooltip();
            return;
          }
          if (currentArticleId != null && String(a.id) === String(currentArticleId)) {
            if (typeof opts.onSelfClick === 'function') opts.onSelfClick();
            return;
          }
          window.location.href = articleUrl;
        });
        marker.on('add', function () {
          var el = marker.getElement();
          if (el) el.setAttribute('tabindex', '0');
        });
        clusterGroup.addLayer(marker);
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
          } else {
            map.removeLayer(g.clusterGroup);
            if (g.polyline) map.removeLayer(g.polyline);
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
        playBtn.onclick = async function () {
          if (isPlaying) return;
          isPlaying = true;
          playBtn.disabled = true;
          playBtn.textContent = '⏸ Přehrávám…';
          for (var i = 0; i < withCoords.length; i++) {
            var a = withCoords[i];
            var m = markerById[a.id];
            map.flyTo([a.lat, a.lng], 9, { duration: 1 });
            await sleep(1100);
            if (m) { try { m.openTooltip(); } catch (e) {} }
            await sleep(1300);
            if (m) { try { m.closeTooltip(); } catch (e) {} }
          }
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
