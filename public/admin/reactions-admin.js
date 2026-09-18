/* =========================================================
   REACTIONS-ADMIN.JS — editor reakcí a jejich statistiky
   =========================================================
   Dvě nezávislé části na jedné záložce "😀 Reakce":
   1) Editor konfigurace (emoji + text u každé reakce) — čte/zapisuje
      /api/reactions/config, které pak veřejná stránka článku používá
      místo dřívějšího natvrdo zapsaného seznamu v article.html.
   2) Statistiky — souhrn (/api/reactions/stats) a jednoduchý sloupcový
      graf vývoje v čase, kreslený jako čisté SVG (žádná externí
      knihovna, konzistentní se zbytkem adminu). */

/* === EDITOR KONFIGURACE === */

function reactionRowHtml(r) {
  const key = r && r.key || '';
  const emoji = r && r.emoji || '';
  const label = r && r.label || '';
  return `
    <div class="reaction-row" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.6rem;flex-wrap:wrap">
      <input type="text" class="form-input reaction-emoji-input" value="${escapeHtml(emoji)}" placeholder="🐇" style="max-width:64px;text-align:center;font-size:16px">
      <input type="text" class="form-input reaction-label-input" value="${escapeHtml(label)}" placeholder="Text sloganu" style="flex:1;min-width:160px">
      <input type="text" class="form-input reaction-key-input" value="${escapeHtml(key)}" placeholder="interní klíč" title="Interní identifikátor — návštěvníci ho nevidí. Změnou klíče u existující reakce začneš počítat od nuly." style="max-width:130px;font-family:var(--font-mono);font-size:11.5px;color:var(--text-faint)">
      <button type="button" class="btn btn-red btn-sm" onclick="this.closest('.reaction-row').remove()" title="Smazat tuhle reakci">🗑</button>
    </div>`;
}

async function loadReactionConfig() {
  const box = $('reactionConfigList');
  if (!box) return;
  box.innerHTML = '<div style="color:var(--text-muted);padding:1rem">Načítám…</div>';
  try {
    const r = await fetch('/api/reactions/config');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const list = Array.isArray(d.reactions) ? d.reactions : [];
    box.innerHTML = list.length
      ? list.map(reactionRowHtml).join('')
      : '<div style="color:var(--text-muted);padding:0.5rem">Zatím žádné reakce — přidej první.</div>';
  } catch (e) {
    console.error('/api/reactions/config (GET) selhalo:', e);
    box.innerHTML = `<div style="color:var(--red);padding:1rem">Nepodařilo se načíst: ${escapeHtml(e.message)}</div>`;
  }
}

function addReactionRow() {
  const box = $('reactionConfigList');
  if (!box) return;
  const empty = box.querySelector('div[style*="Zatím žádné"]');
  if (empty) empty.remove();
  box.insertAdjacentHTML('beforeend', reactionRowHtml({}));
  const inputs = box.querySelectorAll('.reaction-row');
  const last = inputs[inputs.length - 1];
  const emojiInput = last && last.querySelector('.reaction-emoji-input');
  if (emojiInput) emojiInput.focus();
}

/* Z textu sloganu udělá jednoduchý slug pro klíč, když ho admin nechá
   prázdný — ať nemusí vymýšlet interní identifikátor sám. */
function slugifyReactionKey(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || ('reakce-' + Date.now());
}

async function saveReactionConfig() {
  const box = $('reactionConfigList');
  const status = $('reactionConfigStatus');
  if (!box) return;
  const rows = Array.from(box.querySelectorAll('.reaction-row'));
  if (!rows.length) {
    showToast('Musí zůstat aspoň jedna reakce', 'info');
    return;
  }

  const reactions = rows.map(row => {
    const emoji = row.querySelector('.reaction-emoji-input').value.trim();
    const label = row.querySelector('.reaction-label-input').value.trim();
    const keyInput = row.querySelector('.reaction-key-input');
    const key = keyInput.value.trim() || slugifyReactionKey(label);
    keyInput.value = key; // doplní se rovnou do pole, ať admin vidí, co se skutečně uloží
    return { key, emoji, label };
  });

  const missing = reactions.find(r => !r.emoji || !r.label);
  if (missing) {
    showToast('Každá reakce potřebuje emoji i text', 'info');
    return;
  }
  const keys = reactions.map(r => r.key);
  const dupKey = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dupKey) {
    showToast('Duplicitní klíč: ' + dupKey + ' — uprav ho ručně na něco jiného', 'info');
    return;
  }

  if (status) status.textContent = 'Ukládám…';
  try {
    const r = await fetch('/api/reactions/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reactions })
    });
    const bodyText = await r.clone().text().catch(() => '');
    if (!r.ok) throw new Error('HTTP ' + r.status + (bodyText ? ' — ' + bodyText.slice(0, 200) : ''));
    showToast('Reakce uloženy', 'success');
    if (status) status.textContent = 'Uloženo ' + new Date().toLocaleTimeString('cs', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    console.error('/api/reactions/config (POST) selhalo:', e);
    showToast('Nepodařilo se uložit: ' + e.message, 'error');
    if (status) status.textContent = '';
  }
}

/* === STATISTIKY === */

