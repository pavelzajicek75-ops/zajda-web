/* Koš: smazané články a milníky se 30 dní drží v koši a jdou vrátit. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }
  async function post(url, body) {
    var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }
  var KIND = { article: '📝 Článek', timeline: '⭐ Milník' };
  async function load() {
    var list = $('trashList'); if (!list) return;
    list.textContent = 'Načítám…';
    try {
      var r = await fetch('/api/trash/list', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var j = await r.json(), items = j.items || [];
      if (!items.length) { list.innerHTML = '<span style="color:var(--text-muted);font-size:13px">Koš je prázdný. Smazané články a milníky tu zůstanou ' + j.days + ' dní.</span>'; return; }
      list.innerHTML = items.map(function (x) {
        var d = new Date(x.deletedAt), left = Math.max(0, Math.ceil((x.deletedAt + j.days * 864e5 - Date.now()) / 864e5));
        return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 0;border-top:1px solid var(--border-soft,#263252)">' +
          '<span style="flex:1;min-width:180px;font-size:13px">' + (KIND[x.kind] || x.kind) + ' · <b>' + esc(x.title || x.id) + '</b><br><small style="color:var(--text-muted)">smazáno ' + d.toLocaleString('cs-CZ') + ' · zbývá ' + left + ' dní</small></span>' +
          '<button class="btn btn-blue btn-sm" data-r="' + esc(x.key) + '">↩️ Obnovit</button>' +
          '<button class="btn btn-red btn-sm" data-p="' + esc(x.key) + '">Smazat navždy</button></div>';
      }).join('');
      list.querySelectorAll('[data-r]').forEach(function (b) { b.onclick = async function () {
        b.disabled = true;
        try { await post('/api/trash/restore', { key: b.dataset.r }); toast('Obnoveno', 'success'); if (typeof loadArticles === 'function') loadArticles(); } catch (e) { toast('Obnova selhala: ' + e.message, 'error'); }
        load(); }; });
      list.querySelectorAll('[data-p]').forEach(function (b) { b.onclick = async function () {
        if (!confirm('Smazat navždy? Už to nepůjde vrátit.')) return;
        try { await post('/api/trash/purge', { key: b.dataset.p }); } catch (e) { toast(e.message, 'error'); }
        load(); }; });
    } catch (e) { list.textContent = '⚠️ ' + e.message; }
  }
  function mount() {
    var host = $('admin');
    if (!host || $('trashBox')) return;
    var box = document.createElement('div'); box.id = 'trashBox'; box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">🗑️ Koš</h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.6rem">Smazaný článek nebo milník se nejdřív přesune sem a po 30 dnech zmizí sám.</p>' +
      '<div id="trashList"></div><button class="btn btn-sm" id="trashReload" style="margin-top:.5rem">🔄 Znovu načíst</button>';
    host.appendChild(box);
    $('trashReload').onclick = load;
    load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
