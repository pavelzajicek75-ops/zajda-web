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
  const iconUrl = r && r.iconUrl || '';
  return `
    <div class="reaction-row" data-icon-url="${escapeHtml(iconUrl)}" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.6rem;flex-wrap:wrap">
      <div class="reaction-icon-slot" style="width:38px;height:38px;flex:0 0 auto;border-radius:8px;border:1px solid var(--border-soft,#263252);display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--surface-2,#131a2c);cursor:pointer" onclick="pickReactionIcon(this.closest('.reaction-row').querySelector('.reaction-icon-pick-btn'))" title="Klikni pro výběr vlastního obrázku z galerie">
        ${iconUrl ? `<img src="${escapeHtml(iconUrl)}" style="width:100%;height:100%;object-fit:cover">` : `<span style="font-size:18px">${escapeHtml(emoji) || '❔'}</span>`}
      </div>
      <input type="text" class="form-input reaction-emoji-input" value="${escapeHtml(emoji)}" placeholder="🐇" style="max-width:64px;text-align:center;font-size:16px" ${iconUrl ? 'disabled' : ''} oninput="onReactionEmojiInput(this)">
      <input type="text" class="form-input reaction-label-input" value="${escapeHtml(label)}" placeholder="Text sloganu" style="flex:1;min-width:160px">
      <input type="text" class="form-input reaction-key-input" value="${escapeHtml(key)}" placeholder="interní klíč" title="Interní identifikátor — návštěvníci ho nevidí. Změnou klíče u existující reakce začneš počítat od nuly." style="max-width:130px;font-family:var(--font-mono);font-size:11.5px;color:var(--text-faint)">
      <button type="button" class="btn btn-sm reaction-icon-pick-btn" onclick="pickReactionIcon(this)" title="Vybrat obrázek z galerie místo emoji">🖼️ Obrázek</button>
      <button type="button" class="btn btn-sm" onclick="pickReactionEmoji(this)" title="Vybrat emoji z nabídky">😊 Emoji</button>
      <button type="button" class="btn btn-sm reaction-icon-clear-btn" onclick="clearReactionIcon(this)" title="Zrušit obrázek, vrátit se k emoji" style="${iconUrl ? '' : 'display:none'}">✕ obrázek</button>
      <button type="button" class="btn btn-red btn-sm" onclick="this.closest('.reaction-row').remove()" title="Smazat tuhle reakci">🗑</button>
    </div>`;
}

/* Obrázek z galerie MÁ PŘEDNOST před emoji (na veřejné stránce se ukáže
   buď jedno, nebo druhé — viz renderReactionBar v article.html), proto
   se při výběru obrázku textové pole s emoji zamkne (disabled), ať je
   hned jasné, které z toho se skutečně použije. */
/* === VÝBĚR EMOJI Z NABÍDKY ===
   Kurátorovaný výběr (ne úplně celá Unicode emoji databáze — ta má přes
   3000 znaků a byla by nepřehledná) rozdělený do pár kategorií, co
   sedí k reakcím na články: výrazy, gesta, srdce/symboly, zvířata,
   příroda/vesmír (téma webu), jídlo, věci/aktivity. */
