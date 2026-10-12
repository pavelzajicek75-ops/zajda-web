/* 🎧 Vložení zvuku / videa do článku: odkaz na YouTube (bez sledování, youtube-nocookie),
   nebo přímý odkaz na zvukový/video soubor (mp3, m4a, ogg, wav, mp4, webm) přes https. */
(function () {
  'use strict';
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function youtubeId(u) {
    var m = String(u).match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})(?:[?&#].*)?$/i);
    return m ? m[1] : null;
  }
  function mediaKind(u) {
    var p; try { p = new URL(u).pathname; } catch (e) { return null; }
    if (/\.(mp3|m4a|ogg|oga|wav|aac)$/i.test(p)) return 'audio';
    if (/\.(mp4|webm|mov|m4v)$/i.test(p)) return 'video';
    return null;
  }
  // Vrací HTML k vložení, nebo null, když odkaz není podporovaný.
  function buildEmbed(url) {
    url = String(url || '').trim();
    if (!/^https:\/\//i.test(url)) return null;
    var id = youtubeId(url);
    if (id) {
      return '<div class="embed-wrap" contenteditable="false" style="position:relative;padding-top:56.25%;margin:1rem 0;border-radius:8px;overflow:hidden;background:#000">' +
        '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '" title="Video z YouTube" loading="lazy" allowfullscreen ' +
        'referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe></div><p><br></p>';
    }
    var k = mediaKind(url);
    if (k === 'audio') return '<p><audio controls preload="none" src="' + esc(url) + '" style="width:100%">Prohlížeč nepodporuje přehrávání zvuku.</audio></p>';
    if (k === 'video') return '<p><video controls playsinline preload="metadata" src="' + esc(url) + '" style="max-width:100%;border-radius:8px">Prohlížeč nepodporuje přehrávání videa.</video></p>';
    return null;
  }
  window.EmbedMedia = { buildEmbed: buildEmbed, youtubeId: youtubeId };

  window.insertMedia = function () {
    var ed = document.getElementById('artEditor'); if (!ed) return;
    var url = prompt('Vlož odkaz na YouTube video, nebo přímý https odkaz na zvuk/video soubor (mp3, m4a, mp4, webm):');
    if (!url) { ed.focus(); return; }
    var html = buildEmbed(url);
    if (!html) { if (typeof showToast === 'function') showToast('Tenhle odkaz neumím vložit. Použij YouTube nebo přímý odkaz na mp3/mp4 přes https.', 'error'); return; }
    ed.focus();
    if (!document.execCommand('insertHTML', false, html)) ed.insertAdjacentHTML('beforeend', html);
  };
})();
