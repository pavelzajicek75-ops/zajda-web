/* =========================================================
   DASHBOARD CORE — auth, navigace, galerie, upload
   ========================================================= */

/* === AUTOMATICKÉ PŘIPOJENÍ PŘIHLAŠOVACÍHO TOKENU KE VŠEM VOLÁNÍM ===
   Web ukládá přihlašovací token do localStorage (ne do cookie) a backend
   ho čeká jako "Authorization: Bearer <token>" hlavičku (viz /admin/index.js
   a jeho /api/verify). Aby nebylo nutné ručně dopisovat hlavičku do
   desítek jednotlivých fetch() volání po celém dashboardu, "nastrčí" se
   token automaticky do každého fetch() na tento web hned tady — jednou,
   na jednom místě. Volání na cizí domény (mimo tento původ) hlavičku
   nedostanou, aby se token neposílal nikam ven. */
(function patchFetchWithAuthToken() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const token = localStorage.getItem('token');
    if (token) {
      let url;
      try { url = new URL(typeof input === 'string' ? input : input.url, window.location.origin); }
      catch { url = null; }
      const sameOrigin = !url || url.origin === window.location.origin;
      if (sameOrigin) {
        init = init || {};
        const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
        if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
        init.headers = headers;
      }
    }
    return originalFetch(input, init);
  };
})();

/* === UTILITY === */
function $(id) { return document.getElementById(id); }

/* === TOAST NOTIFIKACE (náhrada za alert()) === */
function showToast(message, type = 'info') {
  let host = document.getElementById('toastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toastHost';
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const icons = { info: 'ℹ️', success: '✅', error: '⚠️' };
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-msg"></span>`;
  toast.querySelector('.toast-msg').textContent = message;
  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-in'));
  const remove = () => {
    toast.classList.remove('toast-in');
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 220);
  };
  const timer = setTimeout(remove, type === 'error' ? 5000 : 3200);
  toast.addEventListener('click', () => { clearTimeout(timer); remove(); });
}

/* === "ZRUŠITELNÝ" TOAST — bezpečnostní síťka pro mazání ===
   Akce (smazání) se hned VIZUÁLNĚ projeví, ale skutečně se provede
   (onCommit) až po pár vteřinách — mezitím jde kliknout na "Zpět"
   (onUndo) a nic se nestane. */
function showUndoToast(message, onUndo, onCommit, delayMs = 6000) {
  let host = document.getElementById('toastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toastHost';
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.className = 'toast toast-info toast-undo';
  toast.innerHTML = `<span class="toast-icon">🗑️</span><span class="toast-msg"></span><button class="toast-undo-btn">↩ Zpět</button>`;
  toast.querySelector('.toast-msg').textContent = message;
  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-in'));

  let done = false;
  const remove = () => {
    toast.classList.remove('toast-in');
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 220);
  };
  const timer = setTimeout(() => {
    if (done) return;
    done = true;
    onCommit();
    remove();
  }, delayMs);
  toast.querySelector('.toast-undo-btn').addEventListener('click', () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    onUndo();
    remove();
  });
}

/* === VLASTNÍ POTVRZOVACÍ MODAL (náhrada za confirm()) ===
   Vrací Promise<boolean> — použití: if (!(await showConfirm('Smazat?'))) return; */
function showConfirm(message, { danger = false, confirmText = 'Potvrdit', cancelText = 'Zrušit' } = {}) {
  return new Promise(resolve => {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `
      <div class="modal-box" style="max-width:380px">
        <h3>${danger ? '⚠️ Potvrzení' : '❓ Potvrzení'}</h3>
        <p style="color:var(--text-muted);font-size:14px;line-height:1.5"></p>
        <div class="modal-actions">
          <button class="btn ${danger ? 'btn-red' : 'btn-blue'}" data-act="yes"></button>
          <button class="btn" data-act="no"></button>
        </div>
      </div>`;
    m.querySelector('p').textContent = message;
    m.querySelector('[data-act="yes"]').textContent = confirmText;
    m.querySelector('[data-act="no"]').textContent = cancelText;
    const finish = (result) => { m.remove(); resolve(result); };
    m.querySelector('[data-act="yes"]').onclick = () => finish(true);
    m.querySelector('[data-act="no"]').onclick = () => finish(false);
    m.onclick = e => { if (e.target === m) finish(false); };
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', esc); finish(false); }
    });
    document.body.appendChild(m);
  });
}

function escapeHtml(t) {
  if (!t) return '';
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

/* Sdílený globální stav galerie — dashboard-editor.js na tento objekt navazuje */
window.G = window.G || { photos: [], selected: new Set() };
if (!G.selected) G.selected = new Set();

let showExif = false;
const exifCache = new Map();

/* === AUTH === */
async function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/admin/login.html';
    return false;
  }
  try {
    const r = await fetch('/api/verify', { method: 'POST' });
    const data = await r.json().catch(() => ({ ok: false }));
    if (!r.ok || !data.ok) {
      localStorage.removeItem('token');
      window.location.href = '/admin/login.html';
      return false;
    }
    return true;
  } catch (e) {
    console.error('Chyba ověření přihlášení:', e);
    showToast('Nepodařilo se ověřit přihlášení (chyba serveru).', 'error');
    return false;
  }
}

async function logout() {
  localStorage.removeItem('token');
  window.location.href = '/admin/login.html';
}

/* === NAVIGACE (ribbon) === */
const RIBBON_TABS = ['galleries', 'articles', 'quotes', 'subsections', 'about', 'admin'];

function showTab(name) {
  if (!RIBBON_TABS.includes(name)) name = 'galleries';
  document.querySelectorAll('.ribbon-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.dash-content .section').forEach(s => s.classList.toggle('active', s.id === name));
  localStorage.setItem('dashActiveTab', name);
  showRibbonGroup(name);
  loadSection(name);
  moveTabIndicator();
}

/* Posune plovoucí "pilulku" pod aktivní záložku (jako segmentovaný přepínač) */
function moveTabIndicator() {
  const active = document.querySelector('.ribbon-tab.active');
  const indicator = $('ribbonTabIndicator');
  if (!active || !indicator) return;
  indicator.style.width = active.offsetWidth + 'px';
  indicator.style.transform = `translateX(${active.offsetLeft}px)`;
}
window.addEventListener('resize', () => moveTabIndicator());

function showRibbonGroup(name) {
  document.querySelectorAll('.ribbon-group').forEach(g => g.classList.toggle('active', g.dataset.for === name));
  restoreRibbonOrder(name);
  applyRibbonVisibility(name);
  const toggleBtn = $('reorderToggleBtn');
  if (toggleBtn) toggleBtn.classList.remove('active');
  const activeGroup = document.querySelector('.ribbon-group.active');
  if (activeGroup) activeGroup.classList.remove('reorder-mode');
}

/* === PŘEUSPOŘÁDÁNÍ TLAČÍTEK V RIBBONU (drag & drop, uloží se do localStorage) === */
function toggleRibbonReorderMode() {
  toggleToolbarReorderMode(document.querySelector('.ribbon-group.active'));
}

/* Obecná verze — funguje pro ribbon i pro WYSIWYG toolbar (Tučně/Kurzíva/...) */
function toggleToolbarReorderMode(toolbarEl) {
  if (!toolbarEl) return;
  const nowOn = !toolbarEl.classList.contains('reorder-mode');
  toolbarEl.classList.toggle('reorder-mode', nowOn);
  setRibbonItemsDraggable(toolbarEl, nowOn);
  const toggleBtn = toolbarEl.querySelector(':scope > .toolbar-reorder-btn') || $('reorderToggleBtn');
  if (toggleBtn) toggleBtn.classList.toggle('active', nowOn);
}

function setRibbonItemsDraggable(group, enabled) {
  group.querySelectorAll('[data-key]').forEach(child => {
    let badge = child.querySelector(':scope > .ribbon-grip-badge');
    if (enabled) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'ribbon-grip-badge';
        badge.textContent = '⠿';
        badge.title = 'Táhni = přesunout v rámci skupiny · Klikni na prvek = skrýt';
        badge.draggable = true;
        child.appendChild(badge);
      }
      child.title = 'Klikni pro skrytí, nebo táhni za ⠿ pro přesun v rámci skupiny';
    } else {
      if (badge) badge.remove();
      child.removeAttribute('title');
    }
  });
}

/* === SKRÝVÁNÍ PRVKŮ V PANELU (samostatně od pořadí) === */
function getHiddenRibbonItems(name) {
  try { return JSON.parse(localStorage.getItem('ribbonHidden:' + name) || '[]'); } catch { return []; }
}

function saveHiddenRibbonItems(name, list) {
  localStorage.setItem('ribbonHidden:' + name, JSON.stringify([...new Set(list)]));
}

function hideRibbonItem(group, key) {
  const name = group.dataset.for;
  const hidden = getHiddenRibbonItems(name);
  if (!hidden.includes(key)) hidden.push(key);
  saveHiddenRibbonItems(name, hidden);
  applyRibbonVisibility(name);
  showToast('Prvek skrytý — vrátíš ho přes "Obnovit vše"', 'info');
}

/* Aplikuje na VŠECHNY instance se stejným data-for (např. dva editor-toolbary — Články i O Zajdovi) */
function applyRibbonVisibility(name) {
  const hidden = getHiddenRibbonItems(name);
  document.querySelectorAll(`[data-for="${name}"]`).forEach(group => {
    group.querySelectorAll('[data-key]').forEach(child => {
      child.style.display = hidden.includes(child.dataset.key) ? 'none' : '';
    });
  });
}

