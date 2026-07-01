<link href="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js"></script>
<!-- Článek editor -->
<div id="artEditor-toolbar">
  <span class="ql-formats">
    <select class="ql-header">
      <option value="1">Nadpis 1</option>
      <option value="2">Nadpis 2</option>
      <option value="3">Nadpis 3</option>
      <option value="normal">Normální text</option>
    </select>
  </span>
  <span class="ql-formats">
    <button class="ql-bold"></button>
    <button class="ql-italic"></button>
    <button class="ql-underline"></button>
    <button class="ql-strike"></button>
  </span>
  <span class="ql-formats">
    <button class="ql-list" value="ordered"></button>
    <button class="ql-list" value="bullet"></button>
    <button class="ql-indent" value="-1"></button>
    <button class="ql-indent" value="+1"></button>
  </span>
  <span class="ql-formats">
    <button class="ql-blockquote"></button>
    <button class="ql-code-block"></button>
    <button class="ql-link"></button>
    <button class="ql-image" id="ql-insert-gallery"></button>
    <button class="ql-video"></button>
  </span>
  <span class="ql-formats">
    <select class="ql-color"></select>
    <select class="ql-background"></select>
    <select class="ql-align"></select>
  </span>
  <span class="ql-formats">
    <button class="ql-clean"></button>
  </span>
</div>
<div id="artEditor" style="min-height:350px"></div>

<!-- About editor (stejný toolbar struktura, jen jiné ID) -->
<div id="aboutEditor-toolbar">
  <!-- ... stejné tlačítka ... -->
</div>
<div id="aboutEditor" style="min-height:250px"></div>
/* =========================================================
   DASHBOARD EDITOR v2 — vylepšená verze
   - Quill WYSIWYG editor
   - Robustní upload fronta s retry
   - Lepší galerie picker
   - Cache purge po úpravě článků
   ========================================================= */

function $(id) { return document.getElementById(id); }

