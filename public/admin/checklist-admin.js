/* ✅ Testovací den: vyber, co chceš ověřit (nebo všechno), klikni „Otestovat“ a admin to zkontroluje sám.
   Co projde, se odfajfkuje ✅. Pár věcí jde ověřit jen očima/telefonem — ty jsou označené „ručně“ a odškrtneš je sám. */
(function () {
  'use strict';
  var KEY = 'zajdaTests2';
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function toast(m, t) { if (typeof showToast === 'function') showToast(m, t || 'info'); }
  var NOAUTH = { Authorization: '' };   // prázdná hlavička = požadavek „bez přihlášení“ (přebije automatický token)

  async function jget(url, opt) { var r = await fetch(url, opt); var j = null; try { j = await r.json(); } catch (e) {} return { r: r, j: j }; }
  async function text(url) { var r = await fetch(url, { cache: 'no-store', headers: NOAUTH }); return { ok: r.ok, t: r.ok ? await r.text() : '' }; }
  function ok(msg) { return { ok: true, msg: msg || '' }; }
  function bad(msg) { return { ok: false, msg: msg || 'Selhalo' }; }
  var cache = {};
  async function firstArticleId() {
    if (cache.aid) return cache.aid;
    var x = await jget('/api/articles/list'); var a = Array.isArray(x.j) ? x.j : [];
    cache.articles = a; cache.aid = a[0] && a[0].id; return cache.aid;
  }
  async function getBackup() {
    if (cache.backup) return cache.backup;
    var r = await fetch('/api/data/backup'); if (!r.ok) throw new Error('HTTP ' + r.status);
    var s = await r.text(); cache.backupSize = s.length; cache.backup = JSON.parse(s); return cache.backup;
  }

  var GROUPS = [
    ['🔒 Bezpečnost', [
      ['s1', 'Zápis do článků bez přihlášení je zablokovaný', async function () {
        var r = await fetch('/api/articles/update', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, NOAUTH), body: JSON.stringify({ id: 'x', title: 'x' }) });
        return r.status >= 400 ? ok('odpověď ' + r.status) : bad('Server to přijal (' + r.status + ')!');
      }],
      ['s2', 'Statistiky fotek vyžadují přihlášení a veřejné citáty neprozradí interní klíče', async function () {
        var a = await fetch('/api/photos/stats?galleryId=main', { headers: NOAUTH });
        var q = await fetch('/api/quotes/list', { headers: NOAUTH }); var qj = []; try { qj = await q.json(); } catch (e) {}
        if (a.status !== 401) return bad('Statistiky fotek jsou otevřené (' + a.status + ')');
        if (!q.ok) return bad('Veřejné citáty se nenačetly (' + q.status + ') — na webu by chyběly');
        return (Array.isArray(qj) && qj.every(function (x) { return !('key' in x); })) ? ok(qj.length + ' citátů') : bad('Citáty prozrazují interní klíče');
      }],
      ['s3', 'Ladicí a staré koncové body jsou zavřené', async function () {
        var codes = [];
        for (var u of ['/api/debug/r2', '/api/articles/save', '/api/photo/upload']) { var r = await fetch(u, { headers: NOAUTH }); codes.push(r.status); }
        return codes.every(function (c) { return c >= 400; }) ? ok(codes.join(', ')) : bad('Něco je otevřené: ' + codes.join(', '));
      }],
      ['s4', 'Bezpečnostní hlavičky jsou nastavené', async function () {
        var r = await fetch('/', { cache: 'no-store' });
        return (r.headers.get('x-content-type-options') === 'nosniff') ? ok() : bad('Chybí hlavičky — nahraj funkce (functions/_middleware.js) a public/_headers.');
      }],
      ['s5', 'Diagnostika serveru nehlásí chybu', async function () {
        var x = await jget('/api/admin/selftest'); if (!x.r.ok) return bad('HTTP ' + x.r.status);
        var f = (x.j.checks || []).filter(function (c) { return c.status === 'fail'; });
        return f.length ? bad(f.map(function (c) { return c.name; }).join(', ')) : ok((x.j.checks || []).length + ' kontrol v pořádku');
      }]
    ]],
    ['🌐 Veřejný web', [
      ['w1', 'Přepínač světlý / tmavý režim je na stránkách', async function () {
        var a = await text('/index.html'), t = await text('/theme.js');
        return (a.ok && a.t.indexOf('theme.js') > -1 && t.ok) ? ok() : bad('theme.js chybí');
      }],
      ['w2', 'Vyhledávání s překlepy je nasazené a články se načítají', async function () {
        var a = await text('/index.html'); await firstArticleId();
        if (a.t.indexOf('scoreArticle') < 0) return bad('Chybí nové vyhledávání (index.html)');
        return cache.articles && cache.articles.length ? ok(cache.articles.length + ' článků') : bad('Seznam článků je prázdný');
      }],
      ['w3', 'Odznak „NOVÉ“ je nasazený', async function () {
        var a = await text('/index.html'); return a.t.indexOf('isNewArticle') > -1 ? ok() : bad('Chybí v index.html');
      }],
      ['w4', 'Rychlé fotky na mobilu: náhledy existují u všech fotek', async function () {
        var a = await text('/photo-speed.js'); if (!a.ok) return bad('Chybí photo-speed.js');
        var x = await jget('/api/photos/thumbs-missing'); if (!x.r.ok) return bad('HTTP ' + x.r.status);
        var n = x.j.missingCount != null ? x.j.missingCount : (x.j.missing || []).length;
        return n === 0 ? ok() : bad('Chybí náhledy u ' + n + ' fotek → Nástroje → Náhledy fotek');
      }],
      ['w5', 'Připnutý článek existuje', async function () {
        var x = await jget('/api/site/info'); var pid = x.j && x.j.pinnedId; if (!pid) return ok('žádný není připnutý');
        await firstArticleId(); var found = (cache.articles || []).some(function (a) { return a.id === pid; });
        return found ? ok() : bad('Připnutý článek už neexistuje');
      }],
      ['w6', 'Sdílecí obrázek v „Rok“ je nasazený', async function () {
        var a = await text('/share-card.js'), b = await text('/rok.html');
        return (a.ok && b.t.indexOf("createElement('canvas')") > -1) ? ok() : bad('Chybí share-card.js nebo sdílení v rok.html');
      }]
    ]],
    ['🛠️ Admin', [
      ['a1', 'Kontrola před zveřejněním je načtená', async function () { return (typeof window.confirmPrePublish === 'function') ? ok() : bad('Chybí prepublish-admin.js'); }],
      ['a2', 'Nabídka upozornění po zveřejnění je načtená', async function () { return (typeof window.offerReaderPush === 'function') ? ok() : bad('Chybí push-admin.js'); }],
      ['a3', 'Historie verzí článku odpovídá', async function () {
        var id = await firstArticleId(); if (!id) return bad('Nemám článek k ověření');
        var x = await jget('/api/articles/history?id=' + encodeURIComponent(id)); return x.r.ok ? ok() : bad('HTTP ' + x.r.status);
      }],
      ['a4', 'Zprávy „Napiš mi“ se načítají', async function () { var x = await jget('/api/messages/list'); return x.r.ok ? ok() : bad('HTTP ' + x.r.status); }],
      ['a5', 'Komentáře ke schválení se načítají', async function () { var x = await jget('/api/comments/pending'); return x.r.ok ? ok() : bad('HTTP ' + x.r.status); }],
      ['a6', 'Přehled spotřeby KV funguje', async function () {
        var x = await jget('/api/admin/kv-metrics'); if (!x.r.ok) return bad('HTTP ' + x.r.status + (x.j && x.j.error ? ' – ' + x.j.error : ''));
        return (x.j && x.j.errors && x.j.errors.length) ? bad(String(x.j.errors[0]).slice(0, 120)) : ok();
      }],
      ['a7', 'Vložení zvuku a videa vytvoří přehrávač', async function () {
        if (!window.EmbedMedia) return bad('Chybí embed-admin.js');
        var y = window.EmbedMedia.buildEmbed('https://youtu.be/dQw4w9WgXcQ') || '', m = window.EmbedMedia.buildEmbed('https://example.com/a.mp3') || '';
        return (/iframe/.test(y) && /audio/.test(m)) ? ok() : bad('YouTube nebo mp3 se nevložilo');
      }]
    ]],
    ['🔔 Upozornění', [
      ['p1', 'Server má klíč pro upozornění', async function () { var x = await jget('/api/push/key'); return (x.j && x.j.publicKey) ? ok() : bad('Klíč chybí'); }],
      ['p2', 'Service worker umí upozornění (včetně správce)', async function () {
        var a = await text('/sw.js'); return (a.t.indexOf("'push'") > -1 && a.t.indexOf('zajda-admin') > -1) ? ok() : bad('Starý sw.js — nahraj novou složku public');
      }],
      ['p3', 'Tohle zařízení má zapnutá upozornění pro správce', async function () {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return bad('Zařízení upozornění nepodporuje');
        var reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
        var x = await jget('/api/push/admin-subscribe'); var flag = await caches.match('/__admin-device', { cacheName: 'zajda-flags' });
        return (sub && flag && x.j && x.j.count > 0) ? ok() : bad('Zapni je v Admin → Upozornění pro mě');
      }],
      ['p4', 'Odběr upozornění pro čtenáře odpovídá', async function () { var x = await jget('/api/push/send'); return x.r.ok ? ok('odběratelů: ' + x.j.subscribers) : bad('HTTP ' + x.r.status); }]
    ]],
    ['💾 Zálohy', [
      ['b1', 'Záloha do úložiště proběhne (vytvoří novou zálohu)', async function () {
        var x = await jget('/api/data/auto-backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        return x.r.ok ? ok() : bad((x.j && x.j.error) || ('HTTP ' + x.r.status));
      }],
      ['b2', 'V úložišti je aspoň jedna záloha', async function () {
        var x = await jget('/api/data/auto-backup'); var n = x.j && x.j.backups ? x.j.backups.length : 0; return n ? ok(n + ' záloh') : bad('Žádná záloha');
      }],
      ['b3', 'Stažení zálohy funguje a není prázdné', async function () {
        var b = await getBackup(); return cache.backupSize > 200 ? ok(Math.round(cache.backupSize / 1024) + ' kB') : bad('Záloha je podezřele malá');
      }],
      ['b4', 'Obnova (náhled, nic se nezmění) projde', async function () {
        var b = await getBackup();
        var x = await jget('/api/data/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ backup: b, apply: false }) });
        return x.r.ok ? ok() : bad((x.j && x.j.error) || ('HTTP ' + x.r.status));
      }]
    ]],
    ['👀 Ručně (na telefonu / očima)', [
      ['m1', 'Tmavý a světlý režim vypadá dobře a po obnovení zůstane', null],
      ['m2', 'Fotky se na mobilu načítají rychle (nejdřív náhled, pak plná)', null],
      ['m3', 'Z jiného zařízení pošli zprávu „Napiš mi“ → ti zazvoní telefon', null],
      ['m4', 'Napiš komentář → zazvoní; po schválení se zobrazí pod článkem', null],
      ['m5', 'Po zveřejnění článku se nabídne upozornění čtenářům a dorazí', null],
      ['m6', 'Sdílecí obrázek v „Rok“ se stáhne a vypadá dobře', null],
      ['m7', 'Vložený zvuk / video se v článku přehraje', null]
    ]]
  ];
  var ALL = []; GROUPS.forEach(function (g) { g[1].forEach(function (t) { ALL.push({ id: t[0], label: t[1], fn: t[2] }); }); });

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  var st = load(), sel = {}, running = false;
  ALL.forEach(function (t) { if (t.fn) sel[t.id] = true; });

  function fmt(ts) { try { return new Date(ts).toLocaleString('cs', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function icon(t) {
    var s = st[t.id];
    if (s && s.run) return '⏳';
    if (!t.fn) return s && s.ok ? '✅' : '⬜';
    return !s ? '⬜' : (s.ok ? '✅' : '❌');
  }
  function paint() {
    var box = $('checklistBox'); if (!box) return;
    var auto = ALL.filter(function (t) { return t.fn; }), man = ALL.filter(function (t) { return !t.fn; });
    var okA = auto.filter(function (t) { return st[t.id] && st[t.id].ok; }).length, badA = auto.filter(function (t) { return st[t.id] && st[t.id].ok === false; }).length;
    var okM = man.filter(function (t) { return st[t.id] && st[t.id].ok; }).length;
    var h = '<h3 style="margin-bottom:.4rem">✅ Testovací den</h3>' +
      '<p style="font-size:13px;color:var(--text-muted);margin-bottom:.5rem">Vyber, co otestovat (nebo vše), a klikni na „Otestovat“. Co projde, se odfajfkuje. Chybu uvidíš s vysvětlením, co udělat.</p>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:.6rem"><button class="btn btn-blue btn-sm" id="tdRun"' + (running ? ' disabled' : '') + '>▶ Otestovat vybrané</button>' +
      '<button class="btn btn-sm" id="tdAll">Vybrat vše</button><button class="btn btn-sm" id="tdNone">Zrušit výběr</button><button class="btn btn-sm" id="tdReset">Začít znovu</button></div>' +
      '<div style="font-size:13px;margin-bottom:.5rem">Automaticky: ✅ ' + okA + ' / ' + auto.length + (badA ? ' · ❌ ' + badA : '') + ' &nbsp;·&nbsp; Ručně: ' + okM + ' / ' + man.length + '</div>';
    GROUPS.forEach(function (g) {
      h += '<div style="margin:.7rem 0 .2rem;font-weight:600">' + esc(g[0]) + '</div>';
      g[1].forEach(function (d) {
        var t = ALL.filter(function (x) { return x.id === d[0]; })[0], s = st[t.id] || {};
        var box1 = t.fn ? '<input type="checkbox" data-sel="' + t.id + '"' + (sel[t.id] ? ' checked' : '') + ' aria-label="Vybrat k testu">' : '<input type="checkbox" data-man="' + t.id + '"' + (s.ok ? ' checked' : '') + ' aria-label="Hotovo">';
        var note = t.fn ? (s.msg ? '<div style="font-size:12px;color:' + (s.ok ? 'var(--text-muted)' : '#f87171') + '">' + esc(s.msg) + (s.at ? ' · ' + fmt(s.at) : '') + '</div>' : (s.at ? '<div style="font-size:12px;color:var(--text-muted)">' + fmt(s.at) + '</div>' : '')) : '';
        h += '<label style="display:flex;gap:8px;align-items:flex-start;margin:.3rem 0;cursor:pointer">' + box1 + '<span style="width:1.4em;flex:none">' + icon(t) + '</span><span style="flex:1">' + esc(t.label) + note + '</span></label>';
      });
    });
    box.innerHTML = h;
    box.querySelectorAll('input[data-sel]').forEach(function (c) { c.onchange = function () { sel[c.dataset.sel] = c.checked; }; });
    box.querySelectorAll('input[data-man]').forEach(function (c) { c.onchange = function () { st[c.dataset.man] = c.checked ? { ok: true, at: Date.now() } : null; save(st); paint(); }; });
    $('tdAll').onclick = function () { auto.forEach(function (t) { sel[t.id] = true; }); paint(); };
    $('tdNone').onclick = function () { auto.forEach(function (t) { sel[t.id] = false; }); paint(); };
    $('tdReset').onclick = function () { st = {}; save(st); paint(); toast('Seznam vynulován', 'info'); };
    $('tdRun').onclick = run;
  }
  function withTimeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('Vypršel čas')); }, ms); })]); }
  async function run() {
    var todo = ALL.filter(function (t) { return t.fn && sel[t.id]; });
    if (!todo.length) { toast('Nic není vybráno', 'info'); return; }
    running = true; cache = {};
    for (var i = 0; i < todo.length; i++) {
      var t = todo[i]; st[t.id] = { run: true }; paint();
      var res;
      try { res = await withTimeout(t.fn(), 30000); } catch (e) { res = bad('Chyba: ' + (e && e.message ? e.message : e)); }
      st[t.id] = { ok: !!res.ok, msg: res.msg || '', at: Date.now() }; save(st); paint();
    }
    running = false; paint();
    var failed = todo.filter(function (t) { return !st[t.id].ok; }).length;
    toast(failed ? 'Hotovo — ' + failed + ' věcí neprošlo, podívej se na červené řádky' : 'Všech ' + todo.length + ' vybraných testů prošlo ✅', failed ? 'error' : 'success');
  }
  function mount() {
    var host = $('admin'); if (!host || $('checklistBox')) return;
    var box = document.createElement('div'); box.id = 'checklistBox'; box.style.cssText = 'margin:0 0 2rem';
    host.appendChild(box); paint();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