function restoreAllRibbonItems() {
  const group = document.querySelector('.ribbon-group.active');
  if (!group) return;
  restoreAllToolbarItems(group.dataset.for);
}

function restoreAllToolbarItems(name) {
  if (!name) return;
  saveHiddenRibbonItems(name, []);
  localStorage.removeItem('ribbonOrder:' + name);
  showToast('Obnovuji výchozí pořadí a viditelnost…', 'success');
  setTimeout(() => location.reload(), 500);
}

let ribbonDraggedItem = null;

function initRibbonDragReorder() {
  const isExempt = (el) => el.closest('.toolbar-reorder-btn, .ribbon-reorder-toggle');
  document.querySelectorAll('.ribbon-group, .editor-toolbar').forEach(group => {
    group.addEventListener('mousedown', e => {
      if (!group.classList.contains('reorder-mode') || isExempt(e.target)) return;
      if (e.target.closest('.ribbon-grip-badge')) return; // nechat projít, ať funguje tažení
      e.preventDefault();
      e.stopPropagation();
      const item = e.target.closest('[data-key]');
      if (item) hideRibbonItem(group, item.dataset.key);
    }, true);
    group.addEventListener('click', e => {
      if (group.classList.contains('reorder-mode') && !isExempt(e.target)) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    /* Tažení se zahajuje jen z malého úchytu ⠿ (spolehlivé i pro selecty,
       které nativní HTML5 drag jinak ignorují) — ne z celého prvku. */
    group.addEventListener('dragstart', e => {
      const badge = e.target.closest('.ribbon-grip-badge');
      if (!badge) return;
      const item = badge.closest('[data-key]');
      if (!item || !group.contains(item) || !group.classList.contains('reorder-mode')) return;
      ribbonDraggedItem = item;
      item.classList.add('ribbon-item-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    group.addEventListener('dragend', () => {
      if (ribbonDraggedItem) ribbonDraggedItem.classList.remove('ribbon-item-dragging');
      ribbonDraggedItem = null;
      saveRibbonOrder(group);
    });
    group.addEventListener('dragover', e => {
      if (!ribbonDraggedItem || !group.classList.contains('reorder-mode')) return;
      e.preventDefault();
      const target = e.target.closest('[data-key]');
      /* Přesun se omezuje na stejnou vizuální sekci (stejný přímý rodič) —
         dává smysl přesouvat tlačítka jen v rámci logické skupiny (Písmo,
         Zarovnání, Obrázky…), ne napříč sekcemi. */
      if (!target || target === ribbonDraggedItem || target.parentElement !== ribbonDraggedItem.parentElement) return;
      const rect = target.getBoundingClientRect();
      const before = e.clientX < rect.left + rect.width / 2;
      target.parentElement.insertBefore(ribbonDraggedItem, before ? target : target.nextSibling);
    });
  });
}

function saveRibbonOrder(group) {
  const name = group.dataset.for;
  if (!name) return;
  const order = Array.from(group.querySelectorAll('[data-key]')).map(c => c.dataset.key).filter(Boolean);
  localStorage.setItem('ribbonOrder:' + name, JSON.stringify(order));
  restoreRibbonOrder(name); // hned zrcadlit do všech instancí se stejným klíčem (např. druhý editor-toolbar)
}

/* Aplikuje na VŠECHNY instance se stejným data-for */
function restoreRibbonOrder(name) {
  let order;
  try { order = JSON.parse(localStorage.getItem('ribbonOrder:' + name) || 'null'); } catch { order = null; }
  if (!Array.isArray(order) || !order.length) return;
  document.querySelectorAll(`[data-for="${name}"]`).forEach(group => {
    const byKey = new Map();
    group.querySelectorAll('[data-key]').forEach(c => { if (c.dataset.key) byKey.set(c.dataset.key, c); });
    order.forEach(key => {
      const el = byKey.get(key);
      // Posune prvek na konec v rámci JEHO VLASTNÍHO rodiče (sekce) — nikdy
      // ho nepřesouvá mezi sekcemi, jen mění pořadí uvnitř té svojí.
      if (el && el.parentElement) el.parentElement.appendChild(el);
    });
  });
}

function loadSection(name) {
  if (name === 'galleries') {
    syncUploadQuickControls();
    loadGallery().then(() => { renderGallery(); loadStats(); });
  } else if (name === 'articles') {
    if (typeof loadArticles === 'function') loadArticles();
    if (typeof loadArtSubsections === 'function') loadArtSubsections();
  } else if (name === 'quotes') {
    if (typeof loadQuotes === 'function') loadQuotes();
  } else if (name === 'subsections') {
    if (typeof loadSubsections === 'function') loadSubsections();
    if (typeof loadSectionCovers === 'function') loadSectionCovers();
  } else if (name === 'about') {
    if (typeof loadAbout === 'function') loadAbout();
  } else if (name === 'admin') {
    loadAdminPanel();
  }
}

/* === ADMIN PANEL — Cloudflare metriky + správa přístupů ===
   Očekává 2 backendové endpointy, které zatím pravděpodobně neexistují:

   GET /api/admin/usage
     → { requestsUsed, requestsLimit, storageUsedBytes, storageLimitBytes }
     (typicky z Cloudflare GraphQL Analytics API / R2 usage API)

   GET /api/admin/users
     → [{ email, role, created }]
   POST /api/admin/users/invite   body: { email, role }
   DELETE /api/admin/users?email=...

   GET /api/admin/usage/history?period=week|month
     → [{ label, requests, storageBytes }, ...]  (vývoj v čase pro graf níže)

   Dokud tyhle endpointy backend nemá, panel to férově řekne místo aby
   předstíral čísla, co odnikud nejdou. */
async function loadAdminPanel() {
  await loadAdminUsage();
  await loadAdminUsers();
}

async function loadAdminUsage() {
  const box = $('adminUsageCards');
  if (!box) return;
  box.innerHTML = '<div style="color:var(--text-muted);padding:1rem">Načítám…</div>';
  try {
    const r = await fetch('/api/admin/usage');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const cards = [
      {
        label: 'Požadavky (30 dní)',
        value: d.requestsUsed != null ? d.requestsUsed.toLocaleString('cs') : '⚠️',
        sub: d.requestsError ? 'chyba: ' + d.requestsError.slice(0, 60) : (d.requestsLimit ? `z ${d.requestsLimit.toLocaleString('cs')}` : '')
      },
      { label: 'Využité místo', value: fmtBytes(d.storageUsedBytes || 0), sub: '' },
      { label: 'Zbývá volného místa', value: d.storageLimitBytes ? fmtBytes(Math.max(0, d.storageLimitBytes - (d.storageUsedBytes || 0))) : '?', sub: '' }
    ];
    let html = cards.map(c => `
      <div class="form-card" style="text-align:center;margin-bottom:0">
        <div style="font-family:var(--font-mono);font-size:1.6rem;font-weight:600;color:var(--gold)">${c.value}</div>
        <div style="color:var(--text-muted);font-size:12.5px;margin-top:0.3rem">${c.label}</div>
        ${c.sub ? `<div style="color:var(--text-faint);font-size:11px;margin-top:0.15rem;word-break:break-word">${escapeHtml(c.sub)}</div>` : ''}
      </div>`).join('');

    if (Array.isArray(d.buckets) && d.buckets.length) {
      html += `<div class="form-card" style="grid-column:1/-1;margin-bottom:0">
        <div style="color:var(--text-muted);font-size:12px;margin-bottom:0.5rem">📦 Podle bucketu</div>
        ${d.buckets.map(b => `
          <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:12.5px;padding:0.25rem 0;border-bottom:1px solid var(--border-soft)">
            <span>${escapeHtml(b.name)}${b.error ? ' ⚠️' : ''}</span>
            <span>${b.error ? escapeHtml(b.error.slice(0, 40)) : fmtBytes(b.bytes) + ' · ' + b.objects + ' souborů'}</span>
          </div>`).join('')}
      </div>`;
    }
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = `
      <div class="form-card" style="grid-column:1/-1;text-align:center;color:var(--text-muted);font-size:13px;line-height:1.6">
        📡 Metriky zatím nejdou načíst — backend ještě nemá endpoint <code style="color:var(--gold)">/api/admin/usage</code>.<br>
        Jakmile ho doplníš (viz functions-example), panel se automaticky rozžije.
      </div>`;
  }

  /* Graf vývoje v čase (týdny/měsíce) — samostatný blok pod kartami */
  injectAdminMetricsUI();
  loadAdminMetricsHistory();
}

/* === ADMIN METRIKY V ČASE (týdny / měsíce) ===
   Aktuální /api/admin/usage vrací jen okamžitý stav. Pro graf podle týdnů
   nebo měsíců je potřeba nový backendový endpoint s historií — viz komentář
   výše u loadAdminPanel(). Dokud neexistuje, zobrazí se srozumitelný fallback
   místo prázdného/vymyšleného grafu. */
let adminMetricsPeriod = 'week';

function setAdminMetricsPeriod(period) {
  adminMetricsPeriod = period;
  document.querySelectorAll('.admin-metrics-period-btn').forEach(b => b.classList.toggle('btn-blue', b.dataset.period === period));
  loadAdminMetricsHistory();
}

function injectAdminMetricsUI() {
  const usageBox = $('adminUsageCards');
  if (!usageBox || $('adminMetricsSection')) return;
  const section = document.createElement('div');
  section.id = 'adminMetricsSection';
  section.style.cssText = 'grid-column:1/-1;margin-top:1rem';
  section.innerHTML = `
    <div class="form-card" style="margin-bottom:0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;flex-wrap:wrap;gap:0.5rem">
        <h3 style="margin:0;font-size:0.95rem">📈 Vývoj v čase</h3>
        <div style="display:flex;gap:0.4rem">
          <button class="btn btn-sm admin-metrics-period-btn btn-blue" data-period="week" onclick="setAdminMetricsPeriod('week')">Týdny</button>
          <button class="btn btn-sm admin-metrics-period-btn" data-period="month" onclick="setAdminMetricsPeriod('month')">Měsíce</button>
        </div>
      </div>
      <div id="adminMetricsHistory"></div>
    </div>`;
  usageBox.parentElement.insertBefore(section, usageBox.nextSibling);
}

async function loadAdminMetricsHistory() {
  const box = $('adminMetricsHistory');
  if (!box) return;
  box.innerHTML = '<div style="color:var(--text-muted);padding:1rem">Načítám…</div>';
  try {
    const r = await fetch('/api/admin/usage/history?period=' + adminMetricsPeriod);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const points = Array.isArray(data) ? data : (data.points || []);
    if (!points.length) {
      box.innerHTML = '<div style="color:var(--text-muted);padding:1rem;text-align:center">Zatím žádná data.</div>';
      return;
    }
    const maxReq = Math.max(...points.map(p => p.requests || 0), 1);
    box.innerHTML = `
      <div style="display:flex;align-items:flex-end;gap:6px;height:160px;padding:0.5rem 0 0.25rem">
        ${points.map(p => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px" title="${escapeHtml(p.label)}: ${(p.requests || 0).toLocaleString('cs')} požadavků">
            <div style="width:100%;background:var(--accent);border-radius:4px 4px 0 0;height:${Math.max(4, Math.round((p.requests || 0) / maxReq * 140))}px"></div>
            <div style="font-size:10px;color:var(--text-faint);font-family:var(--font-mono);white-space:nowrap">${escapeHtml(p.label)}</div>
          </div>`).join('')}
      </div>
      <table class="data-table" style="margin-top:0.75rem">
        <thead><tr><th>${adminMetricsPeriod === 'week' ? 'Týden' : 'Měsíc'}</th><th>Požadavky</th><th>Úložiště</th></tr></thead>
        <tbody>${points.map(p => `<tr><td>${escapeHtml(p.label)}</td><td style="font-family:var(--font-mono)">${(p.requests || 0).toLocaleString('cs')}</td><td style="font-family:var(--font-mono)">${p.storageBytes != null ? fmtBytes(p.storageBytes) : '—'}</td></tr>`).join('')}</tbody>
      </table>`;
  } catch (e) {
    box.innerHTML = `
      <div style="text-align:center;color:var(--text-muted);font-size:13px;padding:1.25rem;line-height:1.6">
        📡 Historie zatím nejde načíst — backend ještě nemá endpoint <code style="color:var(--gold)">/api/admin/usage/history?period=week|month</code>.<br>
        Očekávaný formát odpovědi: <code>[{ "label": "27.7.–2.8.", "requests": 1234, "storageBytes": 5000000 }]</code>
      </div>`;
  }
}

async function loadAdminUsers() {
  const tbody = $('adminUsersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:1rem">Načítám…</td></tr>';
  try {
    const r = await fetch('/api/admin/users');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const arr = await r.json();
    if (!Array.isArray(arr) || !arr.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:1rem">Zatím žádní další uživatelé.</td></tr>';
      return;
    }
    tbody.innerHTML = arr.map(u => `
      <tr>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.role || 'editor')}</td>
        <td style="font-family:var(--font-mono);font-size:12px">${u.created ? new Date(u.created).toLocaleDateString('cs') : '—'}</td>
        <td><button class="btn btn-red btn-sm" onclick="deleteAdminUser('${encodeURIComponent(u.email)}')">🗑 Odebrat</button></td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `
      <tr><td colspan="4" style="text-align:center;color:var(--text-muted);font-size:13px;padding:1.25rem;line-height:1.6">
        📡 Správa přístupů zatím nejde — backend ještě nemá endpoint <code style="color:var(--gold)">/api/admin/users</code>.<br>
        Potřeba: <code>GET</code> (seznam), <code>POST /invite</code> <code>{email, role}</code>, <code>DELETE?email=</code>.
      </td></tr>`;
  }
}