async function loadReactionStats() {
  const summaryBox = $('reactionStatsSummary');
  const chartBox = $('reactionStatsChart');
  if (!summaryBox || !chartBox) return;
  summaryBox.className = 'usage-cards';
  summaryBox.innerHTML = '<div style="color:var(--text-muted);padding:1rem;grid-column:1/-1">Načítám…</div>';
  chartBox.innerHTML = '';

  const days = $('reactionStatsRange')?.value || '30';
  try {
    const [statsRes, configRes] = await Promise.all([
      fetch('/api/reactions/stats?days=' + encodeURIComponent(days)),
      fetch('/api/reactions/config')
    ]);
    if (!statsRes.ok) throw new Error('HTTP ' + statsRes.status);
    const stats = await statsRes.json();
    const config = configRes.ok ? await configRes.json() : { reactions: [] };
    renderReactionStatsSummary(stats, config.reactions || []);
    renderReactionStatsChart(stats.dailyCounts || []);
  } catch (e) {
    console.error('/api/reactions/stats selhalo:', e);
    summaryBox.innerHTML = `
      <div class="form-card" style="grid-column:1/-1;text-align:center;color:var(--text-muted);font-size:13px;line-height:1.6">
        📡 Statistiky se nepodařilo načíst.<br>
        <code style="color:var(--red);word-break:break-word;display:inline-block;margin-top:0.4rem;font-size:11.5px">${escapeHtml(e.message)}</code>
      </div>`;
  }
}

function renderReactionStatsSummary(stats, reactionDefs) {
  const box = $('reactionStatsSummary');
  if (!box) return;
  const byKey = {};
  reactionDefs.forEach(r => { byKey[r.key] = r; });

  let topType = null, topTypeCount = -1;
  for (const [k, n] of Object.entries(stats.totalsByType || {})) {
    if (n > topTypeCount) { topTypeCount = n; topType = k; }
  }
  const topTypeDef = topType ? byKey[topType] : null;

  const cards = [
    { label: '🔢 Reakcí celkem', value: (stats.totalReactions || 0).toLocaleString('cs'), sub: '' },
    {
      label: '🏆 Nejpopulárnější reakce',
      value: topTypeDef ? topTypeDef.emoji + ' ' + topTypeCount.toLocaleString('cs') : '—',
      sub: topTypeDef ? topTypeDef.label : (topType ? '(reakce "' + topType + '" už v nastavení není)' : 'Zatím žádné reakce')
    },
    {
      label: '📝 Nejoblíbenější článek',
      value: stats.topArticle ? stats.topArticle.total.toLocaleString('cs') + ' reakcí' : '—',
      sub: stats.topArticle ? stats.topArticle.title : 'Zatím žádné reakce'
    }
  ];

  box.innerHTML = cards.map(c => `
    <div class="usage-card">
      <div class="usage-card-label">${c.label}</div>
      <div class="usage-card-value">${c.value}</div>
      ${c.sub ? `<div class="usage-card-sub">${escapeHtml(c.sub)}</div>` : ''}
    </div>`).join('');
}

/* Prostý sloupcový graf jako čisté SVG — žádná externí knihovna, ať to
   sedí se zbytkem adminu (co taky nic externího netáhne). */
function renderReactionStatsChart(dailyCounts) {
  const box = $('reactionStatsChart');
  if (!box) return;
  if (!dailyCounts.length) {
    box.innerHTML = '<div style="color:var(--text-muted);padding:1rem;text-align:center;font-size:13px">Zatím není z čeho kreslit graf.</div>';
    return;
  }

  const W = 700, H = 180, PAD_BOTTOM = 22, PAD_TOP = 10;
  const max = Math.max(1, ...dailyCounts.map(d => d.count));
  const barW = W / dailyCounts.length;
  const innerH = H - PAD_BOTTOM - PAD_TOP;

  // Popisky pod osou X jen u části sloupců (jinak se na 90 dnech slijí
  // do nečitelné kaše) — vždy první, poslední a pár rovnoměrně mezi tím.
  const labelEvery = Math.max(1, Math.ceil(dailyCounts.length / 8));

  const bars = dailyCounts.map((d, i) => {
    const h = (d.count / max) * innerH;
    const x = i * barW;
    const y = PAD_TOP + (innerH - h);
    const showLabel = i === 0 || i === dailyCounts.length - 1 || i % labelEvery === 0;
    const shortDate = d.date.slice(5).replace('-', '/'); // MM/DD
    return `
      <g>
        <rect x="${x + barW * 0.15}" y="${y}" width="${barW * 0.7}" height="${Math.max(1, h)}" rx="2"
              fill="var(--accent, #3b82f6)" opacity="0.85">
          <title>${d.date}: ${d.count} ${d.count === 1 ? 'reakce' : (d.count >= 2 && d.count <= 4 ? 'reakce' : 'reakcí')}</title>
        </rect>
        ${showLabel ? `<text x="${x + barW / 2}" y="${H - 6}" text-anchor="middle" font-size="9.5" fill="var(--text-faint,#5b6584)">${shortDate}</text>` : ''}
      </g>`;
  }).join('');

  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" preserveAspectRatio="none">${bars}</svg>`;
}

/* === PROPOJENÍ SE ZÁLOŽKOU === */
if (typeof window.showTab === 'function') {
  const originalShowTabForReactions = window.showTab;
  window.showTab = function (name) {
    const result = originalShowTabForReactions.apply(this, arguments);
    if (name === 'reactions') {
      loadReactionConfig();
      loadReactionStats();
    }
    return result;
  };
}
