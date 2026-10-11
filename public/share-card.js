/* Karta ke sdílení: z článku vyrobí čtvercový obrázek (1080×1080) pro
   WhatsApp, Messenger, Instagram… Kreslí se v prohlížeči přes canvas. */
(function () {
  'use strict';
  var W = 1080, H = 1080;
  var FONT = '"Space Grotesk","Inter",system-ui,sans-serif';

  function wrap(ctx, text, maxW, maxLines) {
    var words = String(text).split(/\s+/), lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line); line = words[i];
        if (lines.length === maxLines) break;
      } else line = test;
    }
    if (lines.length < maxLines && line) lines.push(line);
    else if (lines.length === maxLines && i < words.length) lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s,.;:!?-]*$/, '') + '…';
    return lines;
  }

  async function loadImage(url) {
    try {
      var r = await fetch(url, { mode: 'cors' });
      if (!r.ok) return null;
      var blob = await r.blob();
      return await createImageBitmap(blob);
    } catch (e) { return null; } // cizí doména bez CORS → karta bude bez fotky
  }

  async function draw(opts) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0b0b1c'); g.addColorStop(1, '#1d1740');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // hvězdy (pevný vzor, ať je karta pokaždé stejná)
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 90; i++) { ctx.globalAlpha = 0.15 + rnd() * 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 0.6 + rnd() * 1.8, 0, 6.283); ctx.fill(); }
    ctx.globalAlpha = 1;

    var top = 90;
    var img = opts.imageUrl ? await loadImage(opts.imageUrl) : null;
    if (img) {
      var bx = 90, by = 90, bw = W - 180, bh = 440, r = 28;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(bx + r, by); ctx.arcTo(bx + bw, by, bx + bw, by + bh, r); ctx.arcTo(bx + bw, by + bh, bx, by + bh, r); ctx.arcTo(bx, by + bh, bx, by, r); ctx.arcTo(bx, by, bx + bw, by, r); ctx.closePath(); ctx.clip();
      var s = Math.max(bw / img.width, bh / img.height);
      ctx.drawImage(img, bx + (bw - img.width * s) / 2, by + (bh - img.height * s) / 2, img.width * s, img.height * s);
      ctx.restore();
      top = by + bh + 60;
    } else top = 200;

    ctx.fillStyle = '#f8f5ef'; ctx.textBaseline = 'top';
    var tSize = img ? 58 : 76;
    ctx.font = '700 ' + tSize + 'px ' + FONT;
    var tl = wrap(ctx, opts.title, W - 180, img ? 3 : 4);
    tl.forEach(function (l, k) { ctx.fillText(l, 90, top + k * (tSize * 1.2)); });
    var y = top + tl.length * (tSize * 1.2) + 24;
    if (opts.text) {
      ctx.fillStyle = '#b6bbd6'; ctx.font = '400 34px ' + FONT;
      var bl = wrap(ctx, opts.text, W - 180, img ? 2 : 5);
      bl.forEach(function (l, k) { ctx.fillText(l, 90, y + k * 46); });
    }
    ctx.fillStyle = '#ff7a45'; ctx.fillRect(90, H - 150, 70, 5);
    ctx.fillStyle = '#f8f5ef'; ctx.font = '600 34px ' + FONT;
    ctx.fillText("Zajda's world", 90, H - 125);
    ctx.fillStyle = '#9aa3c0'; ctx.font = '400 28px ' + FONT;
    ctx.fillText('Moje diagnóza, můj vesmír · ' + location.host, 90, H - 78);
    return c;
  }

  function toBlob(c) { return new Promise(function (res) { c.toBlob(res, 'image/png'); }); }

  function modal(canvas, blob, opts) {
    var ov = document.createElement('div');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Karta ke sdílení');
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(5,5,15,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px';
    canvas.style.cssText = 'max-width:min(92vw,520px);max-height:62vh;width:auto;height:auto;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.6)';
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center';
    function btn(label, fn, primary) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.style.cssText = 'font:600 15px ' + FONT + ';padding:10px 20px;border-radius:24px;cursor:pointer;border:1px solid #ff7a45;' + (primary ? 'background:#ff7a45;color:#08080f' : 'background:transparent;color:#f8f5ef');
      b.onclick = fn; return b;
    }
    var file = null;
    try { file = new File([blob], 'zajda-karta.png', { type: 'image/png' }); } catch (e) {}
    var canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
    var msg = document.createElement('div'); msg.style.cssText = 'color:#9aa3c0;font:400 13px ' + FONT; msg.setAttribute('role', 'status');
    if (canShare) row.appendChild(btn('📤 Sdílet', function () {
      navigator.share({ files: [file], title: opts.title, text: opts.title + ' — ' + opts.url, url: opts.url }).catch(function () {});
    }, true));
    row.appendChild(btn('⬇️ Stáhnout obrázek', function () {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'zajda-karta.png';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    }, !canShare));
    var close = btn('Zavřít', function () { ov.remove(); document.removeEventListener('keydown', onKey); if (opener && opener.focus) opener.focus(); });
    row.appendChild(close);
    if (!canShare) msg.textContent = 'Tvůj prohlížeč neumí sdílet přímo — stáhni obrázek a pošli ho v aplikaci.';
    var opener = document.activeElement;
    function onKey(e) { if (e.key === 'Escape') close.click(); }
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', function (e) { if (e.target === ov) close.click(); });
    ov.appendChild(canvas); ov.appendChild(row); ov.appendChild(msg);
    document.body.appendChild(ov);
    close.focus();
  }

  async function open(opts) {
    var c = await draw(opts);
    var blob = await toBlob(c);
    if (!blob) throw new Error('Obrázek se nepodařilo vytvořit');
    modal(c, blob, opts);
  }

  function plain(html) { try { return (new DOMParser().parseFromString(html || '', 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim(); } catch (e) { return ''; } }

  function mount(article, container) {
    if (!article || !container || container.querySelector('.sharecard-btn')) return;
    if (!document.getElementById('sharecard-style')) {
      var st = document.createElement('style'); st.id = 'sharecard-style';
      st.textContent = '.sharecard-btn{display:block;margin:12px auto 0;font:500 13px "Space Grotesk",sans-serif;padding:7px 16px;border-radius:22px;cursor:pointer;color:var(--mist,#9aa3c0);background:transparent;border:1px dashed var(--panel-border,rgba(140,150,255,.35))}.sharecard-btn:hover:not(:disabled){color:var(--parchment,#f8f5ef);border-color:var(--ember,#ff7a45)}';
      document.head.appendChild(st);
    }
    var b = document.createElement('button'); b.type = 'button'; b.className = 'sharecard-btn';
    b.textContent = '🖼️ Karta ke sdílení (obrázek)';
    b.onclick = async function () {
      b.disabled = true;
      try {
        var text = article.excerpt || plain(article.content).slice(0, 220);
        await open({ title: article.title || 'Zajda\'s world', text: text, imageUrl: article.coverUrl || '', url: location.href });
      } catch (e) { b.textContent = '⚠️ Kartu se nepodařilo vytvořit'; setTimeout(function () { b.textContent = '🖼️ Karta ke sdílení (obrázek)'; }, 3000); }
      b.disabled = false;
    };
    var host = container.querySelector('.heart-box');
    if (host) host.appendChild(b); else container.appendChild(b);
  }
  window.ShareCard = { open: open, mount: mount };
})();
