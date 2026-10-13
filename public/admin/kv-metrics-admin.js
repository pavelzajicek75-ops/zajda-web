/* 📈 Spotřeba KV: kolik čtení / zápisů / výpisů / mazání proběhlo dnes a za týden (z Cloudflare). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function nf(n) { return Number(n || 0).toLocaleString('cs-CZ'); }
  var LABELS = { read: 'Čtení', write: 'Zápisy', list: 'Výpisy (list)', delete: 'Mazání' };

  function bar(label, used, limit) {
    var pct = limit ? Math.min(100, Math.round(used / limit * 100)) : 0;
    var color = pct >= 90 ? '#ef4444' : (pct >= 60 ? '#f59e0b' : '#22c55e');
    return '<div style="margin:.45rem 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span>' + esc(label) + '</span><span><b>' + nf(used) + '</b> / ' + nf(limit) + ' (' + pct + ' %)</span></div>' +
      '<div style="height:8px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + color + '"></div></div></div>';
  }

  function render(j) {
    var out = $('kvMetricsOut');
    if (j.configured === false) {
      out.innerHTML = '<p style="font-size:13px;line-height:1.6">Ještě to není zapojené do Cloudflare. Je to jednorázové (3 minuty):</p><ol style="font-size:13px;line-height:1.7;margin:.3rem 0 0 1.2rem">' +
        '<li>Cloudflare → <b>Workers &amp; Pages</b> → vpravo najdi <b>Account ID</b> a zkopíruj ho.</li>' +
        '<li>Cloudflare → ikona profilu → <b>My Profile → API Tokens → Create Token → Create Custom Token</b>. Oprávnění: <b>Account → Account Analytics → Read</b> (a pro názvy namespaců ještě <b>Account → Workers KV Storage → Read</b>). Ulož a zkopíruj token.</li>' +
        '<li>Pages projekt → <b>Settings → Variables and Secrets</b> → přidej <code>CF_ACCOUNT_ID_KV</code> a <code>CF_API_TOKEN</code> (jako Secret) (token jako <i>Secret</i>) → nasaď znovu.</li></ol>' +
        '<p style="font-size:12px;color:var(--text-muted);margin-top:.4rem">Chybí: ' + esc((j.missing || []).join(', ')) + '</p>';
      return;
    }
    if (j.error) { out.innerHTML = '<p style="color:#ef4444;font-size:13px">⚠️ ' + esc(j.error) + '</p>'; return; }
    var t = j.today, L = j.limits;
    var html = '<p style="font-size:12.5px;color:var(--text-muted);margin:0 0 .3rem">Dnešek (UTC den — o půlnoci UTC, tj. 2:00 letního / 1:00 zimního času, se limity nulují)</p>' +
      ['read', 'write', 'list', 'delete'].map(function (k) { return bar(LABELS[k], t[k], L[k]); }).join('');
    html += '<table class="data-table" style="margin-top:.8rem;font-size:12.5px"><thead><tr><th>Den</th><th>Čtení</th><th>Zápisy</th><th>Výpisy</th><th>Mazání</th></tr></thead><tbody>' +
      j.days.slice().reverse().map(function (d) {
        var warn = d.list >= L.list * 0.9 || d.write >= L.write * 0.9;
        return '<tr' + (warn ? ' style="color:#f59e0b"' : '') + '><td>' + esc(d.date) + '</td><td>' + nf(d.read) + '</td><td>' + nf(d.write) + '</td><td>' + nf(d.list) + '</td><td>' + nf(d.delete) + '</td></tr>';
      }).join('') + '</tbody></table>';
    if (j.namespaces && j.namespaces.length) {
      html += '<details style="margin-top:.6rem"><summary style="cursor:pointer;font-size:13px">Dnes podle úložiště</summary><table class="data-table" style="font-size:12.5px"><thead><tr><th>Namespace</th><th>Čtení</th><th>Zápisy</th><th>Výpisy</th><th>Mazání</th></tr></thead><tbody>' +
        j.namespaces.map(function (n) { return '<tr><td>' + esc(n.name) + '</td><td>' + nf(n.read) + '</td><td>' + nf(n.write) + '</td><td>' + nf(n.list) + '</td><td>' + nf(n.delete) + '</td></tr>'; }).join('') + '</tbody></table></details>';
    }
    html += '<p style="font-size:12px;color:var(--text-muted);margin-top:.5rem">' + esc(j.note || '') + '</p>';
    out.innerHTML = html;
  }

  async function load() {
    var out = $('kvMetricsOut'); if (!out) return;
    out.textContent = 'Načítám…';
    try {
      var r = await fetch('/api/admin/kv-metrics');
      var j = await r.json().catch(function () { return {}; });
      if (r.status === 401) { out.textContent = 'Nepřihlášen.'; return; }
      render(j);
    } catch (e) { out.textContent = '⚠️ ' + e.message; }
  }

  function mount() {
    var host = $('admin'); if (!host || $('kvMetricsBox')) return;
    var box = document.createElement('div'); box.id = 'kvMetricsBox'; box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">📈 Spotřeba KV (limity zdarma)</h3>' +
      '<button class="btn btn-sm" id="kvMetricsBtn">🔄 Obnovit</button><div id="kvMetricsOut" style="margin-top:.6rem"></div>';
    host.appendChild(box); $('kvMetricsBtn').onclick = load;
    load();
  }
  window.KvMetrics = { render: render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