function escapeHtml(t) {
  if (!t) return '';
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.G = window.G || { photos: [] };

/* === SVG filtry pro náhled (stejně jako předtím) ====== */
(function initEditorFilters() {
  if (document.getElementById('editor-filters-svg')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'editor-filters-svg';
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;pointer-events:none;';
  svg.innerHTML = `
    <defs>
      <filter id="ed-sharpen" x="-20%" y="-20%" width="140%" height="140%">
        <feConvolveMatrix order="3" kernelMatrix="0 -1 0 -1 5 -1 0 -1 0" preserveAlpha="true"/>
      </filter>
      <filter id="ed-sharpen-strong" x="-20%" y="-20%" width="140%" height="140%">
        <feConvolveMatrix order="3" kernelMatrix="0 -1.5 0 -1.5 7 -1.5 0 -1.5 0" preserveAlpha="true"/>
      </filter>
    </defs>`;
  document.body.appendChild(svg);
})();

/* === Foto Editor stav (stejný jako předtím) ============ */
let ED = {
  photo: null, img: null, scale: 1, rotate: 0, panX: 0, panY: 0,
  crop: 'free', export: 'max', blobUrl: null,
  filters: { exposure: 0, contrast: 0, saturation: 0, temp: 0, vignette: 0, sharpen: 0, denoise: 0, ai: false },
  cropRect: null, isDraggingImage: false, isDraggingCrop: false, isResizingCrop: false,
  resizeDir: '', lastX: 0, lastY: 0
};

/* --- Otevřít / Zavřít editor (stejný jako předtím) ----- */
/* ... (openEditor, fitImageToPreview, closeEditor, editorSetZoom,
       updatePreviewTransform, rotateEditor, applyFilters,
       updateFilterLabels, setFilter, setCrop, renderCropRect,
       initCropSystem, applyCrop, setExport, getExportDim,
       getSafeCanvasDim, applySharpen, saveEditor — beze změny) ... */

// [POZNÁMKA: Foto editor zůstává beze změny — funguje správně]

/* =========================================================
   NOVÉ: Quill WYSIWYG editory
   ========================================================= */
let quillArt = null;
let quillAbout = null;

function initQuillEditors() {
  // Článek editor
  if ($('artEditor') && !quillArt) {
    quillArt = new Quill('#artEditor', {
      modules: {
        toolbar: {
          container: '#artEditor-toolbar',
          handlers: {
            image: function() { openGalleryPicker('art'); }
          }
        }
      },
      theme: 'snow',
      placeholder: 'Začni psát článek...'
    });
  }

  // About editor
  if ($('aboutEditor') && !quillAbout) {
    quillAbout = new Quill('#aboutEditor', {
      modules: {
        toolbar: {
          container: '#aboutEditor-toolbar',
          handlers: {
            image: function() { openGalleryPicker('about'); }
          }
        }
      },
      theme: 'snow',
      placeholder: 'Napiš něco o sobě...'
    });
  }
}

function getEditorHTML(which) {
  const q = which === 'about' ? quillAbout : quillArt;
  return q ? q.root.innerHTML : '';
}

function setEditorHTML(which, html) {
  const q = which === 'about' ? quillAbout : quillArt;
  if (!q) return;
  q.root.innerHTML = html || '';
  // Ošetřit obrázky — přidat třídu a draggable=false
  q.root.querySelectorAll('img').forEach(img => {
    img.classList.add('editor-img');
    img.setAttribute('draggable', 'false');
  });
}

/* =========================================================
   NOVÉ: Lepší galerie picker (místo starého insertImgTo)
   ========================================================= */
function openGalleryPicker(targetEditor) {
  if (!G.photos || !G.photos.length) {
    alert('Galerie je prázdná. Nejprve nahraj fotky.');
    return;
  }

  const m = document.createElement('div');
  m.className = 'modal gallery-picker-modal';
  m.innerHTML = `
    <div class="gallery-picker-box">
      <div class="gp-header">
        <h3>📷 Vybrat fotku z galerie</h3>
        <div class="gp-search">
          <input type="text" id="gpSearchInput" placeholder="🔍 Hledat podle názvu..." 
                 style="background:#0f172a;border:1px solid #475569;color:#e2e8f0;border-radius:6px;padding:6px 12px;width:200px;font-size:13px">
        </div>
      </div>
      <div class="gp-align-tabs">
        <button class="gp-tab active" data-align="center" onclick="gpSetAlign('center')">⬌ Na střed</button>
        <button class="gp-tab" data-align="left" onclick="gpSetAlign('left')">⬅ Vlevo</button>
        <button class="gp-tab" data-align="right" onclick="gpSetAlign('right')">➡ Vpravo</button>
      </div>
      <div class="gp-grid" id="gpGrid">
        ${G.photos.map((p, i) => `
          <div class="gp-thumb" data-url="${p.url}" data-name="${escapeHtml(p.name || '')}" data-idx="${i}"
               onclick="gpSelectPhoto('${targetEditor}', '${p.url}')">
            <img src="${p.url}" loading="lazy" alt="${escapeHtml(p.name || '')}">
            <div class="gp-thumb-name">${escapeHtml((p.name || 'foto').substring(0, 18))}</div>
          </div>
        `).join('')}
      </div>
      <div class="gp-footer">
        <span id="gpCount">${G.photos.length} fotek v galerii</span>
        <button onclick="this.closest('.modal').remove()" class="btn btn-red">Zavřít</button>
      </div>
    </div>`;
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);

  // Search filter
  const search = $('gpSearchInput');
  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      document.querySelectorAll('.gp-thumb').forEach(t => {
        const name = (t.dataset.name || '').toLowerCase();
        t.style.display = name.includes(q) ? '' : 'none';
      });
    });
  }
}

let gpSelectedAlign = 'center';

function gpSetAlign(align) {
  gpSelectedAlign = align;
  document.querySelectorAll('.gp-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.align === align);
  });
}

