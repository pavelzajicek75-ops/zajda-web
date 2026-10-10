/* Obnova ze souboru zálohy — nejdřív náhled (nic se nezapíše), pak potvrzení.
   Nic nemaže: doplní chybějící a (jen když zaškrtneš) přepíše změněné. */
(function () {
  'use strict';
  var backup = null;

  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }

  async function call(apply) {
    var types = [].slice.call(document.querySelectorAll('.restore-type:checked')).map(function (c) { return c.value; });
    var r = await fetch('/api/data/restore', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup: backup, apply: apply, overwrite: $('restoreOverwrite') ? $('restoreOverwrite').checked : false, types: types.length ? types : undefined })
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }

  function showSummary(j) {
    var keys = Object.keys(j.summary || {});
    $('restoreSummary').innerHTML =
      '<table style="font-size:13px;border-collapse:collapse;margin:.6rem 0"><thead><tr style="text-align:left;color:var(--text-muted)">' +
      '<th style="padding:3px 10px 3px 0"></th><th style="padding:3px 10px">Nové</th><th style="padding:3px 10px">Změněné</th><th style="padding:3px 10px">Beze změny</th></tr></thead><tbody>' +
      keys.map(function (k) {
        var s = j.summary[k];
        return '<tr style="border-top:1px solid var(--border-soft,#263252)"><td style="padding:4px 10px 4px 0"><label><input type="checkbox" class="restore-type" value="' + esc(k) + '" checked> ' + esc(s.label) + '</label></td>' +
          '<td style="padding:4px 10px">' + s.new + '</td><td style="padding:4px 10px">' + s.changed + '</td><td style="padding:4px 10px;opacity:.6">' + s.same + '</td></tr>' +
          (s.names.length ? '<tr><td colspan="4" style="font-size:12px;color:var(--text-muted);padding:0 0 4px 22px">' + s.names.map(esc).join(', ') + '</td></tr>' : '');
      }).join('') + '</tbody></table>' +
      '<label style="font-size:13px;display:block;margin:.3rem 0"><input type="checkbox" id="restoreOverwrite"> Přepsat i změněné položky verzí ze zálohy (jinak se jen doplní chybějící)</label>' +
      (j.skipped && j.skipped.length ? '<p style="font-size:12px;color:#f59e0b">Přeskočeno: ' + esc(j.skipped.join('; ')) + '</p>' : '') +
      '<button class="btn btn-blue btn-sm" id="restoreApplyBtn">⬆️ Obnovit</button> ' +
      '<span id="restoreCount" style="font-size:12px;color:var(--text-muted)"></span>';
    var refresh = async function () {
      try { var p = await call(false); $('restoreCount').textContent = 'Zapíše se ' + p.writes + ' položek (limit ' + p.maxWrites + ').'; } catch (e) { $('restoreCount').textContent = e.message; }
    };
    $('restoreSummary').querySelectorAll('input[type=checkbox]').forEach(function (c) { c.onchange = refresh; });
    $('restoreApplyBtn').onclick = async function () {
      var b = this;
      var ow = $('restoreOverwrite').checked;
      if (!confirm('Opravdu obnovit ze zálohy?' + (ow ? '\n\nPOZOR: změněné položky se přepíšou verzí ze zálohy.' : '\n\nPřidají se jen chybějící položky, nic se nepřepíše ani nesmaže.'))) return;
      b.disabled = true;
      try {
        var res = await call(true);
        toast('Obnoveno: zapsáno ' + res.written + ' položek.', 'success');
        $('restoreCount').textContent = '✅ Zapsáno ' + res.written + ' položek. Obnov stránku, ať vidíš změny.';
      } catch (e) { toast('Obnova selhala: ' + e.message, 'error'); b.disabled = false; }
    };
    refresh();
  }

  function mount() {
    var host = $('admin');
    if (!host || $('restoreBox')) return;
    var box = document.createElement('div');
    box.id = 'restoreBox';
    box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">♻️ Obnovit ze zálohy</h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.6rem">Vyber soubor zálohy (stažený tlačítkem „Stáhnout zálohu všeho“). Nejdřív se jen ukáže, co by se změnilo — nic se nezapíše, dokud nepotvrdíš. Fotky samotné záloha neobsahuje, ty zůstávají v úložišti.</p>' +
      '<input type="file" id="restoreFile" accept="application/json,.json">' +
      '<div id="restoreSummary"></div>';
    host.appendChild(box);
    $('restoreFile').onchange = function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = async function () {
        try { backup = JSON.parse(rd.result); } catch (e) { toast('Soubor není platný JSON.', 'error'); return; }
        $('restoreSummary').textContent = 'Kontroluji…';
        try { showSummary(await call(false)); } catch (e) { $('restoreSummary').textContent = '⚠️ ' + e.message; }
      };
      rd.readAsText(f);
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
