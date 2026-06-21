// ═══════════════════════════════════════
// WYSIWYG + FORMÁTOVÁNÍ
// ═══════════════════════════════════════
function execCmd(cmd, val) { document.execCommand(cmd, false, val); }

function getSelectedImg() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  let node = sel.getRangeAt(0).commonAncestorContainer;
  if (node.nodeType === 3) node = node.parentElement;
  return node.closest ? node.closest('img') : null;
}

function deleteSelectedImg() {
  const img = getSelectedImg();
  if (!img) return;
  img.remove();
  window.getSelection().removeAllRanges();
}

function moveImageUp() {
  const img = getSelectedImg();
  if (!img) return;
  const prev = img.previousElementSibling;
  if (prev) { img.parentNode.insertBefore(img, prev); window.getSelection().removeAllRanges(); }
}

function moveImageDown() {
  const img = getSelectedImg();
  if (!img) return;
  const next = img.nextElementSibling;
  if (next) { img.parentNode.insertBefore(next, img); window.getSelection().removeAllRanges(); }
}

function insertImgTo(editorId, align) {
  if (!G.photos.length) { alert('Nejdřív nahraj fotky do galerie.'); return; }
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div style="background:#1e293b;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #334155">
    <h3 style="margin-bottom:1rem;color:#f8fafc">Vložit fotku</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.75rem">
      ${G.photos.map(p => `<img src="${p.url}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="insertImgUrl('${editorId}','${p.url}','${align}')">`).join('')}
    </div>
    <div style="text-align:center;margin-top:1rem">
      <button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button>
    </div>
  </div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
}

function insertImgUrl(editorId, url, align) {
  const editor = $(editorId);
  let style = 'max-width:300px;width:100%;height:auto;border-radius:6px;margin:0.5rem auto;display:block;cursor:pointer;';
  if (align === 'left') {
    style = 'max-width:300px;width:100%;height:auto;border-radius:6px;margin:0.5rem 1rem 0.5rem 0;float:left;display:block;cursor:pointer;';
  } else if (align === 'right') {
    style = 'max-width:300px;width:100%;height:auto;border-radius:6px;margin:0.5rem 0 0.5rem 1rem;float:right;display:block;cursor:pointer;';
  }
  const html = `<img src="${url}" style="${style}" onclick="openLightbox('${url}')" class="editor-img" draggable="false">`;
  editor.focus();
  document.execCommand('insertHTML', false, html);
  const modal = document.querySelector('.modal');
  if (modal) modal.remove();
  setTimeout(() => bindEditorImages(editorId), 50);
}

function bindEditorImages(editorId) {
  const editor = $(editorId);
  if (!editor) return;
  editor.querySelectorAll('img:not([data-bound])').forEach(img => {
    img.dataset.bound = '1';
    img.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      editor.querySelectorAll('img').forEach(i => i.style.outline = 'none');
      img.style.outline = '3px solid #3b82f6';
      const sel = window.getSelection();
      const r = document.createRange();
      r.selectNode(img);
      sel.removeAllRanges();
      sel.addRange(r);
    };
  });
}

// ═══════════════════════════════════════
// ČLÁNKY
// ═══════════════════════════════════════
async function loadArtSubsections() {
  const sec = $('artSection')?.value;
  const sel = $('artSubsection');
  if (!sel) return;
  if (!sec) { sel.innerHTML = '<option value="">— Podsekce —</option>'; return; }
  try {
    const r = await fetch('/api/subsections/by-section?sectionId=' + sec);
    const arr = await r.json();
    sel.innerHTML = '<option value="">— Podsekce —</option>' + arr.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  } catch {
    sel.innerHTML = '<option value="">— Podsekce —</option>';
  }
}

async function loadArticles() {
  try {
    const r = await fetch('/api/articles/list');
    const data = await r.json();
    const box = $('articleList');
    if (!box) return;
    box.innerHTML = data.map(a => `<div class="card">
      <h4>${escapeHtml(a.title)}</h4>
      <p><small>${a.section || ''} ${a.subsection || ''} | ${a.place || ''} | ${new Date(a.date || a.created).toLocaleDateString('cs')}</small></p>
      <div class="article-preview">${a.content}</div>
      <div class="actions"><button onclick="deleteArticle('${a.id}')" class="btn btn-red">Smazat</button></div>
    </div>`).join('');
    box.querySelectorAll('.article-preview img').forEach(img => {
      img.style.cursor = 'pointer';
      img.onclick = e => { e.stopPropagation(); openLightbox(img.src); };
    });
  } catch (e) { console.error(e); }
}

