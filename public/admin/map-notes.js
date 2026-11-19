/* Poznámky na mapě výletu — vlastní vzpomínky k cestě ("lilo", "idiotský kamion", "blbá pumpa"…).
   Panel pod „Trasa na mapě“ v editoru článku. Ukládá se jako článek.mapNotes (viz functions/api/_map-notes.js);
   na mapě výletu se ukážou jako bublinky a pod kartou dílu. Načíst AŽ PO article-map-picker.js. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var ICONS = ['💬', '🌧️', '☀️', '🚛', '⛽', '🚧', '🅿️', '☕', '🍕', '😤', '😂', '😴', '😍', '📸', '⚠️', '❤️', '🎶', '🐌'];
  var notes = [];

  function stopsNow() { try { return window.ArticleMapStops ? window.ArticleMapStops() : []; } catch (e) { return []; } }
  function whereOptions(sel) {
    var st = stopsNow(), o = [];
    if (!st.length) return '<option value="stop:0">u místa (zatím bez zastávky)</option>';
    st.forEach(function (s, i) {
      o.push(['stop:' + i, '📍 ' + (i + 1) + '. ' + (s.place || 'zastávka')]);
      if (i + 1 < st.length) o.push(['leg:' + (i + 1), '🛣️ cestou: ' + (i + 1) + ' → ' + (i + 2) + ' (' + (st[i + 1].place || '…') + ')']);
    });
    return o.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === sel ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('');
  }
  function render() {
    var box = $('artNotesRows'); if (!box) return;
    box.innerHTML = notes.map(function (n, i) {
      return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap">' +
        '<select class="form-input" data-f="icon" data-i="' + i + '" style="flex:0 0 auto;width:4.2em;font-size:18px">' + ICONS.map(function (c) { return '<option' + (c === n.icon ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select>' +
        '<input type="text" class="form-input" data-f="text" data-i="' + i + '" maxlength="120" value="' + esc(n.text) + '" placeholder="Např. idiotský kamion, lilo celý den…" style="flex:2 1 200px;min-width:0">' +
        '<select class="form-input" data-f="where" data-i="' + i + '" style="flex:1 1 170px;min-width:0">' + whereOptions(n.at + ':' + n.k) + '</select>' +
        '<button type="button" class="btn btn-sm" data-del="' + i + '" title="Smazat poznámku">✕</button></div>';
    }).join('') + '<button type="button" class="btn btn-sm" id="artNoteAdd">➕ Přidat poznámku</button>';
    box.querySelectorAll('[data-f]').forEach(function (el) {
      el.oninput = el.onchange = function () {
        var n = notes[+el.dataset.i]; if (!n) return;
        if (el.dataset.f === 'where') { var p = el.value.split(':'); n.at = p[0]; n.k = +p[1] || 0; } else n[el.dataset.f] = el.value;
      };
      if (el.dataset.f === 'where') el.onfocus = function () { var cur = notes[+el.dataset.i]; el.innerHTML = whereOptions(cur.at + ':' + cur.k); };
    });
    box.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { notes.splice(+b.dataset.del, 1); render(); updHint(); }; });
    $('artNoteAdd').onclick = function () { notes.push({ id: 'n' + Date.now().toString(36), icon: '💬', text: '', at: 'stop', k: 0 }); render(); updHint(); var t = box.querySelectorAll('[data-f=text]'); if (t.length) t[t.length - 1].focus(); };
  }
  function updHint() { var h = $('artNotesHint'); if (h) h.textContent = notes.filter(function (n) { return n.text; }).length ? '(' + notes.filter(function (n) { return n.text; }).length + ')' : '(nepovinné)'; }
  function inject() {
    if ($('artNotesRow')) return true;
    var anchor = $('artLocationRow'); if (!anchor) return false;
    var d = document.createElement('details'); d.id = 'artNotesRow'; d.className = 'form-row editor-panel'; d.style.cssText = 'display:block;width:100%;margin:0.6rem 0 1rem';
    d.innerHTML = '<summary>💬 Poznámky na mapě <span id="artNotesHint" style="font-weight:400;color:var(--text-faint);margin-left:.4em">(nepovinné)</span></summary>' +
      '<div class="editor-panel-body"><p style="font-size:12px;color:var(--text-faint);margin:0 0 8px">Vlastní vzpomínky k cestě — ukážou se jako bublinky na mapě výletu a pod dílem. Přiřaď je k zastávce nebo k úseku cesty (trasa musí mít souřadnice zastávek).</p><div id="artNotesRows" style="max-width:720px"></div></div>';
    anchor.after(d);
    d.addEventListener('toggle', function () { if (d.open) render(); });
    render(); updHint(); return true;
  }
  var t = setInterval(function () { if (inject()) clearInterval(t); }, 800);

  /* Do plného uložení z editoru přimíchat mapNotes (hromadné akce bez obsahu nechat být). */
  var orig = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      var u = typeof input === 'string' ? input : (input && input.url) || '';
      var m = ((init && init.method) || 'GET').toUpperCase();
      if (/\/api\/articles\/(create|update)(\?|$)/.test(u) && (m === 'POST' || m === 'PUT') && init && typeof init.body === 'string') {
        var b = JSON.parse(init.body), ed = $('artEditor'), eid = ed && ed.dataset ? ed.dataset.editId : '';
        if (typeof b.content === 'string' && (m === 'POST' || String(b.id) === String(eid))) {
          b.mapNotes = notes.filter(function (n) { return n.text && n.text.trim(); }).map(function (n) { return { id: n.id, icon: n.icon, text: n.text.trim(), at: n.at, k: n.k }; });
          init = Object.assign({}, init, { body: JSON.stringify(b) });
        }
      }
    } catch (e) { console.error('map-notes: fetch patch selhal', e); }
    return orig(input, init);
  };

  if (typeof window.editArticle === 'function') {
    var oe = window.editArticle;
    window.editArticle = async function (id) {
      var res = await oe.apply(this, arguments);
      try { var r = await orig('/api/articles/get?id=' + encodeURIComponent(id)); if (r.ok) { var a = await r.json(); notes = Array.isArray(a.mapNotes) ? a.mapNotes.map(function (n) { return Object.assign({}, n); }) : []; inject(); render(); updHint(); var d = $('artNotesRow'); if (d && notes.length) d.open = true; } } catch (e) {}
      return res;
    };
  }
  if (typeof window.resetArticleForm === 'function') {
    var or = window.resetArticleForm;
    window.resetArticleForm = function () { var res = or.apply(this, arguments); notes = []; render(); updHint(); var d = $('artNotesRow'); if (d) d.open = false; return res; };
  }
})();
