/* Automatické zálohy do R2: týdně se vytvoří sama po přihlášení do adminu,
   drží se posledních N (výchozí 4). Odtud jde zálohu stáhnout nebo z ní obnovit. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmt(ts) { try { return new Date(ts).toLocaleString('cs', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function size(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' kB'; }

  async function post(body) {
    var r = await fetch('/api/data/auto-backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return j;
  }

  function render(j) {
    var box = $('autoBackupList');
    if (!box) return;
    box.innerHTML = (j.backups.length ? j.backups.map(function (b) {
      return '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--border-soft,#263252);padding:6px 0;font-size:13px">' +
        '<span style="flex:1;min-width:150px">' + fmt(b.uploaded) + ' <span style="color:var(--text-muted)">· ' + size(b.size) + (b.counts ? ' · ' + b.counts.a + ' článků, ' + b.counts.t + ' milníků, ' + b.counts.s + ' sekcí, ' + b.counts.u + ' podsekcí, ' + b.counts.q + ' citátů' + (b.counts.p ? ', soupis ' + b.counts.p + ' fotek (' + b.counts.pm + ' MB, samotné fotky v záloze nejsou)' : '') : '') + '</span></span>' +
        '<button class="btn btn-sm" data-act="dl" data-key="' + esc(b.key) + '">⬇️ Stáhnout</button> ' +
        '<button class="btn btn-sm" data-act="restore" data-key="' + esc(b.key) + '">♻️ Obnovit z této</button></div>';
    }).join('') : '<p style="font-size:13px;color:var(--text-muted)">Zatím žádná záloha.</p>');
    var keep = $('autoBackupKeep'); if (keep) keep.value = j.keep;
    var rem = $('autoBackupRemind');
    if (rem) {
      var last = 0; try { last = Number(localStorage.getItem('lastBackupDownload')) || 0; } catch (e) {}
      var days = last ? Math.floor((Date.now() - last) / 86400000) : null;
      if (j.backups.length && (days === null || days >= 30)) {
        rem.hidden = false;
        rem.innerHTML = '⚠️ ' + (days === null ? 'Zálohu sis ještě nikdy nestáhl do svého zařízení.' : 'Poslední stažená kopie je stará ' + days + ' dní.') +
          ' Stáhni si ji, ať máš texty i mimo Cloudflare. <button class="btn btn-blue btn-sm" id="autoBackupDlLatest">⬇️ Stáhnout nejnovější</button>';
        $('autoBackupDlLatest').onclick = function () {
          var first = box.querySelector('button[data-act="dl"]'); if (first) first.click();
        };
      } else { rem.hidden = true; }
    }
    box.querySelectorAll('button[data-act]').forEach(function (b) {
      b.onclick = async function () {
        b.disabled = true;
        try {
          var r = await fetch('/api/data/auto-backup?key=' + encodeURIComponent(b.dataset.key));
          if (!r.ok) throw new Error('HTTP ' + r.status);
          var data = await r.json();
          if (b.dataset.act === 'dl') {
            try { localStorage.setItem('lastBackupDownload', String(Date.now())); } catch (e) {}
            var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = b.dataset.key.replace('backups/', '');
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
          } else if (window.RestoreAdmin) {
            await window.RestoreAdmin.useBackup(data);
          }
        } catch (e) { toast('Nepovedlo se: ' + e.message, 'error'); }
        b.disabled = false;
      };
    });
  }

  async function refresh() {
    try { var r = await fetch('/api/data/auto-backup'); if (r.ok) render(await r.json()); } catch (e) {}
  }

  // Tichá týdenní záloha po přihlášení.
  async function auto() {
    try {
      var j = await post({});
      if (j.created) toast('💾 Týdenní záloha vytvořena' + (j.warnings && j.warnings.length ? ' (upozornění: ' + j.warnings.length + ' — viz konzole)' : ''), j.warnings && j.warnings.length ? 'info' : 'success');
      if (j.warnings && j.warnings.length) console.warn('Záloha:', j.warnings);
      render(j);
    } catch (e) { if (e && e.status && e.status !== 401) toast('Automatická záloha selhala: ' + e.message, 'error'); /* nepřihlášen / offline — ticho */ }
  }

  function mount() {
    var host = $('admin');
    if (!host || $('autoBackupBox')) return;
    var box = document.createElement('div');
    box.id = 'autoBackupBox';
    box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">💾 Automatické zálohy</h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.6rem">Jednou za týden se při vstupu do administrace sama uloží záloha textů a dat (bez fotek). Drží se jen posledních několik, starší se mažou.</p>' +
      '<div id="autoBackupRemind" hidden style="background:rgba(245,158,11,.12);border:1px solid #f59e0b;border-radius:8px;padding:8px 12px;margin-bottom:.6rem;font-size:13px"></div>' +
      '<button class="btn btn-blue btn-sm" id="autoBackupNow">💾 Zálohovat teď</button> ' +
      '<label style="font-size:13px;margin-left:8px">Držet posledních <input type="number" id="autoBackupKeep" min="1" max="12" value="4" style="width:56px"> záloh</label> ' +
      '<button class="btn btn-sm" id="autoBackupSave">Uložit počet</button>' +
      '<div id="autoBackupList" style="margin-top:.6rem"></div>';
    host.appendChild(box);
    $('autoBackupNow').onclick = async function () {
      var b = this; b.disabled = true;
      try { var j = await post({ force: true }); render(j); toast('Záloha vytvořena', 'success'); }
      catch (e) { toast('Záloha selhala: ' + e.message, 'error'); }
      b.disabled = false;
    };
    $('autoBackupSave').onclick = async function () {
      try { var j = await post({ keep: Number($('autoBackupKeep').value) }); render(j); toast('Uloženo', 'success'); }
      catch (e) { toast(e.message, 'error'); }
    };
    refresh();
    setTimeout(auto, 3000);
    setTimeout(auto, 8000); // po případném pozdějším přihlášení
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
