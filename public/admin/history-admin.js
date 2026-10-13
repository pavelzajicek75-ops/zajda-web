/* 🕘 Historie verzí článku: při úpravě článku nabídne posledních 10 uložených verzí textu.
   „Načíst“ vloží starou verzi do editoru (nic se neuloží, dokud neklikneš na Uložit). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmt(ts) { try { return new Date(ts).toLocaleString('cs', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }

  async function open(id) {
    var r = await fetch('/api/articles/history?id=' + encodeURIComponent(id));
    if (!r.ok) { toast('Historii se nepodařilo načíst', 'error'); return; }
    var items = await r.json();
    var m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Historie verzí');
    m.innerHTML = '<div class="modal-box" style="max-width:520px"><h3>🕘 Historie verzí</h3>' +
      (items.length ? '<p style="color:var(--text-muted);font-size:13px">Každá položka je stav článku těsně před uložením změny.</p>' + items.map(function (it) {
        return '<div style="display:flex;gap:10px;align-items:center;border-top:1px solid var(--border-soft,#263252);padding:6px 0;font-size:13px"><span style="flex:1">' + esc(fmt(it.at)) + '</span><button class="btn btn-sm" data-key="' + esc(it.key) + '">↩️ Načíst do editoru</button></div>';
      }).join('') : '<p style="color:var(--text-muted);font-size:13px">Zatím žádná uložená verze — objeví se po první úpravě textu.</p>') +
      '<div class="modal-actions"><button class="btn btn-red" data-close>Zavřít</button></div></div>';
    document.body.appendChild(m);
    m.onclick = function (e) { if (e.target === m || (e.target.dataset && e.target.dataset.close !== undefined)) m.remove(); };
    m.querySelectorAll('button[data-key]').forEach(function (b) {
      b.onclick = async function () {
        var vr = await fetch('/api/articles/history?key=' + encodeURIComponent(b.dataset.key));
        if (!vr.ok) { toast('Verzi se nepodařilo načíst', 'error'); return; }
        var v = await vr.json();
        if ($('artTitle')) $('artTitle').value = v.title || '';
        if ($('artEditor')) $('artEditor').innerHTML = v.content || '';
        if ($('artExcerpt')) $('artExcerpt').value = v.excerpt || '';
        m.remove(); toast('Stará verze je v editoru — nezapomeň uložit', 'info');
      };
    });
  }

  function sync() {
    var ed = $('artEditor'); if (!ed) return;
    var btn = $('articleHistoryBtn');
    var id = ed.dataset ? ed.dataset.editId : '';
    if (!id) { if (btn) btn.remove(); return; }
    if (btn) { btn.dataset.id = id; return; }
    btn = document.createElement('button'); btn.id = 'articleHistoryBtn'; btn.type = 'button'; btn.className = 'btn btn-sm'; btn.textContent = '🕘 Historie verzí'; btn.dataset.id = id;
    btn.style.cssText = 'margin:.4rem 0';
    btn.onclick = function () { open(btn.dataset.id); };
    ed.parentNode.insertBefore(btn, ed.nextSibling);
  }
  function start() {
    var ed = $('artEditor'); if (!ed) return;
    new MutationObserver(sync).observe(ed, { attributes: true, attributeFilter: ['data-edit-id'] });
    sync();
  }
  window.ArticleHistory = { open: open };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
