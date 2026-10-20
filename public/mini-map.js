/* mini-map.js — malý živý náhled hvězdné mapy milníků (na /about/).
   MiniMap.init(canvas, milestones, {tip, wrap}) — klik kamkoli vede na /timeline/,
   najetím myši na hvězdu se ukáže její název a odkaz míří rovnou na ni. */
(function () {
  'use strict';
  var PAL = [[255, 122, 156], [184, 156, 255], [127, 214, 255], [95, 240, 220], [255, 211, 107]];
  function palAt(u) { var p = u * (PAL.length - 1), i = Math.min(PAL.length - 2, Math.floor(p)), f = p - i, a = PAL[i], b = PAL[i + 1]; return a.map(function (v, k) { return Math.round(v + (b[k] - v) * f); }); }
  function hash(s) { var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; }
  function mod(a, n) { return ((a % n) + n) % n; }
  var sprites = {};
  function glow(rgb) {
    if (sprites[rgb]) return sprites[rgb];
    var c = document.createElement('canvas'); c.width = c.height = 96; var g = c.getContext('2d');
    var gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    gr.addColorStop(0, 'rgba(' + rgb + ',.95)'); gr.addColorStop(.2, 'rgba(' + rgb + ',.35)'); gr.addColorStop(.55, 'rgba(' + rgb + ',.08)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 96, 96); return sprites[rgb] = c;
  }

  function init(cv, list, o) {
    o = o || {};
    list = (list || []).filter(function (m) { return m && m.title; });
    if (!cv || !list.length) return;
    var ctx = cv.getContext('2d'), N = list.length, W = 0, H = 0, DPR = 1, S = [], hov = -1, run = true, vis = true;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
    var M = list.map(function (m, i) {
      var photos = (m.photos && m.photos.length) || m.photoUrl ? 1 : 0;
      var s = 2 + photos + (m.linkedArticleId ? 1 : 0) + (String(m.text || '').length > 250 ? 1 : 0);
      var col = palAt(N > 1 ? i / (N - 1) : 1);
      return { id: m.id, title: String(m.title), date: m.date, s: Math.min(5, s), rgb: col.join(','), j: (hash(m.id) % 1000) / 1000 - .5, x: 0, y: 0 };
    });
    function layout() {
      var pad = Math.max(26, W * .06);
      M.forEach(function (m, i) {
        m.x = N > 1 ? pad + (W - 2 * pad) * (i / (N - 1)) : W / 2;
        m.y = H * .5 + Math.sin(i * 1.25 + .6) * H * .24 + m.j * H * .2;
      });
    }
    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight; if (!W || !H) return;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      var r = (function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(9);
      S = []; var n = Math.round(W * H / 2600);
      for (var i = 0; i < n; i++) S.push({ x: r(), y: r(), r: .3 + r() * .9, a: .1 + r() * .35, p: r() * 6.28, v: .5 + r() * 1.5 });
      layout(); draw(performance.now());
    }
    function bez(i, u) { // bod na křivce mezi hvězdou i a i+1
      var a = M[i], b = M[i + 1], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + ((i % 2) ? -H * .1 : H * .1), v = 1 - u;
      return [v * v * a.x + 2 * v * u * mx + u * u * b.x, v * v * a.y + 2 * v * u * my + u * u * b.y];
    }
    function draw(now) {
      var t = reduce ? 0 : now / 1000;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
      S.forEach(function (s) {
        var a = s.a * (reduce ? 1 : .65 + .35 * Math.sin(t * s.v + s.p));
        ctx.fillStyle = 'rgba(207,238,233,' + a + ')'; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 6.283); ctx.fill();
      });
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (var i = 0; i < N - 1; i++) {
        var a = M[i], b = M[i + 1], g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        g.addColorStop(0, 'rgba(' + a.rgb + ',1)'); g.addColorStop(1, 'rgba(' + b.rgb + ',1)');
        ctx.beginPath(); var p0 = bez(i, 0); ctx.moveTo(p0[0], p0[1]);
        for (var k = 1; k <= 24; k++) { var p = bez(i, k / 24); ctx.lineTo(p[0], p[1]); }
        ctx.strokeStyle = g; ctx.globalAlpha = .1; ctx.lineWidth = 6; ctx.stroke(); ctx.globalAlpha = .6; ctx.lineWidth = 1.2; ctx.stroke(); ctx.globalAlpha = 1;
        if (!reduce) {
          var u = mod(t * .2 + i * .31, 1), q = bez(i, u);
          ctx.globalAlpha = .9 * Math.sin(u * 3.14159); ctx.drawImage(glow(a.rgb), q[0] - 8, q[1] - 8, 16, 16);
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q[0], q[1], 1.2, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
        }
      }
      M.forEach(function (m, i) {
        var r = (3.5 + m.s * 1.9) * (i === hov ? 1.3 : 1), tw = reduce ? 1 : 1 + .08 * Math.sin(t * 2.1 + i * 1.7), gs = r * 3.6 * tw, len = r * 2.4 * tw;
        ctx.drawImage(glow(m.rgb), m.x - gs, m.y - gs, gs * 2, gs * 2);
        [[1, 0], [0, 1]].forEach(function (d) {
          var g = ctx.createLinearGradient(m.x - d[0] * len, m.y - d[1] * len, m.x + d[0] * len, m.y + d[1] * len);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.strokeStyle = g; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(m.x - d[0] * len, m.y - d[1] * len); ctx.lineTo(m.x + d[0] * len, m.y + d[1] * len); ctx.stroke();
        });
        ctx.fillStyle = 'rgba(' + m.rgb + ',.9)'; ctx.beginPath(); ctx.arc(m.x, m.y, r * .46, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(m.x, m.y, r * .27, 0, 6.283); ctx.fill();
        if (i === N - 1 && !reduce) {
          for (var q = 0; q < 2; q++) { var u = mod(t * .45 + q / 2, 1); ctx.strokeStyle = 'rgba(' + m.rgb + ',' + (.5 * (1 - u)) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(m.x, m.y, r * (1 + u * 3), 0, 6.283); ctx.stroke(); }
        }
      });
      ctx.globalCompositeOperation = 'source-over';
    }
    function loop(now) { if (run && vis) draw(now); if (!reduce) requestAnimationFrame(loop); }
    function pick(x, y) { var best = -1, bd = 1e9; M.forEach(function (m, i) { var d = Math.hypot(m.x - x, m.y - y); if (d < 26 && d < bd) { bd = d; best = i; } }); return best; }
    cv.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, h = pick(x, y);
      if (h !== hov) {
        hov = h;
        if (o.wrap) o.wrap.href = h >= 0 ? '/timeline/?m=' + encodeURIComponent(M[h].id) : '/timeline/';
        if (o.tip) {
          if (h >= 0) { o.tip.textContent = M[h].title; o.tip.style.left = Math.min(Math.max(M[h].x, 70), W - 70) + 'px'; o.tip.style.top = (M[h].y - 30) + 'px'; o.tip.classList.add('on'); }
          else o.tip.classList.remove('on');
        }
        if (reduce) draw(0);
      }
    });
    cv.addEventListener('pointerleave', function () { hov = -1; if (o.tip) o.tip.classList.remove('on'); if (o.wrap) o.wrap.href = '/timeline/'; if (reduce) draw(0); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { vis = en[0].isIntersecting; }).observe(cv);
    document.addEventListener('visibilitychange', function () { run = !document.hidden; });
    window.addEventListener('resize', resize);
    resize();
    if (!reduce) requestAnimationFrame(loop);
  }
  window.MiniMap = { init: init };
})();