async function createArticle() {
  const title = $('artTitle')?.value.trim();
  const content = $('artEditor')?.innerHTML;
  if (!title || !content) return alert('Vyplň nadpis a obsah');
  await fetch('/api/articles/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title, content,
      sectionId: $('artSection')?.value,
      subsectionId: $('artSubsection')?.value,
      date: $('artDate')?.value,
      place: $('artPlace')?.value
    })
  });
  $('artTitle').value = '';
  $('artEditor').innerHTML = '';
  $('artDate').value = '';
  $('artPlace').value = '';
  loadArticles();
}

async function deleteArticle(id) {
  if (!confirm('Smazat článek?')) return;
  await fetch(`/api/articles/delete?id=${id}`, { method: 'DELETE' });
  loadArticles();
}
// ═══════════════════════════════════════
// CITÁTY
// ═══════════════════════════════════════
async function loadQuotes() {
  const tbody = $('quoteTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b">Načítání...</td></tr>';
  try {
    const r = await fetch('/api/quotes/list');
    const data = await r.json();
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b">Žádné citáty.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(q => `<tr>
      <td>"${escapeHtml(q.text)}"</td>
      <td>${escapeHtml(q.author) || '—'}</td>
      <td><button onclick="deleteQuote('${encodeURIComponent(q.key)}')" class="btn btn-red btn-sm">Smazat</button></td>
    </tr>`).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#ef4444">Chyba.</td></tr>';
  }
}

async function createQuote() {
  const text = $('qText')?.value.trim();
  if (!text) return alert('Zadej text citátu');
  await fetch('/api/quotes/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, author: $('qAuthor')?.value.trim() })
  });
  $('qText').value = '';
  $('qAuthor').value = '';
  loadQuotes();
}

async function deleteQuote(key) {
  if (!confirm('Smazat?')) return;
  await fetch(`/api/quotes/delete?key=${key}`, { method: 'DELETE' });
  loadQuotes();
}

// ═══════════════════════════════════════
// PODSEKCE + COVERY
// ═══════════════════════════════════════
async function loadSubsections() {
  const tbody = $('subsectionTableBody');
  if (!tbody) return;
  const secs = ['travel', 'photo', 'projects', 'about'];
  const all = [];
  for (const sid of secs) {
    try {
      const r = await fetch('/api/subsections/by-section?sectionId=' + sid);
      const arr = await r.json();
      all.push(...arr);
    } catch {}
  }
  tbody.innerHTML = all.map(s => `<tr>
    <td>${escapeHtml(s.sectionId)}</td>
    <td style="display:flex;align-items:center;gap:0.75rem">
      ${s.coverUrl ? `<img src="${s.coverUrl}" style="width:120px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #334155;flex-shrink:0">` : '<div style="width:120px;height:80px;background:#0f172a;border-radius:6px;border:1px solid #334155;flex-shrink:0"></div>'}
      <span>${escapeHtml(s.name)}</span>
    </td>
    <td>${escapeHtml(s.slug)}</td>
    <td>${s.order || 0}</td>
    <td>
      <button onclick="pickSubsectionCover('${s.id}')" class="btn btn-blue btn-sm">Cover</button>
      <button onclick="deleteSubsection('${s.id}')" class="btn btn-red btn-sm">Smazat</button>
    </td>
  </tr>`).join('');
}

async function createSubsection() {
  const sec = $('ssSection')?.value;
  const name = $('ssName')?.value.trim();
  if (!sec || !name) return alert('Vyplň sekci a název');
  const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  await fetch('/api/subsections/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sectionId: sec, name, slug, order: parseInt($('ssOrder')?.value) || 0 })
  });
  $('ssName').value = '';
  $('ssOrder').value = '0';
  loadSubsections();
}

async function deleteSubsection(id) {
  if (!confirm('Smazat?')) return;
  await fetch(`/api/subsections/delete?id=${id}`, { method: 'DELETE' });
  loadSubsections();
}
async function pickSubsectionCover(id) {
  if (!G.photos.length) { alert('Galerie se načítá. Jdi nejdřív do Galerie.'); return; }
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div style="background:#1e293b;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #334155">
    <h3 style="margin-bottom:1rem;color:#f8fafc">Cover podsekce</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.5rem">
      ${G.photos.map(p => `<img src="${p.url}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="saveSubsectionCover('${id}','${p.url}')">`).join('')}
    </div>
    <div style="text-align:center;margin-top:1rem">
      <button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button>
    </div>
  </div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
}

async function saveSubsectionCover(id, url) {
  await fetch('/api/subsections/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, coverUrl: url })
  });
  const m = document.querySelector('.modal');
  if (m) m.remove();
  loadSubsections();
}

async function loadSectionCovers() {
  const box = $('sectionCovers');
  if (!box) return;
  const secs = [
    { id: 'travel', n: 'Cestování' },
    { id: 'photo', n: 'Fotografování' },
    { id: 'projects', n: 'Projekty' },
    { id: 'about', n: 'O Zajdovi' }
  ];
  let html = '<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem">';
  for (const s of secs) {
    let url = '';
    try {
      const r = await fetch('/api/sections/cover?sectionId=' + s.id);
      const d = await r.json();
      url = d.url || '';
    } catch {}
    html += `<div style="background:#1e293b;padding:0.75rem;border-radius:8px;border:1px solid #334155;text-align:center;min-width:140px">
      <div style="font-size:0.875rem;margin-bottom:0.5rem">${escapeHtml(s.n)}</div>
      ${url ? `<img src="${url}" style="width:120px;height:80px;object-fit:cover;border-radius:6px;margin:0 auto 0.5rem;display:block;border:1px solid #334155">` : '<div style="width:120px;height:80px;background:#0f172a;border-radius:6px;margin:0 auto 0.5rem;border:1px solid #334155"></div>'}
      <button onclick="pickSectionCover('${s.id}')" class="btn btn-blue btn-sm">Změnit</button>
    </div>`;
  }
  html += '</div>';
  box.innerHTML = html;
}

function pickSectionCover(sectionId) {
  if (!G.photos.length) { alert('Galerie se načítá. Jdi nejdřív do Galerie.'); return; }
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div style="background:#1e293b;padding:1.5rem;border-radius:12px;max-width:90vw;max-height:80vh;overflow:auto;border:1px solid #334155">
    <h3 style="margin-bottom:1rem;color:#f8fafc">Cover sekce</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.5rem">
      ${G.photos.map(p => `<img src="${p.url}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="saveSectionCover('${sectionId}','${p.url}')">`).join('')}
    </div>
    <div style="text-align:center;margin-top:1rem">
      <button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button>
    </div>
  </div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
}

async function saveSectionCover(sectionId, url) {
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    const fd = new FormData();
    fd.append('file', blob, 'cover.jpg');
    fd.append('sectionId', sectionId);
    await fetch('/api/sections/cover', { method: 'POST', body: fd });
  } catch (e) { console.error(e); }
  const m = document.querySelector('.modal');
  if (m) m.remove();
  loadSectionCovers();
}

// ═══════════════════════════════════════
// O ZAJDOVI
// ═══════════════════════════════════════
async function loadAbout() {
  try {
    const r = await fetch('/api/about/get');
    const d = await r.json();
    $('aboutTitle').value = d.title || '';
    $('aboutEditor').innerHTML = d.text || '';
    $('aboutPreview').innerHTML = `<h4>${escapeHtml(d.title || 'O Zajdovi')}</h4><div>${d.text || ''}</div>`;
    bindEditorImages('aboutEditor');
  } catch (e) { console.error(e); }
}

async function saveAbout() {
  const about = {
    title: $('aboutTitle')?.value || '',
    text: $('aboutEditor')?.innerHTML || ''
  };
  await fetch('/api/about/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(about)
  });
  loadAbout();
}
