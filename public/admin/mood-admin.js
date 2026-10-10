/* Soukromý deník nálady — jen v administraci, nikdo jiný ho neuvidí.
   Jeden záznam na den: nálada 1–5, energie 1–5 (nepovinné) a poznámka. */
(function () {
  'use strict';
  var FACES = ['😞', '😕', '😐', '🙂', '😄'];
  var entries = [], pickedMood = 0;

  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }
  function todayStr() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function dayLabel(s) { var d = new Date(s + 'T12:00:00'); return d.getDate() + '. ' + (d.getMonth() + 1) + '.'; }

  async function load() {
    var r = await fetch('/api/mood/list');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var data = await r.json();
    entries = Array.isArray(data) ? data : [];
    render();
  }

  function pickMood(n) {
    pickedMood = n;
    document.querySelectorAll('#moodFaces button').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.n === n)); b.style.opacity = (+b.dataset.n === n) ? '1' : '.45'; });
  }

  function fillForm(date) {
    var e = entries.filter(function (x) { return x.date === date; })[0];
    $('moodDate').value = date;
    $('moodEnergy').value = e && e.energy ? String(e.energy) : '';
    $('moodNote').value = e ? e.note || '' : '';
    pickMood(e ? e.mood : 0);
  }

  function render() {
    // posledních 30 dní jako sloupce nálady
    var days = [];
    for (var i = 29; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var p = function (n) { return String(n).padStart(2, '0'); };
      days.push(d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()));
    }
    var byDate = {}; entries.forEach(function (e) { byDate[e.date] = e; });
    $('moodChart').innerHTML = days.map(function (ds) {
      var e = byDate[ds];
      var h = e ? e.mood * 20 : 0;
      var col = !e ? 'transparent' : (e.mood >= 4 ? '#22c55e' : (e.mood === 3 ? '#f59e0b' : '#ef4444'));
      return '<div title="' + esc(dayLabel(ds) + (e ? ': ' + FACES[e.mood - 1] + (e.note ? ' ' + e.note : '') : ': bez záznamu')) + '" style="flex:1;height:100%;display:flex;align-items:flex-end">' +
        '<div style="width:100%;height:' + h + '%;background:' + col + ';border-radius:4px 4px 1px 1px;min-height:' + (e ? 3 : 0) + 'px"></div></div>';
    }).join('');

    var recent = entries.slice(-30);
    var avg = recent.length ? (recent.reduce(function (n, e) { return n + e.mood; }, 0) / recent.length) : 0;
    $('moodSummary').textContent = recent.length
      ? 'Posledních 30 dní: ' + recent.length + ' záznamů, průměrná nálada ' + avg.toFixed(1).replace('.', ',') + ' / 5 ' + FACES[Math.max(0, Math.round(avg) - 1)]
      : 'Zatím žádné záznamy.';

    $('moodList').innerHTML = entries.slice(-10).reverse().map(function (e) {
      return '<div style="display:flex;gap:8px;align-items:baseline;padding:5px 0;border-top:1px solid var(--border-soft,#263252);font-size:13.5px">' +
        '<span style="min-width:48px;color:var(--text-muted)">' + esc(dayLabel(e.date)) + '</span><span>' + FACES[e.mood - 1] + '</span>' +
        (e.energy ? '<span style="color:var(--text-muted)">⚡' + e.energy + '</span>' : '') +
        '<span style="flex:1">' + esc(e.note) + '</span>' +
        '<button class="btn btn-sm" data-edit="' + esc(e.date) + '">Upravit</button> <button class="btn btn-sm" data-del="' + esc(e.date) + '">✕</button></div>';
    }).join('');
    $('moodList').querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { fillForm(b.dataset.edit); window.scrollTo({ top: $('moodBox').offsetTop - 20, behavior: 'smooth' }); }; });
    $('moodList').querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = async function () {
        if (!confirm('Smazat záznam ze dne ' + dayLabel(b.dataset.del) + '?')) return;
        try { await post({ action: 'delete', date: b.dataset.del }); await load(); } catch (e) { toast('Nepovedlo se: ' + e.message, 'error'); }
      };
    });
  }

  async function post(body) {
    var r = await fetch('/api/mood/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) { var j = await r.json().catch(function () { return {}; }); throw new Error(j.error || ('HTTP ' + r.status)); }
  }

  async function save() {
    if (!pickedMood) return toast('Vyber náladu (obličej).', 'info');
    try {
      await post({ date: $('moodDate').value, mood: pickedMood, energy: $('moodEnergy').value || null, note: $('moodNote').value });
      toast('Uloženo', 'success');
      await load();
    } catch (e) { toast('Nepovedlo se uložit: ' + e.message, 'error'); }
  }

  function mount() {
    var host = $('admin');
    if (!host || $('moodBox')) return;
    var box = document.createElement('div');
    box.id = 'moodBox';
    box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML =
      '<h3 style="margin-bottom:.5rem">📓 Deník nálady <span style="font-weight:400;font-size:12px;color:var(--text-muted)">(soukromé, vidíš jen ty)</span></h3>' +
      '<button class="btn btn-sm" id="moodOpenBtn">📓 Otevřít deník</button>' +
      '<div id="moodBody" style="display:none;margin-top:.7rem">' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px">' +
          '<input type="date" id="moodDate" class="form-input">' +
          '<div id="moodFaces" style="display:flex;gap:4px" role="group" aria-label="Nálada">' +
            FACES.map(function (f, i) { return '<button type="button" class="btn btn-sm" data-n="' + (i + 1) + '" aria-pressed="false" title="Nálada ' + (i + 1) + '/5" style="font-size:22px;padding:2px 8px">' + f + '</button>'; }).join('') +
          '</div>' +
          '<select id="moodEnergy" class="form-select" aria-label="Energie"><option value="">⚡ Energie (nepovinné)</option>' +
            [1, 2, 3, 4, 5].map(function (n) { return '<option value="' + n + '">⚡ ' + n + ' / 5</option>'; }).join('') + '</select>' +
        '</div>' +
        '<textarea id="moodNote" class="form-input" rows="2" maxlength="500" placeholder="Poznámka (nepovinné) — jak ti bylo, co ti pomohlo…" style="width:100%;max-width:640px"></textarea>' +
        '<div style="margin:.5rem 0"><button class="btn btn-blue btn-sm" id="moodSaveBtn">💾 Uložit den</button></div>' +
        '<div id="moodSummary" style="font-size:13px;color:var(--text-muted);margin-top:.8rem"></div>' +
        '<div id="moodChart" style="display:flex;align-items:flex-end;gap:3px;height:90px;margin:.4rem 0;max-width:640px"></div>' +
        '<div id="moodList" style="max-width:640px"></div>' +
      '</div>';
    host.appendChild(box);
    $('moodOpenBtn').onclick = async function () {
      $('moodBody').style.display = '';
      this.style.display = 'none';
      fillForm(todayStr());
      try { await load(); fillForm(todayStr()); } catch (e) { toast('Deník se nepodařilo načíst: ' + e.message, 'error'); }
    };
    box.querySelectorAll('#moodFaces button').forEach(function (b) { b.onclick = function () { pickMood(+b.dataset.n); }; });
    $('moodDate').onchange = function () { fillForm($('moodDate').value); };
    $('moodSaveBtn').onclick = save;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
