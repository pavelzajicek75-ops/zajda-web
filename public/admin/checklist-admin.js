/* ✅ Kontrolní seznam „testovací den“ — odškrtáváš, co jsi na živém webu vyzkoušel (ukládá se v tomhle prohlížeči). */
(function () {
  'use strict';
  var KEY = 'zajdaChecklist';
  var ITEMS = [
    'Světlý / tmavý režim: tlačítko přepne a po obnovení zůstane',
    'Vyhledávání na úvodní stránce najde článek i s překlepem',
    'Odznak „NOVÉ“ se ukáže u článku, který jsi ještě neviděl',
    'Fotky na mobilu se načtou rychle (nejdřív náhled, pak plná)',
    'Čtenářská upozornění: na „Sleduj blog“ je zapneš a přijde testovací oznámení',
    'Upozornění pro správce: pošli si z jiného zařízení komentář → zazvoní',
    'Zpráva „Napiš mi“ dorazí do Zpráv v adminu',
    'Komentář čeká na schválení a po schválení se zobrazí',
    'Nový článek: kontrola před zveřejněním se ukáže',
    'Po zveřejnění článku se nabídne upozornění čtenářům',
    'Historie verzí: změň článek a vrať starší verzi',
    'Záloha: „Zálohovat teď“ proběhne bez chyby',
    'Stažení zálohy do počítače funguje',
    'Obnova ze zálohy: vyzkoušej na čerstvé záloze (nic se neztratí)',
    'Přehledy: spotřeba KV se zobrazuje, zápisy jsou pod limitem',
    'Připnutý článek je nahoře na úvodní stránce',
    'Sdílecí obrázek v „Rok“ se stáhne',
    'Zvuk nebo video vložené do článku se přehraje'
  ];
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  function mount() {
    var host = document.getElementById('admin'); if (!host || document.getElementById('checklistBox')) return;
    var box = document.createElement('div'); box.id = 'checklistBox'; box.style.cssText = 'margin:0 0 2rem';
    var st = load();
    function paint() {
      var done = ITEMS.filter(function (_, i) { return st[i]; }).length;
      box.innerHTML = '<h3 style="margin-bottom:.4rem">✅ Testovací den</h3><div style="font-size:13px;color:var(--text-muted);margin-bottom:.5rem">Splněno ' + done + ' z ' + ITEMS.length + '</div>' +
        ITEMS.map(function (t, i) { return '<label style="display:flex;gap:8px;align-items:flex-start;margin:.3rem 0;cursor:pointer"><input type="checkbox" data-i="' + i + '"' + (st[i] ? ' checked' : '') + ' style="margin-top:4px"><span' + (st[i] ? ' style="opacity:.55;text-decoration:line-through"' : '') + '>' + t.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span></label>'; }).join('') +
        '<button class="btn btn-sm" id="chkReset" style="margin-top:.6rem">Začít znovu</button>';
      box.querySelectorAll('input[type=checkbox]').forEach(function (c) { c.onchange = function () { st[c.dataset.i] = c.checked; save(st); paint(); }; });
      box.querySelector('#chkReset').onclick = function () { st = {}; save(st); paint(); };
    }
    paint(); host.appendChild(box);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
