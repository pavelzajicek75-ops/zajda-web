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
  // Po zveřejnění nabídne rozeslat oznámení hned (naplánované články zůstávají ruční).
  window.offerReaderPush = async function (id, title) {
    if (!id) return;
    try {
      var info = await (await fetch('/api/push/send')).json();
      if (!info || !info.subscribers) return; // nikdo odebírá → neptáme se
      var ok = typeof showConfirm === 'function' && await showConfirm('Poslat čtenářům upozornění („' + (title || 'nový článek') + '“)? Odběratelů: ' + info.subscribers, { confirmText: 'Poslat', cancelText: 'Teď ne' });
      if (!ok) return;
      var r = await fetch('/api/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ articleId: id }) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
      toast('Upozornění odesláno: ' + j.sent + ' z ' + j.total, 'success');
    } catch (e) { toast('Upozornění se nepodařilo poslat: ' + e.message, 'error'); }
  };

  // === Upozornění pro správce na tomhle zařízení ===
  function u8(b64) {
    var s = (b64 + '===='.slice(0, (4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(s), out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
  }
  function pushOk() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  async function setFlag(on) {
    try { var c = await caches.open('zajda-flags'); if (on) await c.put('/__admin-device', new Response('1')); else await c.delete('/__admin-device'); } catch (e) {}
  }
  async function adminSub() { try { return await (await navigator.serviceWorker.ready).pushManager.getSubscription(); } catch (e) { return null; } }
  async function paintAdmin() {
    var b = $('adminPushBtn'), m = $('adminPushMsg'); if (!b) return;
    if (!pushOk()) { b.hidden = true; m.textContent = 'Tohle zařízení upozornění nepodporuje (na iPhonu přidej blog na plochu).'; return; }
    var sub = await adminSub(), on = false;
    if (sub) { try { var inList = await (await fetch('/api/push/admin-subscribe')).json(); on = !!(await caches.match('/__admin-device', { cacheName: 'zajda-flags' })) && inList.count > 0; } catch (e) {} }
    b.textContent = on ? '🔕 Vypnout upozornění na tomhle zařízení' : '🔔 Zapnout upozornění na tomhle zařízení';
    b.dataset.on = on ? '1' : '';
    m.textContent = on ? 'Na tomhle zařízení ti zazvoní nový komentář i zpráva z „Napiš mi“.' : 'Dostaneš upozornění, když někdo napíše komentář nebo zprávu.';
  }
  async function toggleAdmin() {
    var b = $('adminPushBtn'); b.disabled = true;
    try {
      if (b.dataset.on) {
        var s0 = await adminSub();
        if (s0) await fetch('/api/push/admin-subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unsubscribe: true, endpoint: s0.endpoint }) });
        await setFlag(false); toast('Upozornění pro správce vypnutá', 'info');
      } else {
        if ((await Notification.requestPermission()) !== 'granted') throw new Error('Upozornění nejsou povolená v prohlížeči');
        var k = await (await fetch('/api/push/key')).json();
        var reg = await navigator.serviceWorker.ready;
        var sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(k.publicKey) });
        var res = await fetch('/api/push/admin-subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: { endpoint: sub.endpoint } }) });
        if (!res.ok) throw new Error('Server odmítl odběr');
        await setFlag(true); toast('Upozornění pro správce zapnutá', 'success');
      }
    } catch (e) { toast(e.message || 'Nepodařilo se', 'error'); }
    b.disabled = false; paintAdmin();
  }

  function mount() {
    var host = $('admin'); if (!host || $('pushBox')) return;
    var box = document.createElement('div'); box.id = 'pushBox'; box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">📣 Oznámit nový článek</h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.4rem">Čtenáři si upozornění zapnou na stránce „Sleduj blog“. Tady vybereš zveřejněný článek a pošleš jim oznámení.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><select id="pushArticle" aria-label="Článek k oznámení" style="flex:1;min-width:220px"><option value="">— vyber článek —</option></select>' +
      '<button class="btn btn-blue btn-sm" id="pushSend">📣 Poslat oznámení</button></div><div id="pushInfo" style="margin-top:.4rem;font-size:12.5px;color:var(--text-muted)"></div>' +
      '<h4 style="margin:1rem 0 .3rem">🔔 Upozornění pro mě (správce)</h4><button class="btn btn-sm" id="adminPushBtn" style="margin-right:8px">…</button><span id="adminPushMsg" style="font-size:12.5px;color:var(--text-muted)"></span>';
    host.appendChild(box); $('pushSend').onclick = send; $('adminPushBtn').onclick = toggleAdmin; paintAdmin(); loadArticles(); refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
