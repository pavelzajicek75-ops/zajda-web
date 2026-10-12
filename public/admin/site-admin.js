/* ⚙️ Nastavení webu: stav dne na úvodní stránce, zapnutí soukromých zpráv
   a odkazy pro „Sleduj blog“. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }
  var EMOJIS = ['☀️', '🙂', '😴', '🤒', '🌧️', '💪', '🚗', '✍️'];

  async function save(body) {
    var r = await fetch('/api/site/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j.site;
  }

  var pinnedWanted = '';
  function fillPinned(id) {
    pinnedWanted = id; var sel = $('sitePinned'); if (sel) sel.value = id;
  }
  async function loadArticles() {
    var sel = $('sitePinned'); if (!sel) return;
    try {
      var r = await fetch('/api/articles/list'); if (!r.ok) return;
      var arr = await r.json();
      arr.filter(function (a) { return a && a.published !== false && !a.unlisted; }).slice(0, 80).forEach(function (a) {
        var o = document.createElement('option'); o.value = a.id; o.textContent = (a.title || a.id).slice(0, 80); sel.appendChild(o);
      });
      sel.value = pinnedWanted;
    } catch (e) {}
  }

  function fill(site) {
    var st = site.status || {};
    $('siteStatusText').value = st.text || '';
    $('siteStatusEmoji').value = st.emoji || '';
    fillPinned(site.pinnedId || '');
    $('siteMessages').checked = site.messagesEnabled === true;
    ['whatsapp', 'messenger', 'instagram', 'facebook'].forEach(function (k) { $('siteFollow_' + k).value = (site.follow && site.follow[k]) || ''; });
  }

  async function load() {
    try {
      var r = await fetch('/api/site/info', { cache: 'no-store' });
      if (r.ok) fill(await r.json());
    } catch (e) {}
  }

  function mount() {
    var host = $('admin');
    if (!host || $('siteBox')) return;
    var box = document.createElement('div');
    box.id = 'siteBox';
    box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">⚙️ Nastavení webu</h3>' +
      '<h4 style="margin:.4rem 0;font-size:14px">Stav dne (na úvodní stránce)</h4>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.4rem">Jedna krátká věta, jak se dnes máš. Prázdné = nezobrazí se nic. Po 14 dnech se skryje sama.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><select id="siteStatusEmoji"><option value="">—</option>' + EMOJIS.map(function (e) { return '<option>' + e + '</option>'; }).join('') + '</select>' +
      '<input type="text" id="siteStatusText" maxlength="140" placeholder="Dnes dobrý den, jdu na procházku" style="flex:1;min-width:200px"></div>' +
      '<h4 style="margin:1rem 0 .4rem;font-size:14px">Připnutý článek (nahoře na úvodní stránce)</h4>' +
      '<select id="sitePinned" aria-label="Připnutý článek" style="width:100%"><option value="">— žádný —</option></select>' +
      '<h4 style="margin:1rem 0 .4rem;font-size:14px">Soukromé zprávy („Napiš mi“)</h4>' +
      '<label style="font-size:13px"><input type="checkbox" id="siteMessages"> Zapnout veřejný formulář /napis-mi (zprávy uvidíš jen ty)</label>' +
      '<h4 style="margin:1rem 0 .4rem;font-size:14px">Odkazy „Sleduj blog“ (jen https://, prázdné se nezobrazí)</h4>' +
      ['whatsapp:WhatsApp kanál / skupina', 'messenger:Messenger', 'instagram:Instagram', 'facebook:Facebook'].map(function (x) {
        var p = x.split(':');
        return '<div style="margin-bottom:6px"><input type="url" id="siteFollow_' + p[0] + '" placeholder="' + esc(p[1]) + ' — https://…" style="width:100%"></div>';
      }).join('') +
      '<button class="btn btn-blue btn-sm" id="siteSave" style="margin-top:.5rem">💾 Uložit nastavení</button>';
    host.appendChild(box);
    $('siteSave').onclick = async function () {
      var b = this; b.disabled = true;
      try {
        var text = $('siteStatusText').value.trim();
        var site = await save({
          status: text ? { text: text, emoji: $('siteStatusEmoji').value } : null,
          pinnedId: $('sitePinned').value,
          messagesEnabled: $('siteMessages').checked,
          follow: { whatsapp: $('siteFollow_whatsapp').value, messenger: $('siteFollow_messenger').value, instagram: $('siteFollow_instagram').value, facebook: $('siteFollow_facebook').value }
        });
        fill(site); toast('Nastavení uloženo', 'success');
      } catch (e) { toast('Nepovedlo se uložit: ' + e.message, 'error'); }
      b.disabled = false;
    };
    load(); loadArticles();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
