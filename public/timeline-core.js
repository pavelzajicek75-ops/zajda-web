/* =========================================================
   timeline-core.js
   =========================================================
   Jediný zdroj pravdy pro vykreslení a sdílení časové osy — použije
   ho jak /about/ (kde se timeline zobrazuje vložená pod hlavním
   textem), tak /timeline/ (samostatná, fokusovaná stránka určená
   především ke sdílení jednotlivých milníků).

   DŮLEŽITÉ: odkazy na sdílení VŽDY míří na /timeline/#milestone-<id>,
   bez ohledu na to, odkud se render() volá — i když si čtenář otevře
   milník vložený v /about/, sdílený odkaz vede na fokusovanou stránku
   jen s časovou osou, ne na celou stránku "O Zajdovi" s životopisem,
   podsekcemi a aktualitami navíc.

   Vyžaduje už načtené: shared.js (escapeHtml) a na stránce musí
   existovat funkce window.openLightbox(src) pro otevření fotky.

   Použití:
     await TimelineCore.render({
       trackId: 'timelineTrack',     // povinné — id kontejneru pro karty
       sectionId: 'timelineSection'  // volitelné — element se odkryje (display:block), když jsou data
     });
   ========================================================= */
(function () {
  var SHARE_BASE_PATH = '/timeline/';

  function formatDateCz(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return ''; }
  }

  /* === SDÍLENÍ MILNÍKU ===
     navigator.share() je nativní systémová nabídka (na mobilu typicky
     zahrnuje Messenger, WhatsApp, SMS, e-mail... podle toho, co má
     čtenář nainstalované) — bez nutnosti řešit Messengeru vlastní
     webový dialog (ten vyžaduje Facebook App ID, které nemáme).
     WhatsApp odkaz vedle toho zůstává jako explicitní fallback i na
     desktopu, kde navigator.share obvykle není. */
  window.shareMilestone = function (text, url) {
    if (navigator.share) {
      navigator.share({ title: text, url: url }).catch(function () { /* uživatel zavřel nabídku — nic se neděje */ });
    }
  };

  window.copyMilestoneLink = function (btn, url) {
    var done = function () {
      var original = btn.textContent;
      btn.textContent = '✅ Zkopírováno';
      btn.classList.add('copied');
      setTimeout(function () { btn.textContent = original; btn.classList.remove('copied'); }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(function () { prompt('Zkopíruj odkaz ručně:', url); });
    } else {
      prompt('Zkopíruj odkaz ručně:', url);
    }
  };

  async function render(opts) {
    var options = opts || {};
    var track = document.getElementById(options.trackId);
    if (!track) return;

    try {
      var r = await fetch('/api/timeline/list');
      if (!r.ok) return;
      var data = await r.json();
      var milestones = Array.isArray(data) ? data : [];
      if (!milestones.length) return;

      // API vrací od nejstaršího po nejnovější (na tom pořadí závisí i
      // jiné části webu, např. poznámka o čerstvém milníku na
      // homepage) — tady, jen pro ZOBRAZENÍ, se pořadí otočí: nejnovější
      // milník nahoře.
      var milestonesDisplay = milestones.slice().reverse();

      if (options.sectionId) {
        var sectionEl = document.getElementById(options.sectionId);
        if (sectionEl) sectionEl.style.display = 'block';
      }

      track.innerHTML = milestonesDisplay.map(function (m) {
        var dateStr = formatDateCz(m.date);
        var photos = (m.photos && m.photos.length) ? m.photos : (m.photoUrl ? [m.photoUrl] : []);
        var photoHtml = '';
        if (photos.length === 1) {
          photoHtml = '<img src="' + escapeHtml(photos[0]) + '" alt="" loading="lazy">';
        } else if (photos.length > 1) {
          photoHtml = '<div class="timeline-photo-grid" style="--tl-photo-count:' + photos.length + '">' +
            photos.map(function (u) { return '<img src="' + escapeHtml(u) + '" alt="" loading="lazy">'; }).join('') +
            '</div>';
        }
        var textHtml = m.text ? '<p>' + escapeHtml(m.text).replace(/\n/g, '<br>') + '</p>' : '';
        var mTitle = m.title || '';
        // ★ NOVÉ: nepovinné propojení s článkem — jednoduchý odkaz pod
        // textem milníku. Nepotřebuje znát název článku (žádný další
        // fetch navíc) — text odkazu je obecný a stačí.
        var linkedHtml = m.linkedArticleId
          ? '<a class="timeline-linked-article" href="/article?id=' + encodeURIComponent(m.linkedArticleId) + '">O týhle cestě víc píšu tady →</a>'
          : '';
        var shareUrl = window.location.origin + SHARE_BASE_PATH + '#milestone-' + encodeURIComponent(m.id);
        var shareText = mTitle + ' — Moje diagnóza, můj vesmír';
        var shareHtml = '<div class="timeline-share">' +
          '<button type="button" class="milestone-share-native" onclick="shareMilestone(\'' + escapeHtml(shareText) + '\', \'' + escapeHtml(shareUrl) + '\')">📤 Sdílet</button>' +
          '<a class="wa" href="https://wa.me/?text=' + encodeURIComponent(shareText + ' ' + shareUrl) + '" target="_blank" rel="noopener">WhatsApp</a>' +
          '<button type="button" onclick="copyMilestoneLink(this, \'' + escapeHtml(shareUrl) + '\')">🔗 Kopírovat odkaz</button>' +
          '</div>';
        return '<div class="timeline-item" id="milestone-' + escapeHtml(String(m.id)) + '"><div class="timeline-dot"></div><div class="timeline-card">' +
          (dateStr ? '<span class="timeline-date">' + escapeHtml(dateStr) + '</span>' : '') +
          '<h3>' + escapeHtml(mTitle) + '</h3>' +
          photoHtml + textHtml + linkedHtml + shareHtml +
          '</div></div>';
      }).join('');

      // "📤 Sdílet" (nativní systémová nabídka) se zobrazí, jen kde ho
      // prohlížeč umí — jinak by na desktopu trčelo tlačítko, co nic
      // neudělá. WhatsApp a kopírování zůstávají vždy.
      if (!navigator.share) {
        track.querySelectorAll('.milestone-share-native').forEach(function (btn) { btn.remove(); });
      }

      track.querySelectorAll('img').forEach(function (img) {
        img.addEventListener('click', function () {
          if (typeof window.openLightbox === 'function') window.openLightbox(this.src);
        });
      });

      // Postupné odhalení karet při scrollování — v duchu "hvězd", co
      // se objevují na obloze jedna po druhé, ne celá timeline naráz.
      if ('IntersectionObserver' in window) {
        var obs = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { entry.target.classList.add('in-view'); obs.unobserve(entry.target); }
          });
        }, { threshold: 0.15 });
        track.querySelectorAll('.timeline-item').forEach(function (el) { obs.observe(el); });
      } else {
        track.querySelectorAll('.timeline-item').forEach(function (el) { el.classList.add('in-view'); });
      }

      // Pokud stránku někdo otevřel přes sdílený odkaz na konkrétní
      // milník (#milestone-xyz), doscrollovat k němu — jinak by
      // sdílený odkaz jen otevřel stránku nahoře a čtenář by musel
      // hledat sám.
      if (window.location.hash && window.location.hash.indexOf('#milestone-') === 0) {
        var target = document.getElementById(window.location.hash.slice(1));
        if (target) {
          target.classList.add('in-view'); // rovnou viditelné, ať se nečeká na scroll animaci
          setTimeout(function () { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
        }
      }
    } catch (e) {
      console.error('Timeline:', e);
    }
  }

  window.TimelineCore = { render: render };
})();
