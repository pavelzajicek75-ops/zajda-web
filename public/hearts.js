/* Srdíčko pod článkem. Pamatuje si v prohlížeči, že čtenář už dal
   (localStorage; když není, jen se nezapamatuje). */
(function () {
  'use strict';
  function mount(article, container) {
    if (!article || !container || article.unlisted || container.querySelector('.heart-box')) return;
    if (!document.getElementById('hearts-style')) {
      var st = document.createElement('style');
      st.id = 'hearts-style';
      st.textContent = '.heart-box{margin:30px 0 0;text-align:center}' +
        '.heart-btn{font:600 15px "Space Grotesk",sans-serif;padding:10px 22px;border-radius:26px;cursor:pointer;color:var(--parchment,#f8f5ef);background:var(--panel-solid,rgba(28,29,48,.92));border:1px solid var(--panel-border,rgba(140,150,255,.25))}' +
        '.heart-btn:hover:not(:disabled){border-color:var(--ember,#ff7a45)}.heart-btn.on{border-color:var(--ember,#ff7a45)}.heart-btn:disabled{cursor:default}' +
        '.heart-note{font-size:12px;color:var(--mist,#9aa3c0);margin-top:6px;min-height:1em}';
      document.head.appendChild(st);
    }
    var key = 'liked:' + article.id;
    var liked = false;
    try { liked = localStorage.getItem(key) === '1'; } catch (e) {}
    var n = article.likes || 0;
    var box = document.createElement('div'); box.className = 'heart-box';
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'heart-btn';
    var note = document.createElement('div'); note.className = 'heart-note';
    function paint() {
      btn.textContent = (liked ? '❤️' : '🤍') + ' ' + (liked ? 'Díky!' : 'Líbí se mi') + (n ? ' · ' + n : '');
      btn.classList.toggle('on', liked); btn.disabled = liked;
      btn.setAttribute('aria-label', 'Srdíčko, zatím ' + n);
    }
    paint();
    btn.onclick = function () {
      if (liked) return;
      liked = true; n++; paint();
      try { localStorage.setItem(key, '1'); } catch (e) {}
      fetch('/api/articles/like', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: article.id }) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j && typeof j.likes === 'number') { n = j.likes; paint(); } })
        .catch(function () {});
    };
    box.appendChild(btn); box.appendChild(note);
    var first = container.querySelector('.comments-section');
    if (first) container.insertBefore(box, first); else container.appendChild(box);
  }
  window.ArticleHearts = { mount: mount };
})();
