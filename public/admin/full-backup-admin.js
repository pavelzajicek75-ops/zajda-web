/* 💾 Úplná záloha na disk: jedním klepnutím se stáhne jeden soubor ZIP s texty, všemi fotkami,
   náhledy a skriptem obnova.mjs, kterým se všechno vrátí na web jedním příkazem.
   Doporučeno z počítače (na telefonu se velká záloha nemusí vejít do paměti). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function mb(n) { return (n / 1048576).toFixed(1) + ' MB'; }

  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  /* ZIP bez komprese (fotky jsou už komprimované). Do 4 GB. */
  function ZipWriter() { this.parts = []; this.central = []; this.offset = 0; this.count = 0; }
  ZipWriter.prototype.add = function (name, u8) {
    var nm = new TextEncoder().encode(name), crc = crc32(u8), sz = u8.length;
    var d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true);
    lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
    this.parts.push(lh.buffer, nm, u8);
    var ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true);
    ch.setUint16(28, nm.length, true); ch.setUint32(42, this.offset, true);
    this.central.push(ch.buffer, nm);
    this.offset += 30 + nm.length + sz; this.count++;
  };
  ZipWriter.prototype.finish = function () {
    var csize = 0; this.central.forEach(function (p) { csize += p.byteLength !== undefined ? p.byteLength : p.length; });
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, this.count, true); e.setUint16(10, this.count, true); e.setUint32(12, csize, true); e.setUint32(16, this.offset, true);
    return new Blob(this.parts.concat(this.central, [e.buffer]), { type: 'application/zip' });
  };

  var SCRIPT = [
    "// obnova.mjs — vrátí zálohu Zajdova webu (texty i fotky). Potřebuje Node.js 18 nebo novější.",
    "// Použití:  node obnova.mjs https://zajda-web.pages.dev",
    "// Nic nemaže: doplní jen to, co na webu chybí. Přepsání změněných textů: node obnova.mjs <adresa> --prepsat",
    "import fs from 'node:fs'; import path from 'node:path'; import readline from 'node:readline/promises';",
    "const base = (process.argv[2] || '').replace(/\\/+$/, ''); const overwrite = process.argv.includes('--prepsat');",
    "if (!/^https?:\\/\\//.test(base)) { console.log('Zadej adresu webu, např.:  node obnova.mjs https://zajda-web.pages.dev'); process.exit(1); }",
    "const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\\/([A-Za-z]:)/, '$1'));",
    "let user = process.env.ZAJDA_JMENO, pass = process.env.ZAJDA_HESLO;",
    "if (!pass) { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); user = (await rl.question('Přihlašovací jméno [admin]: ')) || 'admin'; pass = await rl.question('Heslo správce: '); rl.close(); } user = user || 'admin';",
    "let r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }) });",
    "const lg = await r.json().catch(() => ({})); if (!r.ok || !lg.token) { console.log('Přihlášení se nepovedlo:', lg.error || r.status); process.exit(1); }",
    "const H = { Authorization: 'Bearer ' + lg.token };",
    "const backup = JSON.parse(fs.readFileSync(path.join(dir, 'zaloha.json'), 'utf8'));",
    "console.log('1/2 Obnova textů…');",
    "r = await fetch(base + '/api/data/restore', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ backup, apply: true, overwrite }) });",
    "const rj = await r.json().catch(() => ({})); console.log(r.ok ? 'Hotovo, zapsáno položek: ' + (rj.written ?? rj.writes ?? '?') : 'Chyba: ' + (rj.error || r.status));",
    "console.log('2/2 Obnova fotek…');",
    "const files = []; (function walk(p, rel) { for (const f of fs.readdirSync(p, { withFileTypes: true })) { const fp = path.join(p, f.name), rp = rel ? rel + '/' + f.name : f.name; if (f.isDirectory()) walk(fp, rp); else files.push([rp, fp]); } })(path.join(dir, 'fotky'), '');",
    "let ok = 0, skip = 0, bad = 0;",
    "for (const [key, fp] of files) { const fd = new FormData(); fd.append('key', key); if (overwrite) fd.append('overwrite', '1'); fd.append('file', new Blob([fs.readFileSync(fp)]), path.basename(fp));",
    "  try { const x = await fetch(base + '/api/photos/restore', { method: 'POST', headers: H, body: fd }); const j = await x.json().catch(() => ({})); if (x.ok && j.skipped) skip++; else if (x.ok) ok++; else { bad++; console.log('Chyba u', key, j.error || x.status); } } catch (e) { bad++; console.log('Chyba u', key, e.message); }",
    "  process.stdout.write('\\r' + (ok + skip + bad) + ' / ' + files.length); }",
    "console.log('\\nFotky: nahráno ' + ok + ', už tam byly ' + skip + ', chyb ' + bad);"
  ].join('\n');

  var README = 'ÚPLNÁ ZÁLOHA ZAJDOVA WEBU\n\nObsah:\n  zaloha.json  – všechny texty (články, milníky, komentáře, citáty, nastavení)\n  fotky/       – všechny fotky a jejich náhledy pod původními názvy\n  obnova.mjs   – skript, který to celé vrátí na web\n  stahni-kod.mjs / OBNOVA-OD-NULY.txt – kód webu a postup, jak web postavit znovu od nuly\n\nJak obnovit:\n1. Rozbal tenhle ZIP do složky.\n2. Nainstaluj Node.js (verze 18 a novější) z nodejs.org.\n3. Ve složce spusť:   node obnova.mjs https://zajda-web.pages.dev\n4. Zadej jméno a heslo správce. Skript nic nemaže, jen doplní chybějící.\n\nKdyž chceš přepsat i změněné texty verzí ze zálohy, přidej na konec příkazu:  --prepsat\n';


  var CODE_SCRIPT = [
    "// stahni-kod.mjs — stáhne aktuální kód webu z GitHubu do souboru zajda-web-kod.zip (Node.js 18+).",
    "// Použití:  node stahni-kod.mjs",
    "import fs from 'node:fs';",
    "const url = 'https://codeload.github.com/pavelzajicek75-ops/zajda-web/zip/refs/heads/main';",
    "const r = await fetch(url);",
    "if (!r.ok) { console.log('Stažení se nepovedlo (' + r.status + '). Je repozitář soukromý? Stáhni ho ručně: GitHub → zajda-web → Code → Download ZIP, nebo: git clone https://github.com/pavelzajicek75-ops/zajda-web'); process.exit(1); }",
    "fs.writeFileSync('zajda-web-kod.zip', Buffer.from(await r.arrayBuffer())); console.log('Hotovo: zajda-web-kod.zip');"
  ].join('\n');

  var SCRATCH = 'OBNOVA OD NULY — ZAJDŮV WEB\n\n' +
    'Tenhle postup použij, kdyby web úplně zmizel nebo se musel postavit znovu. Hesla a tajné klíče v záloze NEJSOU — musíš je znát nebo vymyslet nové.\n\n' +
    'CO MÁŠ V TÉHLE ZÁLOZE\n  - zaloha.json a fotky/  (obsah webu)\n  - obnova.mjs            (vrací obsah a fotky na web)\n  - stahni-kod.mjs        (stáhne kód webu z GitHubu)\n\n' +
    'KROK 1 — KÓD\n  Spusť:  node stahni-kod.mjs   (vznikne zajda-web-kod.zip)\n  Nebo na GitHubu: pavelzajicek75-ops/zajda-web → Code → Download ZIP.\n  Kód je i na GitHubu v celé historii; vlastní kopii si uschovej vedle téhle zálohy.\n\n' +
    'KROK 2 — CLOUDFLARE\n  a) Cloudflare → Workers & Pages → Create → Pages → propojit s GitHub repozitářem zajda-web.\n     Build command: (prázdné)   Build output directory: public\n  b) Vytvoř úložiště (názvy jako dřív):\n     KV namespace:  SESSIONS, ARTICLES, SUBSECTIONS, PHOTOS, APP_DATA   (USAGE_KV používá stejný namespace jako SUBSECTIONS)\n     R2 bucket:     zajda-photos (fotky), zajda-quotes (citáty a automatické zálohy)\n  c) Pages → Settings → Bindings (nebo Functions): připoj je pod těmito názvy:\n     KV:  SESSIONS, ARTICLES, SUBSECTIONS, PHOTOS, APP_DATA, USAGE_KV\n     R2:  PHOTOS_R2 → zajda-photos,  QUOTES_R2 → zajda-quotes\n     (přesné hodnoty jsou i v souboru wrangler.toml v kódu; ID namespaců se po novém založení změní — uprav je tam)\n  d) Pages → Settings → Environment variables (proměnné):\n     ADMIN_PASSWORD   heslo správce (povinné)\n     ADMIN_USERNAME   přihlašovací jméno (volitelné, výchozí admin)\n     JWT_SECRET       dlouhý náhodný text (volitelné; když chybí, použije se ADMIN_PASSWORD)\n     CDN_BASE_URL, CF_ACCOUNT_ID, CF_PLAN, R2_BUCKET_NAMES, KV_NAMESPACE_IDS   (jsou ve wrangler.toml)\n     CF_API_TOKEN a CF_ACCOUNT_ID — jen pro měření využití; vytvoř nový token v Cloudflare\n  e) Počkej na první nasazení (Deployments → Success).\n\n' +
    'KROK 3 — OBSAH A FOTKY\n  Ve složce se zálohou:  node obnova.mjs https://TVOJE-ADRESA.pages.dev\n  (zadej jméno a heslo správce z kroku 2d)\n\n' +
    'KROK 4 — KONTROLA\n  Otevři web a administraci, v Expertu spusť „Kontrolu fotek a odkazů“ a „Náhledy fotek“.\n  Upozornění na nové články si čtenáři musí zapnout znovu. Vlastní doménu připoj v Pages → Custom domains.\n';

  async function run() {
    var out = $('fullBackupMsg'), btn = $('fullBackupBtn');
    btn.disabled = true;
    function say(t) { out.textContent = t; }
    try {
      say('Sbírám texty…');
      var r = await fetch('/api/data/backup'); if (!r.ok) throw new Error('texty: HTTP ' + r.status);
      var text = await r.text(), data = JSON.parse(text);
      var items = (data.photoInventory && data.photoInventory.items) || [];
      var total = items.reduce(function (a, x) { return a + (x[1] || 0); }, 0);
      if (total > 3.5 * 1073741824) throw new Error('Fotek je ' + mb(total) + ' — to se do jednoho souboru ZIP nevejde. Napiš mi a rozdělíme to.');
      if (total > 400 * 1048576 && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !confirm('Fotek je ' + mb(total) + '. Na telefonu nebo tabletu se to nemusí vejít do paměti. Pokračovat? Lepší je spustit to z počítače.')) { btn.disabled = false; say(''); return; }
      var zip = new ZipWriter(), enc = new TextEncoder();
      zip.add('zaloha.json', enc.encode(text));
      zip.add('obnova.mjs', enc.encode(SCRIPT));
      zip.add('OBNOVA.txt', enc.encode(README));
      zip.add('stahni-kod.mjs', enc.encode(CODE_SCRIPT));
      zip.add('OBNOVA-OD-NULY.txt', enc.encode(SCRATCH));
      var done = 0, bytes = 0, miss = [];
      for (var i = 0; i < items.length; i++) {
        var key = items[i][0];
        say('Fotky ' + (i + 1) + ' / ' + items.length + ' (' + mb(bytes) + ' z ' + mb(total) + ')');
        var res = await fetch('/api/photos/file?key=' + encodeURIComponent(key));
        if (!res.ok) { miss.push(key); continue; }
        var u8 = new Uint8Array(await res.arrayBuffer()); zip.add('fotky/' + key, u8); bytes += u8.length; done++;
        try { var tr = await fetch('/api/photos/file?key=' + encodeURIComponent('thumbs/' + key)); if (tr.ok) zip.add('fotky/thumbs/' + key, new Uint8Array(await tr.arrayBuffer())); } catch (e) {}
      }
      say('Balím soubor…');
      var blob = zip.finish();
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'zajda-uplna-zaloha-' + new Date().toISOString().slice(0, 10) + '.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000);
      try { localStorage.setItem('lastBackupDownload', String(Date.now())); } catch (e) {}
      out.innerHTML = '✅ Hotovo: ' + done + ' fotek (' + mb(bytes) + '), ZIP má ' + mb(blob.size) + '.' + (miss.length ? '<br>⚠️ Nepodařilo se stáhnout ' + miss.length + ' fotek: ' + esc(miss.slice(0, 5).join(', ')) : '') +
        '<br>Obnova: rozbal ZIP, ve složce spusť <code>node obnova.mjs https://zajda-web.pages.dev</code>';
    } catch (e) { say('⚠️ ' + e.message); }
    btn.disabled = false;
  }

  function mount() {
    var host = $('admin');
    if (!host || $('fullBackupBox')) return;
    var box = document.createElement('div');
    box.id = 'fullBackupBox'; box.style.cssText = 'margin:0 0 2rem';
    box.innerHTML = '<h3 style="margin-bottom:.5rem">💾 Úplná záloha na disk</h3>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-bottom:.6rem">Jedním klepnutím stáhneš jeden soubor ZIP: všechny texty, <b>všechny fotky</b> a skript <code>obnova.mjs</code>, který to celé vrátí na web jedním příkazem. Nejlépe z počítače.</p>' +
      '<button class="btn btn-blue" id="fullBackupBtn">💾 Zálohovat všechno na disk</button><p id="fullBackupMsg" style="margin-top:.6rem;font-size:13px;line-height:1.6"></p>';
    host.appendChild(box);
    $('fullBackupBtn').onclick = run;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
