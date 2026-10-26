/* 🔔 Upozornění na nové články: tlačítko pro čtenáře (Android Chrome i počítač;
   na iPhonu jen když je blog přidaný na plochu). Nic se neposílá, dokud čtenář nepovolí. */
(function () {
  'use strict';
  function isIOS() { return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1); }
  function supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function u8(b64) {
    var s = (b64 + '===='.slice(0, (4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(s), out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
  }
  async function reg() { return navigator.serviceWorker.ready; }
  async function current() { try { var r = await reg(); return await r.pushManager.getSubscription(); } catch (e) { return null; } }

  async function subscribe() {
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('denied');
    var k = await (await fetch('/api/push/key')).json();
    var r = await reg();
    var sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(k.publicKey) });
    var res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: { endpoint: sub.endpoint } }) });
    if (!res.ok) { try { await sub.unsubscribe(); } catch (e) {} throw new Error('server'); }
  }
  async function unsubscribe() {
    var sub = await current(); if (!sub) return;
    var ep = sub.endpoint;
    try { await sub.unsubscribe(); } catch (e) {}
    try { await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unsubscribe: true, endpoint: ep }) }); } catch (e) {}
  }

  async function mount(btn, msg) {
    if (!btn) return;
    if (!supported()) { btn.hidden = true; if (msg) msg.textContent = isIOS() ? 'Na iPhonu a iPadu nejdřív přidej blog na plochu (Sdílet → Přidat na plochu) a otevři ho odtamtud, pak půjdou upozornění zapnout.' : 'Tenhle prohlížeč upozornění nepodporuje.'; return; }
    async function paint() {
      var sub = await current(), denied = Notification.permission === 'denied';
      btn.hidden = false; btn.disabled = false;
      btn.querySelector('span').textContent = denied ? 'Upozornění jsou zablokovaná v prohlížeči' : (sub ? 'Vypnout upozornění' : 'Upozornit mě na nové články');
      btn.firstChild.textContent = sub ? '🔕 ' : '🔔 ';
      btn.disabled = denied; btn.setAttribute('aria-pressed', sub ? 'true' : 'false');
    }
    btn.onclick = async function () {
      btn.disabled = true;
      try { if (await current()) { await unsubscribe(); if (msg) msg.textContent = 'Upozornění vypnutá.'; } else { await subscribe(); if (msg) msg.textContent = 'Hotovo — dám ti vědět, až bude něco nového.'; } }
      catch (e) { if (msg) msg.textContent = e && e.message === 'denied' ? 'Upozornění nebyla povolena.' : 'Nepodařilo se to zapnout, zkus to později.'; }
      paint();
    };
    paint();
  }
  window.PushSub = { mount: mount, supported: supported, isIOS: isIOS };
})();
