/* Výlet v editoru článku: když je vybraná podsekce s víc články, ukáže stav výletu
   (kolik dílů, kolik má trasu), upozorní na díl bez zastávek a nabídne
   „Zobrazit celý výlet na mapě“. Čte se z window._articlesCache (načítá loadArticles). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function ts(a) { if (a && a.date) { const t = new Date(a.date).getTime(); if (!isNaN(t)) return t; } return a && typeof a.created === 'number' ? a.created : 0; }
  function hasRoute(a) {
    const st = Array.isArray(a.stops) ? a.stops.filter(s => s && Number.isFinite(+s.lat) && Number.isFinite(+s.lng)) : [];
    return st.length >= 2 || (Number.isFinite(+a.lat) && Number.isFinite(+a.lng) && a.lat !== null && a.lng !== null && a.lat !== '' );
  }
  function box() {
    let b = $('tripPreviewBox');
    if (b) return b;
    const sel = $('artSubsection'); if (!sel) return null;
    const row = sel.closest('.form-row') || sel.parentNode;
    b = document.createElement('div'); b.id = 'tripPreviewBox'; b.hidden = true;
    b.style.cssText = 'margin:8px 0;padding:10px 12px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-size:13px;line-height:1.5';
    row.parentNode.insertBefore(b, row.nextSibling);
    return b;
  }
  let lastKey = '';
  async function refresh(force) {
    const sel = $('artSubsection'), secEl = $('artSection'); if (!sel || !secEl) return;
    const sub = sel.value, sec = secEl.value, editId = $('artEditor')?.dataset?.editId || '';
    const dateV = $('artDate')?.value || '';
    const key = [sub, sec, editId, dateV, (window._articlesCache || []).length].join('|');
    if (!force && key === lastKey) return;
    lastKey = key;
    const b = box(); if (!b) return;
    if (!sub) { b.hidden = true; return; }
    let all = window._articlesCache;
    if (!Array.isArray(all)) { try { const r = await fetch('/api/articles/list'); const d = r.ok ? await r.json() : []; all = Array.isArray(d) ? d : (d.articles || []); } catch (e) { all = []; } }
    const list = all.filter(a => a && String(a.subsectionId || '') === String(sub) && (!sec || String(a.sectionId || '') === String(sec)));
    const isNew = !editId || !list.some(a => String(a.id) === String(editId));
    const cur = isNew ? { id: '__new', title: '(tento nový článek)', date: dateV, created: Date.now(), __new: true } : null;
    const items = list.slice(); if (cur) items.push(cur);
    items.sort((a, c) => (ts(a) - ts(c)) || ((a.created || 0) - (c.created || 0)));
    const n = items.length;
    b.hidden = false;
    if (n < 2) { b.innerHTML = '🧭 V téhle podsekci je zatím jediný článek — až přibudou další, naváží se na sebe jako díly výletu.'; return; }
    const withRoute = items.filter(a => !a.__new && hasRoute(a)).length;
    const warns = [];
    items.forEach((a, i) => {
      if (a.__new) return;
      if (!hasRoute(a)) warns.push('Díl ' + (i + 1) + ' „' + (a.title || 'Bez názvu') + '“ nemá zastávky — na mapě výletu bude chybět.');
    });
    const idx = items.findIndex(a => String(a.id) === String(editId) || a.__new);
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const url = '/vylet?s=' + encodeURIComponent(sec || (items[0].sectionId || '')) + '&sub=' + encodeURIComponent(sub);
    b.innerHTML = '<div><b>🧭 Výlet: ' + n + ' dílů</b> · tenhle článek bude díl <b>' + (idx + 1) + '</b> · trasu má ' + withRoute + ' z ' + (n - (isNew ? 1 : 0)) + ' uložených</div>' +
      (warns.length ? '<div style="color:#fbbf24;margin-top:4px">⚠️ ' + warns.map(esc).join('<br>⚠️ ') + '</div>' : '<div style="color:#86efac;margin-top:4px">✓ Všechny uložené díly mají polohu.</div>') +
      '<div style="margin-top:6px"><a class="btn btn-blue btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener">🗺️ Zobrazit celý výlet na mapě</a></div>';
  }
  setInterval(() => { try { refresh(false); } catch (e) {} }, 1500);
  document.addEventListener('change', e => { if (e.target && (e.target.id === 'artSubsection' || e.target.id === 'artDate' || e.target.id === 'artSection')) setTimeout(() => refresh(true), 300); });
  window.TripPreview = { refresh: () => refresh(true) };
})();
