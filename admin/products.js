/**
 * products.js
 * Pagina: Producten beheer
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
  const grid     = document.getElementById('product-grid');
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

    return `
      <div class="product-card ${p.active === false ? 'inactive' : ''}">
        <div class="product-card-header">
          <span class="badge ${p.active === false ? 'badge-gray' : 'badge-green'}">
            ${p.active === false ? '⊘ Inactief' : '✓ Actief'}
          </span>
          <div style="display:flex;gap:4px">
            <button class="icon-btn" onclick="openProductModal('${p.id}')" title="Bewerken">✏️</button>
            <button class="icon-btn" onclick="toggleProductActive('${p.id}')" title="${p.active === false ? 'Activeren' : 'Deactiveren'}">
              ${p.active === false ? '👁️' : '🙈'}
            </button>
            <button class="icon-btn danger" onclick="deleteProductById('${p.id}')" title="Verwijderen">🗑️</button>
          </div>
        </div>
        <div class="product-card-body">
          <h3>${escHtml(p.name)}</h3>
          <div class="product-card-id">${p.id}</div>
          <div class="price-slabs">${slabHTML || '<span style="font-size:12px;color:var(--text-3)">Geen prijzen ingesteld</span>'}</div>
          <div class="product-specs">
            ${p.width_mm ? `<span class="spec-tag">${p.width_mm}×${p.height_mm} mm</span>` : ''}
            ${p.margin_mm ? `<span class="spec-tag">Marge ${p.margin_mm} mm</span>` : ''}
            ${p.width_px ? `<span class="spec-tag">${p.width_px}×${p.height_px} px</span>` : ''}
            ${(p.templates||[]).length ? `<span class="spec-tag">${p.templates.length} template(s)</span>` : ''}
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
  if (result.error) {
    AdminUI.showToast(result.error, 'error');
    return;
  }
  renderProductGrid();
  AdminUI.showToast('Product verwijderd');
}

// ─── PRODUCT MODAL ────────────────────────────────────────────────────────────

function openProductModal(id = null) {
  const p      = id ? DS.getProductById(id) : {};
  const isEdit = !!id;
  const slabs  = p.priceSlabs || [{ from: 1, to: 9, price: '' }, { from: 10, to: 49, price: '' }, { from: 50, to: null, price: '' }];
  const templates = p.templates || [''];

  function slabRow(s, i) {
    return `
      <div class="slab-row" id="slab-${i}">
        <input type="number" class="slab-from" value="${s.from}" placeholder="Van" min="1">
        <span>–</span>
        <input type="number" class="slab-to" value="${s.to || ''}" placeholder="Tot (leeg = ∞)">
        <span>stuks</span>
        <input type="number" class="slab-price" value="${s.price}" placeholder="Prijs" step="0.01">
        <span>€</span>
        <button class="icon-btn danger" onclick="this.closest('.slab-row').remove()" title="Verwijder">✕</button>
      </div>`;
  }

  function templateRow(t) {
    return `
      <div class="template-item">
        <input type="text" class="tmpl-input" value="${escHtml(t)}" placeholder="template-naam.png">
        <button class="icon-btn danger" onclick="this.closest('.template-item').remove()" title="Verwijder">✕</button>
      </div>`;
  }

  const body = `
    <div class="section-title">Algemeen</div>
    <div class="form-row">
      <div class="form-group">
        <label>Productnaam *</label>
        <input type="text" id="pf-name" value="${escHtml(p.name)}" placeholder="Kleine geschenkdoos">
      </div>
      <div class="form-group">
        <label>Product-ID</label>
        <input type="text" id="pf-id" value="${escHtml(p.id || '')}" placeholder="Automatisch" ${isEdit ? 'readonly style="background:var(--surface-2);color:var(--text-3)"' : ''}>
        <span class="form-hint">Leeg = automatisch gegenereerd</span>
      </div>
    </div>

    <div class="section-title" style="margin-top:4px">Afmetingen (mm)</div>
    <div class="form-row-3">
      <div class="form-group">
        <label>Breedte (mm)</label>
        <input type="number" id="pf-w-mm" value="${p.width_mm || ''}" placeholder="100">
      </div>
      <div class="form-group">
        <label>Hoogte (mm)</label>
        <input type="number" id="pf-h-mm" value="${p.height_mm || ''}" placeholder="70">
      </div>
      <div class="form-group">
        <label>Marge (mm)</label>
        <input type="number" id="pf-m-mm" value="${p.margin_mm || ''}" placeholder="5">
      </div>
    </div>
    <div id="px-preview" class="form-hint" style="margin-top:-8px"></div>

    <div class="section-title" style="margin-top:4px">Display canvas (px — wat de klant ziet)</div>
    <div class="form-row">
      <div class="form-group">
        <label>Weergavebreedte (px)</label>
        <input type="number" id="pf-dw" value="${p.canvas_display_width || ''}" placeholder="500">
      </div>
      <div class="form-group">
        <label>Weergavehoogte (px)</label>
        <input type="number" id="pf-dh" value="${p.canvas_display_height || ''}" placeholder="350">
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

    <div class="section-title" style="margin-top:4px">Afbeeldingen (URL of pad)</div>
    <div class="form-row-1">
      <div class="form-group">
        <label>Productafbeelding</label>
        <input type="text" id="pf-img1" value="${escHtml(p.imageProduct || '')}" placeholder="shared/images/product.png">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Personalisatie afbeelding 1</label>
        <input type="text" id="pf-img2" value="${escHtml(p.imagePersonalize1 || '')}" placeholder="shared/images/pers-1.png">
      </div>
      <div class="form-group">
        <label>Personalisatie afbeelding 2</label>
        <input type="text" id="pf-img3" value="${escHtml(p.imagePersonalize2 || '')}" placeholder="shared/images/pers-2.png">
      </div>
    </div>

    <div id="pf-error" class="form-error"></div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="AdminUI.closeModal()">Annuleren</button>
    <button class="btn btn-primary"   id="btn-product-save">Opslaan</button>
  `;

  AdminUI.openModal({ title: isEdit ? 'Product bewerken' : 'Nieuw product', body, footer });

  // Live DPI preview
  function updatePxPreview() {
    const w = parseFloat(document.getElementById('pf-w-mm').value);
    const h = parseFloat(document.getElementById('pf-h-mm').value);
    const m = parseFloat(document.getElementById('pf-m-mm').value);
    const prev = document.getElementById('px-preview');
    if (w && h) {
      const wp = Math.round(w / 25.4 * 300);
      const hp = Math.round(h / 25.4 * 300);
      const mp = m ? Math.round(m / 25.4 * 300) : null;
      prev.textContent = `→ 300 DPI export: ${wp} × ${hp} px${mp ? `, marge: ${mp} px` : ''}`;
    } else {
      prev.textContent = '';
    }
  }

  ['pf-w-mm','pf-h-mm','pf-m-mm'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updatePxPreview);
  });
  updatePxPreview();

  document.getElementById('btn-add-slab').addEventListener('click', () => {
    const list = document.getElementById('slab-list');
    const idx  = list.children.length;
    list.insertAdjacentHTML('beforeend', slabRow({ from: '', to: '', price: '' }, idx));
  });

  document.getElementById('btn-add-tmpl').addEventListener('click', () => {
    document.getElementById('template-list').insertAdjacentHTML('beforeend', templateRow(''));
  });

  document.getElementById('btn-product-save').addEventListener('click', () => {
    const name = document.getElementById('pf-name').value.trim();
    if (!name) {
      const err = document.getElementById('pf-error');
      err.textContent = 'Productnaam is verplicht.';
      err.classList.add('visible');
      return;
    }

    const wMm = parseFloat(document.getElementById('pf-w-mm').value) || null;
    const hMm = parseFloat(document.getElementById('pf-h-mm').value) || null;
    const mMm = parseFloat(document.getElementById('pf-m-mm').value) || null;

    const slabRows   = document.querySelectorAll('#slab-list .slab-row');
    const priceSlabs = [...slabRows].map(row => ({
      from:  parseFloat(row.querySelector('.slab-from').value)  || 1,
      to:    parseFloat(row.querySelector('.slab-to').value)    || null,
      price: parseFloat(row.querySelector('.slab-price').value) || 0,
    }));

    const tmplInputs = document.querySelectorAll('#template-list .tmpl-input');
    const templates  = [...tmplInputs].map(i => i.value.trim()).filter(Boolean);

    const customId = document.getElementById('pf-id').value.trim();

    const updated = {
      ...p,
      id:                   isEdit ? p.id : (customId || undefined),
      name,
      active:               p.active !== false,
      priceSlabs,
      templates,
      imageProduct:         document.getElementById('pf-img1').value.trim(),
      imagePersonalize1:    document.getElementById('pf-img2').value.trim(),
      imagePersonalize2:    document.getElementById('pf-img3').value.trim(),
      width_mm:             wMm,
      height_mm:            hMm,
      margin_mm:            mMm,
      width_px:             wMm ? Math.round(wMm / 25.4 * 300) : null,
      height_px:            hMm ? Math.round(hMm / 25.4 * 300) : null,
      margin_px:            mMm ? Math.round(mMm / 25.4 * 300) : null,
      canvas_display_width: parseInt(document.getElementById('pf-dw').value) || null,
      canvas_display_height:parseInt(document.getElementById('pf-dh').value) || null,
    };

    DS.saveProduct(updated);
    AdminUI.closeModal();
    renderProductGrid();
    AdminUI.showToast(isEdit ? 'Product bijgewerkt' : 'Product aangemaakt');
  });
}
