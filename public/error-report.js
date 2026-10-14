/* Tiché hlášení chyb JavaScriptu autorovi blogu (zobrazí se v adminu v „🐞 Hlášené chyby“).
   Posílá se jen text chyby, adresa stránky a typ prohlížeče — nic osobního.
   Maximálně 3 hlášení na jedno otevření stránky. */
(function () {
  'use strict';
  var sent = 0, seen = {};
  function send(message, where) {
    try {
      if (sent >= 3) return;
      message = String(message || '').slice(0, 300);
      if (!message || /^Script error\.?$/i.test(message) || /ResizeObserver loop/i.test(message) || /view transition|Transition was aborted|Transition was skipped/i.test(message)) return;
      var sig = message + '|' + where;
      if (seen[sig]) return; seen[sig] = 1; sent++;
      var body = JSON.stringify({ message: message, where: String(where || '').slice(0, 200), page: location.pathname + location.search.replace(/[?&]k=[^&]*/g, '') });
      if (navigator.sendBeacon) { navigator.sendBeacon('/api/errors/report', new Blob([body], { type: 'application/json' })); }
      else fetch('/api/errors/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
    } catch (e) { /* hlášení nesmí samo způsobit chybu */ }
  }
  window.addEventListener('error', function (e) {
    var file = (e.filename || '').replace(location.origin, '');
    if (e.filename && e.filename.indexOf(location.origin) !== 0) return; // cizí skripty (CDN, rozšíření prohlížeče) neřešíme
    send(e.message, file + ':' + (e.lineno || 0));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason; send('Promise: ' + (r && r.message ? r.message : r), '');
  });
})();
