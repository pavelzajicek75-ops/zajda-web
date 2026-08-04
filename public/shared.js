/* =========================================================
   shared.js — společné pro index.html, article.html, about.html
   =========================================================
   Sem patří JEN kód, který byl doslova identický (copy-paste) na všech
   3 stránkách: generování hvězdného pozadí, systém plovoucích citátů
   se souhvězdím mezi nimi, a dvě drobné utility funkce. Přesně tenhle
   druh duplicity dřív způsobil bug, kdy se oprava odkazů propsala jen
   do dvou stránek ze tří — proto je to teď na jednom místě.

   Stránka, která chce citáty, jen zavolá startQuotes() — pokud na ní
   není <svg id="constellationLayer">, kód se sám bezpečně nic nedělá
   (viz updateConstellation), takže je klidně includovat všude.
   ========================================================= */

function escapeHtml(t) {
  if (t == null) return '';
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('cs', { year: 'numeric', month: 'numeric', day: 'numeric' });
  } catch (e) { return ''; }
}

/* Vygeneruje `count` blikajících hvězd do #stars. Volat po DOMContentLoaded
   (nebo kdykoliv po vykreslení <div id="stars">). */
function initStarfield(count) {
  var starsBox = document.getElementById('stars');
  if (!starsBox) return;
  var frag = document.createDocumentFragment();
  for (var i = 0; i < count; i++) {
    var s = document.createElement('div');
    s.className = 'star';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.setProperty('--dur', (3 + Math.random() * 4) + 's');
    s.style.setProperty('--del', (Math.random() * 5) + 's');
    frag.appendChild(s);
  }
  starsBox.appendChild(frag);
}

/* === SYSTÉM PLOVOUCÍCH CITÁTŮ + SOUHVĚZDÍ === */
var __reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var __activeQuotes = []; // { el }
var __constellationRunning = false;
var __DECODE_CHARS = '#*+·˚✦✧⋆°ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzáčďéěíňóřšťúůýž';

async function loadQuotes() {
  try { var r = await fetch('/api/quotes/list'); if (!r.ok) return []; return await r.json(); }
  catch (e) { return []; }
}

function decodeText(el, finalText, duration) {
  if (__reduceMotion || !finalText) { el.textContent = finalText || ''; return; }
  var len = finalText.length;
  var start = null;
  function frame(ts) {
    if (!start) start = ts;
    var progress = Math.min(1, (ts - start) / duration);
    var revealCount = Math.floor(progress * len);
    var out = '';
    for (var i = 0; i < len; i++) {
      var ch = finalText[i];
      if (i < revealCount || ch === ' ') out += ch;
      else out += __DECODE_CHARS[Math.floor(Math.random() * __DECODE_CHARS.length)];
    }
    el.textContent = out;
    if (progress < 1) requestAnimationFrame(frame);
    else el.textContent = finalText;
  }
  requestAnimationFrame(frame);
}

function updateConstellation() {
  var constellationSvg = document.getElementById('constellationLayer');
  if (!constellationSvg) return;
  var w = window.innerWidth, h = window.innerHeight;
  constellationSvg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
  var centers = __activeQuotes.map(function (entry) {
    var r = entry.el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, hover: entry.el.classList.contains('hover-active') };
  });
  var svgns = 'http://www.w3.org/2000/svg';
  var frag = document.createDocumentFragment();
  var maxDist = 380;
  for (var i = 0; i < centers.length; i++) {
    for (var j = i + 1; j < centers.length; j++) {
      var a = centers[i], b = centers[j];
      var dx = a.x - b.x, dy = a.y - b.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < maxDist) {
        var line = document.createElementNS(svgns, 'line');
        line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
        line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
        var highlight = a.hover || b.hover;
        var baseOpacity = (1 - dist / maxDist) * 0.3;
        line.setAttribute('class', 'constellation-line' + (highlight ? ' active' : ''));
        line.setAttribute('stroke-opacity', String(highlight ? Math.min(0.9, baseOpacity + 0.5) : baseOpacity));
        frag.appendChild(line);
      }
    }
  }
  constellationSvg.innerHTML = '';
  constellationSvg.appendChild(frag);
  if (__activeQuotes.length > 0) requestAnimationFrame(updateConstellation);
  else __constellationRunning = false;
}

function __ensureConstellationLoop() {
  if (!__constellationRunning && !__reduceMotion) {
    __constellationRunning = true;
    requestAnimationFrame(updateConstellation);
  }
}

function spawnQuote(q) {
  var el = document.createElement('div');
  el.className = 'quote-star';
  var sz = 13 + Math.floor(Math.random() * 10);

  var sx = Math.random() * (window.innerWidth - 100);
  var sy = Math.random() * (window.innerHeight - 80);
  el.style.left = sx + 'px';
  el.style.top = sy + 'px';
  var ex = (Math.random() - 0.5) * 400;
  var ey = (Math.random() - 0.5) * 400;
  el.style.setProperty('--sx', '0px');
  el.style.setProperty('--sy', '0px');
  el.style.setProperty('--ex', ex + 'px');
  el.style.setProperty('--ey', ey + 'px');
  el.style.animationDuration = (14 + Math.random() * 10) + 's';
  var tailAngle = (Math.atan2(ey, ex) * 180 / Math.PI) + 180;
  el.style.setProperty('--tail-angle', tailAngle + 'deg');

  el.innerHTML =
    '<span class="comet-tail"></span>' +
    '<span class="signal-dot"></span>' +
    '<div class="quote-inner" style="font-size:' + sz + 'px">"<span class="quote-text"></span>"' +
    '<span class="quote-author"></span></div>';

  document.body.appendChild(el);

  var entry = { el: el };
  __activeQuotes.push(entry);
  __ensureConstellationLoop();

  el.addEventListener('mouseenter', function () { el.classList.add('hover-active'); });
  el.addEventListener('mouseleave', function () { el.classList.remove('hover-active'); });

  // Klik/tap navíc — na dotykových zařízeních (mobil, tablet) se
  // mouseenter/mouseleave nikdy nespustí, takže citáty šlo dřív odhalit
  // jen myší. Klik teď přepíná stejnou třídu, co dělá hover; tap na
  // jiný citát ten předchozí "zavře", ať se jich nekupí odhalených víc.
  el.addEventListener('click', function (e) {
    e.stopPropagation();
    var wasActive = el.classList.contains('hover-active');
    document.querySelectorAll('.quote-star.hover-active').forEach(function (other) {
      if (other !== el) other.classList.remove('hover-active');
    });
    el.classList.toggle('hover-active', !wasActive);
  });

  var textEl = el.querySelector('.quote-text');
  var authorEl = el.querySelector('.quote-author');
  var revealDelay = __reduceMotion ? 0 : 400 + Math.random() * 500;
  setTimeout(function () {
    el.classList.add('revealed');
    decodeText(textEl, q.text || '', __reduceMotion ? 0 : 650);
    setTimeout(function () {
      authorEl.textContent = q.author || '';
      authorEl.classList.add('shown');
    }, __reduceMotion ? 0 : 700);
  }, revealDelay);

  setTimeout(function () {
    el.remove();
    var idx = __activeQuotes.indexOf(entry);
    if (idx > -1) __activeQuotes.splice(idx, 1);
  }, 25000);
}

async function startQuotes() {
  var quotes = await loadQuotes();
  if (!quotes.length) return;
  for (var i = 0; i < Math.min(8, quotes.length); i++) spawnQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  setInterval(function () {
    if (document.querySelectorAll('.quote-star').length > 12) return;
    spawnQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, 5000);
}