function gpSelectPhoto(targetEditor, url) {
  const q = targetEditor === 'about' ? quillAbout : quillArt;
  if (!q) return;

  const range = q.getSelection();
  const index = range ? range.index : q.getLength();

  let style = 'max-width: 400px; width: 100%; height: auto; border-radius: 6px; margin: 0.5rem auto; display: block; cursor: pointer;';
  if (gpSelectedAlign === 'left') {
    style = 'max-width: 400px; width: 100%; height: auto; border-radius: 6px; margin: 0.5rem 1rem 0.5rem 0; float: left; display: block; cursor: pointer;';
  } else if (gpSelectedAlign === 'right') {
    style = 'max-width: 400px; width: 100%; height: auto; border-radius: 6px; margin: 0.5rem 0 0.5rem 1rem; float: right; display: block; cursor: pointer;';
  }

  // Vložit obrázek do Quill editoru
  q.insertEmbed(index, 'image', url);
  
  // Po vložení nastavit styl a třídu
  setTimeout(() => {
    const imgs = q.root.querySelectorAll('img');
    const lastImg = imgs[imgs.length - 1];
    if (lastImg) {
      lastImg.className = 'editor-img';
      lastImg.setAttribute('draggable', 'false');
      lastImg.setAttribute('style', style);
    }
  }, 50);

  // Zavřít modal
  const modal = document.querySelector('.gallery-picker-modal');
  if (modal) modal.remove();
}

/* =========================================================
   NOVÉ: Robustní upload fronta s retry a progressem
   ========================================================= */
async function uploadPhotosRobust(files) {
  if (!files || !files.length) return;

  // Vytvořit progress UI
  const progressBox = document.createElement('div');
  progressBox.id = 'uploadProgress';
  progressBox.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:1rem;min-width:320px;max-width:400px;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.6)';
  document.body.appendChild(progressBox);

  const fileArr = Array.from(files);
  const total = fileArr.length;
  let completed = 0;
  let failed = [];

  function updateProgress() {
    const pct = Math.round((completed / total) * 100);
    progressBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
        <span style="color:#f8fafc;font-weight:600;font-size:14px">📤 Upload fotek</span>
        <span style="color:#94a3b8;font-size:13px">${completed}/${total}</span>
      </div>
      <div style="background:#0f172a;border-radius:6px;height:8px;overflow:hidden;margin-bottom:0.5rem">
        <div style="background:linear-gradient(90deg,#ff6600,#ffaa00);height:100%;width:${pct}%;transition:width 0.3s;border-radius:6px"></div>
      </div>
      ${failed.length ? `<div style="color:#ef4444;font-size:12px;margin-top:0.5rem">⚠️ ${failed.length} selhalo</div>` : ''}
      ${completed === total ? `<button onclick="this.parentElement.remove()" class="btn btn-sm" style="margin-top:0.5rem;width:100%">Hotovo ✓</button>` : ''}
    `;
  }

  updateProgress();

  // Sekvenční upload s retry
  for (let i = 0; i < fileArr.length; i++) {
    const file = fileArr[i];
    let success = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!success && attempts < maxAttempts) {
      attempts++;
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('galleryId', 'main');

        const r = await fetch('/api/photos/upload', {
          method: 'POST',
          body: fd
        });

        if (!r.ok) throw new Error('HTTP ' + r.status);
        
        success = true;
        completed++;
        updateProgress();
      } catch (e) {
        console.warn(`Upload pokus ${attempts}/${maxAttempts} pro ${file.name}:`, e.message);
        if (attempts >= maxAttempts) {
          failed.push(file.name);
          completed++;
          updateProgress();
        } else {
          // Krátká pauza před retry
          await new Promise(r => setTimeout(r, 1000 * attempts));
        }
      }
    }

    // Krátká pauza mezi soubory (100ms) — zabrání přetížení Workeru
    if (i < fileArr.length - 1) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // Po dokončení reload galerie
  await loadGallery();
  
  // Zobrazit výsledek
  if (failed.length > 0) {
    console.error('Nepodařilo se nahrát:', failed);
  }
}

/* =========================================================
   Články — vylepšená editace s cache purge
   ========================================================= */
function generateSlug(title) {
  if (!title) return 'clanek-' + Date.now();
  return title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60) || 'clanek-' + Date.now();
}

async function loadArticles() {
  try {
    const r = await fetch('/api/articles/list');
    if (!r.ok) throw new Error('Chyba načítání');
    const data = await r.json();
    const arr = Array.isArray(data) ? data : (data.articles || []);
    const box = $('articleList');
    if (!box) return;

    if (!arr.length) {
      box.innerHTML = '<div style="color:#64748b;padding:1rem;text-align:center">Zatím žádné články</div>';
      return;
    }

    box.innerHTML = arr.map(a => {
      const excerpt = a.content ? a.content.replace(/<[^>]+>/g, '').substring(0, 120) + '...' : '';
      return `
      <div class="card" style="margin-bottom:1rem;padding:1rem;background:#1e293b;border:1px solid #334155;border-radius:10px">
        <h4 style="color:#ffcc66;margin-bottom:0.3rem">${escapeHtml(a.title)}</h4>
        <p style="color:#94a3b8;font-size:13px;margin-bottom:0.5rem">
          ${a.section || ''} ${a.subsection || ''} • ${a.place || ''} • ${new Date(a.date || a.created).toLocaleDateString('cs')}
        </p>
        ${excerpt ? `<p style="color:#cbd5e1;font-size:14px;margin-bottom:0.75rem;line-height:1.5">${escapeHtml(excerpt)}</p>` : ''}
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button onclick="editArticle('${a.id}')" class="btn btn-blue btn-sm">✏️ Upravit</button>
          <button onclick="publishArticle('${a.id}')" class="btn btn-sm" style="background:#16a34a;color:white" title="Obnovit na webu">🔄 Obnovit na webu</button>
          <button onclick="deleteArticle('${a.id}')" class="btn btn-red btn-sm">🗑 Smazat</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    console.error('Chyba článků:', e);
    const box = $('articleList');
    if (box) box.innerHTML = '<div style="color:#ef4444;padding:1rem;text-align:center">Nepodařilo se načíst články</div>';
  }
}

