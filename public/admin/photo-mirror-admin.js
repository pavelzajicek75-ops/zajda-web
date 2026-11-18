/* Zrcadlo fotek: kopie fotek z R2 do druhého bucketu (ochrana před omylem) + návrat chybějících. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }
  var busy = false;
  async function status(dir) {
    var r = await fetch('/api/photos/mirror?dir=' + dir, { cache: 'no-store' });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }
  async function refresh() {
    var el = $('pmStatus'); if (!el) return;
    try {
      var j = await status('backup');
      el.innerHTML = 'Fotek: <b>' + j.total + '</b> · v zrcadle: <b>' + j.mirrored + '</b> · ' +
        (j.missingCount ? '<span style="color:#fbbf24">chybí zkopírovat: <b>' + j.missingCount + '</b></span>' : '<span style="color:#86efac">✓ vše zrcadleno</span>') +
        (j.more ? ' <small>(velké úložiště, údaj je částečný)</small>' : '');
      $('pmGo').disabled = !j.missingCount;
    } catch (e) { el.textContent = '⚠️ ' + e.message; }
  }
  async function run(dir) {
    if (busy) return; busy = true;
    var bar = $('pmProg'); $('pmGo').disabled = true; $('pmRestore').disabled = true;
    try {
      var done = 0, failedAll = 0;
      for (var round = 0; round < 40; round++) {
        var j = await status(dir);
        if (!j.missing.length) break;
        if (dir === 'restore' && round === 0 && !confirm('Vrátit ' + j.missingCount + ' chybějících fotek ze zrcadla do galerie?')) break;
        var total = done + j.missingCount;
        for (var i = 0; i < j.missing.length; i += 12) {
          var chunk = j.missing.slice(i, i + 12);
          var r = await fetch('/api/photos/mirror', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir: dir, keys: chunk }) });
          var p = await r.json().catch(function () { return {}; });
          if (!r.ok) throw new Error(p.error || ('HTTP ' + r.status));
          done += p.copied || 0; failedAll += (p.failed || []).length;
          bar.textContent = (dir === 'backup' ? 'Kopíruji… ' : 'Vracím… ') + done + ' / ' + total;
        }
        if (failedAll && failedAll >= j.missing.length) break; /* nic se nedaří → nezacyklit */
      }
      bar.textContent = '✅ Hotovo: ' + done + ' fotek' + (failedAll ? ' (nepovedlo se: ' + failedAll + ')' : '') + '.';
      toast(dir === 'backup' ? 'Fotky zrcadleny' : 'Fotky vráceny', 'success');
    } catch (e) { bar.textContent = '⚠️ ' + e.message; toast('Chyba: ' + e.message, 'error'); }
    busy = false; $('pmRestore').disabled = false; refresh();
  }
  function mount() {
    var host = $('admin'); if (!host || $('photoMirrorBox')) return;
    var box = document.createElement('div'); box.id = 'photoMirrorBox'; box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">📸 Zrcadlo fotek</h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.6rem">Zkopíruje všechny fotky z galerie do druhého úložiště na Cloudflaru. Když fotku omylem smažeš nebo přepíšeš, vrátíš ji odsud. (Úplná záloha mimo Cloudflare je „Záloha všeho na disk“.) Kopíruje se jen to, co ještě chybí.</p>' +
      '<div id="pmStatus" style="font-size:13px;margin-bottom:.5rem">Načítám…</div>' +
      '<button class="btn btn-blue btn-sm" id="pmGo">⬆️ Zkopírovat chybějící fotky</button> ' +
      '<button class="btn btn-sm" id="pmRestore">↩️ Vrátit chybějící fotky ze zrcadla</button> ' +
      '<button class="btn btn-sm" id="pmReload">🔄</button>' +
      '<div id="pmProg" style="font-size:13px;margin-top:.5rem"></div>';
    host.appendChild(box);
    $('pmGo').onclick = function () { run('backup'); };
    $('pmRestore').onclick = function () { run('restore'); };
    $('pmReload').onclick = refresh;
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