const EMOJI_PICKER_CATEGORIES = [
  { name: 'Výrazy', items: ['😀','😂','🤣','😅','😊','😍','🥰','😘','😜','🤪','🤩','🥳','😎','🤓','🧐','😏','😌','😴','🥱','😭','😢','😡','🤬','😱','😨','😰','😳','🥵','🥶','🤯','🥴','😵','🤔','🙄','😬','😇','🤠','🥹','😤','🫠'] },
  { name: 'Gesta', items: ['👍','👎','👏','🙌','🤝','🙏','💪','✌️','🤞','🤟','🤙','👌','👋','🤘','☝️','🫡','🫶'] },
  { name: 'Srdce a symboly', items: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💯','✨','🌟','💥','💫','🔥','⚡','🎉','🎊','🏆','🎯','💡','❓','❗','♾️'] },
  { name: 'Zvířata', items: ['🐰','🐇','🦊','🐻','🐼','🐨','🐯','🦁','🐶','🐱','🐸','🐵','🦄','🐔','🐧','🦉','🐺','🦇','🐢','🐙'] },
  { name: 'Příroda a vesmír', items: ['🚀','🛸','🌍','🌙','⭐','🌌','☄️','🪐','🌈','☀️','🌤️','⛈️','🌪️','❄️','🌊','🏔️','🌋','🌵','🍀','🌸'] },
  { name: 'Jídlo a pití', items: ['☕','🍺','🍷','🍕','🍔','🍟','🍩','🍪','🍫','🍿','🌮','🍜','🍦','🥐','🧃'] },
  { name: 'Věci a aktivity', items: ['💊','🧨','🎈','🃏','🎲','🎮','📸','✈️','⛺','🗺️','🧭','⏱️','🔊','🔁','💀','👽','🤖','🎭','🧩','🛑'] }
];

function pickReactionEmoji(btn) {
  const row = btn.closest('.reaction-row');
  if (!row) return;
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `
    <div class="modal-box" style="max-width:480px;max-height:80vh;display:flex;flex-direction:column;padding:0">
      <div style="padding:1.25rem 1.25rem 0.5rem;flex-shrink:0">
        <h3 style="margin:0 0 0.75rem">😊 Vyber emoji</h3>
      </div>
      <div style="flex:1;overflow-y:auto;padding:0 1.25rem 1rem">
        ${EMOJI_PICKER_CATEGORIES.map(cat => `
          <div style="margin-bottom:1rem">
            <div style="font-size:11.5px;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:0.4rem">${escapeHtml(cat.name)}</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(38px,1fr));gap:4px">
              ${cat.items.map(e => `<button type="button" class="emoji-pick-btn" data-emoji="${e}" style="font-size:20px;padding:6px 0;border-radius:8px;border:1px solid transparent;background:transparent;cursor:pointer" onmouseover="this.style.background='var(--surface-2,#131a2c)'" onmouseout="this.style.background='transparent'">${e}</button>`).join('')}
            </div>
          </div>`).join('')}
      </div>
      <div style="padding:0.75rem 1.25rem;flex-shrink:0;border-top:1px solid var(--border-soft,#263252);text-align:center">
        <button class="btn btn-red btn-sm" onclick="this.closest('.modal').remove()">Zavřít</button>
      </div>
    </div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  m.querySelectorAll('.emoji-pick-btn').forEach(b => {
    b.addEventListener('click', () => {
      const emojiInput = row.querySelector('.reaction-emoji-input');
      if (emojiInput) {
        emojiInput.value = b.dataset.emoji;
        onReactionEmojiInput(emojiInput);
      }
      m.remove();
    });
  });
  document.body.appendChild(m);
}

function pickReactionIcon(btn) {
  const row = btn.closest('.reaction-row');
  if (!row) return;
  openGalleryPickerModal({
    title: 'Vyber obrázek pro reakci',
    onSelect: function (url) {
      row.dataset.iconUrl = url;
      refreshReactionRowIconUI(row);
    }
  });
}

function clearReactionIcon(btn) {
  const row = btn.closest('.reaction-row');
  if (!row) return;
  row.dataset.iconUrl = '';
  refreshReactionRowIconUI(row);
}

function refreshReactionRowIconUI(row) {
  const iconUrl = row.dataset.iconUrl || '';
  const slot = row.querySelector('.reaction-icon-slot');
  const emojiInput = row.querySelector('.reaction-emoji-input');
  const clearBtn = row.querySelector('.reaction-icon-clear-btn');
  if (slot) slot.innerHTML = iconUrl
    ? `<img src="${escapeHtml(iconUrl)}" style="width:100%;height:100%;object-fit:cover">`
    : `<span style="font-size:18px">${escapeHtml(emojiInput ? emojiInput.value : '') || '❔'}</span>`;
  if (emojiInput) emojiInput.disabled = !!iconUrl;
  if (clearBtn) clearBtn.style.display = iconUrl ? '' : 'none';
}

/* Dokud reakce nemá vlastní obrázek, náhled v kolečku odráží rovnou to,
   co se právě píše do emoji pole — ať admin hned vidí, jak to bude
   vypadat, bez nutnosti dřív ukládat. */
function onReactionEmojiInput(input) {
  const row = input.closest('.reaction-row');
  if (!row || row.dataset.iconUrl) return;
  const slot = row.querySelector('.reaction-icon-slot span');
  if (slot) slot.textContent = input.value || '❔';
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
    const iconUrl = row.dataset.iconUrl || '';
    const keyInput = row.querySelector('.reaction-key-input');
    const key = keyInput.value.trim() || slugifyReactionKey(label);
    keyInput.value = key; // doplní se rovnou do pole, ať admin vidí, co se skutečně uloží
    const entry = { key, label };
    if (iconUrl) entry.iconUrl = iconUrl; else entry.emoji = emoji;
    return entry;
  });

  const missing = reactions.find(r => !r.label || (!r.emoji && !r.iconUrl));
  if (missing) {
    showToast('Každá reakce potřebuje text a buď emoji, nebo obrázek', 'info');
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
      value: topTypeDef
        ? (topTypeDef.iconUrl
            ? `<img src="${escapeHtml(topTypeDef.iconUrl)}" style="width:1.6rem;height:1.6rem;object-fit:cover;border-radius:6px;vertical-align:-4px;margin-right:4px">`
            : escapeHtml(topTypeDef.emoji) + ' ') + topTypeCount.toLocaleString('cs')
        : '—',
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
