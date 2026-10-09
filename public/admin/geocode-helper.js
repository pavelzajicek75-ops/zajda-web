/* Hromadné doplnění souřadnic podle textového "Místa" u starších článků.
   Články bez lat/lng se nezobrazí na mapě (/mapa, /fotomapa). Tenhle
   pomocník je najde, vyhledá místo přes OpenStreetMap (Nominatim),
   ukáže, co našel, a uloží JEN to, co necháš zaškrtnuté. */
(function () {
  'use strict';

  var rows = []; // { id, title, place, query, found:{lat,lng,name}|null, checked }
  var cache = {};

  function $(id) { return document.getElementById(id); }
  function esc(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toast(msg, type) { if (typeof showToast === 'function') showToast(msg, type || 'info'); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function finite(v) { return v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)); }

  function needsCoords(a) {
    if (!a || !(a.place || '').trim()) return false;
    if (finite(a.lat) && finite(a.lng)) return false;
    if (Array.isArray(a.stops) && a.stops.some(function (s) { return s && finite(s.lat) && finite(s.lng); })) return false;
    return true;
  }

  async function geocode(query) {
    var key = query.trim().toLowerCase();
    if (key in cache) return cache[key];
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=cs&q=' + encodeURIComponent(query);
    var r = await fetch(url, { headers: { 'Accept-Language': 'cs' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var data = await r.json();
    var res = (data && data.length)
      ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name || query }
      : null;
    cache[key] = res;
    return res;
  }

  function render() {
    var box = $('geoFillResult');
    if (!box) return;
    if (!rows.length) { box.innerHTML = ''; return; }
    box.innerHTML =
      '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:.75rem">' +
      '<thead><tr style="text-align:left;color:var(--text-muted)"><th></th><th>Článek</th><th>Hledané místo</th><th>Nalezeno</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        var found = r.found
          ? esc(r.found.name.split(',').slice(0, 3).join(',')) + '<br><span style="opacity:.6">' + r.found.lat.toFixed(4) + ', ' + r.found.lng.toFixed(4) + '</span>'
          : (r.searched ? '<span style="color:#f59e0b">nenalezeno — uprav hledaný text</span>' : '…');
        return '<tr style="border-top:1px solid var(--border-soft,#263252)">' +
          '<td style="padding:6px"><input type="checkbox" data-i="' + i + '" class="geo-check"' + (r.checked && r.found ? ' checked' : '') + (r.found ? '' : ' disabled') + '></td>' +
          '<td style="padding:6px">' + esc(r.title) + '</td>' +
          '<td style="padding:6px"><input class="form-input geo-query" data-i="' + i + '" value="' + esc(r.query) + '" style="min-width:140px"> ' +
          '<button class="btn btn-sm geo-retry" data-i="' + i + '" title="Hledat znovu">🔍</button></td>' +
          '<td style="padding:6px">' + found + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<div style="margin-top:.75rem"><button class="btn btn-blue" id="geoSaveBtn">💾 Uložit zaškrtnuté</button></div>';

    box.querySelectorAll('.geo-check').forEach(function (c) {
      c.onchange = function () { rows[+c.dataset.i].checked = c.checked; };
    });
    box.querySelectorAll('.geo-query').forEach(function (q) {
      q.oninput = function () { rows[+q.dataset.i].query = q.value; };
    });
    box.querySelectorAll('.geo-retry').forEach(function (b) {
      b.onclick = async function () {
        var r = rows[+b.dataset.i];
        b.disabled = true;
        try { r.found = await geocode(r.query); r.searched = true; r.checked = !!r.found; }
        catch (e) { toast('Hledání selhalo: ' + e.message, 'error'); }
        render();
      };
    });
    $('geoSaveBtn').onclick = save;
  }

  async function scan() {
    var btn = $('geoFillBtn'), status = $('geoFillStatus');
    btn.disabled = true;
    rows = [];
    render();
    try {
      status.textContent = 'Načítám články…';
      var r = await fetch('/api/articles/list');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var list = await r.json();
      var todo = (Array.isArray(list) ? list : []).filter(needsCoords);
      if (!todo.length) { status.textContent = '✅ Všechny články s místem už mají souřadnice.'; return; }
      rows = todo.map(function (a) {
        return { id: a.id, title: a.title || 'Bez názvu', place: a.place, query: (a.place || '').trim(), found: null, checked: true, searched: false };
      });
      render();
      for (var i = 0; i < rows.length; i++) {
        status.textContent = 'Hledám ' + (i + 1) + ' / ' + rows.length + '…';
        try { rows[i].found = await geocode(rows[i].query); } catch (e) { rows[i].found = null; }
        rows[i].searched = true;
        rows[i].checked = !!rows[i].found;
        render();
        if (!(rows[i].query.trim().toLowerCase() in cache) || i < rows.length - 1) await sleep(1100); // limit Nominatim: 1 dotaz/s
      }
      var ok = rows.filter(function (x) { return x.found; }).length;
      status.textContent = 'Hotovo: nalezeno ' + ok + ' z ' + rows.length + '. Zkontroluj, co se našlo, a ulož.';
    } catch (e) {
      status.textContent = '⚠️ ' + e.message;
    } finally {
      btn.disabled = false;
    }
  }

  async function save() {
    var chosen = rows.filter(function (r) { return r.checked && r.found; });
    if (!chosen.length) return toast('Nic není zaškrtnuté.', 'info');
    var btn = $('geoSaveBtn'); btn.disabled = true;
    var done = 0, fail = 0;
    for (var i = 0; i < chosen.length; i++) {
      try {
        var r = await fetch('/api/articles/update', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: chosen[i].id, lat: chosen[i].found.lat, lng: chosen[i].found.lng })
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        done++;
        rows = rows.filter(function (x) { return x !== chosen[i]; });
      } catch (e) { fail++; }
    }
    toast('Uloženo ' + done + ' článků' + (fail ? ', selhalo ' + fail : '') + '.', fail ? 'error' : 'success');
    if (typeof loadArticles === 'function') { try { loadArticles(); } catch (e) {} }
    $('geoFillStatus').textContent = done ? '✅ Uloženo ' + done + '.' : '';
    render();
  }

  function mount() {
    var host = $('admin');
    if (!host || $('geoFillBox')) return;
    var box = document.createElement('div');
    box.id = 'geoFillBox';
    box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML =
      '<h3 style="margin-bottom:.5rem">📍 Souřadnice pro mapy</h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.75rem">Starší články mají jen text místa (třeba „Třeboň“) a na mapách se neukážou. ' +
      'Tohle je najde, vyhledá místo na OpenStreetMap a nabídne uložení. Nic se neuloží, dokud nepotvrdíš.</p>' +
      '<button class="btn btn-sm" id="geoFillBtn">📍 Najít souřadnice podle místa</button> ' +
      '<span id="geoFillStatus" style="font-size:13px;color:var(--text-muted)"></span>' +
      '<div id="geoFillResult"></div>';
    host.appendChild(box);
    $('geoFillBtn').onclick = scan;
  }

  window.GeoFill = { needsCoords: needsCoords };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
