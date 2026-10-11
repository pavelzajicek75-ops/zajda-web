/* ✉️ Soukromé zprávy od čtenářů („Napiš mi“) — vidíš je jen ty.
   Nepřečtené se ukážou jako modrý počet u záložky ADMIN. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }
  function fmt(ts) { try { return new Date(ts).toLocaleString('cs', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  var msgs = [];

  function badge() {
    var n = msgs.filter(function (m) { return !m.read; }).length;
    var h = $('messagesBadge'); if (h) h.textContent = n ? ' (' + n + ' nových)' : '';
    var tab = document.querySelector('button.ribbon-tab[data-tab="admin"]');
    if (tab) {
      var old = tab.querySelector('.msg-badge'); if (old) old.remove();
      if (n) {
        var b = document.createElement('span'); b.className = 'msg-badge'; b.textContent = '✉️' + n; b.title = 'Nepřečtené soukromé zprávy';
        b.style.cssText = 'background:#38bdf8;color:#000;border-radius:10px;padding:0 6px;margin-left:6px;font-size:11px;font-weight:700';
        tab.appendChild(b);
      }
    }
  }

  async function post(body) {
    var r = await fetch('/api/messages/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j.messages;
  }

  function render() {
    var box = $('messagesList'); if (!box) return;
    box.innerHTML = msgs.length ? msgs.map(function (m) {
      return '<div style="border:1px solid var(--border-soft,#263252);border-radius:10px;padding:10px 12px;margin-bottom:8px;' + (m.read ? 'opacity:.7' : '') + '">' +
        '<div style="font-size:12px;color:var(--text-muted)">' + (m.read ? '' : '🔵 ') + '<b>' + esc(m.name || 'Anonym') + '</b>' + (m.contact ? ' · ' + esc(m.contact) : '') + ' · ' + fmt(m.created) + '</div>' +
        '<div style="white-space:pre-wrap;margin:6px 0;font-size:14px">' + esc(m.text) + '</div>' +
        '<button class="btn btn-sm" data-act="read" data-id="' + esc(m.id) + '" data-read="' + (m.read ? '0' : '1') + '">' + (m.read ? 'Označit jako nepřečtené' : '✅ Přečteno') + '</button> ' +
        '<button class="btn btn-red btn-sm" data-act="delete" data-id="' + esc(m.id) + '">🗑️ Smazat</button></div>';
    }).join('') : '<p style="font-size:13px;color:var(--text-muted)">Žádné zprávy.</p>';
    box.querySelectorAll('button[data-act]').forEach(function (b) {
      b.onclick = async function () {
        if (b.dataset.act === 'delete' && !confirm('Opravdu smazat tuhle zprávu?')) return;
        b.disabled = true;
        try { msgs = await post({ action: b.dataset.act, id: b.dataset.id, read: b.dataset.read === '1' }); render(); badge(); }
        catch (e) { toast('Nepovedlo se: ' + e.message, 'error'); b.disabled = false; }
      };
    });
    badge();
  }

  async function load(silent) {
    try {
      var r = await fetch('/api/messages/list');
      if (!r.ok) { if (!silent) toast('Zprávy se nepodařilo načíst (HTTP ' + r.status + ')', 'error'); return; }
      var prev = msgs.filter(function (m) { return !m.read; }).length;
      msgs = await r.json();
      render();
      var now = msgs.filter(function (m) { return !m.read; }).length;
      if (silent && now && !prev) {
        var seen = false; try { seen = sessionStorage.getItem('msg-notified') === '1'; } catch (e) {}
        if (!seen) { toast('✉️ Máš ' + now + ' nepřečtených soukromých zpráv', 'info'); try { sessionStorage.setItem('msg-notified', '1'); } catch (e) {} }
      }
    } catch (e) { /* offline / nepřihlášen */ }
  }

  function mount() {
    var host = $('admin');
    if (!host || $('messagesBox')) return;
    var box = document.createElement('div');
    box.id = 'messagesBox';
    box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">✉️ Soukromé zprávy<span id="messagesBadge" style="font-weight:400;color:#38bdf8"></span></h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.6rem">Zprávy z formuláře „Napiš mi“ (zapíná se v Nastavení webu). Vidíš je jen ty.</p>' +
      '<button class="btn btn-sm" id="messagesBtn">✉️ Načíst zprávy</button><div id="messagesList" style="margin-top:.6rem"></div>';
    host.appendChild(box);
    $('messagesBtn').onclick = function () { load(false); };
    setTimeout(function () { load(true); }, 2000);
    setTimeout(function () { load(true); }, 7000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
