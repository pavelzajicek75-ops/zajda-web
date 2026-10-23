/* Tabulky v adminu jako karty na telefonu a iPadu na výšku (do 900 px). Na větších displejích se nic nemění. */
(function () {
  var css = '@media (max-width:900px){' +
    '.data-table{display:block;width:100%;min-width:0!important}' +
    '.data-table thead{display:none}' +
    '.data-table tbody{display:block}' +
    '.data-table tr{display:block;background:var(--surface-2,#1a2338);border:1px solid var(--border-soft,#263252);border-radius:14px;padding:12px 13px;margin:0 0 10px}' +
    '.data-table tr:hover td{background:none}' +
    '.data-table td{display:block;border:0!important;padding:3px 0!important;font-size:14.5px;line-height:1.45;word-break:break-word}' +
    '.data-table td[colspan]{text-align:center}' +
    '.data-table td[data-label]:not(:first-child)::before{content:attr(data-label) ": ";color:var(--text-muted,#92a0bc);font-size:12.5px}' +
    '.data-table td[data-label]:not(:first-child):not(.cell-act){font-size:13px;color:var(--text-muted,#92a0bc)}' +
    '.data-table td.cell-act{display:flex;flex-wrap:wrap;gap:8px;margin-top:9px;padding-top:6px!important}' +
    '.data-table td.cell-act::before{content:none!important}' +
    '.data-table td.cell-act .btn,.data-table td.cell-act button,.data-table td.cell-act select,.data-table td.cell-act input{flex:1 1 auto;min-height:44px;min-width:44px;font-size:14px}' +
    '#commentsBox button.btn,#messagesList button.btn,#errorsList button.btn,#ideasList button.btn{min-height:44px;margin:3px 4px 3px 0;padding:0 14px;font-size:14px}' +
    '}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function label(table) {
    var ths = table.querySelectorAll('thead th');
    if (!ths.length) return;
    var names = Array.prototype.map.call(ths, function (th) { return (th.textContent || '').trim(); });
    table.querySelectorAll('tbody tr').forEach(function (tr) {
      var tds = tr.children;
      for (var i = 0; i < tds.length; i++) {
        var td = tds[i];
        if (td.hasAttribute('colspan')) continue;
        if (names[i]) td.setAttribute('data-label', names[i]);
        else td.setAttribute('data-label', '');
        if (i === tds.length - 1 && td.querySelector('button,.btn,select,input')) td.classList.add('cell-act');
      }
    });
  }
  function scan() { document.querySelectorAll('table.data-table').forEach(label); }
  var timer;
  function later() { clearTimeout(timer); timer = setTimeout(scan, 60); }
  function start() {
    scan();
    new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
