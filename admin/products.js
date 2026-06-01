/**
 * products.js
 * Pagina: Producten beheer
 * Uitgebreid met: personalisatietypes beheer per product
 */

function renderProductsPage() {
  const el = document.getElementById('page-products');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Producten</h1>
        <p>Beheer het productaanbod dat zichtbaar is in de klantflow</p>
      </div>
      <button class="btn btn-primary" id="btn-product-add">+ Nieuw product</button>
    </div>
    <div class="product-grid" id="product-grid"></div>
  `;
  document.getElementById('btn-product-add').addEventListener('click', () => openProductModal());
  renderProductGrid();
}

function renderProductGrid() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  const products = DS.getProducts();

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">📦</div>
        <h3>Geen producten</h3>
        <p>Voeg een product toe om te beginnen.</p>
      </div>`;
    return;
  }

  grid.innerHTML = products.map(p => {
    const slabHTML = (p.priceSlabs || []).map(s =>
      `<div class="price-slab">
        <span class="range">${s.from}${s.to ? `–${s.to}` : '+'} stuks</span>
        <span>${formatEuro(s.price)} / stuk</span>
      </div>`
    ).join('');

    const persHTML = (p.personalisatieTypes || []).map(pt =>
      `<span class="spec-tag">📐 ${escHtml(pt.label)}: ${pt.width_mm}×${pt.height_mm}mm</span>`
    ).join('');

    return `
      <div class="product-card ${p.active === false ? 'inactive' : ''}">
        <div class="product-card-header">
          <span class="badge ${p.active === false ? 'badge-gray' : 'badge-green'}">
            ${p.active === false ? '⊘ Inactief' : '✓ Actief'}
          </span>
          <div style="display:flex;gap:4px">
            <button class="icon-btn" onclick="openProductModal('${p.id}')" title="Bewerken">✏️</button>
            <button class="icon-btn" onclick="toggleProductActive('${p.id}')"
                    title="${p.active === false ? 'Activeren' : 'Deactiveren'}">
              ${p.active === false ? '👁️' : '🙈'}
            </button>
            <button class="icon-btn danger" onclick="deleteProductById('${p.id}')" title="Verwijderen">🗑️</button>
          </div>
        </div>
        <div class="product-card-body">
          <h3>${escHtml(p.name)}</h3>
          <div class="product-card-id">${p.id}</div>
          <div class="price-slabs">${slabHTML || '<span style="font-size:12px;color:var(--text-3)">Geen prijzen</span>'}</div>
          <div class="product-specs" style="margin-top:8px">
            ${persHTML || '<span class="spec-tag" style="color:var(--text-3)">Geen personalisatietypes</span>'}
            ${(p.templates || []).length ? `<span class="spec-tag">${p.templates.length} template(s)</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleProductActive(id) {
  const p = DS.getProductById(id);
  if (!p) return;
  p.active = p.active === false ? true : false;
  DS.saveProduct(p);
  renderProductGrid();
  AdminUI.showToast(p.active ? 'Product geactiveerd' : 'Product gedeactiveerd');
}

async function deleteProductById(id) {
  const result = DS.deleteProduct(id);
  if (result.error) { AdminUI.showToast(result.error, 'error'); return; }
  renderProductGrid();
  AdminUI.showToast('Product verwijderd');
}

// ─── PRODUCT MODAL ────────────────────────────────────────────────────────────

function openProductModal(id = null) {
  const p = id ? DS.getProductById(id) : {};
  const isEdit = !!id;
  const slabs = p.priceSlabs || [{ from: 1, to: 9, price: '' }, { from: 10, to: 49, price: '' }, { from: 50, to: null, price: '' }];
  const templates = p.templates || [''];
  const persTypes = p.personalisatieTypes || [];

  function slabRow(s, i) {
    return `
      <div class="slab-row" id="slab-${i}">
        <input type="number" class="slab-from"  value="${s.from}"     placeholder="Van"  min="1">
        <span>–</span>
        <input type="number" class="slab-to"    value="${s.to || ''}" placeholder="Tot (leeg = ∞)">
        <span>stuks</span>
        <input type="number" class="slab-price" value="${s.price}"    placeholder="Prijs" step="0.01">
        <span>€</span>
        <button class="icon-btn danger" onclick="this.closest('.slab-row').remove()">✕</button>
      </div>`;
  }

  function templateRow(t) {
    return `
      <div class="template-item">
        <input type="text" class="tmpl-input" value="${escHtml(t)}" placeholder="template-naam.png">
        <button class="icon-btn danger" onclick="this.closest('.template-item').remove()">✕</button>
      </div>`;
  }

  // ── Personalisatietype rij ─────────────────────────────────────────────────
  function persTypeRow(pt, idx) {
    const wMm = pt.width_mm || '';
    const hMm = pt.height_mm || '';
    const mMm = pt.margin_mm || '';
    return `
      <div class="pers-type-row" data-idx="${idx}" style="
        border:1px solid var(--border);border-radius:var(--radius);
        padding:12px;margin-bottom:8px;background:var(--surface-2)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <strong style="font-size:13px">Personalisatietype ${idx + 1}</strong>
          <button class="icon-btn danger" onclick="this.closest('.pers-type-row').remove()" title="Verwijder">✕</button>
        </div>
        <div class="form-row" style="margin-bottom:8px">
          <div class="form-group">
            <label>Label (bijv. "Voorkant")</label>
            <input type="text" class="pers-label" value="${escHtml(pt.label || '')}" placeholder="Voorkant">
          </div>
          <div class="form-group">
            <label>Preview afbeelding (pad)</label>
            <input type="text" class="pers-preview" value="${escHtml(pt.previewImage || '')}" placeholder="shared/images/voorkant.png">
          </div>
        </div>
        <div class="form-row-3" style="margin-bottom:8px">
          <div class="form-group">
            <label>Breedte (mm)</label>
            <input type="number" class="pers-w-mm" value="${wMm}" placeholder="100" min="10" step="0.5">
          </div>
          <div class="form-group">
            <label>Hoogte (mm)</label>
            <input type="number" class="pers-h-mm" value="${hMm}" placeholder="70"  min="10" step="0.5">
          </div>
          <div class="form-group">
            <label>Marge (mm)</label>
            <input type="number" class="pers-m-mm" value="${mMm}" placeholder="5"   min="0"  step="0.5">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Clip-vorm (optioneel)</label>
            <input type="text" class="pers-clip" value="${escHtml(pt.clipShape || '')}" placeholder="circle(50%) of leeg voor rechthoek">
            <span class="form-hint">CSS clip-path voor niet-rechthoekige printzone</span>
          </div>
        </div>
        <div class="pers-px-preview form-hint" style="color:var(--text-2);margin-top:4px"></div>
      </div>`;
  }

  const body = `
    <div class="section-title">Algemeen</div>
    <div class="form-row">
      <div class="form-group">
        <label>Productnaam *</label>
        <input type="text" id="pf-name" value="${escHtml(p.name || '')}" placeholder="Kleine geschenkdoos">
      </div>
      <div class="form-group">
        <label>Product-ID</label>
        <input type="text" id="pf-id" value="${escHtml(p.id || '')}" placeholder="Automatisch"
               ${isEdit ? 'readonly style="background:var(--surface-2);color:var(--text-3)"' : ''}>
        <span class="form-hint">Leeg = automatisch gegenereerd</span>
      </div>
    </div>

    <div class="section-title" style="margin-top:4px">Staffelprijzen</div>
    <div class="slab-list" id="slab-list">
      ${slabs.map((s, i) => slabRow(s, i)).join('')}
    </div>
    <button class="btn btn-secondary btn-sm" style="margin-top:8px" id="btn-add-slab">+ Staffel toevoegen</button>

    <div class="section-title" style="margin-top:4px">Templates</div>
    <div class="template-list" id="template-list">
      ${templates.map(t => templateRow(t)).join('')}
    </div>
    <button class="btn btn-secondary btn-sm" style="margin-top:8px" id="btn-add-tmpl">+ Template toevoegen</button>

    <div class="section-title" style="margin-top:4px">Productafbeelding</div>
    <div class="form-row-1">
      <div class="form-group">
        <label>Productafbeelding (URL of pad)</label>
        <input type="text" id="pf-img1" value="${escHtml(p.imageProduct || '')}" placeholder="shared/images/product.png">
      </div>
    </div>

    <div class="section-title" style="margin-top:4px">
      Personalisatietypes
      <span class="form-hint" style="text-transform:none;font-weight:400;letter-spacing:0">
        — elk type heeft eigen afmetingen en canvas
      </span>
    </div>
    <div id="pers-type-list">
      ${persTypes.map((pt, i) => persTypeRow(pt, i)).join('')}
    </div>
    <button class="btn btn-secondary btn-sm" style="margin-top:8px" id="btn-add-pers">+ Personalisatietype toevoegen</button>

    <div id="pf-error" class="form-error"></div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="AdminUI.closeModal()">Annuleren</button>
    <button class="btn btn-primary"   id="btn-product-save">Opslaan</button>
  `;

  AdminUI.openModal({ title: isEdit ? 'Product bewerken' : 'Nieuw product', body, footer });

  // Live DPI preview per personalisatietype
  function bindPersPreview(row) {
    const wEl = row.querySelector('.pers-w-mm');
    const hEl = row.querySelector('.pers-h-mm');
    const mEl = row.querySelector('.pers-m-mm');
    const prev = row.querySelector('.pers-px-preview');
    function update() {
      const w = parseFloat(wEl?.value); const h = parseFloat(hEl?.value);
      const m = parseFloat(mEl?.value);
      if (w && h) {
        const wp = Math.round(w / 25.4 * 300);
        const hp = Math.round(h / 25.4 * 300);
        const mp = m ? Math.round(m / 25.4 * 300) : null;
        // Canvas display: max 600px breed, hoogte proportioneel
        const scale = Math.min(1, 600 / wp);
        const dispW = Math.round(wp * scale);
        const dispH = Math.round(hp * scale);
        prev.textContent = `→ Export: ${wp}×${hp}px (300 DPI)  |  Canvas: ${dispW}×${dispH}px${mp ? `  |  Marge: ${mp}px` : ''}`;
      } else {
        prev.textContent = '';
      }
    }
    [wEl, hEl, mEl].forEach(el => el?.addEventListener('input', update));
    update();
  }

  // Bind preview op bestaande rijen
  document.querySelectorAll('.pers-type-row').forEach(row => bindPersPreview(row));

  // Staffel toevoegen
  document.getElementById('btn-add-slab').addEventListener('click', () => {
    const list = document.getElementById('slab-list');
    list.insertAdjacentHTML('beforeend', slabRow({ from: '', to: '', price: '' }, list.children.length));
  });

  // Template toevoegen
  document.getElementById('btn-add-tmpl').addEventListener('click', () => {
    document.getElementById('template-list').insertAdjacentHTML('beforeend', templateRow(''));
  });

  // Personalisatietype toevoegen
  document.getElementById('btn-add-pers').addEventListener('click', () => {
    const list = document.getElementById('pers-type-list');
    const newIdx = list.children.length;
    const html = persTypeRow({ label: '', previewImage: '', width_mm: '', height_mm: '', margin_mm: '', clipShape: '' }, newIdx);
    list.insertAdjacentHTML('beforeend', html);
    const newRow = list.lastElementChild;
    bindPersPreview(newRow);
  });

  // Opslaan
  document.getElementById('btn-product-save').addEventListener('click', () => {
    const name = document.getElementById('pf-name').value.trim();
    const errEl = document.getElementById('pf-error');

    if (!name) {
      errEl.textContent = 'Productnaam is verplicht.';
      errEl.classList.add('visible');
      return;
    }

    // Verzamel personalisatietypes
    const persRows = document.querySelectorAll('#pers-type-list .pers-type-row');
    const personalisatieTypes = [...persRows].map(row => {
      const wMm = parseFloat(row.querySelector('.pers-w-mm').value) || null;
      const hMm = parseFloat(row.querySelector('.pers-h-mm').value) || null;
      const mMm = parseFloat(row.querySelector('.pers-m-mm').value) || null;
      const label = row.querySelector('.pers-label').value.trim();

      // Bereken pixel afmetingen automatisch
      const wp = wMm ? Math.round(wMm / 25.4 * 300) : null;
      const hp = hMm ? Math.round(hMm / 25.4 * 300) : null;
      const mp = mMm ? Math.round(mMm / 25.4 * 300) : null;
      const scale = wp ? Math.min(1, 600 / wp) : 1;
      const dispW = wp ? Math.round(wp * scale) : null;
      const dispH = hp ? Math.round(hp * scale) : null;

      return {
        id: label.toLowerCase().replace(/\s+/g, '-') || `type-${Date.now()}`,
        label: label || 'Standaard',
        previewImage: row.querySelector('.pers-preview').value.trim(),
        clipShape: row.querySelector('.pers-clip').value.trim() || null,
        width_mm: wMm,
        height_mm: hMm,
        margin_mm: mMm,
        width_px: wp,
        height_px: hp,
        margin_px: mp,
        canvas_display_width: dispW,
        canvas_display_height: dispH,
      };
    });

    if (personalisatieTypes.length === 0) {
      errEl.textContent = 'Voeg minimaal één personalisatietype toe.';
      errEl.classList.add('visible');
      return;
    }

    errEl.classList.remove('visible');

    const slabRows = document.querySelectorAll('#slab-list .slab-row');
    const priceSlabs = [...slabRows].map(row => ({
      from: parseFloat(row.querySelector('.slab-from').value) || 1,
      to: parseFloat(row.querySelector('.slab-to').value) || null,
      price: parseFloat(row.querySelector('.slab-price').value) || 0,
    }));

    const tmplInputs = document.querySelectorAll('#template-list .tmpl-input');
    const templates = [...tmplInputs].map(i => i.value.trim()).filter(Boolean);
    const customId = document.getElementById('pf-id').value.trim();

    // Gebruik afmetingen van het eerste personalisatietype als product-level fallback
    const firstPers = personalisatieTypes[0];

    const updated = {
      ...p,
      id: isEdit ? p.id : (customId || undefined),
      name,
      active: p.active !== false,
      priceSlabs,
      templates,
      imageProduct: document.getElementById('pf-img1').value.trim(),
      personalisatieTypes,
      // Product-level fallbacks (voor backwards compatibility)
      width_mm: firstPers.width_mm,
      height_mm: firstPers.height_mm,
      margin_mm: firstPers.margin_mm,
      width_px: firstPers.width_px,
      height_px: firstPers.height_px,
      margin_px: firstPers.margin_px,
      canvas_display_width: firstPers.canvas_display_width,
      canvas_display_height: firstPers.canvas_display_height,
    };

    DS.saveProduct(updated);
    AdminUI.closeModal();
    renderProductGrid();
    AdminUI.showToast(isEdit ? 'Product bijgewerkt' : 'Product aangemaakt');
  });
}

// helpers
function formatEuro(n) {
  if (n === null || n === undefined) return '—';
  return '€ ' + parseFloat(n).toFixed(2).replace('.', ',');
}
function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}