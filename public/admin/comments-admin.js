/* Komentáře v administraci: fronta ke schválení + smazání už schválených. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }
  function fmt(ts) { try { return new Date(ts).toLocaleString('cs', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }

  async function act(body) {
    var r = await fetch('/api/comments/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) { var j = await r.json().catch(function () { return {}; }); throw new Error(j.error || ('HTTP ' + r.status)); }
  }

  async function load() {
    var box = $('commentsResult');
    box.textContent = 'Načítám…';
    var pending = [], arts = [];
    try {
      var rs = await Promise.all([fetch('/api/comments/pending'), fetch('/api/articles/list')]);
      if (!rs[0].ok) throw new Error('HTTP ' + rs[0].status);
      pending = await rs[0].json();
      arts = await rs[1].json();
    } catch (e) { box.textContent = '⚠️ ' + e.message; return; }

    var approved = [];
    (Array.isArray(arts) ? arts : []).forEach(function (a) {
      (a.comments || []).forEach(function (c) { approved.push({ a: a, c: c }); });
    });
    approved.sort(function (x, y) { return (y.c.created || 0) - (x.c.created || 0); });

    var badge = $('commentsBadge');
    if (badge) badge.textContent = pending.length ? ' (' + pending.length + ' čeká)' : '';

    box.innerHTML =
      '<h4 style="margin:.6rem 0 .4rem;font-size:14px">Čeká na schválení (' + pending.length + ')</h4>' +
      (pending.length ? pending.map(function (c) {
        return '<div style="border:1px solid var(--border-soft,#263252);border-radius:10px;padding:10px 12px;margin-bottom:8px">' +
          '<div style="font-size:12px;color:var(--text-muted)">' + esc(c.articleTitle) + ' · <b>' + esc(c.name) + '</b> · ' + fmt(c.created) + '</div>' +
          '<div style="white-space:pre-wrap;margin:6px 0">' + esc(c.text) + '</div>' +
          '<button class="btn btn-blue btn-sm" data-act="approve" data-id="' + esc(c.id) + '">✅ Schválit</button> ' +
          '<button class="btn btn-red btn-sm" data-act="reject" data-id="' + esc(c.id) + '">🗑️ Zamítnout</button></div>';
      }).join('') : '<p style="font-size:13px;color:var(--text-muted)">Nic nečeká.</p>') +
      '<h4 style="margin:1rem 0 .4rem;font-size:14px">Schválené (' + approved.length + ')</h4>' +
      (approved.length ? approved.slice(0, 30).map(function (x) {
        return '<div style="border-top:1px solid var(--border-soft,#263252);padding:8px 0;font-size:13px">' +
          '<span style="color:var(--text-muted)">' + esc(x.a.title) + ' · <b>' + esc(x.c.name) + '</b> · ' + fmt(x.c.created) + '</span><br>' + esc(x.c.text) +
          ' <button class="btn btn-sm" data-act="delete" data-id="' + esc(x.c.id) + '" data-article="' + esc(x.a.id) + '">Smazat</button></div>';
      }).join('') : '<p style="font-size:13px;color:var(--text-muted)">Žádné.</p>');

    box.querySelectorAll('button[data-act]').forEach(function (b) {
      b.onclick = async function () {
        if (b.dataset.act === 'delete' && !confirm('Opravdu smazat tenhle komentář?')) return;
        b.disabled = true;
        try {
          await act({ action: b.dataset.act, id: b.dataset.id, articleId: b.dataset.article });
          toast(b.dataset.act === 'approve' ? 'Komentář schválen' : 'Hotovo', 'success');
          load();
        } catch (e) { toast('Nepovedlo se: ' + e.message, 'error'); b.disabled = false; }
      };
    });
  }

  function mount() {
    var host = $('admin');
    if (!host || $('commentsBox')) return;
    var box = document.createElement('div');
    box.id = 'commentsBox';
    box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">💬 Komentáře<span id="commentsBadge" style="font-weight:400;color:#f59e0b"></span></h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.6rem">Komentáře čtenářů se zobrazí na webu až po tvém schválení.</p>' +
      '<button class="btn btn-sm" id="commentsBtn">💬 Načíst komentáře</button>' +
      '<div id="commentsResult" style="margin-top:.6rem"></div>';
    host.appendChild(box);
    $('commentsBtn').onclick = load;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
