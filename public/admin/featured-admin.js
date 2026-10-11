/* „Začni tady“ — výběr článků pro nové čtenáře (zobrazí se na /nejctenejsi).
   Zaškrtni článek a případně dej pořadí (nižší číslo = výš). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  async function save(id, patch) {
    var r = await fetch('/api/articles/update', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ id: id }, patch)) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
  }

  async function load() {
    var box = $('featuredList');
    box.textContent = 'Načítám…';
    var arts;
    try {
      var r = await fetch('/api/articles/list');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      arts = await r.json();
    } catch (e) { box.textContent = '⚠️ ' + e.message; return; }
    arts = (Array.isArray(arts) ? arts : []).filter(function (a) { return a && a.id && a.published !== false; })
      .sort(function (x, y) { return (y.featured ? 1 : 0) - (x.featured ? 1 : 0) || (x.featuredOrder || 0) - (y.featuredOrder || 0) || (y.created || 0) - (x.created || 0); });
    box.innerHTML = arts.map(function (a) {
      return '<div style="display:flex;gap:10px;align-items:center;border-top:1px solid var(--border-soft,#263252);padding:5px 0;font-size:13px">' +
        '<label style="flex:1;min-width:0"><input type="checkbox" class="feat-cb" data-id="' + esc(a.id) + '"' + (a.featured ? ' checked' : '') + '> ' + esc(a.title || 'Bez názvu') + '</label>' +
        '<input type="number" class="feat-ord" data-id="' + esc(a.id) + '" value="' + (a.featuredOrder || 0) + '" title="Pořadí" style="width:56px"' + (a.featured ? '' : ' disabled') + '></div>';
    }).join('') || '<p style="font-size:13px;color:var(--text-muted)">Žádné články.</p>';
    box.querySelectorAll('.feat-cb').forEach(function (cb) {
      cb.onchange = async function () {
        var ord = box.querySelector('.feat-ord[data-id="' + cb.dataset.id + '"]');
        ord.disabled = !cb.checked;
        try { await save(cb.dataset.id, { featured: cb.checked, featuredOrder: Number(ord.value) || 0 }); toast('Uloženo', 'success'); }
        catch (e) { toast('Nepovedlo se uložit: ' + e.message, 'error'); cb.checked = !cb.checked; ord.disabled = !cb.checked; }
      };
    });
    box.querySelectorAll('.feat-ord').forEach(function (inp) {
      inp.onchange = async function () {
        try { await save(inp.dataset.id, { featuredOrder: Number(inp.value) || 0 }); toast('Uloženo', 'success'); }
        catch (e) { toast('Nepovedlo se uložit: ' + e.message, 'error'); }
      };
    });
  }

  function mount() {
    var host = $('admin');
    if (!host || $('featuredBox')) return;
    var box = document.createElement('div');
    box.id = 'featuredBox';
    box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">🌟 Začni tady</h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.6rem">Vyber články, které chceš ukázat novým čtenářům na stránce Nejčtenější.</p>' +
      '<button class="btn btn-sm" id="featuredBtn">🌟 Načíst články</button>' +
      '<div id="featuredList" style="margin-top:.6rem"></div>';
    host.appendChild(box);
    $('featuredBtn').onclick = load;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
