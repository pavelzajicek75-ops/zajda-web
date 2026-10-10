/* Fotky článku rozdělené po zastávkách trasy.
   Používá mapa fotek (/fotomapa) a přehrání trasy.

   Pravidla, kam která fotka patří:
   1) Fotky před jakýmkoli „nadpisem zastávky“ (a titulní fotka) patří na
      výchozí zastávku: tu, kterou v editoru označíš 📷 (article.photoStop),
      jinak na zastávku nejvzdálenější od startu (u okruhu = hlavní cíl).
   2) Když je v textu článku krátký řádek / nadpis (max 60 znaků), který
      obsahuje název nějaké zastávky (např. „Janské Lázně“), všechny fotky
      za ním patří na tuhle zastávku — až do dalšího takového nadpisu. */
(function () {
  'use strict';

  function norm(t) {
    return String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function fin(v) { return v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)); }

  function stopsOf(a) {
    if (!a) return [];
    var s = (Array.isArray(a.stops) ? a.stops : []).filter(function (x) { return x && fin(x.lat) && fin(x.lng); })
      .map(function (x) { return { place: x.place || '', lat: Number(x.lat), lng: Number(x.lng) }; });
    if (s.length >= 2) return s;
    if (fin(a.lat) && fin(a.lng)) return [{ place: a.place || '', lat: Number(a.lat), lng: Number(a.lng) }];
    return s;
  }

  function km(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function routeKm(a) {
    var s = stopsOf(a), total = 0;
    if (s.length < 2) return 0;
    for (var i = 1; i < s.length; i++) total += km(s[i - 1], s[i]);
    return total;
  }

  function defaultIndex(a, stops) {
    stops = stops || stopsOf(a);
    if (stops.length < 2) return 0;
    if (Number.isInteger(a.photoStop) && a.photoStop >= 0 && a.photoStop < stops.length) return a.photoStop;
    var best = 1, bestKm = -1;
    stops.forEach(function (s, i) {
      var d = km(stops[0], s);
      if (d > bestKm) { bestKm = d; best = i; }
    });
    return best;
  }

  var cache = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;

  // → [{ idx, place, lat, lng, imgs:[url…] }] seřazeno podle pořadí zastávek
  function groups(a) {
    if (cache && cache.has(a)) return cache.get(a);
    var stops = stopsOf(a);
    if (!stops.length) return [];
    var cur = defaultIndex(a, stops), by = {}, seen = {};
    function add(idx, u) {
      if (!u || seen[u]) return;
      if (!/^(https?:)?\/\//i.test(u) && u.charAt(0) !== '/') return;
      seen[u] = true;
      (by[idx] = by[idx] || []).push(u);
    }
    if (a.coverUrl) add(cur, a.coverUrl);

    var names = stops.map(function (s) { return norm(String(s.place || '').split(',')[0]); });
    var doc = null;
    try { doc = new DOMParser().parseFromString(a.content || '', 'text/html'); } catch (e) { doc = null; }
    if (doc && doc.body) {
      var els = doc.body.querySelectorAll('*');
      for (var i = 0; i < els.length; i++) {
        var el = els[i], tag = el.tagName;
        if (tag === 'IMG') { add(cur, el.getAttribute('src')); continue; }
        if (stops.length > 1 && /^(H[1-6]|B|STRONG|DIV|P|LI|SPAN)$/.test(tag) && !el.querySelector('img')) {
          var t = norm(el.textContent);
          if (!t || t.length > 60) continue;
          var best = -1, bl = 0;
          for (var k = 0; k < names.length; k++) {
            if (names[k].length >= 3 && t.indexOf(names[k]) !== -1 && names[k].length > bl) { best = k; bl = names[k].length; }
          }
          if (best >= 0) cur = best;
        }
      }
    }
    var out = Object.keys(by).map(function (k) {
      var idx = +k, s = stops[idx];
      return { idx: idx, place: s.place || a.place || '', lat: s.lat, lng: s.lng, imgs: by[k] };
    }).sort(function (x, y) { return x.idx - y.idx; });
    if (cache) cache.set(a, out);
    return out;
  }

  // Všechny fotky článku (titulní + v textu) bez ohledu na to, jestli má článek polohu.
  function allImages(a) {
    var seen = {}, out = [];
    function add(u) {
      if (!u || seen[u]) return;
      if (!/^(https?:)?\/\//i.test(u) && u.charAt(0) !== '/') return;
      seen[u] = true; out.push(u);
    }
    if (a && a.coverUrl) add(a.coverUrl);
    try {
      var doc = new DOMParser().parseFromString((a && a.content) || '', 'text/html');
      var imgs = doc.body ? doc.body.querySelectorAll('img') : [];
      for (var i = 0; i < imgs.length; i++) add(imgs[i].getAttribute('src'));
    } catch (e) { /* bez fotek */ }
    return out;
  }

  function photosForStop(a, idx, max) {
    var g = groups(a).filter(function (x) { return x.idx === idx; })[0];
    return g ? g.imgs.slice(0, max || 3) : [];
  }

  window.PhotoStops = { allImages: allImages, stopsOf: stopsOf, groups: groups, photosForStop: photosForStop, defaultIndex: defaultIndex, routeKm: routeKm, km: km, norm: norm };
})();
