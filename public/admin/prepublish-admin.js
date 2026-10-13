/* ✅ Kontrola před zveřejněním: při ukládání zveřejněného článku se zeptá, když chybí
   titulní fotka, štítek nebo perex. (Popisky fotek se nehlídají — web je doplní sám.) Koncepty a naplánované se nekontrolují. */
(function () {
  'use strict';
  function missing(p) {
    var out = [];
    if (!p || p.published !== true) return out;
    if (!p.coverUrl) out.push('titulní fotka');
    if (!(p.tags && p.tags.length)) out.push('štítek (tag)');
    if (!(p.excerpt || '').trim()) out.push('perex (krátký popis pro sdílení)');
    return out;
  }
  // Vrací true = pokračuj v ukládání.
  window.confirmPrePublish = async function (payload) {
    var m = missing(payload);
    if (!m.length || typeof showConfirm !== 'function') return true;
    return showConfirm('Před zveřejněním chybí: ' + m.join(', ') + '. Uložit i tak?', { confirmText: 'Uložit i tak', cancelText: 'Doplnit' });
  };
  window.PrePublish = { missing: missing };
})();