async function inviteAdminUser() {
  const email = $('adminInviteEmail')?.value.trim();
  const role = $('adminInviteRole')?.value || 'editor';
  if (!email) { showToast('Zadej e-mail osoby, kterou chceš pozvat.', 'info'); return; }
  try {
    const r = await fetch('/api/admin/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
    $('adminInviteEmail').value = '';
    loadAdminUsers();
    showInvitedCredentials(d.email, d.temporaryPassword);
  } catch (e) {
    showToast('Nepodařilo se pozvat uživatele: ' + e.message, 'error');
  }
}

/* Dočasné heslo se z backendu vrátí jen JEDNOU — musí se hned tady ukázat,
   ať ho jde zkopírovat a poslat nové osobě (Signal/WhatsApp/osobně...). */
function showInvitedCredentials(email, tempPassword) {
  if (!tempPassword) { showToast('Uživatel pozván', 'success'); return; }
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `
    <div class="modal-box" style="max-width:420px">
      <h3>✅ Uživatel pozván</h3>
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:1rem">Tohle heslo se zobrazí JEN TEĎ — pošli ho nové osobě ručně (nikam se dál neukládá v čitelné podobě).</p>
      <div class="form-row"><label>E-mail</label><input class="form-input" readonly value="${escapeHtml(email)}" onclick="this.select()"></div>
      <div class="form-row"><label>Heslo</label><input class="form-input" readonly value="${escapeHtml(tempPassword)}" onclick="this.select()" style="font-family:var(--font-mono)"></div>
      <div class="modal-actions">
        <button class="btn btn-blue" onclick="navigator.clipboard.writeText('${email}: ${tempPassword}').then(()=>showToast('Zkopírováno','success'))">📋 Kopírovat oboje</button>
        <button class="btn btn-red" onclick="this.closest('.modal').remove()">Zavřít</button>
      </div>
    </div>`;
  document.body.appendChild(m);
}

async function deleteAdminUser(email) {
  if (!(await showConfirm('Odebrat přístup pro ' + decodeURIComponent(email) + '?', { danger: true, confirmText: 'Odebrat' }))) return;
  try {
    const r = await fetch('/api/admin/users?email=' + email, { method: 'DELETE' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    showToast('Přístup odebrán', 'success');
    loadAdminUsers();
  } catch (e) {
    showToast('Nepodařilo se odebrat přístup.', 'error');
  }
}
function openLightbox(src) {
  const m = document.createElement('div');
  m.className = 'lightbox-modal';
  m.innerHTML = `<img src="${src}" alt="">`;
  m.onclick = () => m.remove();
  document.body.appendChild(m);
}

/* === GALERIE === */
async function loadGallery() {
  try {
    const r = await fetch('/api/photos/list?galleryId=main');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    G.photos = Array.isArray(data) ? data : (data.photos || []);
  } catch (e) {
    console.error('Chyba galerie:', e);
    G.photos = [];
  }
}

async function loadStats() {
  const pill = $('galleryCountPill');
  if (!pill) return;
  try {
    const r = await fetch('/api/photos/stats?galleryId=main');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const s = await r.json();
    const count = s.galCount ?? G.photos.length;
    pill.textContent = count + ' ' + (count === 1 ? 'fotka' : (count >= 2 && count <= 4 ? 'fotky' : 'fotek')) +
      (s.galSize ? ' · ' + fmtBytes(s.galSize) : '') +
      (s.totalSize ? ' · R2: ' + fmtBytes(s.totalSize) : '');
  } catch {
    const count = G.photos.length;
    const totalBytes = G.photos.reduce((sum, p) => sum + (p.size || 0), 0);
    pill.textContent = count + ' ' + (count === 1 ? 'fotka' : (count >= 2 && count <= 4 ? 'fotky' : 'fotek')) +
      (totalBytes ? ' · ' + fmtBytes(totalBytes) : '');
  }
}

/* === KOŠ (soft-delete) ===
   Smazání fotky z galerie NEJDŘÍV jen schová (žije v localStorage tohoto
   prohlížeče) — jako koš ve Windows. Fotka zmizí z běžného zobrazení
   galerie, ale dá se z koše obnovit. Skutečně se z R2/serveru smaže až:
   - ručně přes "Vysypat koš" (nebo smazáním jednotlivé položky v koši), nebo
   - automaticky po uplynutí TRASH_RETENTION_DAYS dní od přesunu do koše.
   Je to čistě klientská vrstva nad existujícím /api/photos/delete — server
   se nijak nemusí měnit. */
const TRASH_RETENTION_DAYS = 30;
let viewingTrash = false;

function getTrashMap() {
  try { return JSON.parse(localStorage.getItem('photoTrash') || '{}'); } catch { return {}; }
}
function saveTrashMap(map) { localStorage.setItem('photoTrash', JSON.stringify(map)); }
function isInTrash(p) { return !!getTrashMap()[p.id]; }

function moveToTrash(ids) {
  const map = getTrashMap();
  const now = Date.now();
  ids.forEach(id => {
    const p = G.photos.find(x => x.id === id);
    if (p) map[id] = { deletedAt: now, key: p.key, name: p.name };
  });
  saveTrashMap(map);
}

function restoreFromTrash(ids) {
  const map = getTrashMap();
  ids.forEach(id => delete map[id]);
  saveTrashMap(map);
}

function getTrashedPhotos() {
  const map = getTrashMap();
  return G.photos
    .filter(p => map[p.id])
    .map(p => ({ ...p, _deletedAt: map[p.id].deletedAt }))
    .sort((a, b) => b._deletedAt - a._deletedAt);
}

function trashCount() { return Object.keys(getTrashMap()).length; }

function daysLeftInTrash(deletedAt) {
  const left = TRASH_RETENTION_DAYS - Math.floor((Date.now() - deletedAt) / 86400000);
  return Math.max(0, left);
}

function updateTrashBadge() {
  const btn = $('trashToggleBtn');
  if (!btn) return;
  const n = trashCount();
  btn.textContent = '🗑 Koš' + (n ? ` (${n})` : '');
}

async function permanentlyDeleteTrashIds(ids) {
  if (!ids.length) return;
  const map = getTrashMap();
  const keys = ids
    .map(id => (G.photos.find(x => x.id === id)?.key) || map[id]?.key)
    .filter(Boolean)
    .join(',');
  try {
    if (keys) await fetch('/api/photos/delete?keys=' + encodeURIComponent(keys), { method: 'DELETE' });
  } catch (e) {
    console.error('Chyba trvalého mazání z koše', e);
  }
  ids.forEach(id => delete map[id]);
  saveTrashMap(map);
  await loadGallery();
  renderGallery();
  loadStats();
  updateTrashBadge();
}

async function emptyTrash() {
  const ids = Object.keys(getTrashMap());
  if (!ids.length) { showToast('Koš je prázdný.', 'info'); return; }
  if (!(await showConfirm(`Opravdu natrvalo smazat ${ids.length} fotek z koše? Tohle už nejde vzít zpět.`, { danger: true, confirmText: 'Vysypat koš' }))) return;
  await permanentlyDeleteTrashIds(ids);
  showToast('Koš vysypán', 'success');
}

function restoreSelectedFromTrash() {
  if (!G.selected.size) { showToast('Nejdřív něco vyber.', 'info'); return; }
  const ids = [...G.selected];
  restoreFromTrash(ids);
  G.selected.clear();
  renderGallery();
  updateTrashBadge();
  showToast('Fotky obnoveny z koše', 'success');
}

function toggleTrashView() {
  viewingTrash = !viewingTrash;
  G.selected.clear();
  $('trashToggleBtn')?.classList.toggle('btn-blue', viewingTrash);
  const bar = $('trashActionsBar');
  if (bar) bar.style.display = viewingTrash ? 'flex' : 'none';
  renderGallery();
}

/* Fotky starší TRASH_RETENTION_DAYS dní v koši se natrvalo smažou —
   kontrola proběhne vždy při startu dashboardu. */
async function purgeExpiredTrash() {
  const map = getTrashMap();
  const now = Date.now();
  const expired = Object.keys(map).filter(id => (now - map[id].deletedAt) > TRASH_RETENTION_DAYS * 86400000);
  if (expired.length) await permanentlyDeleteTrashIds(expired);
}

/* Vloží tlačítko Koš + akční lištu, bez nutnosti měnit HTML šablonu.
   Primárně do ribbon toolbaru záložky Galerie (spolehlivá, známá kotva —
   [data-for="galleries"] existuje vždy, viz showRibbonGroup výš).
   Pokud by z nějakého důvodu ribbon toolbar nebyl v DOM, spadne to jako
   záložní varianta na vložení řádku nad #galleryGrid. */
function injectTrashUI() {
  if ($('trashToggleBtn')) { updateTrashBadge(); return; }

  const ribbon = document.querySelector('.ribbon-group[data-for="galleries"]');
  if (ribbon) {
    const section = document.createElement('div');
    section.className = 'ribbon-section';
    section.innerHTML = `
      <div class="ribbon-section-items">
        <button id="trashToggleBtn" class="btn btn-sm" onclick="toggleTrashView()">🗑 Koš</button>
        <span id="trashActionsBar" style="display:none;gap:0.5rem">
          <button class="btn btn-sm" onclick="restoreSelectedFromTrash()">↩ Obnovit vybrané</button>
          <button class="btn btn-red btn-sm" onclick="emptyTrash()">🔥 Vysypat koš</button>
        </span>
      </div>
      <span class="ribbon-section-label">Koš</span>`;
    const pill = ribbon.querySelector('#galleryCountPill');
    if (pill) ribbon.insertBefore(section, pill); else ribbon.appendChild(section);
    updateTrashBadge();
    return;
  }

  // Záložní varianta, kdyby ribbon toolbar nebyl (nemělo by nastat)
  const grid = $('galleryGrid');
  if (!grid || !grid.parentElement) return;
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap';
  bar.innerHTML = `
    <button id="trashToggleBtn" class="btn btn-sm" onclick="toggleTrashView()">🗑 Koš</button>
    <div id="trashActionsBar" style="display:none;gap:0.5rem">
      <button class="btn btn-sm" onclick="restoreSelectedFromTrash()">↩ Obnovit vybrané</button>
      <button class="btn btn-red btn-sm" onclick="emptyTrash()">🔥 Vysypat koš</button>
    </div>`;
  grid.parentElement.insertBefore(bar, grid);
  updateTrashBadge();
}

/* === SLOŽKY — čistě klientská správa (žádné síťové volání, žádná
   závislost na tom, jak backend zachází s názvy souborů při uploadu).
   Přiřazení fotka → složka žije jen v localStorage tohoto prohlížeče. */
function getPhotoFolderMap() {
  try { return JSON.parse(localStorage.getItem('photoFolderMap') || '{}'); } catch { return {}; }
}
function savePhotoFolderMap(map) {
  localStorage.setItem('photoFolderMap', JSON.stringify(map));
}

function getPhotoFolder(p) {
  const map = getPhotoFolderMap();
  return map[p.id] ?? map[p.key] ?? null;
}

function setPhotoFolder(p, folder) {
  const map = getPhotoFolderMap();
  const key = p.id || p.key;
  if (!key) return;
  if (folder) map[key] = folder;
  else delete map[key];
  savePhotoFolderMap(map);
}

/* === POPISKY FOTEK — čistě klientská správa, stejný princip jako složky.
   Popisek se zobrazí pod fotkou v galerii a jako výchozí figcaption při
   vložení fotky do článku (jde tam přepsat/smazat i zvlášť). */
function getPhotoCaptionMap() {
  try { return JSON.parse(localStorage.getItem('photoCaptionMap') || '{}'); } catch { return {}; }
}

function savePhotoCaptionMap(map) {
  localStorage.setItem('photoCaptionMap', JSON.stringify(map));
}

function getPhotoCaption(p) {
  const map = getPhotoCaptionMap();
  return map[p.id] ?? map[p.key] ?? '';
}

function setPhotoCaption(p, caption) {
  const map = getPhotoCaptionMap();
  const key = p.id || p.key;
  if (!key) return;
  if (caption) map[key] = caption;
  else delete map[key];
  savePhotoCaptionMap(map);
}

function editPhotoCaption(id) {
  const p = G.photos.find(x => x.id === id);
  if (!p) return;
  const current = getPhotoCaption(p);
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `
    <div class="modal-box" style="max-width:420px">
      <h3>📝 Popisek fotky</h3>
      <p style="color:var(--text-muted);font-size:12.5px;margin:-0.6rem 0 0.9rem">Zobrazí se pod fotkou, když ji vložíš do článku (jde upravit i přímo v editoru).</p>
      <div class="form-row"><input class="form-input" id="captionInput" placeholder="Např. Západ slunce nad Alpami" value="${escapeHtml(current)}"></div>
      <div class="modal-actions">
        <button class="btn btn-blue" onclick="saveCaptionFromModal('${id}')">Uložit</button>
        <button class="btn" onclick="this.closest('.modal').remove()">Zrušit</button>
      </div>
    </div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
  setTimeout(() => {
    const inp = $('captionInput');
    if (inp) { inp.focus(); inp.select(); }
  }, 50);
  const onEnter = (e) => { if (e.key === 'Enter') saveCaptionFromModal(id); };
  $('captionInput')?.addEventListener('keydown', onEnter);
}

function saveCaptionFromModal(id) {
  const p = G.photos.find(x => x.id === id);
  if (!p) return;
  const val = $('captionInput')?.value.trim() || '';
  setPhotoCaption(p, val);
  document.querySelector('.modal')?.remove();
  renderGallery();
  showToast(val ? 'Popisek uložen' : 'Popisek smazán', 'success');
}

function getManualFolders() {
  try {
    const raw = localStorage.getItem('manualFolders');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveManualFolders(list) {
  localStorage.setItem('manualFolders', JSON.stringify([...new Set(list)]));
}

/* === PŘENOS SLOŽEK MEZI ZAŘÍZENÍMI (export/import kódu) ===
   Složky žijí jen v localStorage tohoto prohlížeče/zařízení — export
   zabalí přiřazení fotka→složka i seznam prázdných složek do jednoho
   kódu, který se dá zkopírovat a vložit jinde. */
function exportFolderData() {
  const payload = {
    photoFolderMap: getPhotoFolderMap(),
    manualFolders: getManualFolders()
  };
  const code = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const ta = document.createElement('textarea');
  ta.value = code;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('Kód zkopírován do schránky — vlož ho na druhém zařízení', 'success');
  } catch {
    showToast('Nepodařilo se zkopírovat automaticky, kód najdeš v konzoli (F12).', 'info');
    console.log('Kód pro import složek:', code);
  }
  ta.remove();
}

/* Jednodušší varianta — rovnou stáhne .txt soubor se stejnými daty
   (čitelný JSON, ne zakódovaný text), který jde poslat/nahrát na druhé
   zařízení jakkoliv (mail, cloud, USB...), bez kopírování textu. */
function exportFolderDataAsFile() {
  const payload = {
    photoFolderMap: getPhotoFolderMap(),
    manualFolders: getManualFolders()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'slozky-' + new Date().toISOString().split('T')[0] + '.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  showToast('Soubor stažen — přenes ho na druhé zařízení a nahraj přes "Importovat"', 'success');
}

function importFolderDataFromFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if ($('importFolderCode')) $('importFolderCode').value = reader.result;
    importFolderData();
    input.value = '';
  };
  reader.onerror = () => showToast('Soubor se nepodařilo přečíst.', 'error');
  reader.readAsText(file);
}

/* === SERVEROVÁ SYNCHRONIZACE SLOŽEK MEZI ZAŘÍZENÍMI ===
   Uloží/načte stejná data (photoFolderMap + manualFolders) přes malý
   backendový endpoint /api/data/folders — funguje odkudkoliv, bez
   ručního kopírování souboru/kódu mezi zařízeními. */
async function saveFoldersToServer() {
  const status = $('folderSyncStatus');
  if (status) status.textContent = 'Ukládám…';
  try {
    const payload = {
      photoFolderMap: getPhotoFolderMap(),
      manualFolders: getManualFolders()
    };
    const r = await fetch('/api/data/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    showToast('Složky uloženy na server', 'success');
    if (status) status.textContent = d.updated ? 'Uloženo ' + new Date(d.updated).toLocaleString('cs') : '';
  } catch (e) {
    showToast('Backend zatím nemá endpoint /api/data/folders (viz functions-example).', 'error');
    if (status) status.textContent = '';
  }
}

async function loadFoldersFromServer() {
  const status = $('folderSyncStatus');
  if (status) status.textContent = 'Načítám…';
  try {
    const r = await fetch('/api/data/folders');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (d.photoFolderMap) savePhotoFolderMap(d.photoFolderMap);
    if (d.manualFolders) saveManualFolders(d.manualFolders);
    refreshFolderControls();
    renderGallery();
    showToast('Složky načteny ze serveru', 'success');
    if (status) status.textContent = d.updated ? 'Naposled uloženo ' + new Date(d.updated).toLocaleString('cs') : 'Server zatím nic neukládal';
  } catch (e) {
    showToast('Backend zatím nemá endpoint /api/data/folders (viz functions-example).', 'error');
    if (status) status.textContent = '';
  }
}

function openImportFolderModal() {
  if ($('importFolderCode')) $('importFolderCode').value = '';
  $('importFolderModal')?.classList.remove('hidden');
}

function importFolderData() {
  const raw = $('importFolderCode')?.value.trim();
  if (!raw) { showToast('Vlož prosím kód nebo nahraj soubor.', 'info'); return; }
  let payload;
  try {
    // Nejdřív zkusit obyčejný čitelný JSON (ze staženého .txt souboru)
    payload = JSON.parse(raw);
  } catch {
    try {
      // Jinak zkusit starší zakódovaný kód (kopírování přes schránku)
      payload = JSON.parse(decodeURIComponent(escape(atob(raw))));
    } catch {
      showToast('Kód/soubor se nepodařilo přečíst — zkontroluj, že je celý.', 'error');
      return;
    }
  }
  if (payload.photoFolderMap) savePhotoFolderMap(payload.photoFolderMap);
  if (payload.manualFolders) saveManualFolders(payload.manualFolders);
  $('importFolderModal')?.classList.add('hidden');
  refreshFolderControls();
  renderGallery();
  showToast('Složky naimportovány', 'success');
}

function getAllFolders() {
  const set = new Set(getManualFolders());
  Object.values(getPhotoFolderMap()).forEach(f => { if (f) set.add(f); });
  return [...set].sort((a, b) => a.localeCompare(b));
}

function openNewFolderModal() {
  if ($('newFolderName')) $('newFolderName').value = '';
  $('newFolderModal')?.classList.remove('hidden');
  setTimeout(() => $('newFolderName')?.focus(), 50);
}

function createNewFolder() {
  const name = $('newFolderName')?.value.trim();
  if (!name) { showToast('Zadej název složky.', 'info'); return; }
  const manual = getManualFolders();
  if (!manual.includes(name)) { manual.push(name); saveManualFolders(manual); }
  $('newFolderModal')?.classList.add('hidden');
  refreshFolderControls();
  const uploadInput = $('uploadFolderInput');
  if (uploadInput) uploadInput.value = name;
  const filterSel = $('folderFilter');
  if (filterSel) filterSel.value = name;
  renderGallery();
}

function deleteEmptyFolder() {
  const sel = $('folderFilter');
  const folder = sel?.value || '';
  if (!folder || folder === '__none__') { showToast('Nejdřív ve filtru vyber konkrétní složku, kterou chceš smazat.', 'info'); return; }
  const hasPhotos = G.photos.some(p => getPhotoFolder(p) === folder);
  if (hasPhotos) { showToast('Tahle složka obsahuje fotky — nejdřív je přesuň jinam nebo smaž, teprve pak půjde složka odstranit.', 'info'); return; }
  const manual = getManualFolders().filter(f => f !== folder);
  saveManualFolders(manual);
  if (sel) sel.value = '';
  refreshFolderControls();
  renderGallery();
}

function refreshFolderControls() {
  const folders = getAllFolders();
  const sel = $('folderFilter');
  if (sel) {
    const current = sel.value;
    sel.innerHTML = '<option value="">📁 Všechny složky</option><option value="__none__">— Bez složky —</option>' +
      folders.map(f => `<option value="${escapeHtml(f)}">📁 ${escapeHtml(f)}</option>`).join('');
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
  }
  const dl = $('folderSuggestions');
  if (dl) dl.innerHTML = folders.map(f => `<option value="${escapeHtml(f)}">`).join('');
}

/* === ROZLIŠENÍ FOTEK (cache, lazy dopočet přes Image()) === */
const photoDimCache = new Map();

function getCachedDim(p) {
  if (p.width && p.height) return { w: p.width, h: p.height };
  if (photoDimCache.has(p.id)) return photoDimCache.get(p.id);
  return null;
}

function loadPhotoDimension(p) {
  if (getCachedDim(p) || photoDimCache.has(p.id + ':loading')) return;
  photoDimCache.set(p.id + ':loading', true);
  const img = new Image();
  img.onload = () => {
    const dim = { w: img.naturalWidth, h: img.naturalHeight };
    photoDimCache.set(p.id, dim);
    photoDimCache.delete(p.id + ':loading');
    const el = document.querySelector(`.gallery-item[data-id="${p.id}"] .item-dim`);
    if (el) el.textContent = dim.w + '×' + dim.h;
    if (($('sortMode')?.value) === 'resolution') renderGallery();
  };
  img.onerror = () => photoDimCache.delete(p.id + ':loading');
  img.src = p.url;
}

/* === "POUŽITO V ČLÁNKU" — sleduje, které fotky se objevují v obsahu článků === */
window.usedPhotoUrls = window.usedPhotoUrls || new Set();

function isPhotoUsedInArticle(p) {
  return window.usedPhotoUrls.has(p.url);
}

function sortedPhotos() {
  const mode = $('sortMode')?.value || 'newest';
  const folderSel = $('folderFilter')?.value || '';
  const query = $('gallerySearch')?.value.trim().toLowerCase() || '';
  let arr = [...G.photos].filter(p => !isInTrash(p));
  if (folderSel === '__none__') arr = arr.filter(p => !getPhotoFolder(p));
  else if (folderSel) arr = arr.filter(p => getPhotoFolder(p) === folderSel);
  if (query) arr = arr.filter(p => (p.name || '').toLowerCase().includes(query));
  if (mode === 'newest') arr.sort((a, b) => new Date(b.uploaded || b.date || 0) - new Date(a.uploaded || a.date || 0));
  else if (mode === 'oldest') arr.sort((a, b) => new Date(a.uploaded || a.date || 0) - new Date(b.uploaded || b.date || 0));
  else if (mode === 'name') arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  else if (mode === 'size') arr.sort((a, b) => (b.size || 0) - (a.size || 0));
  else if (mode === 'resolution') {
    arr.forEach(p => loadPhotoDimension(p));
    arr.sort((a, b) => {
      const da = getCachedDim(a), db = getCachedDim(b);
      const pa = da ? da.w * da.h : -1, pb = db ? db.w * db.h : -1;
      return pb - pa;
    });
  }
  return arr;
}

function renderGallery() {
  const grid = $('galleryGrid');
  if (!grid) return;
  injectTrashUI();
  refreshFolderControls();
  const mode = $('viewMode')?.value || 'grid';
  grid.className = 'gallery-grid' + (mode !== 'grid' ? ' mode-' + mode : '');

  const arr = viewingTrash ? getTrashedPhotos() : sortedPhotos();
  if (!arr.length) {
    if (viewingTrash) {
      grid.innerHTML = `<div style="color:#64748b;padding:2rem;text-align:center;grid-column:1/-1">Koš je prázdný.</div>`;
      return;
    }
    const query = $('gallerySearch')?.value.trim() || '';
    const msg = query
      ? `Žádná fotka neodpovídá hledání „${escapeHtml(query)}“.`
      : 'V této složce zatím žádné fotky.';
    grid.innerHTML = `<div style="color:#64748b;padding:2rem;text-align:center;grid-column:1/-1">${msg}</div>`;
    return;
  }

  grid.innerHTML = arr.map(p => {
    const selected = G.selected.has(p.id) ? ' selected' : '';
    const checked = G.selected.has(p.id) ? 'checked' : '';
    const folder = getPhotoFolder(p);
    const caption = getPhotoCaption(p);
    const dim = getCachedDim(p);
    const used = isPhotoUsedInArticle(p);
    if (mode === 'list' && !dim) loadPhotoDimension(p);

    const topBadge = viewingTrash
      ? `<span class="folder-badge" style="background:rgba(247,92,92,0.85);color:#fff">Smaže se za ${daysLeftInTrash(p._deletedAt)} dní</span>`
      : (folder ? `<span class="folder-badge">📁 ${escapeHtml(folder)}</span>` : '');

    const actions = viewingTrash
      ? `<button class="btn btn-sm" onclick="event.stopPropagation();restoreFromTrash(['${p.id}']);renderGallery();updateTrashBadge();showToast('Obnoveno','success')" title="Obnovit">↩</button>
         <button class="btn btn-red btn-sm" onclick="event.stopPropagation();(async()=>{if(await showConfirm('Natrvalo smazat tuhle fotku?',{danger:true,confirmText:'Smazat'}))permanentlyDeleteTrashIds(['${p.id}'])})()" title="Smazat natrvalo">🗑</button>`
      : `<button class="btn btn-sm" onclick="event.stopPropagation();openLightbox('${p.url}')" title="Náhled">🔍</button>
         <button class="btn btn-sm" onclick="event.stopPropagation();editPhotoCaption('${p.id}')" title="Popisek">📝</button>`;

    return `
    <div class="gallery-item${selected}" data-id="${p.id}">
      <input type="checkbox" class="item-checkbox" ${checked} onclick="event.stopPropagation();toggleSel('${p.id}')">
      ${topBadge}
      ${used && !viewingTrash ? `<span class="used-in-article-badge" title="Fotka je použitá v článku — neupravuj ji, radši vlož novou kopii">📄 V článku</span>` : ''}
      <img src="${p.url}" alt="${escapeHtml(p.name || '')}" loading="lazy" ${viewingTrash ? `onclick="openLightbox('${p.url}')"` : `onclick="openEditor('${p.id}')"`}>
      <div class="item-meta">
        <div class="item-name">${escapeHtml(p.name || '')}</div>
        <div>${fmtBytes(p.size)}${mode === 'list' ? ` · <span class="item-dim">${dim ? dim.w + '×' + dim.h : '…'}</span>` : ''}</div>
        ${caption && !viewingTrash ? `<div style="color:var(--text-faint);font-size:11px;font-style:italic;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">💬 ${escapeHtml(caption)}</div>` : ''}
        ${showExif && !viewingTrash ? `<div class="item-exif">Načítám EXIF…</div>` : ''}
      </div>
      <div class="item-actions">${actions}</div>
    </div>`;
  }).join('');

  if (showExif && !viewingTrash) arr.forEach(p => loadAndShowExif(p));
}

function toggleExifDisplay() {
  showExif = $('exifToggle')?.checked || false;
  renderGallery();
}

/* === EXIF ===
   Vlastní minimalistický čtečka EXIF (Make/Model/expozice/clona/ISO/ohnisko/datum/GPS)
   přímo z JPEG bajtů, bez externí knihovny. Stahuje jen prvních ~128 KB souboru
   (přes Range hlavičku), kde EXIF blok obvykle je — šetří data. */
async function fetchExifPrefix(url) {
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-131071' } });
    return await r.arrayBuffer();
  } catch {
    return null;
  }
}

function parseExif(buf) {
  try {
    const view = new DataView(buf);
    if (view.getUint16(0) !== 0xFFD8) return null;
    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      if ((marker & 0xFF00) !== 0xFF00) break;
      if (marker === 0xFFE1) {
        const segLen = view.getUint16(offset + 2);
        if (view.getUint32(offset + 4) === 0x45786966) {
          return readExifSegment(view, offset + 10);
        }
        offset += 2 + segLen;
      } else if (marker === 0xFFD8) {
        offset += 2;
      } else {
        const segLen = view.getUint16(offset + 2);
        offset += 2 + segLen;
      }
    }
  } catch (e) { console.error('EXIF parse chyba:', e); }
  return null;
}

function readExifSegment(view, tiffStart) {
  const little = view.getUint16(tiffStart) === 0x4949;
  const u16 = o => view.getUint16(o, little);
  const u32 = o => view.getUint32(o, little);
  const rational = o => { const n = u32(o), d = u32(o + 4); return d ? n / d : 0; };
  const result = {};
  let exifIFD = null, gpsIFD = null;

  function readIFD(ifdOffset, target) {
    const count = u16(ifdOffset);
    for (let i = 0; i < count; i++) {
      const e = ifdOffset + 2 + i * 12;
      const tag = u16(e), type = u16(e + 2), num = u32(e + 4);
      const typeSize = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }[type] || 1;
      const dataPos = typeSize * num > 4 ? tiffStart + u32(e + 8) : e + 8;

      if (target === 'ifd0') {
        if (tag === 0x010F) result.make = readAscii(view, dataPos, num);
        else if (tag === 0x0110) result.model = readAscii(view, dataPos, num);
        else if (tag === 0x0132) result.dateTime = readAscii(view, dataPos, num);
        else if (tag === 0x8769) exifIFD = tiffStart + u32(e + 8);
        else if (tag === 0x8825) gpsIFD = tiffStart + u32(e + 8);
      } else if (target === 'exif') {
        if (tag === 0x9003) result.dateTimeOriginal = readAscii(view, dataPos, num);
        else if (tag === 0x829A) result.exposureTime = rational(dataPos);
        else if (tag === 0x829D) result.fNumber = rational(dataPos);
        else if (tag === 0x8827) result.iso = u16(dataPos);
        else if (tag === 0x920A) result.focalLength = rational(dataPos);
      } else if (target === 'gps') {
        if (tag === 0x0001) result.gpsLatRef = String.fromCharCode(view.getUint8(dataPos));
        else if (tag === 0x0002) result.gpsLat = readGPSCoord(view, dataPos, little);
        else if (tag === 0x0003) result.gpsLonRef = String.fromCharCode(view.getUint8(dataPos));
        else if (tag === 0x0004) result.gpsLon = readGPSCoord(view, dataPos, little);
      }
    }
  }

  try {
    const ifd0Offset = tiffStart + u32(tiffStart + 4);
    readIFD(ifd0Offset, 'ifd0');
    if (exifIFD) readIFD(exifIFD, 'exif');
    if (gpsIFD) readIFD(gpsIFD, 'gps');
  } catch (e) { console.error('EXIF IFD chyba:', e); }
  return result;
}

function readAscii(view, offset, length) {
  let str = '';
  for (let i = 0; i < length - 1; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    str += String.fromCharCode(c);
  }
  return str.trim();
}

function readGPSCoord(view, offset, little) {
  let coord = 0;
  for (let i = 0; i < 3; i++) {
    const n = view.getUint32(offset + i * 8, little);
    const d = view.getUint32(offset + i * 8 + 4, little);
    coord += (d ? n / d : 0) / Math.pow(60, i);
  }
  return coord;
}

function formatExifSummary(exif) {
  if (!exif || (!exif.make && !exif.model && !exif.dateTimeOriginal && !exif.dateTime)) {
    return '📷 Bez EXIF dat';
  }
  const parts = [];
  const camera = [exif.make, exif.model].filter(Boolean).join(' ').trim();
  if (camera) parts.push(camera);
  if (exif.fNumber) parts.push('f/' + exif.fNumber.toFixed(1));
  if (exif.exposureTime) parts.push(exif.exposureTime >= 1 ? exif.exposureTime.toFixed(1) + 's' : '1/' + Math.round(1 / exif.exposureTime) + 's');
  if (exif.iso) parts.push('ISO ' + exif.iso);
  if (exif.focalLength) parts.push(Math.round(exif.focalLength) + 'mm');
  const dt = exif.dateTimeOriginal || exif.dateTime;
  if (dt) { const m = dt.match(/(\d{4}):(\d{2}):(\d{2})/); if (m) parts.push(m[3] + '.' + m[2] + '.' + m[1]); }
  if (exif.gpsLat != null && exif.gpsLon != null) {
    const lat = exif.gpsLatRef === 'S' ? -exif.gpsLat : exif.gpsLat;
    const lon = exif.gpsLonRef === 'W' ? -exif.gpsLon : exif.gpsLon;
    parts.push('📍 ' + lat.toFixed(4) + ', ' + lon.toFixed(4));
  }
  return '📷 ' + (parts.length ? parts.join(' · ') : 'Bez EXIF dat');
}

async function loadAndShowExif(p) {
  const setText = (txt) => {
    const el = document.querySelector(`.gallery-item[data-id="${p.id}"] .item-exif`);
    if (el) el.textContent = txt;
  };
  if (exifCache.has(p.id)) { setText(exifCache.get(p.id)); return; }
  try {
    const buf = await fetchExifPrefix(p.url);
    const exif = buf ? parseExif(buf) : null;
    const summary = formatExifSummary(exif);
    exifCache.set(p.id, summary);
    setText(summary);
  } catch {
    setText('📷 EXIF nedostupné');
  }
}

function toggleSel(id) {
  if (G.selected.has(id)) G.selected.delete(id);
  else G.selected.add(id);
  const el = document.querySelector(`.gallery-item[data-id="${id}"]`);
  if (el) el.classList.toggle('selected', G.selected.has(id));
}

/* Mazání z hlavní galerie teď NEMAŽE rovnou na serveru — jen přesune
   vybrané fotky do koše (viz sekce KOŠ výše). Skutečné smazání proběhne
   až při vysypání koše nebo automaticky po uplynutí lhůty. */
async function bulkDelete() {
  if (!G.selected.size) { showToast('Nejsou vybrány žádné fotky.', 'info'); return; }
  const ids = [...G.selected];
  if (!(await showConfirm(`Přesunout ${ids.length} vybraných fotek do koše?`, { confirmText: 'Do koše' }))) return;
  moveToTrash(ids);
  G.selected.clear();
  renderGallery();
  loadStats();
  updateTrashBadge();
  showToast(`${ids.length} fotek přesunuto do koše`, 'success');
}

/* === HROMADNÁ ÚPRAVA VYBRANÝCH FOTEK (velikost + JPG kvalita) === */
/* === DETEKCE DUPLICITNÍCH FOTEK ===
   Rychlá heuristika bez stahování obsahu: stejná velikost souboru v bajtech
   (u skutečných duplicit prakticky vždy sedí). */
async function findDuplicatePhotos() {
  /* Zajistí, že víme, které fotky jsou použité v článcích, i když jsme
     ještě nebyli na záložce Články v této relaci. */
  if (!window.usedPhotoUrls || !window.usedPhotoUrls.size) {
    try {
      const r = await fetch('/api/articles/list');
      if (r.ok) {
        const data = await r.json();
        const arr = Array.isArray(data) ? data : (data.articles || []);
        window.usedPhotoUrls = new Set();
        arr.forEach(a => {
          if (!a.content) return;
          const matches = a.content.match(/<img[^>]+src=["']([^"']+)["']/g) || [];
          matches.forEach(tag => {
            const m = tag.match(/src=["']([^"']+)["']/);
            if (m) window.usedPhotoUrls.add(m[1]);
          });
        });
      }
    } catch (e) { console.error('Nepodařilo se dotáhnout seznam článků pro kontrolu duplicit:', e); }
  }

  const bySize = new Map();
  G.photos.forEach(p => {
    if (!p.size) return;
    if (!bySize.has(p.size)) bySize.set(p.size, []);
    bySize.get(p.size).push(p);
  });
  const groups = [...bySize.values()].filter(g => g.length > 1);
  if (!groups.length) {
    showToast('Žádné pravděpodobné duplicity nenalezeny.', 'success');
    return;
  }
  const m = document.createElement('div');
  m.className = 'modal';
  const groupsHtml = groups.map(g => `
    <div style="margin-bottom:1rem;padding:0.75rem;background:var(--surface-2);border-radius:var(--r-md);border:1px solid var(--border-soft)">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:0.5rem;font-family:var(--font-mono)">${fmtBytes(g[0].size)} · ${g.length} fotek</div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        ${g.map(p => {
          const used = typeof isPhotoUsedInArticle === 'function' && isPhotoUsedInArticle(p);
          return `
          <div style="text-align:center;position:relative">
            <input type="checkbox" class="dupe-check" data-key="${p.key || ''}" data-id="${p.id}" style="position:absolute;top:4px;left:4px;z-index:2;width:18px;height:18px;cursor:pointer;accent-color:var(--red)">
            <img src="${p.url}" style="width:90px;height:90px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="openLightbox('${p.url}')">
            <div style="font-size:10px;color:var(--text-faint);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.name || '')}</div>
            ${used ? '<div style="font-size:9.5px;color:#06281f;background:var(--green);border-radius:4px;padding:1px 4px;margin-top:2px;font-weight:700">📄 V ČLÁNKU</div>' : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`).join('');
  m.innerHTML = `
    <div class="modal-box" style="max-width:560px;width:100%;max-height:82vh;display:flex;flex-direction:column;padding:0">
      <div style="padding:1.5rem 1.5rem 0.75rem;flex-shrink:0">
        <h3 style="margin-bottom:0.3rem">🔍 Možné duplicity (${groups.length} skupin)</h3>
        <p style="color:var(--text-faint);font-size:12px;margin:0">Podle stejné velikosti souboru. Zelený štítek "V ČLÁNKU" = fotka je použitá v nějakém článku, radši ji nemaž. Zaškrtni fotky ke smazání (přesunou se do koše) a zkontroluj náhledem, než potvrdíš.</p>
      </div>
      <div style="flex:1;overflow-y:auto;padding:0 1.5rem">
        ${groupsHtml}
      </div>
      <div style="padding:1rem 1.5rem;flex-shrink:0;border-top:1px solid var(--border-soft);display:flex;gap:0.5rem;justify-content:center">
        <button class="btn btn-red" onclick="deleteDuplicateSelected(this)">🗑 Do koše</button>
        <button class="btn" onclick="this.closest('.modal').remove()">Zavřít</button>
      </div>
    </div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
}

async function deleteDuplicateSelected(btn) {
  const modal = btn.closest('.modal');
  const checks = Array.from(modal.querySelectorAll('.dupe-check:checked'));
  if (!checks.length) { showToast('Nejdřív zaškrtni aspoň jednu fotku ke smazání.', 'info'); return; }
  if (!(await showConfirm(`Přesunout ${checks.length} vybraných fotek do koše?`, { confirmText: 'Do koše' }))) return;

  const ids = checks.map(c => c.dataset.id).filter(Boolean);
  moveToTrash(ids);
  modal.remove();
  renderGallery();
  loadStats();
  updateTrashBadge();
  showToast(`${checks.length} fotek přesunuto do koše`, 'success');
}

/* === HROMADNÉ STAŽENÍ VYBRANÝCH FOTEK JAKO ZIP === */
async function downloadSelectedAsZip() {
  if (!G.selected.size) { showToast('Nejdřív vyber fotky zaškrtnutím checkboxu.', 'info'); return; }
  if (typeof JSZip === 'undefined') { showToast('Knihovna pro ZIP se nenačetla, zkus obnovit stránku.', 'error'); return; }

  const ids = [...G.selected];
  const modal = buildBulkEditProgressModal(ids.length);
  const h3 = modal.querySelector('h3');
  if (h3) h3.textContent = '⬇️ Stahování do ZIP';

  const zip = new JSZip();
  for (let i = 0; i < ids.length; i++) {
    const p = G.photos.find(x => x.id === ids[i]);
    if (!p) continue;
    if ($('beFileName')) $('beFileName').textContent = p.name || p.key || '';
    if ($('beCounter')) $('beCounter').textContent = (i + 1) + '/' + ids.length;
    try {
      const r = await fetch(p.url);
      const blob = await r.blob();
      zip.file(p.name || ('foto-' + (i + 1) + '.jpg'), blob);
    } catch (e) {
      console.error('Chyba stahování fotky do ZIP', p, e);
    }
    if ($('beProgressBar')) $('beProgressBar').style.width = Math.round(((i + 1) / ids.length) * 100) + '%';
  }

  if ($('beDone')) $('beDone').style.display = 'block';
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fotky-' + new Date().toISOString().split('T')[0] + '.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);

  setTimeout(() => modal.remove(), 700);
}

function openMoveToFolderModal() {
  if (!G.selected.size) { showToast('Nejdřív vyber fotky zaškrtnutím checkboxu.', 'info'); return; }
  if ($('moveFolderCount')) $('moveFolderCount').textContent = `Vybráno: ${G.selected.size} fotek`;
  if ($('moveFolderName')) $('moveFolderName').value = '';
  $('moveToFolderModal')?.classList.remove('hidden');
}

function applyMoveToFolder() {
  const folder = $('moveFolderName')?.value.trim() || '';
  $('moveToFolderModal')?.classList.add('hidden');
  const ids = [...G.selected];
  if (!ids.length) return;

  /* Čistě klientská operace — jen se u fotky poznamená složka do
     localStorage, žádné nahrávání/mazání na serveru, takže to nemůže
     selhat kvůli backendu. Okamžité. */
  ids.forEach(id => {
    const p = G.photos.find(x => x.id === id);
    if (p) setPhotoFolder(p, folder);
  });

  G.selected.clear();
  renderGallery();
  loadStats();
  showToast(`Přesunuto ${ids.length} fotek do složky` + (folder ? ` „${folder}“` : ' (bez složky)'), 'success');
}

function openBulkEditModal() {
  if (!G.selected.size) { showToast('Nejdřív vyber fotky zaškrtnutím checkboxu.', 'info'); return; }
  if ($('bulkEditCount')) $('bulkEditCount').textContent = `Vybráno: ${G.selected.size} fotek`;
  $('bulkEditModal')?.classList.remove('hidden');
}

async function resizeExistingPhoto(photo, maxRes, quality) {
  const r = await fetch(photo.url);
  if (!r.ok) throw new Error('Nepodařilo se načíst fotku ' + photo.name);
  const blob = await r.blob();
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    bitmap = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }
  const w0 = bitmap.width || bitmap.naturalWidth;
  const h0 = bitmap.height || bitmap.naturalHeight;
  let w = w0, h = h0;
  if (maxRes && Math.max(w, h) > maxRes) {
    const scale = maxRes / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/jpeg', quality));
}

function buildBulkEditProgressModal(total) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.id = 'bulkEditProgressModal';
  m.innerHTML = `
    <div class="modal-box" style="max-width:460px">
      <h3>🔧 Hromadná úprava fotek</h3>
      <div id="beFileName" style="font-size:13px;color:#94a3b8;margin-bottom:0.4rem"></div>
      <div style="background:#0f172a;border-radius:6px;height:10px;overflow:hidden;margin-bottom:0.5rem">
        <div id="beProgressBar" style="background:#ff6600;height:100%;width:0%;transition:width 0.15s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8">
        <span id="beCounter">0/${total}</span>
      </div>
      <div id="beDone" style="text-align:center;color:#22c55e;font-weight:600;margin-top:0.75rem;display:none">✅ Hotovo!</div>
    </div>`;
  document.body.appendChild(m);
  return m;
}

async function applyBulkEdit() {
  const maxRes = parseInt($('beMaxRes')?.value) || 0;
  const quality = parseFloat($('beQuality')?.value) || 0.7;
  $('bulkEditModal')?.classList.add('hidden');

  const ids = [...G.selected];
  if (!ids.length) return;

  const modal = buildBulkEditProgressModal(ids.length);

  for (let i = 0; i < ids.length; i++) {
    const p = G.photos.find(x => x.id === ids[i]);
    if (!p) continue;
    if ($('beFileName')) $('beFileName').textContent = p.name || p.key || '';
    if ($('beCounter')) $('beCounter').textContent = (i + 1) + '/' + ids.length;

    try {
      const resizedBlob = await resizeExistingPhoto(p, maxRes, quality);
      const fd = new FormData();
      const baseName = (p.name || 'foto').replace(/\.[^.]+$/, '');
      fd.append('file', resizedBlob, baseName + '.jpg');
      fd.append('galleryId', 'main');
      fd.append('oldKey', p.key);
      fd.append('mode', 'replace');
      await fetch('/api/photos/update', { method: 'POST', body: fd });
    } catch (e) {
      console.error('Chyba hromadné úpravy fotky', p, e);
    }
    if ($('beProgressBar')) $('beProgressBar').style.width = Math.round(((i + 1) / ids.length) * 100) + '%';
  }

  if ($('beDone')) $('beDone').style.display = 'block';
  setTimeout(async () => {
    modal.remove();
    G.selected.clear();
    await loadGallery();
    renderGallery();
    loadStats();
  }, 700);
}

/* === UPLOAD SETTINGS === */
function getUploadSettings() {
  const defaults = { maxRes: 2000, quality: 0.85, autoRotate: true };
  try {
    const raw = localStorage.getItem('uploadSettings');
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function openUploadSettings() {
  const s = getUploadSettings();
  if ($('usMaxRes')) $('usMaxRes').value = String(s.maxRes);
  if ($('usQuality')) $('usQuality').value = String(s.quality);
  if ($('usAutoRotate')) $('usAutoRotate').value = s.autoRotate ? '1' : '0';
  $('uploadSettingsModal')?.classList.remove('hidden');
}

function saveUploadSettings() {
  const settings = {
    maxRes: parseInt($('usMaxRes')?.value) || 0,
    quality: parseFloat($('usQuality')?.value) || 0.85,
    autoRotate: $('usAutoRotate')?.value === '1'
  };
  localStorage.setItem('uploadSettings', JSON.stringify(settings));
  $('uploadSettingsModal')?.classList.add('hidden');
  syncUploadQuickControls();
}

/* Rychlý výběr velikosti/kvality přímo v ribbon toolbaru (vedle tlačítka Nahrát) */
function syncUploadQuickControls() {
  const s = getUploadSettings();
  if ($('upResSelect')) $('upResSelect').value = String(s.maxRes);
  if ($('upQualitySelect')) $('upQualitySelect').value = String(s.quality);
}

function quickSaveUploadSetting() {
  const current = getUploadSettings();
  const settings = {
    maxRes: parseInt($('upResSelect')?.value) ?? current.maxRes,
    quality: parseFloat($('upQualitySelect')?.value) ?? current.quality,
    autoRotate: current.autoRotate
  };
  localStorage.setItem('uploadSettings', JSON.stringify(settings));
}

/* === KOMPRESE OBRÁZKŮ PŘED NAHRÁNÍM === */
async function compressImage(file, settings) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, {
      imageOrientation: settings.autoRotate ? 'from-image' : 'none'
    });
  } catch {
    bitmap = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const w0 = bitmap.width || bitmap.naturalWidth;
  const h0 = bitmap.height || bitmap.naturalHeight;
  let w = w0, h = h0;
  if (settings.maxRes && Math.max(w, h) > settings.maxRes) {
    const scale = settings.maxRes / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', settings.quality));
  return blob || file;
}

/* === UPLOAD S PROGRESS MODALEM === */
function buildUploadProgressModal() {
  const m = document.createElement('div');
  m.className = 'modal';
  m.id = 'uploadProgressModal';
  const isMobile = /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
  m.innerHTML = `
    <div class="modal-box" style="max-width:460px">
      <h3>⬆️ Nahrávání fotek</h3>
      ${isMobile ? '<p style="color:#f59e0b;font-size:13px;margin-bottom:0.75rem">📱 Na mobilu může nahrávání trvat déle, nechte prosím okno otevřené.</p>' : ''}
      <div id="upFileName" style="font-size:13px;color:#94a3b8;margin-bottom:0.4rem"></div>
      <div style="background:#0f172a;border-radius:6px;height:10px;overflow:hidden;margin-bottom:0.5rem">
        <div id="upProgressBar" style="background:#ff6600;height:100%;width:0%;transition:width 0.15s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8">
        <span id="upCounter">0/0</span>
        <span id="upPercent">0 %</span>
        <span id="upSpeed"></span>
      </div>
      <div id="upDone" style="text-align:center;color:#22c55e;font-weight:600;margin-top:0.75rem;display:none">✅ Hotovo!</div>
    </div>`;
  document.body.appendChild(m);
  return m;
}

function fmtSpeed(bytesPerSec) {
  if (bytesPerSec >= 1024 * 1024) return (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
  if (bytesPerSec >= 1024) return (bytesPerSec / 1024).toFixed(1) + ' KB/s';
  return Math.round(bytesPerSec) + ' B/s';
}

function uploadOne(blob, filename) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', blob, filename);
    fd.append('galleryId', 'main');
    const xhr = new XMLHttpRequest();
    let lastLoaded = 0, lastTime = Date.now();
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      const speed = dt > 0 ? (e.loaded - lastLoaded) / dt : 0;
      lastLoaded = e.loaded; lastTime = now;
      const pct = Math.round((e.loaded / e.total) * 100);
      if ($('upProgressBar')) $('upProgressBar').style.width = pct + '%';
      if ($('upPercent')) $('upPercent').textContent = pct + ' %';
      if ($('upSpeed')) $('upSpeed').textContent = fmtSpeed(speed);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error('Server ' + xhr.status));
    };
    xhr.onerror = () => reject(new Error('Chyba sítě'));
    xhr.open('POST', '/api/photos/upload');
    xhr.send(fd);
  });
}

async function uploadFiles(input) {
  const files = Array.from(input.files || []);
  await uploadFileList(files);
  input.value = '';
}

async function uploadFileList(files) {
  if (!files.length) return;
  const settings = getUploadSettings();
  const targetFolder = $('uploadFolderInput')?.value.trim() || '';
  const modal = buildUploadProgressModal();
  const uploadedNames = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if ($('upFileName')) $('upFileName').textContent = file.name;
    if ($('upCounter')) $('upCounter').textContent = (i + 1) + '/' + files.length;
    if ($('upProgressBar')) $('upProgressBar').style.width = '0%';
    if ($('upPercent')) $('upPercent').textContent = '0 %';
    if ($('upSpeed')) $('upSpeed').textContent = '';
    try {
      const compressed = await compressImage(file, settings);
      await uploadOne(compressed, file.name);
      uploadedNames.push(file.name);
    } catch (e) {
      console.error('Chyba nahrávání souboru', file.name, e);
      showToast('Nepodařilo se nahrát ' + file.name + ': ' + e.message, 'error');
    }
  }

  if ($('upDone')) $('upDone').style.display = 'block';
  setTimeout(async () => {
    modal.remove();
    await loadGallery();
    /* Přiřadit cílovou složku nově nahraným fotkám (podle názvu, čistě
       klientsky) — jen těm, co ještě žádnou složku nemají. */
    if (targetFolder && uploadedNames.length) {
      uploadedNames.forEach(name => {
        const p = G.photos.find(x => x.name === name && !getPhotoFolder(x));
        if (p) setPhotoFolder(p, targetFolder);
      });
    }
    renderGallery();
    loadStats();
  }, 700);
}

/* === DRAG & DROP SOUBORŮ PŘÍMO DO GALERIE === */
function initGalleryDropZone() {
  const section = $('galleries');
  if (!section || section.dataset.dropReady) return;
  section.dataset.dropReady = '1';

  let dragCounter = 0;

  section.addEventListener('dragenter', e => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    dragCounter++;
    section.classList.add('drop-active');
  });
  section.addEventListener('dragover', e => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
  });
  section.addEventListener('dragleave', () => {
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) section.classList.remove('drop-active');
  });
  section.addEventListener('drop', e => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    dragCounter = 0;
    section.classList.remove('drop-active');
    const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
    if (!files.length) { showToast('Přetáhni prosím obrázkové soubory.', 'info'); return; }
    uploadFileList(files);
  });
}

/* === INICIALIZACE === */
document.addEventListener('DOMContentLoaded', async () => {
  const ok = await checkAuth();
  if (!ok) return;

  const saved = localStorage.getItem('dashActiveTab') || 'galleries';
  showTab(saved);
  initRibbonDragReorder();
  initGalleryDropZone();
  purgeExpiredTrash();
  updateTrashBadge();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => moveTabIndicator());
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $('uploadSettingsModal')?.classList.add('hidden');
      document.querySelectorAll('.lightbox-modal').forEach(m => m.remove());
      const gallerySection = $('galleries');
      if (gallerySection && gallerySection.classList.contains('active') && G.selected.size) {
        G.selected.clear();
        renderGallery();
      }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const gallerySection = $('galleries');
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
      if (!typing && gallerySection && gallerySection.classList.contains('active') && G.selected.size) {
        e.preventDefault();
        bulkDelete();
      }
    }
  });
});
