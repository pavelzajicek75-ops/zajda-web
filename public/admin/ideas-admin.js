/* 💡 Rozepsané nápady — rychlé poznámky jen pro tebe. Jedním klikem z nich
   uděláš koncept článku (skrytý, dokud ho nezveřejníš). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }
  function fmt(ts) { try { return new Date(ts).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { return ''; } }
  var ideas = [];

  async function post(body) {
    var r = await fetch('/api/ideas/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }

  function render() {
    var box = $('ideasList');
    if (!box) return;
    box.innerHTML = ideas.length ? ideas.map(function (i) {
      return '<div style="border-top:1px solid var(--border-soft,#263252);padding:8px 0;font-size:13px">' +
        '<div style="white-space:pre-wrap">' + esc(i.text) + '</div>' +
        '<div style="margin-top:4px;color:var(--text-muted)">' + fmt(i.created) + ' ' +
        '<button class="btn btn-blue btn-sm" data-act="draft" data-id="' + esc(i.id) + '">📝 Na koncept</button> ' +
        '<button class="btn btn-sm" data-act="edit" data-id="' + esc(i.id) + '">✏️ Upravit</button> ' +
        '<button class="btn btn-sm" data-act="delete" data-id="' + esc(i.id) + '">Smazat</button></div></div>';
    }).join('') : '<p style="font-size:13px;color:var(--text-muted)">Zatím žádné nápady.</p>';
    box.querySelectorAll('button[data-act]').forEach(function (b) {
      b.onclick = async function () {
        var it = ideas.filter(function (x) { return x.id === b.dataset.id; })[0];
        if (!it) return;
        b.disabled = true;
        try {
          if (b.dataset.act === 'delete') {
            if (!confirm('Smazat tenhle nápad?')) { b.disabled = false; return; }
            ideas = (await post({ action: 'delete', id: it.id })).ideas;
          } else if (b.dataset.act === 'edit') {
            var t = prompt('Upravit nápad:', it.text);
            if (t === null) { b.disabled = false; return; }
            ideas = (await post({ action: 'edit', id: it.id, text: t })).ideas;
          } else {
            var firstLine = it.text.split('\n')[0].slice(0, 80);
            var p = new Date(), pad = function (n) { return String(n).padStart(2, '0'); };
            var r = await fetch('/api/articles/create', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: firstLine, content: '<p>' + esc(it.text).replace(/\n/g, '<br>') + '</p>', published: false, date: p.getFullYear() + '-' + pad(p.getMonth() + 1) + '-' + pad(p.getDate()) })
            });
            if (!r.ok) throw new Error('Koncept se nepodařilo vytvořit (HTTP ' + r.status + ')');
            ideas = (await post({ action: 'delete', id: it.id })).ideas;
            toast('Koncept vytvořen — najdeš ho mezi články (obnov seznam článků).', 'success');
          }
          render();
        } catch (e) { toast('Nepovedlo se: ' + e.message, 'error'); b.disabled = false; }
      };
    });
  }

  async function load() {
    try {
      var r = await fetch('/api/ideas/list');
      if (!r.ok) return;
      ideas = await r.json();
      render();
    } catch (e) { /* offline / nepřihlášen */ }
  }

  function mount() {
    var host = $('admin');
    if (!host || $('ideasBox')) return;
    var box = document.createElement('div');
    box.id = 'ideasBox';
    box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">💡 Rozepsané nápady</h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.6rem">Rychlé poznámky na články, jen pro tebe. Jedním klikem z nich uděláš koncept.</p>' +
      '<textarea id="ideaText" rows="2" maxlength="1000" placeholder="Co tě napadlo?" style="width:100%;margin-bottom:.4rem"></textarea>' +
      '<button class="btn btn-blue btn-sm" id="ideaAdd">➕ Přidat nápad</button>' +
      '<div id="ideasList" style="margin-top:.6rem"></div>';
    host.appendChild(box);
    $('ideaAdd').onclick = async function () {
      var t = $('ideaText').value;
      if (t.trim().length < 2) return;
      this.disabled = true;
      try { ideas = (await post({ action: 'add', text: t })).ideas; $('ideaText').value = ''; render(); toast('Nápad uložen', 'success'); }
      catch (e) { toast('Nepovedlo se: ' + e.message, 'error'); }
      this.disabled = false;
    };
    setTimeout(load, 1200);
    setTimeout(load, 6000); // po případném pozdějším přihlášení
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