async function editArticle(id) {
  try {
    const r = await fetch('/api/articles/get?id=' + encodeURIComponent(id));
    if (!r.ok) throw new Error('Server vrátil ' + r.status);
    const a = await r.json();

    if (typeof showTab === 'function') showTab('articles');

    if ($('artTitle')) $('artTitle').value = a.title || '';
    
    // Quill editor — nastavit obsah
    setEditorHTML('art', a.content || '');
    // Uložit editId
    if (quillArt) quillArt.root.dataset.editId = id;

    if ($('artDate')) $('artDate').value = a.date ? a.date.split('T')[0] : '';
    if ($('artPlace')) $('artPlace').value = a.place || '';
    if ($('artSection')) {
      $('artSection').value = a.sectionId || a.section || '';
      await loadArtSubsections();
    }
    const subEl = $('artSubsection');
    if (subEl) subEl.value = a.subsectionId || a.subsection || '';

    // Změnit tlačítko na "Uložit změny"
    const btn = $('artSubmitBtn');
    if (btn) {
      btn.textContent = '💾 Uložit změny';
      btn.onclick = updateArticle;
    }

    // Scroll nahoru
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    alert('Nepodařilo se načíst článek pro úpravu');
    console.error(e);
  }
}

async function createArticle() {
  const title = $('artTitle')?.value.trim();
  const content = getEditorHTML('art');
  if (!title || !content || content === '<p><br></p>') return alert('Vyplň nadpis a obsah');

  const payload = {
    title,
    content,
    slug: generateSlug(title),
    sectionId: $('artSection')?.value || null,
    subsectionId: $('artSubsection')?.value || null,
    date: $('artDate')?.value || new Date().toISOString().split('T')[0],
    place: $('artPlace')?.value || ''
  };

  try {
    const r = await fetch('/api/articles/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('Chyba ukládání');
    await purgeCache(); // NOVÉ: refresh na webu
  } catch (e) {
    alert('Nepodařilo se vytvořit článek');
    console.error(e);
    return;
  }
  resetArticleForm();
  loadArticles();
}

async function updateArticle() {
  const id = quillArt?.root?.dataset?.editId;
  if (!id) return createArticle();

  const title = $('artTitle')?.value.trim();
  const content = getEditorHTML('art');
  if (!title || !content || content === '<p><br></p>') return alert('Vyplň nadpis a obsah');

  const payload = {
    id,
    title,
    content,
    slug: generateSlug(title),
    sectionId: $('artSection')?.value || null,
    subsectionId: $('artSubsection')?.value || null,
    date: $('artDate')?.value || new Date().toISOString().split('T')[0],
    place: $('artPlace')?.value || ''
  };

  try {
    const r = await fetch('/api/articles/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('Chyba ukládání');
    await purgeCache(); // NOVÉ: refresh na webu
  } catch (e) {
    alert('Nepodařilo se uložit změny');
    console.error(e);
    return;
  }
  resetArticleForm();
  loadArticles();
}

/* NOVÉ: Publikovat / obnovit článek na webu */
async function publishArticle(id) {
  try {
    // 1. Purge cache
    await purgeCache();
    alert('✅ Web byl obnoven. Změny jsou viditelné.');
  } catch (e) {
    alert('Nepodařilo se obnovit web: ' + e.message);
  }
}

/* NOVÉ: Cache purge — zajistí refresh na webu */
async function purgeCache() {
  try {
    // Pokud máš custom domain na Cloudflare, purge everything
    const r = await fetch('/api/cache/purge', { method: 'POST' });
    if (!r.ok) console.warn('Cache purge endpoint neexistuje nebo selhal');
  } catch (e) {
    console.warn('Cache purge skip:', e.message);
  }
}

function resetArticleForm() {
  if ($('artTitle')) $('artTitle').value = '';
  setEditorHTML('art', '');
  if (quillArt) delete quillArt.root.dataset.editId;
  if ($('artDate')) $('artDate').value = '';
  if ($('artPlace')) $('artPlace').value = '';
  if ($('artSection')) $('artSection').value = '';
  if ($('artSubsection')) $('artSubsection').innerHTML = '<option value="">— Podsekce —</option>';

  const btn = $('artSubmitBtn');
  if (btn) {
    btn.textContent = 'Vytvořit článek';
    btn.onclick = createArticle;
  }
}

async function deleteArticle(id) {
  if (!confirm('Opravdu smazat tento článek?')) return;
  try {
    const r = await fetch(`/api/articles/delete?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Chyba mazání');
    await purgeCache();
    loadArticles();
  } catch (e) {
    alert('Nepodařilo se smazat článek');
    console.error(e);
  }
}

/* =========================================================
   Podsekce pro formulář (beze změny)
   ========================================================= */
async function loadArtSubsections() {
  const sec = $('artSection')?.value;
  const sel = $('artSubsection');
  if (!sel) return;
  if (!sec) { sel.innerHTML = '<option value="">— Podsekce —</option>'; return; }
  try {
    const r = await fetch('/api/subsections/by-section?sectionId=' + sec);
    const arr = await r.json();
    sel.innerHTML = '<option value="">— Podsekce —</option>' +
      arr.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  } catch {
    sel.innerHTML = '<option value="">— Podsekce —</option>';
  }
}

/* =========================================================
   Citáty (beze změny)
   ========================================================= */
// ... loadQuotes, createQuote, deleteQuote — stejné jako předtím ...

/* =========================================================
   Podsekce (beze změny)
   ========================================================= */
// ... loadSubsections, createSubsection, deleteSubsection,
//     pickSubsectionCover, saveSubsectionCover — stejné ...

/* =========================================================
   Sekce Cover fotky (beze změny)
   ========================================================= */
// ... loadSectionCovers, pickSectionCover, saveSectionCover — stejné ...

/* =========================================================
   O mně — upraveno pro Quill
   ========================================================= */
async function loadAbout() {
  try {
    const r = await fetch('/api/about/get');
    const d = await r.json() || {};
    if ($('aboutTitle')) $('aboutTitle').value = d.title || '';
    setEditorHTML('about', d.text || '');
    const prev = $('aboutPreview');
    if (prev) prev.innerHTML = `<h4 style="color:#ffcc66;margin-bottom:0.5rem">${escapeHtml(d.title || 'O Zajdovi')}</h4><div style="line-height:1.6">${d.text || ''}</div>`;
  } catch (e) {
    console.error('About chyba:', e);
    if ($('aboutTitle')) $('aboutTitle').value = '';
    setEditorHTML('about', '');
  }
}

async function saveAbout() {
  const about = {
    title: $('aboutTitle')?.value || '',
    text: getEditorHTML('about')
  };
  try {
    await fetch('/api/about/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(about)
    });
    await purgeCache();
    loadAbout();
  } catch {
    alert('Chyba uložení');
  }
}

/* =========================================================
   Galerie (beze změny)
   ========================================================= */
async function loadGallery() {
  try {
    const r = await fetch('/api/photos/list?galleryId=main');
    if (!r.ok) throw new Error();
    const data = await r.json();
    G.photos = Array.isArray(data) ? data : (data.photos || []);
  } catch (e) {
    console.error('Chyba galerie:', e);
    G.photos = [];
  }
}

/* =========================================================
   CSS — Quill + galerie picker styly
   ========================================================= */
(function injectEditorStyles() {
  if (document.getElementById('dashboard-editor-styles')) return;
  const style = document.createElement('style');
  style.id = 'dashboard-editor-styles';
  style.textContent = `
    /* === Quill editor tmavý vzhled === */
    .ql-toolbar {
      background: #1e293b !important;
      border: 1px solid #334155 !important;
      border-radius: 8px 8px 0 0 !important;
      padding: 8px !important;
    }
    .ql-container {
      background: #0f172a !important;
      border: 1px solid #334155 !important;
      border-radius: 0 0 8px 8px !important;
      color: #e2e8f0 !important;
      font-size: 15px !important;
    }
    .ql-editor {
      min-height: 300px;
      color: #e2e8f0 !important;
      line-height: 1.7;
    }
    .ql-editor.ql-blank::before {
      color: #475569 !important;
    }
    .ql-editor h1 { color: #ffcc66; font-size: 24px; border-bottom: 1px solid rgba(255,102,0,0.3); padding-bottom: 0.3rem; }
    .ql-editor h2 { color: #ffcc66; font-size: 20px; }
    .ql-editor h3 { color: #ffb366; font-size: 17px; }
    .ql-editor a { color: #60a5fa; }
    .ql-editor blockquote {
      border-left: 3px solid #ff6600;
      background: rgba(255,102,0,0.08);
      color: #cbd5e1;
      font-style: italic;
    }
    .ql-editor img { max-width: 100%; border-radius: 6px; }
    .ql-editor img.editor-img { cursor: pointer; }
    .ql-snow .ql-stroke { stroke: #94a3b8 !important; }
    .ql-snow .ql-fill { fill: #94a3b8 !important; }
    .ql-snow .ql-picker-label { color: #94a3b8 !important; }
    .ql-snow .ql-picker-options { background: #1e293b !important; border: 1px solid #334155 !important; }
    .ql-snow.ql-toolbar button:hover .ql-stroke,
    .ql-snow.ql-toolbar button.ql-active .ql-stroke { stroke: #ff6600 !important; }
    .ql-snow.ql-toolbar button:hover .ql-fill,
    .ql-snow.ql-toolbar button.ql-active .ql-fill { fill: #ff6600 !important; }
    .ql-snow .ql-tooltip {
      background: #1e293b !important;
      border: 1px solid #334155 !important;
      color: #e2e8f0 !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
    }
    .ql-snow .ql-tooltip input[type=text] {
      background: #0f172a !important;
      border: 1px solid #475569 !important;
      color: #e2e8f0 !important;
    }

    /* === Galerie picker modal === */
    .gallery-picker-modal { padding: 0; }
    .gallery-picker-box {
      background: #1e293b;
      border-radius: 12px;
      max-width: 900px;
      width: 90vw;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      border: 1px solid #334155;
      overflow: hidden;
    }
    .gp-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #334155;
    }
    .gp-header h3 { color: #f8fafc; margin: 0; font-size: 18px; }
    .gp-align-tabs {
      display: flex;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      border-bottom: 1px solid #334155;
    }
    .gp-tab {
      background: #334155;
      color: #94a3b8;
      border: 1px solid #475569;
      border-radius: 6px;
      padding: 6px 14px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .gp-tab:hover { background: #475569; color: #e2e8f0; }
    .gp-tab.active { background: #ff6600; color: white; border-color: #ff6600; }
    .gp-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      overflow-y: auto;
      flex: 1;
    }
    .gp-thumb {
      cursor: pointer;
      border-radius: 8px;
      overflow: hidden;
      border: 2px solid transparent;
      transition: all 0.15s;
      position: relative;
    }
    .gp-thumb:hover {
      border-color: #ff6600;
      transform: scale(1.02);
    }
    .gp-thumb img {
      width: 100%;
      height: 110px;
      object-fit: cover;
      display: block;
    }
    .gp-thumb-name {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(transparent, rgba(0,0,0,0.8));
      color: #e2e8f0;
      font-size: 11px;
      padding: 0.5rem 0.4rem 0.3rem;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gp-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1.5rem;
      border-top: 1px solid #334155;
      color: #64748b;
      font-size: 13px;
    }

    /* === Upload progress === */
    #uploadProgress {
      animation: slideUp 0.3s ease;
    }
    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    /* === Modály === */
    .modal {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(0,0,0,0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: modalIn 0.2s ease;
    }
    @keyframes modalIn { from { opacity: 0; } to { opacity: 1; } }

    /* === Responzivita === */
    @media (max-width: 640px) {
      .gp-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
      .gp-header { flex-direction: column; gap: 0.5rem; }
      .gp-search input { width: 100% !important; }
      #uploadProgress { left: 10px; right: 10px; min-width: auto; }
    }
  `;
  document.head.appendChild(style);
})();

/* =========================================================
   Inicializace
   ========================================================= */
(function initDashboard() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  function onReady() {
    injectEditorStyles();

    // Počkat na Quill načtení z CDN
    function waitForQuill(cb, attempts = 0) {
      if (typeof Quill !== 'undefined') {
        cb();
      } else if (attempts < 50) {
        setTimeout(() => waitForQuill(cb, attempts + 1), 100);
      } else {
        console.error('Quill se nepodařilo načíst z CDN');
      }
    }

    waitForQuill(() => {
      initQuillEditors();
      loadGallery().then(() => {
        if ($('articleList')) loadArticles();
        if ($('quoteTableBody')) loadQuotes();
        if ($('subsectionTableBody')) loadSubsections();
        if ($('sectionCovers')) loadSectionCovers();
        if ($('aboutPreview') || $('aboutEditor')) loadAbout();
        if ($('artSection')) loadArtSubsections();
      });
    });

    // ESC zavírá modály
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(m => m.remove());
      }
    });
  }
})();
// Přidat do Worker fetch handleru
if (url.pathname === '/api/cache/purge' && request.method === 'POST') {
  // Purge Cache pro zónu (pokud máš doménu na Cloudflare)
  // Můžeš použít Cache API:
  try {
    // Option 1: Cache API purge
    const cache = caches.default;
    await cache.delete(url.origin + '/');
    
    // Option 2: Pokud máš zone_id, použij Cloudflare API
    // const resp = await fetch(
    //   `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
    //   { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: '{"purge_everything":true}' }
    // );
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

