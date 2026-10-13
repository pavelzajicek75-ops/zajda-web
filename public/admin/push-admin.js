/* 📣 Oznámení o novém článku: pošle odběratelům upozornění v telefonu / počítači. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }

  async function refresh() {
    try {
      var r = await fetch('/api/push/send'); if (!r.ok) return;
      var j = await r.json();
      $('pushInfo').textContent = 'Odběratelů: ' + j.subscribers + (j.last ? ' · naposledy oznámeno: „' + j.last.title + '“' : '');
    } catch (e) {}
  }
  async function loadArticles() {
    var sel = $('pushArticle'); if (!sel) return;
    try {
      var r = await fetch('/api/articles/list'); if (!r.ok) return;
      (await r.json()).filter(function (a) { return a && a.published !== false && !a.unlisted; }).slice(0, 40).forEach(function (a) {
        var o = document.createElement('option'); o.value = a.id; o.textContent = (a.title || a.id).slice(0, 80); sel.appendChild(o);
      });
    } catch (e) {}
  }
  async function send() {
    var id = $('pushArticle').value; if (!id) { toast('Vyber článek', 'info'); return; }
    var ok = typeof showConfirm === 'function' ? await showConfirm('Poslat všem odběratelům oznámení o tomto článku?', { confirmText: 'Poslat', cancelText: 'Zrušit' }) : true;
    if (!ok) return;
    var b = $('pushSend'); b.disabled = true;
    try {
      var r = await fetch('/api/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ articleId: id }) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
      toast('Odesláno: ' + j.sent + ' z ' + j.total + (j.removed ? ' (odhlášených odstraněno: ' + j.removed + ')' : ''), 'success');
      refresh();
    } catch (e) { toast('Nepodařilo se odeslat: ' + e.message, 'error'); }
    b.disabled = false;
  }
  function mount() {
    var host = $('admin'); if (!host || $('pushBox')) return;
    var box = document.createElement('div'); box.id = 'pushBox'; box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">📣 Oznámit nový článek</h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.4rem">Čtenáři si upozornění zapnou na stránce „Sleduj blog“. Tady vybereš zveřejněný článek a pošleš jim oznámení.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><select id="pushArticle" aria-label="Článek k oznámení" style="flex:1;min-width:220px"><option value="">— vyber článek —</option></select>' +
      '<button class="btn btn-blue btn-sm" id="pushSend">📣 Poslat oznámení</button></div><div id="pushInfo" style="margin-top:.4rem;font-size:12.5px;color:var(--text-muted)"></div>';
    host.appendChild(box); $('pushSend').onclick = send; loadArticles(); refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
