/* ✦ Deep-space quote receiver — celoobrazovkové vysílání citátů (rozjede se z odkazu „Citáty" v patičce).
   Rozhraní je anglicky (vesmírný systém), citáty zůstávají tak, jak jsou. Žádné záblesky přes celou obrazovku. */
(function () {
  'use strict';
  if (window.QuoteTV) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CSS = [
    '.qtv{position:fixed;inset:0;z-index:10000;display:none;background:#05030f;color:#fff;overflow:hidden;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:manipulation;',
    'clip-path:circle(0px at var(--ox,50%) var(--oy,100%));transition:clip-path .95s cubic-bezier(.65,0,.2,1)}',
    '.qtv.show{display:block}.qtv.open{clip-path:circle(170vmax at var(--ox,50%) var(--oy,100%))}',
    '.qtv-in{position:absolute;inset:0;transform:scale(1.35);opacity:0;transition:transform 1.2s cubic-bezier(.2,.8,.2,1),opacity .7s}',
    '.qtv.open .qtv-in{transform:none;opacity:1}',
    '.qtv.noanim,.qtv.noanim .qtv-in{transition:none}',
    '.qtv-cv{position:absolute;inset:0;width:100%;height:100%}',
    '.qtv-in::after{content:"";position:absolute;inset:0;z-index:4;pointer-events:none;box-shadow:inset 0 0 150px 30px rgba(0,0,0,.8)}',
    '.qtv-hud{position:absolute;z-index:6;left:0;right:0;top:0;display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:16px 22px;font:700 12px "Space Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:#7ff0dc;text-shadow:0 0 10px rgba(0,0,0,.9);pointer-events:none}',
    '.qtv-sys{min-height:1.4em;color:#7ff0dc}.qtv-sys.warn{color:#ffb86b}',
    '.qtv-bar{margin-top:8px;width:min(300px,52vw);height:6px;border:1px solid rgba(127,240,220,.5);border-radius:2px;overflow:hidden}',
    '.qtv-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#2fe6c9,#f2b8ff);box-shadow:0 0 12px #2fe6c9}',
    '.qtv-barlab{margin-top:5px;font-size:10.5px;opacity:.8;letter-spacing:.14em}',
    '.qtv-hr{text-align:right;line-height:1.7}.qtv-hr b{color:#ffe14a;font-weight:700}',
    '.qtv-col{position:absolute;z-index:2;top:110px;bottom:26vh;margin:0;width:150px;overflow:hidden;font:400 10.5px/1.7 "Space Mono",ui-monospace,monospace;color:#7ff0dc;opacity:.32;pointer-events:none;white-space:pre}',
    '.qtv-col.l{left:18px}.qtv-col.r{right:18px;text-align:right}',
    '.qtv-logwrap{position:absolute;z-index:3;left:0;right:0;top:92px;bottom:25vh;display:flex;align-items:center;justify-content:center;padding:0 7vw}',
    '.qtv-log{width:min(860px,100%);font-family:"Space Mono","Courier New",monospace;text-align:left;transition:opacity .6s}',
    '.qtv-log.off{opacity:0}',
    '.qtv-h{color:#7ff0dc;font-size:clamp(11px,1.4vw,13.5px);letter-spacing:.12em;text-transform:uppercase;line-height:1.75;margin-bottom:4vh;opacity:0;transition:opacity .7s}',
    '.qtv-h.in{opacity:1}.qtv-h b{color:#ffe14a}',
    '.qtv-body{display:grid}.qtv-body>*{grid-area:1/1;margin:0;white-space:pre-wrap;word-break:break-word;font-weight:400;line-height:1.55;color:#f4efff}',
    '.qtv-sizer{visibility:hidden}.qtv-noise{color:#7ff0dc;opacity:.22}',
    '.qtv-live .w{display:inline-block;white-space:pre}',
    '.qtv-live .w.k1{color:#ffe14a}.qtv-live .w.k2{color:#ffd0f7}',
    '.qtv-live .w.hit{animation:qtvhit .95s cubic-bezier(.1,.7,.2,1)}',
    '.qtv-live .w.hit2{animation:qtvhit2 .8s cubic-bezier(.1,.7,.2,1)}',
    '@keyframes qtvhit{0%{transform:scale(1.28);color:#fff;text-shadow:0 0 50px #ffe14a,0 0 22px #ffe14a,0 0 6px #fff}35%{transform:scale(1.1);text-shadow:0 0 34px #ffe14a,0 0 12px #ffe14a}100%{transform:scale(1);text-shadow:0 0 0 transparent}}',
    '@keyframes qtvhit2{0%{transform:scale(1.18);color:#fff;text-shadow:0 0 36px #f2b8ff,0 0 14px #f2b8ff}100%{transform:scale(1);text-shadow:0 0 0 transparent}}',
    '.qtv-live::after{content:"█";color:#7ff0dc;animation:qtvbl 1s steps(1) infinite}.qtv-live.done::after{content:""}',
    '.qtv-src{margin-top:4vh;font-size:clamp(12px,1.8vw,17px);color:#f2b8ff;opacity:0;transition:opacity .9s;letter-spacing:.06em}.qtv-src.in{opacity:1}',
    '@keyframes qtvbl{50%{opacity:0}}',
    '.qtv-controls{position:absolute;z-index:7;left:0;right:0;bottom:12px;display:flex;justify-content:center;gap:10px}',
    '.qtv-controls button{cursor:pointer;font:700 12px "Space Mono",ui-monospace,monospace;letter-spacing:.08em;color:#cfeee9;background:rgba(8,5,22,.7);border:1px solid rgba(127,240,220,.4);border-radius:999px;padding:8px 16px}',
    '.qtv-controls button:hover,.qtv-controls button:focus-visible{border-color:#f2b8ff;color:#f2b8ff}',
    '@media(max-width:760px){.qtv-controls button{padding:7px 11px;font-size:11px;white-space:nowrap}.qtv-col{display:none}.qtv-hud{font-size:10px;padding:14px}.qtv-logwrap{top:84px;bottom:28vh}}'
  ].join('');

  var HTML = '<div class="qtv-in"><canvas class="qtv-cv"></canvas>' +
    '<div class="qtv-hud"><div><div class="qtv-sys" id="qtvSys"></div><div class="qtv-bar"><i id="qtvFill"></i></div><div class="qtv-barlab" id="qtvLab"></div></div><div class="qtv-hr" id="qtvHr"></div></div>' +
    '<pre class="qtv-col l" id="qtvL"></pre><pre class="qtv-col r" id="qtvR"></pre>' +
    '<div class="qtv-logwrap"><div class="qtv-log off" id="qtvLog"><div class="qtv-h" id="qtvH"></div>' +
    '<div class="qtv-body"><div class="qtv-sizer" id="qtvSizer"></div><div class="qtv-noise" id="qtvNoise"></div><div class="qtv-live" id="qtvLive"></div></div>' +
    '<div class="qtv-src" id="qtvSrc"></div></div></div>' +
    '<div class="qtv-controls"><button type="button" id="qtvPause">⏸ PAUSE</button><button type="button" id="qtvNext">⏭ NEXT SIGNAL</button><button type="button" id="qtvFull">⛶</button><button type="button" id="qtvExit">✕ CLOSE</button></div></div>';

  var STOP = ('a i o u v z s k je jsem jsi jsme jste jsou to se si na že ale jak co by aby do ze ve po pro než tak jen už ani nebo tu ten ta ty tě mě mi ti jí ho ji my vy oni byl byla bylo být má mám máš ' +
    'nemusíš musíš když kdy kde který která které tom tom tohle toto jako jeden jedna to že za při od před nad pod mezi bez ať ať ještě také tedy proto protože pokud však ne není nejsem nejsi').split(' ');
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });

  var el, cv, g, wf, wg, wrow, quotes = [], loaded = false, built = false;
  var running = false, paused = false, raf = 0, queue = [], forced = null, curQuote = null, num = 0, onClose = null;
  var W = 0, H = 0, pts = [], ptsN = 0, st = null, bpm = 92, phase = 0, lastT = 0, colT = 0, sysT = 0, sysI = 0, chars = '▒░█#%&@?*+=/\\<>';
  var q$ = function (id) { return document.getElementById(id); };

  function build() {
    if (built) return; built = true;
    var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
    var fl = document.createElement('link'); fl.rel = 'stylesheet'; fl.href = 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap'; document.head.appendChild(fl);
    el = document.createElement('div'); el.className = 'qtv'; el.id = 'qtv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Deep space receiver — quotes'); el.innerHTML = HTML; document.body.appendChild(el);
    cv = el.querySelector('.qtv-cv'); g = cv.getContext('2d');
    wf = document.createElement('canvas'); wf.width = 200; wf.height = 110; wg = wf.getContext('2d'); wrow = wg.createImageData(wf.width, 1);
    el.addEventListener('click', function () { next(); });
    q$('qtvNext').addEventListener('click', function (e) { e.stopPropagation(); next(); });
    q$('qtvPause').addEventListener('click', function (e) { e.stopPropagation(); togglePause(); });
    q$('qtvExit').addEventListener('click', function (e) { e.stopPropagation(); close(); });
    q$('qtvFull').addEventListener('click', function (e) {
      e.stopPropagation();
      if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
    });
    document.addEventListener('keydown', function (e) {
      if (!running) return;
      if (e.key === 'Escape') close();
      else if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') { if (e.target && e.target.tagName === 'BUTTON' && e.key !== 'ArrowRight') return; e.preventDefault(); next(); }
      else if (e.key === 'p' || e.key === 'P') togglePause();
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden && running && !paused) togglePause(); });
    window.addEventListener('resize', function () { if (running) resize(); });
  }

  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0; var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function rnd(n) { return (Math.random() * n) | 0; }
  function hex(n) { var o = ''; for (var i = 0; i < n; i++) o += '0123456789ABCDEF'[rnd(16)]; return o; }
  function resize() {
    var d = Math.min(window.devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * d; cv.height = H * d; g.setTransform(d, 0, 0, d, 0, 0);
    ptsN = Math.ceil(W / 2); pts = []; for (var i = 0; i < ptsN; i++) pts.push(0);
  }
  function ecg(ph) {
    if (ph < .08) return Math.sin(ph / .08 * Math.PI) * .12;
    if (ph > .16 && ph < .19) return -(ph - .16) / .03 * .15;
    if (ph >= .19 && ph < .23) return -.15 + (ph - .19) / .04 * 1.15;
    if (ph >= .23 && ph < .28) return 1 - (ph - .23) / .05 * 1.35;
    if (ph >= .28 && ph < .31) return -.35 + (ph - .28) / .03 * .35;
    if (ph > .4 && ph < .55) return Math.sin((ph - .4) / .15 * Math.PI) * .2;
    return 0;
  }
  function nextQuote() {
    if (forced) { var q = forced; forced = null; return q; }
    if (!queue.length) queue = shuffle(quotes);
    var q2 = queue.pop(); if (curQuote && q2 === curQuote && queue.length) q2 = queue.pop(); return q2;
  }
  function stardate() { var d = new Date(), doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); return d.getFullYear() + '.' + String(doy).padStart(3, '0'); }
  function scr(n) { var o = ''; for (var i = 0; i < n; i++) o += chars[rnd(chars.length)]; return o; }

  /* nejdůležitější slova: nejdelší významová slova (bez spojek a zájmen), mírná přednost koncovým */
  function keyWords(ws) {
    var sc = ws.map(function (w, i) {
      var c = w.toLocaleLowerCase('cs').replace(/[.,;:!?„"“”()\-–—…]/g, '');
      var s = c.length + (i / ws.length) * 1.2 + (/[!?]$/.test(w) ? 1.5 : 0);
      if (STOPSET[c] || c.length < 3) s -= 50;
      return { i: i, s: s };
    }).sort(function (a, b) { return b.s - a.s; });
    var k1 = sc[0] ? sc[0].i : -1, k2 = -1;
    if (sc[1] && sc[1].s > 0 && ws.length >= 4) k2 = sc[1].i;
    return { k1: k1, k2: k2 };
  }

  function sys(txt, warn) { var e = q$('qtvSys'); if (e.textContent !== txt) e.textContent = txt; e.className = 'qtv-sys' + (warn ? ' warn' : ''); }
  function bar(p, lab) { q$('qtvFill').style.width = Math.max(0, Math.min(100, p * 100)).toFixed(1) + '%'; q$('qtvLab').textContent = lab; }

  function begin() {
    var q = nextQuote(); curQuote = q; num++;
    var full = String(q.text).trim(), words = full.split(' '), keys = keyWords(words);
    var area = Math.max(200, window.innerWidth * .86) * Math.max(160, window.innerHeight * .46) * .5;
    var fs = Math.max(16, Math.min(32, Math.sqrt(area / (full.length * .62 * 1.55))));
    ['qtvSizer', 'qtvNoise', 'qtvLive'].forEach(function (id) { q$(id).style.fontSize = fs + 'px'; });
    q$('qtvSizer').textContent = full; var live = q$('qtvLive'); live.textContent = ''; live.className = 'qtv-live';
    q$('qtvH').classList.remove('in'); q$('qtvSrc').classList.remove('in');
    q$('qtvH').innerHTML = 'Stardate ' + stardate() + ' · transmission #<b>' + String((quotes.indexOf(q) + 1) || num).padStart(2, '0') + '</b><br>origin: <span id="qtvAu"></span> · signal quality <b>' + (94 + rnd(5)) + '%</b> · encryption: none';
    q$('qtvAu').textContent = q.author || 'Zajda';
    q$('qtvSrc').textContent = '— ' + (q.author || 'Zajda');
    q$('qtvLog').classList.remove('off');
    st = { q: q, full: full, words: words, keys: keys, phase: reduce ? 'hold' : 'tune', t0: performance.now(), typed: 0, lastType: 0, tuneDur: 3600 + Math.random() * 900, holdUntil: 0, sector: (1 + rnd(9)) + String.fromCharCode(65 + rnd(8)), n: 0 };
    if (reduce) { st.typed = full.length; renderTyped(); q$('qtvH').classList.add('in'); q$('qtvSrc').classList.add('in'); live.classList.add('done'); st.holdUntil = performance.now() + 9000; sys('TRANSMISSION RECEIVED · DECODING COMPLETE'); bar(1, 'DATA INTEGRITY 100%'); }
  }

  function renderTyped() {
    var t = st.full.slice(0, st.typed), parts = t.split(' '), live = q$('qtvLive'), pos = 0;
    live.textContent = ''; st.spans = [];
    for (var i = 0; i < parts.length; i++) {
      var sp = document.createElement('span'), complete = (pos + parts[i].length < st.full.length) ? true : (st.typed >= st.full.length);
      sp.className = 'w' + (complete && i === st.keys.k1 ? ' k1' : '') + (complete && i === st.keys.k2 ? ' k2' : '');
      sp.textContent = parts[i]; live.appendChild(sp); st.spans[i] = sp;
      if (i < parts.length - 1) live.appendChild(document.createTextNode(' '));
      pos += parts[i].length + 1;
    }
  }
  function hit(sp, cls) { if (!sp) return; sp.classList.remove('hit', 'hit2'); void sp.offsetWidth; sp.classList.add(cls); }
  function beat() {   // úder srdce: rozbliká se NEJDŮLEŽITĚJŠÍ slovo (a o úder později to druhé)
    if (!st || st.phase === 'tune' || !st.spans) return;
    st.n++;
    var s1 = st.spans[st.keys.k1], s2 = st.keys.k2 > -1 ? st.spans[st.keys.k2] : null;
    if (s1 && s1.classList.contains('k1')) hit(s1, 'hit');
    if (s2 && s2.classList.contains('k2') && st.n % 2 === 0) hit(s2, 'hit2');
  }

  function columns(now) {
    if (W < 760 || reduce) return;
    if (now - colT < 150) return; colT = now;
    var L = q$('qtvL'), R = q$('qtvR'), tpl = ['ALT  {a} KM', 'TEMP -{b} C', 'FLUX {c}', 'DRIFT +0.{d}', 'GAIN {e} DB', 'SNR  {f}', 'LAT  {g} LY', 'PKT  {h}'];
    function line() { return tpl[rnd(tpl.length)].replace('{a}', 300 + rnd(200) + '.' + rnd(9)).replace('{b}', 120 + rnd(80)).replace('{c}', '0.' + (10 + rnd(89))).replace('{d}', '0' + rnd(9) + rnd(9)).replace('{e}', 20 + rnd(30)).replace('{f}', 10 + rnd(30) + '.' + rnd(9)).replace('{g}', rnd(9) + '.' + rnd(99)).replace('{h}', hex(4)); }
    var a = L.textContent.split('\n'); a.push('RX ' + hex(4) + ' ' + hex(4) + ' ' + hex(2)); while (a.length > 16) a.shift(); L.textContent = a.join('\n');
    var b = R.textContent.split('\n'); b.push(line()); while (b.length > 16) b.shift(); R.textContent = b.join('\n');
  }

  var SYS_TUNE = ['SCANNING DEEP SPACE', 'CALIBRATING ANTENNA ARRAY', 'SWEEPING SECTOR {s}', 'SEARCHING FOR TRANSMISSION', 'FILTERING COSMIC NOISE'];

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    var dt = Math.min(60, now - lastT); lastT = now;
    if (paused) return;
    if (!st) begin();
    var tuning = st.phase === 'tune';
    var p = tuning ? Math.min(1, (now - st.t0) / st.tuneDur) : 1, clean = p * p * (3 - 2 * p);

    var target = tuning ? 92 - clean * 14 : 58;
    bpm += (target - bpm) * Math.min(1, dt * (tuning ? .0006 : .00075));
    phase += dt * bpm / 60000; if (phase >= 1) { phase -= 1; beat(); }

    if (!reduce) {
      wg.drawImage(wf, 0, 1);
      var d = wrow.data, n = wf.width, mid = n / 2;
      for (var x = 0; x < n; x++) {
        var dd = Math.abs(x - mid) / mid, peak = Math.exp(-dd * dd * 90) * (tuning ? clean : 1) * .9;
        var v = Math.min(1, Math.random() * (tuning ? (1 - clean * .8) : .16) * .5 + peak);
        d[x * 4] = 40 + v * 90; d[x * 4 + 1] = 70 + v * 180; d[x * 4 + 2] = 120 + v * 120; d[x * 4 + 3] = v * 255;
      }
      wg.putImageData(wrow, 0, 0);
    }
    g.fillStyle = '#05030f'; g.fillRect(0, 0, W, H);
    var gr = g.createRadialGradient(W / 2, H * .35, 0, W / 2, H * .35, W * .65); gr.addColorStop(0, 'rgba(143,107,255,.22)'); gr.addColorStop(1, 'rgba(5,3,15,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.imageSmoothingEnabled = false; g.globalAlpha = .4; g.drawImage(wf, 0, 0, W, H * .8); g.globalAlpha = 1;

    // radar
    if (W >= 760) {
      var rx = W - 90, ry = 150, rr = 46, ang = reduce ? 0 : now / 900;
      g.strokeStyle = 'rgba(127,240,220,.45)'; g.lineWidth = 1;
      [1, .66, .33].forEach(function (k) { g.beginPath(); g.arc(rx, ry, rr * k, 0, 6.3); g.stroke(); });
      g.beginPath(); g.moveTo(rx - rr, ry); g.lineTo(rx + rr, ry); g.moveTo(rx, ry - rr); g.lineTo(rx, ry + rr); g.stroke();
      var sw = g.createConicGradient ? g.createConicGradient(ang, rx, ry) : null;
      if (sw) { sw.addColorStop(0, 'rgba(127,240,220,.55)'); sw.addColorStop(.12, 'rgba(127,240,220,0)'); sw.addColorStop(1, 'rgba(127,240,220,0)'); g.fillStyle = sw; g.beginPath(); g.arc(rx, ry, rr, 0, 6.3); g.fill(); }
      g.strokeStyle = '#7ff0dc'; g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + Math.cos(ang) * rr, ry + Math.sin(ang) * rr); g.stroke();
      g.fillStyle = '#ffe14a'; var bl = st.blips || (st.blips = [[rnd(70) - 35, rnd(70) - 35], [rnd(60) - 30, rnd(60) - 30], [rnd(50) - 25, rnd(50) - 25]]);
      bl.forEach(function (b) { g.globalAlpha = tuning ? .9 : .5; g.beginPath(); g.arc(rx + b[0], ry + b[1], 2.2, 0, 6.3); g.fill(); }); g.globalAlpha = 1;
    }

    // EKG
    var chaos = tuning ? (1 - clean) : 0;
    var v0 = ecg(phase) + (reduce ? 0 : (Math.random() - .5) * chaos * .35);
    if (!reduce) { pts.push(v0); pts.shift(); pts.push(v0); pts.shift(); } else { for (var k = 0; k < pts.length; k++) pts[k] = 0; }
    var base = H - 78, amp = Math.min(70, H * .1);
    g.strokeStyle = tuning ? '#ffb86b' : '#7ff0dc'; g.shadowColor = g.strokeStyle; g.shadowBlur = 12; g.lineWidth = 2.2; g.beginPath();
    for (var i = 0; i < pts.length; i++) { var Y = base - pts[i] * amp; i ? g.lineTo(i * 2, Y) : g.moveTo(0, Y); }
    g.stroke(); g.shadowBlur = 0;
    var hrState = bpm > 80 ? 'ELEVATED' : (bpm > 65 ? 'STABILIZING' : 'NOMINAL');
    g.font = '700 12px "Space Mono", monospace'; g.fillStyle = tuning ? '#ffb86b' : '#7ff0dc'; g.textAlign = 'left';
    g.fillText('♥ HEART RATE ' + Math.round(bpm) + ' BPM · ' + hrState, 18, base + amp * .9 + 22);

    // HUD vpravo
    var freq = 1420.40 + (tuning ? (1 - clean) * Math.sin(now / 260) * 4 : 0);
    q$('qtvHr').innerHTML = freq.toFixed(2) + ' MHz<br>' + (tuning ? 'STATUS: SCANNING' : 'STATUS: <b>LOCKED</b>') + '<br>LINK ' + (tuning ? '—' : 'STABLE');
    columns(now);

    // fáze
    if (st.phase === 'tune') {
      if (now - sysT > 1000) { sysT = now; sysI++; }
      sys(SYS_TUNE[sysI % SYS_TUNE.length].replace('{s}', st.sector) + '.'.repeat(1 + ((now / 350) | 0) % 3), true);
      bar(clean, 'SCAN ' + Math.round(clean * 100) + '% · SECTOR ' + st.sector);
      var nz = q$('qtvNoise'); nz.textContent = scr(st.full.length); nz.style.opacity = .1 + clean * .18;
      if (p >= 1) { st.phase = 'type'; st.t0 = now; nz.textContent = ''; q$('qtvH').classList.add('in'); st.perChar = Math.max(34, Math.min(70, 3200 / st.full.length)); }
    } else if (st.phase === 'type') {
      var pr = st.typed / st.full.length;
      sys('SIGNAL LOCKED · DOWNLOADING DATA'); bar(pr, 'DOWNLOADING ' + Math.round(pr * 100) + '% · ' + (st.typed * 3) + ' BYTES');
      if (now - st.lastType > st.perChar) {
        st.lastType = now; st.typed++; renderTyped();
        if (st.typed >= st.full.length) { st.phase = 'hold'; st.holdUntil = now + 4600 + st.full.length * 22; q$('qtvLive').classList.add('done'); q$('qtvSrc').classList.add('in'); }
      }
    } else if (st.phase === 'hold') {
      sys('TRANSMISSION RECEIVED · DECODING COMPLETE'); bar(1, 'DATA INTEGRITY 100%');
      if (now > st.holdUntil) { st.phase = 'out'; st.t0 = now; q$('qtvLog').classList.add('off'); }
    } else if (st.phase === 'out') {
      sys('CLOSING CHANNEL · SCANNING NEXT SECTOR', true); bar(Math.max(0, 1 - (now - st.t0) / 800), 'STANDBY');
      if (now - st.t0 > 800) st = null;
    }
  }

  function next() { if (!running) return; paused = false; q$('qtvPause').textContent = '⏸ PAUSE'; st = null; q$('qtvLog').classList.add('off'); }
  function togglePause() { paused = !paused; q$('qtvPause').textContent = paused ? '▶ RESUME' : '⏸ PAUSE'; }

  function start(startQuote) {
    forced = startQuote || null; running = true; paused = false; queue = []; st = null; num = 0; bpm = 92; phase = 0;
    q$('qtvPause').textContent = '⏸ PAUSE'; document.body.style.overflow = 'hidden';
    resize(); lastT = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    try { q$('qtvNext').focus({ preventScroll: true }); } catch (e) {}
  }

  function open(origin, startQuote, opts) {
    build();
    onClose = opts && opts.onClose || null;
    var r = origin && origin.getBoundingClientRect ? origin.getBoundingClientRect() : origin;
    var ox = r ? (r.left + r.width / 2) : window.innerWidth / 2, oy = r ? (r.top + r.height / 2) : window.innerHeight;
    el.style.setProperty('--ox', ox + 'px'); el.style.setProperty('--oy', oy + 'px');
    el.classList.toggle('noanim', reduce);
    el.classList.add('show');
    var go = function () {
      if (!quotes.length) { el.classList.remove('open', 'show'); return; }
      void el.offsetWidth; el.classList.add('open'); start(startQuote);
    };
    if (loaded) { requestAnimationFrame(go); return; }
    fetch('/api/quotes/list').then(function (r2) { return r2.ok ? r2.json() : []; }).then(function (a) {
      quotes = (Array.isArray(a) ? a : []).filter(function (q) { return q && q.text; }); loaded = true; go();
    }).catch(function () { loaded = true; go(); });
  }

  function close() {
    if (!running) return;
    running = false; cancelAnimationFrame(raf); st = null;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
    el.classList.remove('open'); document.body.style.overflow = '';
    setTimeout(function () { el.classList.remove('show'); if (onClose) onClose(); }, reduce ? 0 : 950);
  }

  window.QuoteTV = { open: open, close: close };
})();
