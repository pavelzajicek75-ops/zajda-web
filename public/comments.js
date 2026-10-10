/* Komentáře pod článkem (veřejná stránka). Schválené komentáře přicházejí
   přímo s článkem (article.comments). Nový komentář jde do fronty a
   zobrazí se až po schválení v administraci. Vše se vkládá přes
   textContent, takže se do stránky nikdy nedostane cizí HTML. */
(function () {
  'use strict';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function fmt(ts) {
    try { return new Date(ts).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; }
  }

  function style() {
    if (document.getElementById('comments-style')) return;
    var s = document.createElement('style');
    s.id = 'comments-style';
    s.textContent =
      '.comments-section{margin:34px 0 10px;padding-top:22px;border-top:1px solid var(--panel-border,rgba(140,150,255,.18))}' +
      '.comments-section h2{font:700 20px "Space Grotesk",sans-serif;color:var(--parchment,#f8f5ef);margin-bottom:14px}' +
      '.comment{padding:12px 14px;margin-bottom:10px;border-radius:12px;background:var(--panel-solid,rgba(28,29,48,.92));border:1px solid var(--panel-border,rgba(140,150,255,.18))}' +
      '.comment-head{font-size:13px;color:var(--mist,#9aa3c0);margin-bottom:4px}.comment-head b{color:var(--nova,#2fe6c9);font-weight:600}' +
      '.comment-text{white-space:pre-wrap;word-wrap:break-word;font-size:15px;line-height:1.5;color:var(--parchment,#f8f5ef)}' +
      '.comment-form{display:grid;gap:10px;margin-top:16px}' +
      '.comment-form input,.comment-form textarea{width:100%;font:inherit;font-size:15px;padding:10px 12px;border-radius:10px;color:var(--parchment,#f8f5ef);background:rgba(255,255,255,.05);border:1px solid var(--panel-border,rgba(140,150,255,.25))}' +
      '.comment-form textarea{min-height:90px;resize:vertical}' +
      '.comment-form button{justify-self:start;font:600 14px "Space Grotesk",sans-serif;padding:10px 20px;border-radius:24px;cursor:pointer;color:#08080f;background:var(--ember,#ff7a45);border:0}' +
      '.comment-form button:disabled{opacity:.6;cursor:default}' +
      '.comment-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}' +
      '.comment-msg{font-size:14px;color:var(--nova,#2fe6c9);min-height:1.2em}.comment-msg.err{color:#ff8a8a}';
    document.head.appendChild(s);
  }

  function mount(article, container) {
    if (!article || !container || article.unlisted) return; // soukromé články bez komentářů
    if (container.querySelector('.comments-section')) return;
    style();

    var sec = el('section', 'comments-section');
    sec.setAttribute('aria-labelledby', 'commentsHeading');
    var list = Array.isArray(article.comments) ? article.comments : [];
    var h = el('h2', null, '💬 Komentáře' + (list.length ? ' (' + list.length + ')' : ''));
    h.id = 'commentsHeading';
    sec.appendChild(h);

    list.forEach(function (c) {
      var box = el('div', 'comment');
      var head = el('div', 'comment-head');
      head.appendChild(el('b', null, c.name || 'Anonym'));
      head.appendChild(document.createTextNode(' · ' + fmt(c.created)));
      box.appendChild(head);
      box.appendChild(el('div', 'comment-text', c.text || ''));
      sec.appendChild(box);
    });
    if (!list.length) sec.appendChild(el('p', 'comment-head', 'Zatím žádný komentář — buď první.'));

    var form = el('form', 'comment-form');
    form.setAttribute('novalidate', '');
    var name = el('input'); name.type = 'text'; name.maxLength = 40; name.placeholder = 'Jméno nebo přezdívka'; name.setAttribute('aria-label', 'Jméno nebo přezdívka'); name.autocomplete = 'nickname';
    var text = el('textarea'); text.maxLength = 1000; text.placeholder = 'Tvůj komentář…'; text.setAttribute('aria-label', 'Komentář');
    // Past na roboty: skryté pole, které člověk nevidí ani nevyplní.
    var hpWrap = el('div', 'comment-hp'); hpWrap.setAttribute('aria-hidden', 'true');
    var hp = el('input'); hp.type = 'text'; hp.name = 'website'; hp.tabIndex = -1; hp.autocomplete = 'off';
    hpWrap.appendChild(hp);
    var btn = el('button', null, 'Odeslat komentář'); btn.type = 'submit';
    var msg = el('div', 'comment-msg'); msg.setAttribute('role', 'status');
    form.appendChild(name); form.appendChild(text); form.appendChild(hpWrap); form.appendChild(btn); form.appendChild(msg);
    sec.appendChild(form);
    sec.appendChild(el('p', 'comment-head', 'Komentáře se zobrazí po schválení.'));

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      msg.className = 'comment-msg'; msg.textContent = '';
      if (!name.value.trim() || text.value.trim().length < 2) {
        msg.className = 'comment-msg err'; msg.textContent = 'Vyplň jméno i komentář.'; return;
      }
      btn.disabled = true;
      fetch('/api/comments/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: article.id, name: name.value, text: text.value, website: hp.value })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok) {
            msg.textContent = '✅ Díky! Komentář se objeví po schválení.';
            text.value = '';
          } else {
            msg.className = 'comment-msg err'; msg.textContent = (res.j && res.j.error) || 'Odeslání se nepovedlo.';
          }
        })
        .catch(function () { msg.className = 'comment-msg err'; msg.textContent = 'Odeslání se nepovedlo, zkus to znovu.'; })
        .then(function () { btn.disabled = false; });
    });

    container.appendChild(sec);
  }

  window.ArticleComments = { mount: mount };
})();
