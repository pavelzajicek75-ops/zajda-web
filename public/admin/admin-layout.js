/* Rozdělení administrace do záložek: 🛠️ ADMIN (co nastavuješ a řídíš), 📊 Přehledy (jen čtení),
   🧰 Nástroje (zálohy, diagnostika, údržba). Jednotlivé panely se dál montují do #admin (jak byly),
   tenhle skript je jen přesune na správné místo — podle pořadí v seznamech níže. */
(function () {
  'use strict';
  var LAYOUT = {
    adminBoxes: ['siteBox', 'commentsBox', 'messagesBox', 'ideasBox', 'featuredBox', 'shareBox'],
    overviewBoxes: ['trafficBox', 'weeklyBox', 'moodBox'],
    toolsBoxes: ['selftestBox', 'autoBackupBox', 'restoreBox', 'linkcheckBox', 'thumbsBox', 'geoFillBox', 'errorsBox']
  };

  function place(box, targetId) {
    var target = document.getElementById(targetId);
    if (!target || box.parentNode === target) return;
    var order = LAYOUT[targetId], rank = order.indexOf(box.id), ref = null;
    for (var i = 0; i < target.children.length; i++) {
      var r = order.indexOf(target.children[i].id);
      if (r > rank) { ref = target.children[i]; break; }
    }
    target.insertBefore(box, ref);
  }

  function sweep() {
    Object.keys(LAYOUT).forEach(function (t) {
      LAYOUT[t].forEach(function (id) { var b = document.getElementById(id); if (b) place(b, t); });
    });
  }

  function start() {
    sweep();
    var host = document.getElementById('admin');
    if (host && window.MutationObserver) {
      new MutationObserver(function () { sweep(); }).observe(host, { childList: true });
    }
  }
  window.AdminLayout = { sweep: sweep, LAYOUT: LAYOUT };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
