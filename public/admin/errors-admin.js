/* 🐞 Hlášené chyby: tiché hlášení JavaScriptových chyb z prohlížečů čtenářů i z adminu. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }
  function fmt(ts) { try { return new Date(ts).toLocaleString('cs', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  var items = [];

  async function clear(id) {
    var r = await fetch('/api/errors/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { id: id } : {}) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
  }

  function render() {
    var box = $('errorsList'); if (!box) return;
    var h = $('errorsBadge'); if (h) h.textContent = items.length ? ' (' + items.length + ')' : '';
    box.innerHTML = (items.length ? '<button class="btn btn-sm" id="errorsClearAll">Smazat vše</button>' : '') +
      (items.length ? items.map(function (e) {
        return '<div style="border-top:1px solid var(--border-soft,#263252);padding:8px 0;font-size:13px">' +
          '<div><b>' + esc(e.message) + '</b></div>' +
          '<div style="color:var(--text-muted)">' + esc(e.page || '?') + (e.where ? ' · ' + esc(e.where) : '') + ' · ' + (e.count || 1) + '× · naposledy ' + fmt(e.last) + '</div>' +
          '<div style="color:var(--text-muted);font-size:12px">' + esc(e.ua || '') + '</div>' +
          '<button class="btn btn-sm" data-id="' + esc(e.id) + '">Hotovo</button></div>';
      }).join('') : '<p style="font-size:13px;color:var(--text-muted)">Žádné hlášené chyby. 🎉</p>');
    box.querySelectorAll('button[data-id]').forEach(function (b) {
      b.onclick = async function () { b.disabled = true; try { await clear(b.dataset.id); items = items.filter(function (x) { return x.id !== b.dataset.id; }); render(); } catch (e) { toast('Nepovedlo se: ' + e.message, 'error'); b.disabled = false; } };
    });
    var all = $('errorsClearAll');
    if (all) all.onclick = async function () { if (!confirm('Smazat všechna hlášení?')) return; try { await clear(); items = []; render(); } catch (e) { toast('Nepovedlo se: ' + e.message, 'error'); } };
  }

  async function load(silent) {
    try {
      var r = await fetch('/api/errors/list');
      if (!r.ok) { if (!silent) toast('Chyby se nepodařilo načíst (HTTP ' + r.status + ')', 'error'); return; }
      items = (await r.json()).items || [];
      render();
      if (silent && items.length) {
        var seen = false; try { seen = sessionStorage.getItem('err-notified') === '1'; } catch (e) {}
        if (!seen) { toast('🐞 Je tu ' + items.length + ' hlášených chyb webu (Admin → Hlášené chyby)', 'info'); try { sessionStorage.setItem('err-notified', '1'); } catch (e) {} }
      }
    } catch (e) { /* offline / nepřihlášen */ }
  }

  function mount() {
    var host = $('admin');
    if (!host || $('errorsBox')) return;
    var box = document.createElement('div');
    box.id = 'errorsBox';
    box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">🐞 Hlášené chyby<span id="errorsBadge" style="font-weight:400;color:#f59e0b"></span></h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.6rem">Chyby JavaScriptu, které se objevily v prohlížeči čtenářů nebo tvém. Stejná chyba se jen přičte k počtu. Pošli mi je, když něco nefunguje.</p>' +
      '<button class="btn btn-sm" id="errorsBtn">🐞 Načíst chyby</button><div id="errorsList" style="margin-top:.6rem"></div>';
    host.appendChild(box);
    $('errorsBtn').onclick = function () { load(false); };
    setTimeout(function () { load(true); }, 2500);
    setTimeout(function () { load(true); }, 8000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
