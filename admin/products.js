/**
 * products.js
 * Pagina: Producten beheer
 * Productafbeeldingen, personalisatieafbeeldingen en template PDF's worden via admin geüpload.
 * Personalisatietypes kunnen actief en non-actief worden gezet.
 * Uitgebreid met drukwerkspecificaties: eindformaat, afloop, exportformaat, veilige marge,
 * rillijnen en rechthoekige nietzones.
 */

function renderProductsPage() {
  const el = document.getElementById('page-products');

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Producten</h1>
        <p>Beheer het productaanbod dat zichtbaar is in de klantflow</p>
      </div>
      <button class="btn btn-primary" type="button" id="btn-product-add">+ Nieuw product</button>
    </div>

    <div class="product-grid" id="product-grid"></div>
  `;

  document.getElementById('btn-product-add').addEventListener('click', () => openProductModal());
  renderProductGrid();
}

function renderProductGrid() {
  const grid = document.getElementById('product-grid');

  if (!grid) {
    return;
  }

  const products = DS.getProducts();

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">Producten</div>
        <h3>Geen producten</h3>
        <p>Voeg een product toe om te beginnen.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map(product => {
    const slabHTML = (product.priceSlabs || []).map(slab => `
      <div class="price-slab">
        <span class="range">${slab.from}${slab.to ? `–${slab.to}` : '+'} stuks</span>
        <span>${formatEuro(slab.price)} / stuk</span>
      </div>
    `).join('');

    const personalisationHTML = (product.personalisatieTypes || []).map(type => {
      const priceCount = Array.isArray(type.priceSlabs) ? type.priceSlabs.length : 0;
      const isActive = type.active !== false;
      const spec = normalizeAdminPrintSpec(type, product);
      const zoneCount = Array.isArray(type.blockedZones) ? type.blockedZones.length : 0;
      const previewConfig = normalizeAdminPreviewConfig(type, product);
      const previewViewCount = previewConfig.enabled ? previewConfig.views.length : 0;

      return `
        <span class="spec-tag ${isActive ? '' : 'inactive'}">
          ${escHtml(type.label)}:
          ${spec.finishWidthMm || '—'}×${spec.finishHeightMm || '—'}mm
          · export ${spec.exportWidthMm || '—'}×${spec.exportHeightMm || '—'}mm
          ${priceCount ? `, ${priceCount} staffels` : ''}
          ${zoneCount ? `, ${zoneCount} zones` : ''}
          ${previewViewCount ? `, ${previewViewCount} productpreview${previewViewCount === 1 ? '' : 's'}` : ''}
          ${isActive ? '' : ' · inactief'}
        </span>
      `;
    }).join('');

    return `
      <div class="product-card ${product.active === false ? 'inactive' : ''}">
        <div class="product-card-header">
          <span class="badge ${product.active === false ? 'badge-gray' : 'badge-green'}">
            ${product.active === false ? 'Inactief' : 'Actief'}
          </span>

          <div style="display:flex;gap:4px">
            <button class="icon-btn" type="button" onclick="openProductModal('${product.id}')" title="Bewerken">✎</button>
            <button class="icon-btn" type="button" onclick="toggleProductActive('${product.id}')"
                    title="${product.active === false ? 'Activeren' : 'Deactiveren'}">
              ${product.active === false ? 'Tonen' : 'Verbergen'}
            </button>
            <button class="icon-btn danger" type="button" onclick="deleteProductById('${product.id}')" title="Verwijderen">×</button>
          </div>
        </div>

        <div class="product-card-body">
          <h3>${escHtml(product.name)}</h3>
          <div class="product-card-id">${escHtml(product.id)}</div>

          ${product.imageProduct ? `
            <div class="file-preview-box" style="margin-bottom:12px">
              <img src="${product.imageProduct}" alt="${escHtml(product.name)}">
            </div>
          ` : ''}

          <div class="price-slabs">
            ${slabHTML || '<span style="font-size:12px;color:var(--text-3)">Geen algemene fallback prijzen</span>'}
          </div>

          <div class="product-specs" style="margin-top:8px">
            ${personalisationHTML || '<span class="spec-tag" style="color:var(--text-3)">Geen personalisatietypes</span>'}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleProductActive(id) {
  const product = DS.getProductById(id);

  if (!product) {
    return;
  }

  product.active = product.active === false;
  DS.saveProduct(product);

  renderProductGrid();
  AdminUI.showToast(product.active ? 'Product geactiveerd' : 'Product gedeactiveerd');
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

function openProductModal(id = null) {
  const product = id ? DS.getProductById(id) : {};
  const isEdit = Boolean(id);

  const slabs = product.priceSlabs || [
    { from: 1, to: 9, price: '' },
    { from: 10, to: 49, price: '' },
    { from: 50, to: null, price: '' },
  ];

  const persTypes = product.personalisatieTypes || [];

  const uploadState = {
    imageProductFile: product.imageProductFile || (product.imageProduct ? {
      name: 'Productafbeelding',
      type: 'image/png',
      size: 0,
      dataURL: product.imageProduct,
    } : null),
    persFiles: {},
  };

  persTypes.forEach(type => {
    uploadState.persFiles[type.id] = {
      sourceType: { ...type },
      previewImageFile: type.previewImageFile || (type.previewImage ? {
        name: 'Personalisatieafbeelding',
        type: 'image/png',
        size: 0,
        dataURL: type.previewImage,
      } : null),
      templatePdf: type.templatePdf || null,
      ...createPreviewFileState(type.preview),
    };
  });

  const body = `
    <div class="section-title">Algemeen</div>

    <div class="form-row">
      <div class="form-group">
        <label>Productnaam *</label>
        <input type="text" id="pf-name" value="${escHtml(product.name || '')}" placeholder="Kleine geschenkdoos">
      </div>

      <div class="form-group">
        <label>Product-ID</label>
        <input type="text" id="pf-id" value="${escHtml(product.id || '')}" placeholder="Automatisch"
               ${isEdit ? 'readonly style="background:var(--surface-2);color:var(--text-3)"' : ''}>
        <span class="form-hint">Leeg = automatisch gegenereerd</span>
      </div>
    </div>

    <div class="section-title" style="margin-top:4px">Algemene fallback staffelprijzen</div>

    <div class="slab-list" id="slab-list">
      ${slabs.map((slab, index) => slabRow(slab, index)).join('')}
    </div>

    <button class="btn btn-secondary btn-sm" type="button" style="margin-top:8px" id="btn-add-slab">
      + Staffel toevoegen
    </button>

    <span class="form-hint" style="display:block;margin-top:6px">
      Deze algemene staffels worden alleen gebruikt als een personalisatietype geen eigen staffels heeft.
    </span>

    <div class="section-title" style="margin-top:4px">Productafbeelding</div>

    <div class="form-row-1">
      <div class="form-group">
        <label>Productafbeelding</label>
        <div class="file-upload-field">
          <div id="pf-img-preview">
            ${renderStoredFile(uploadState.imageProductFile, 'Productafbeelding')}
          </div>
          <div class="file-upload-actions">
            <input type="file" id="pf-img-file" accept="image/*">
            <button type="button" class="btn btn-secondary btn-sm" id="pf-img-remove">Verwijderen</button>
          </div>
        </div>
      </div>
    </div>

    <div class="section-title" style="margin-top:4px">
      Personalisatietypes
      <span class="form-hint" style="text-transform:none;font-weight:400;letter-spacing:0">
        Elk type heeft eigen status, eindformaat, afloop, afbeelding, template PDF, drukzones en staffelprijzen
      </span>
    </div>

    <div id="pers-type-list">
      ${persTypes.map((type, index) => persTypeRow(type, index, type.id)).join('')}
    </div>

    <button class="btn btn-secondary btn-sm" type="button" style="margin-top:8px" id="btn-add-pers">
      + Personalisatietype toevoegen
    </button>

    <div id="pf-error" class="form-error"></div>
  `;

  const footer = `
    <button class="btn btn-secondary" type="button" onclick="AdminUI.closeModal()">Annuleren</button>
    <button class="btn btn-primary" type="button" id="btn-product-save">Opslaan</button>
  `;

  AdminUI.openModal({
    title: isEdit ? 'Product bewerken' : 'Nieuw product',
    body,
    footer,
  });

  bindProductImageUpload(uploadState);
  bindExistingPersRows(uploadState, persTypes);
  bindProductModalActions(uploadState, product, isEdit);
}

function slabRow(slab, index) {
  return `
    <div class="slab-row" id="slab-${index}">
      <input type="number" class="slab-from" value="${escHtml(slab.from || '')}" placeholder="Van" min="1">
      <span>–</span>
      <input type="number" class="slab-to" value="${escHtml(slab.to || '')}" placeholder="Tot leeg is oneindig">
      <span>stuks</span>
      <input type="number" class="slab-price" value="${escHtml(slab.price || '')}" placeholder="Prijs" step="0.01">
      <span>€</span>
      <button class="icon-btn danger" type="button" onclick="this.closest('.slab-row').remove()">×</button>
    </div>
  `;
}

function personalisationSlabRow(slab, index) {
  return `
    <div class="slab-row pers-slab-row">
      <input type="number" class="pers-slab-from" value="${escHtml(slab.from || '')}" placeholder="Van" min="1">
      <span>–</span>
      <input type="number" class="pers-slab-to" value="${escHtml(slab.to || '')}" placeholder="Tot leeg is oneindig">
      <span>stuks</span>
      <input type="number" class="pers-slab-price" value="${escHtml(slab.price || '')}" placeholder="Prijs" step="0.01">
      <span>€</span>
      <button class="icon-btn danger" type="button" onclick="this.closest('.pers-slab-row').remove()">×</button>
    </div>
  `;
}

function blockedZoneRow(zone = {}, index = 0) {
  const id = zone.id || createBlockedZoneId();
  const type = zone.type || 'circle';

  return `
    <div class="blocked-zone-row" data-zone-id="${escHtml(id)}">
      <div class="blocked-zone-header">
        <strong>Drukzone ${index + 1}</strong>
        <button class="icon-btn danger" type="button" onclick="this.closest('.blocked-zone-row').remove()" title="Verwijder">×</button>
      </div>

      <div class="form-row" style="margin-bottom:8px">
        <div class="form-group">
          <label>Label</label>
          <input type="text" class="blocked-zone-label" value="${escHtml(zone.label || '')}" placeholder="Bijv. rillijn, nietzone of gat">
        </div>

        <div class="form-group">
          <label>Type</label>
          <select class="blocked-zone-type">
            <option value="circle" ${type === 'circle' ? 'selected' : ''}>Cirkel / gat</option>
            <option value="line" ${type === 'line' ? 'selected' : ''}>Lijn / rillijn</option>
            <option value="rect" ${type === 'rect' ? 'selected' : ''}>Rechthoekige nietzone</option>
          </select>
        </div>
      </div>

      <div class="blocked-zone-fields blocked-zone-fields-circle" style="${type === 'circle' ? '' : 'display:none'}">
        <div class="form-row-3" style="margin-bottom:8px">
          <div class="form-group">
            <label>X middelpunt mm</label>
            <input type="number" class="blocked-zone-x" value="${escHtml(zone.x_mm || '')}" placeholder="15" min="0" step="0.1">
          </div>

          <div class="form-group">
            <label>Y middelpunt mm</label>
            <input type="number" class="blocked-zone-y" value="${escHtml(zone.y_mm || '')}" placeholder="42" min="0" step="0.1">
          </div>

          <div class="form-group">
            <label>Diameter mm</label>
            <input type="number" class="blocked-zone-diameter" value="${escHtml(zone.diameter_mm || '')}" placeholder="8" min="0" step="0.1">
          </div>
        </div>
      </div>

      <div class="blocked-zone-fields blocked-zone-fields-line" style="${type === 'line' ? '' : 'display:none'}">
        <div class="form-row" style="margin-bottom:8px">
          <div class="form-group">
            <label>X start mm</label>
            <input type="number" class="blocked-zone-x1" value="${escHtml(zone.x1_mm || '')}" placeholder="0" min="0" step="0.1">
          </div>

          <div class="form-group">
            <label>Y start mm</label>
            <input type="number" class="blocked-zone-y1" value="${escHtml(zone.y1_mm || '')}" placeholder="35" min="0" step="0.1">
          </div>
        </div>

        <div class="form-row" style="margin-bottom:8px">
          <div class="form-group">
            <label>X eind mm</label>
            <input type="number" class="blocked-zone-x2" value="${escHtml(zone.x2_mm || '')}" placeholder="100" min="0" step="0.1">
          </div>

          <div class="form-group">
            <label>Y eind mm</label>
            <input type="number" class="blocked-zone-y2" value="${escHtml(zone.y2_mm || '')}" placeholder="35" min="0" step="0.1">
          </div>
        </div>

        <div class="form-row-1" style="margin-bottom:8px">
          <div class="form-group">
            <label>Lijndikte indicatie mm</label>
            <input type="number" class="blocked-zone-line-width" value="${escHtml(zone.line_width_mm || 0.3)}" placeholder="0.3" min="0.1" step="0.1">
          </div>
        </div>
      </div>

      <div class="blocked-zone-fields blocked-zone-fields-rect" style="${type === 'rect' ? '' : 'display:none'}">
        <div class="form-row" style="margin-bottom:8px">
          <div class="form-group">
            <label>X linksboven mm</label>
            <input type="number" class="blocked-zone-rect-x" value="${escHtml(zone.x_mm || '')}" placeholder="0" min="0" step="0.1">
          </div>

          <div class="form-group">
            <label>Y linksboven mm</label>
            <input type="number" class="blocked-zone-rect-y" value="${escHtml(zone.y_mm || '')}" placeholder="0" min="0" step="0.1">
          </div>
        </div>

        <div class="form-row" style="margin-bottom:8px">
          <div class="form-group">
            <label>Breedte mm</label>
            <input type="number" class="blocked-zone-width" value="${escHtml(zone.width_mm || '')}" placeholder="20" min="0" step="0.1">
          </div>

          <div class="form-group">
            <label>Hoogte mm</label>
            <input type="number" class="blocked-zone-height" value="${escHtml(zone.height_mm || '')}" placeholder="10" min="0" step="0.1">
          </div>
        </div>
      </div>

      <div class="form-row-1">
        <div class="form-group">
          <label>Veilige marge rondom mm</label>
          <input type="number" class="blocked-zone-margin" value="${escHtml(zone.margin_mm || '')}" placeholder="3" min="0" step="0.1">
          <span class="form-hint">
            Objecten mogen niet over deze zone of de extra veiligheidsmarge vallen.
          </span>
        </div>
      </div>
    </div>
  `;
}

function getDefaultBlockedZones(type = {}) {
  return Array.isArray(type.blockedZones) ? type.blockedZones : [];
}

function getDefaultPersonalisationPriceSlabs(type = {}) {
  if (Array.isArray(type.priceSlabs) && type.priceSlabs.length > 0) {
    return type.priceSlabs;
  }

  return [
    { from: 50, to: 99, price: '' },
    { from: 100, to: 249, price: '' },
    { from: 250, to: 499, price: '' },
    { from: 500, to: null, price: '' },
  ];
}

function persTypeRow(type, index, uploadKey) {
  const key = uploadKey || createUploadKey();
  const spec = normalizeAdminPrintSpec(type);

  const previewFile = type.previewImageFile || (type.previewImage ? {
    name: 'Personalisatieafbeelding',
    type: 'image/png',
    size: 0,
    dataURL: type.previewImage,
  } : null);

  const templatePdf = type.templatePdf || null;
  const priceSlabs = getDefaultPersonalisationPriceSlabs(type);
  const blockedZones = getDefaultBlockedZones(type);
  const isActive = type.active !== false;

  return `
    <div class="pers-type-row"
         data-upload-key="${escHtml(key)}"
         data-persisted-id="${escHtml(type.id || '')}"
         style="border:1px solid var(--border);border-radius:var(--radius);
                padding:12px;margin-bottom:8px;background:var(--surface-2)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <strong style="font-size:13px">Personalisatietype ${index + 1}</strong>
        <button class="icon-btn danger" type="button" onclick="this.closest('.pers-type-row').remove()" title="Verwijder">×</button>
      </div>

      <div class="form-row-1" style="margin-bottom:8px">
        <div class="form-group">
          <label class="toggle-wrap" style="flex-direction:row;align-items:center;justify-content:space-between;gap:14px">
            <span>
              <strong style="display:block;font-size:13px">Actief</strong>
              <span class="form-hint" style="margin:2px 0 0">
                Zichtbaar in de klantflow
              </span>
            </span>
            <span class="toggle">
              <input type="checkbox" class="pers-active" ${isActive ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </span>
          </label>
        </div>
      </div>

      <div class="form-row" style="margin-bottom:8px">
        <div class="form-group">
          <label>Label</label>
          <input type="text" class="pers-label" value="${escHtml(type.label || '')}" placeholder="Voorkant">
        </div>

        <div class="form-group">
          <label>Clip-vorm optioneel</label>
          <input type="text" class="pers-clip" value="${escHtml(type.clipShape || '')}" placeholder="circle(50%) of leeg voor rechthoek">
          <span class="form-hint">CSS clip-path voor niet-rechthoekige printzone</span>
        </div>
      </div>

      <div class="form-row-1" style="margin-bottom:8px">
        <div class="form-group">
          <label class="toggle-wrap" style="flex-direction:row;align-items:center;gap:10px">
            <span class="toggle">
              <input type="checkbox" class="pers-bg-allowed" ${type.allowBackgroundColor ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </span>
            <span>Achtergrondkleur canvas mag aangepast worden</span>
          </label>
          <span class="form-hint">
            Zet dit alleen aan wanneer de achtergrondkleur ook echt bedrukt of zichtbaar mag worden.
          </span>
        </div>
      </div>

      <div class="form-row" style="margin-bottom:8px">
        <div class="form-group">
          <label>Eindformaat breedte mm</label>
          <input type="number" class="pers-finish-w-mm pers-w-mm" value="${escHtml(spec.finishWidthMm || '')}" placeholder="100" min="1" step="0.1">
        </div>

        <div class="form-group">
          <label>Eindformaat hoogte mm</label>
          <input type="number" class="pers-finish-h-mm pers-h-mm" value="${escHtml(spec.finishHeightMm || '')}" placeholder="70" min="1" step="0.1">
        </div>
      </div>

      <div class="form-row" style="margin-bottom:8px">
        <div class="form-group">
          <label>Afloop rondom mm</label>
          <input type="number" class="pers-bleed-mm" value="${escHtml(spec.bleedMm || 3)}" placeholder="3" min="0" step="0.1">
        </div>

        <div class="form-group">
          <label>Veilige marge mm</label>
          <input type="number" class="pers-m-mm" value="${escHtml(spec.safeMarginMm || 3)}" placeholder="3" min="0" step="0.1">
        </div>
      </div>

      <div class="pers-px-preview form-hint" style="color:var(--text-2);margin:4px 0 12px"></div>

      ${renderPreviewCalibrationPanel(type)}

      <div class="section-title" style="margin-top:10px">Uitsparingen, rillijnen en no-print zones</div>

      <div class="blocked-zone-list">
        ${blockedZones.map((zone, zoneIndex) => blockedZoneRow(zone, zoneIndex)).join('')}
      </div>

      <button class="btn btn-secondary btn-sm btn-add-blocked-zone" type="button" style="margin:8px 0 12px">
        + Drukzone toevoegen
      </button>

      <span class="form-hint" style="display:block;margin-bottom:12px">
        Gebruik dit voor gaten, rillijnen, vouwlijnen, nietzones of andere zones waar geen tekst of logo overheen mag vallen.
      </span>

      <div class="section-title" style="margin-top:10px">Staffelprijzen voor deze personalisatie</div>

      <div class="pers-slab-list">
        ${priceSlabs.map((slab, slabIndex) => personalisationSlabRow(slab, slabIndex)).join('')}
      </div>

      <button class="btn btn-secondary btn-sm btn-add-pers-slab" type="button" style="margin:8px 0 12px">
        + Staffel toevoegen
      </button>

      <div class="form-row" style="margin-bottom:8px">
        <div class="form-group">
          <label>Personalisatieafbeelding</label>
          <div class="file-upload-field">
            <div class="pers-preview-output">
              ${renderStoredFile(previewFile, 'Personalisatieafbeelding')}
            </div>
            <div class="file-upload-actions">
              <input type="file" class="pers-preview-file" accept="image/*">
              <button type="button" class="btn btn-secondary btn-sm pers-preview-remove">Verwijderen</button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>Template PDF</label>
          <div class="file-upload-field">
            <div class="pers-template-output">
              ${renderStoredFile(templatePdf, 'Template PDF')}
            </div>
            <div class="file-upload-actions">
              <input type="file" class="pers-template-file" accept="application/pdf">
              <button type="button" class="btn btn-secondary btn-sm pers-template-remove">Verwijderen</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function normalizeAdminPreviewConfig(type = {}, product = {}) {
  const spec = normalizeAdminPrintSpec(type, product);
  const normalized = window.ProductPreview?.normalizeConfig
    ? ProductPreview.normalizeConfig(type, product)
    : {
      enabled: type.preview?.enabled === true,
      type: type.preview?.type || 'single-view',
      defaultViewId: type.preview?.defaultViewId || null,
      views: Array.isArray(type.preview?.views) ? type.preview.views : [],
      canvasGuides: Array.isArray(type.preview?.canvasGuides) ? type.preview.canvasGuides : [],
    };

  if (normalized.views.length > 0) {
    return normalized;
  }

  const defaultView = {
    id: 'front',
    label: 'Voorkant',
    helpText: 'Dit deel is zichtbaar aan de voorkant van het product.',
    sourceZone: {
      x_mm: 0,
      y_mm: 0,
      width_mm: spec.finishWidthMm,
      height_mm: spec.finishHeightMm,
      rotation: 0,
      flipX: false,
      flipY: false,
    },
    mockup: {
      baseImage: null,
      overlayImage: null,
      slot: {
        xPercent: 20,
        yPercent: 10,
        widthPercent: 60,
        heightPercent: 55,
        rotation: 0,
        borderRadius: 0,
        fit: 'cover',
      },
    },
  };

  return {
    enabled: false,
    type: 'single-view',
    defaultViewId: defaultView.id,
    views: [defaultView],
    canvasGuides: [],
  };
}

function createPreviewFileState(preview = null) {
  const state = { previewViews: {} };
  const views = Array.isArray(preview?.views) ? preview.views : [];

  views.forEach(view => {
    if (!view?.id) {
      return;
    }

    state.previewViews[view.id] = {
      baseImage: view.mockup?.baseImage || null,
      overlayImage: view.mockup?.overlayImage || null,
    };
  });

  return state;
}

function renderPreviewCalibrationPanel(type = {}) {
  const config = normalizeAdminPreviewConfig(type);
  const foldGuide = config.canvasGuides.find(guide => guide.type === 'line') || null;
  const contentHidden = config.enabled ? '' : 'is-disabled';

  return `
    <div class="section-title preview-section-title">Productpreview en zichtbare zijden</div>

    <div class="preview-calibration-panel" data-preview-panel>
      <div class="preview-calibration-intro">
        <strong>Klantvriendelijke productpreview</strong>
        <span>
          Het volledige drukcanvas blijft intact. Iedere weergave gebruikt alleen het ingestelde brongebied
          en plaatst dat live op een mockup van het eindproduct.
        </span>
      </div>

      <label class="toggle-wrap preview-toggle-row">
        <span>
          <strong>Productpreview inschakelen</strong>
          <span class="form-hint">De customerflow gebruikt deze configuratie voor stap 3 en de eindcontrole.</span>
        </span>
        <span class="toggle">
          <input type="checkbox" class="pers-product-preview-enabled" ${config.enabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </span>
      </label>

      <div class="preview-calibration-content ${contentHidden}">
        <div class="form-row" style="margin-bottom:0">
          <div class="form-group">
            <label>Weergavetype</label>
            <select class="pers-preview-type">
              <option value="single-view" ${config.type === 'single-view' ? 'selected' : ''}>Eén weergave</option>
              <option value="two-sided-toggle" ${config.type === 'two-sided-toggle' ? 'selected' : ''}>Voor- en achterkant met toggle</option>
              <option value="multi-view-toggle" ${config.type === 'multi-view-toggle' ? 'selected' : ''}>Meerdere zijden met toggle</option>
            </select>
          </div>

          <div class="form-group">
            <label>Standaard getoonde zijde</label>
            <select class="pers-preview-default-view">
              ${config.views.map(view => `
                <option value="${escHtml(view.id)}" ${view.id === config.defaultViewId ? 'selected' : ''}>
                  ${escHtml(view.label)}
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="preview-subtitle">Zijden en brongebieden</div>

        <div class="preview-view-list">
          ${config.views.map((view, viewIndex) => previewViewRow(view, viewIndex, config.canvasGuides)).join('')}
        </div>

        <button class="btn btn-secondary btn-sm btn-add-preview-view" type="button">
          + Zijde toevoegen
        </button>

        <div class="preview-subtitle">Vouwlijn op het ontwerpcanvas</div>
        ${previewFoldRow(foldGuide)}
      </div>
    </div>
  `;
}

function previewViewRow(view = {}, index = 0, canvasGuides = []) {
  const sourceZone = view.sourceZone || {};
  const slot = view.mockup?.slot || {};
  const viewId = view.id || createPreviewViewId();
  const labelGuide = canvasGuides.find(guide => guide.type === 'label' && guide.viewId === viewId) || null;
  const showGuide = Boolean(labelGuide) || canvasGuides.length === 0;

  return `
    <article class="preview-view-row" data-preview-view-id="${escHtml(viewId)}">
      <div class="preview-view-header">
        <div>
          <strong>Zijde ${index + 1}: <span class="preview-view-title">${escHtml(view.label || `Weergave ${index + 1}`)}</span></strong>
          <span>Brongebied op het volledige drukcanvas en plaatsing op de productmockup</span>
        </div>
        <button class="icon-btn danger btn-remove-preview-view" type="button" title="Verwijder zijde">×</button>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Label</label>
          <input type="text" class="preview-view-label" value="${escHtml(view.label || '')}" placeholder="Voorkant">
        </div>

        <div class="form-group">
          <label>Technisch ID</label>
          <input type="text" class="preview-view-id" value="${escHtml(viewId)}" readonly>
          <span class="form-hint">Blijft stabiel voor bestaande producten en orders.</span>
        </div>
      </div>

      <div class="form-row-1">
        <div class="form-group">
          <label>Uitleg voor de klant</label>
          <input type="text" class="preview-view-help" value="${escHtml(view.helpText || '')}" placeholder="Dit deel wordt naar achteren gevouwen.">
        </div>
      </div>

      <div class="preview-subtitle">Brongebied op het eindformaat</div>
      <span class="form-hint preview-coordinate-hint">
        X en Y starten linksboven op het afgewerkte formaat, dus zonder afloop. De preview-engine verwerkt de afloop automatisch.
      </span>

      <div class="form-row-4">
        <div class="form-group">
          <label>X mm</label>
          <input type="number" class="preview-source-x" value="${numberInputValue(sourceZone.x_mm)}" min="0" step="0.1">
        </div>
        <div class="form-group">
          <label>Y mm</label>
          <input type="number" class="preview-source-y" value="${numberInputValue(sourceZone.y_mm)}" min="0" step="0.1">
        </div>
        <div class="form-group">
          <label>Breedte mm</label>
          <input type="number" class="preview-source-width" value="${numberInputValue(sourceZone.width_mm)}" min="0.1" step="0.1">
        </div>
        <div class="form-group">
          <label>Hoogte mm</label>
          <input type="number" class="preview-source-height" value="${numberInputValue(sourceZone.height_mm)}" min="0.1" step="0.1">
        </div>
      </div>

      <div class="form-row-3">
        <div class="form-group">
          <label>Bronrotatie</label>
          <select class="preview-source-rotation">
            ${[0, 90, 180, 270].map(rotation => `
              <option value="${rotation}" ${Number(sourceZone.rotation || 0) === rotation ? 'selected' : ''}>${rotation}°</option>
            `).join('')}
          </select>
        </div>

        <label class="preview-check-row">
          <input type="checkbox" class="preview-source-flip-x" ${sourceZone.flipX ? 'checked' : ''}>
          <span>Horizontaal spiegelen</span>
        </label>

        <label class="preview-check-row">
          <input type="checkbox" class="preview-source-flip-y" ${sourceZone.flipY ? 'checked' : ''}>
          <span>Verticaal spiegelen</span>
        </label>
      </div>

      <label class="preview-guide-toggle">
        <input type="checkbox" class="preview-guide-enabled" ${showGuide ? 'checked' : ''}>
        <span>
          <strong>Toon dit gebied als label op het ontwerpcanvas</strong>
          <small>Dit label is alleen een hulplijn en komt nooit in de print-export.</small>
        </span>
      </label>

      <div class="form-row-1 preview-guide-description-wrap">
        <div class="form-group">
          <label>Beschrijving onder canvaslabel</label>
          <input type="text" class="preview-guide-description" value="${escHtml(labelGuide?.description || view.helpText || '')}" placeholder="Zichtbaar op het product">
        </div>
      </div>

      <div class="preview-subtitle">Mockupbestanden</div>

      <div class="form-row">
        <div class="form-group">
          <label>Basismockup</label>
          <div class="file-upload-field">
            <div class="preview-base-output">
              ${renderStoredFile(view.mockup?.baseImage || null, 'Basismockup')}
            </div>
            <div class="file-upload-actions">
              <input type="file" class="preview-base-file" accept="image/*">
              <button type="button" class="btn btn-secondary btn-sm preview-base-remove">Verwijderen</button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>Overlay optioneel</label>
          <div class="file-upload-field">
            <div class="preview-overlay-output">
              ${renderStoredFile(view.mockup?.overlayImage || null, 'Overlay')}
            </div>
            <div class="file-upload-actions">
              <input type="file" class="preview-overlay-file" accept="image/*">
              <button type="button" class="btn btn-secondary btn-sm preview-overlay-remove">Verwijderen</button>
            </div>
          </div>
        </div>
      </div>

      <div class="preview-subtitle">Plaatsing op de mockup</div>

      <div class="form-row-4">
        <div class="form-group">
          <label>X %</label>
          <input type="number" class="preview-slot-x" value="${numberInputValue(slot.xPercent, 20)}" step="0.1">
        </div>
        <div class="form-group">
          <label>Y %</label>
          <input type="number" class="preview-slot-y" value="${numberInputValue(slot.yPercent, 10)}" step="0.1">
        </div>
        <div class="form-group">
          <label>Breedte %</label>
          <input type="number" class="preview-slot-width" value="${numberInputValue(slot.widthPercent, 60)}" min="0.1" step="0.1">
        </div>
        <div class="form-group">
          <label>Hoogte %</label>
          <input type="number" class="preview-slot-height" value="${numberInputValue(slot.heightPercent, 55)}" min="0.1" step="0.1">
        </div>
      </div>

      <div class="form-row-3">
        <div class="form-group">
          <label>Rotatie op mockup</label>
          <input type="number" class="preview-slot-rotation" value="${numberInputValue(slot.rotation, 0)}" step="0.1">
        </div>
        <div class="form-group">
          <label>Hoekafronding %</label>
          <input type="number" class="preview-slot-radius" value="${numberInputValue(slot.borderRadius, 0)}" min="0" max="50" step="0.1">
        </div>
        <div class="form-group">
          <label>Vulling</label>
          <select class="preview-slot-fit">
            <option value="cover" ${slot.fit !== 'contain' && slot.fit !== 'stretch' ? 'selected' : ''}>Vullend uitsnijden</option>
            <option value="contain" ${slot.fit === 'contain' ? 'selected' : ''}>Volledig zichtbaar</option>
            <option value="stretch" ${slot.fit === 'stretch' ? 'selected' : ''}>Uitrekken naar slot</option>
          </select>
        </div>
      </div>

      <div class="preview-calibration-result">
        <div class="preview-calibration-result-header">
          <strong>Calibratievoorbeeld</strong>
          <span class="preview-calibration-status">Wordt bijgewerkt…</span>
        </div>
        <canvas class="preview-calibration-canvas" aria-label="Calibratievoorbeeld van ${escHtml(view.label || `weergave ${index + 1}`)}"></canvas>
      </div>
    </article>
  `;
}

function previewFoldRow(guide = null) {
  return `
    <div class="preview-fold-row">
      <label class="toggle-wrap preview-fold-toggle">
        <span>
          <strong>Vouwlijn tonen</strong>
          <span class="form-hint">Alleen zichtbaar als hulplijn in de ontwerptool.</span>
        </span>
        <span class="toggle">
          <input type="checkbox" class="preview-fold-enabled" ${guide ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </span>
      </label>

      <div class="preview-fold-fields ${guide ? '' : 'is-disabled'}">
        <div class="form-row-1">
          <div class="form-group">
            <label>Label</label>
            <input type="text" class="preview-fold-label" value="${escHtml(guide?.label || 'Vouwlijn')}" placeholder="Vouwlijn">
          </div>
        </div>

        <div class="form-row-4">
          <div class="form-group">
            <label>X start mm</label>
            <input type="number" class="preview-fold-x1" value="${numberInputValue(guide?.x1_mm, 0)}" min="0" step="0.1">
          </div>
          <div class="form-group">
            <label>Y start mm</label>
            <input type="number" class="preview-fold-y1" value="${numberInputValue(guide?.y1_mm, 0)}" min="0" step="0.1">
          </div>
          <div class="form-group">
            <label>X eind mm</label>
            <input type="number" class="preview-fold-x2" value="${numberInputValue(guide?.x2_mm, 0)}" min="0" step="0.1">
          </div>
          <div class="form-group">
            <label>Y eind mm</label>
            <input type="number" class="preview-fold-y2" value="${numberInputValue(guide?.y2_mm, 0)}" min="0" step="0.1">
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindPreviewCalibration(row, uploadState) {
  const uploadKey = row.dataset.uploadKey;
  const fileState = uploadState.persFiles[uploadKey];
  const panel = row.querySelector('[data-preview-panel]');

  if (!panel) {
    return;
  }

  fileState.previewViews = fileState.previewViews || {};

  panel.querySelector('.pers-product-preview-enabled')?.addEventListener('change', event => {
    panel.querySelector('.preview-calibration-content')?.classList.toggle('is-disabled', !event.target.checked);
    refreshPreviewCalibration(row, uploadState);
  });

  panel.querySelector('.preview-fold-enabled')?.addEventListener('change', event => {
    panel.querySelector('.preview-fold-fields')?.classList.toggle('is-disabled', !event.target.checked);
    refreshPreviewCalibration(row, uploadState);
  });

  panel.querySelector('.btn-add-preview-view')?.addEventListener('click', () => {
    const list = panel.querySelector('.preview-view-list');

    if (!list) {
      return;
    }

    const viewCount = list.children.length;
    const viewId = createPreviewViewId();
    const spec = getAdminSpecFromRow(row);
    const view = {
      id: viewId,
      label: viewCount === 1 ? 'Achterkant' : `Zijde ${viewCount + 1}`,
      helpText: viewCount === 1 ? 'Dit deel is zichtbaar aan de achterkant van het product.' : '',
      sourceZone: {
        x_mm: 0,
        y_mm: 0,
        width_mm: spec.finishWidthMm,
        height_mm: spec.finishHeightMm,
        rotation: 0,
        flipX: false,
        flipY: false,
      },
      mockup: {
        baseImage: null,
        overlayImage: null,
        slot: {
          xPercent: 20,
          yPercent: 10,
          widthPercent: 60,
          heightPercent: 55,
          rotation: 0,
          borderRadius: 0,
          fit: 'cover',
        },
      },
    };

    fileState.previewViews[viewId] = {
      baseImage: null,
      overlayImage: null,
    };

    list.insertAdjacentHTML('beforeend', previewViewRow(view, viewCount, []));

    const typeSelect = panel.querySelector('.pers-preview-type');

    if (typeSelect && viewCount === 1 && typeSelect.value === 'single-view') {
      typeSelect.value = 'two-sided-toggle';
    } else if (typeSelect && viewCount >= 2) {
      typeSelect.value = 'multi-view-toggle';
    }

    bindPreviewViewRow(list.lastElementChild, row, uploadState);
    refreshPreviewCalibration(row, uploadState);
  });

  panel.querySelectorAll('.preview-view-row').forEach(viewRow => {
    const viewId = viewRow.dataset.previewViewId;
    fileState.previewViews[viewId] = fileState.previewViews[viewId] || {
      baseImage: null,
      overlayImage: null,
    };
    bindPreviewViewRow(viewRow, row, uploadState);
  });

  panel.querySelectorAll('input, select').forEach(input => {
    if (input.closest('.preview-view-row')) {
      return;
    }

    input.addEventListener('input', () => refreshPreviewCalibration(row, uploadState));
    input.addEventListener('change', () => refreshPreviewCalibration(row, uploadState));
  });

  refreshPreviewCalibration(row, uploadState);
}

function bindPreviewViewRow(viewRow, personalisationRow, uploadState) {
  if (!viewRow) {
    return;
  }

  const uploadKey = personalisationRow.dataset.uploadKey;
  const fileState = uploadState.persFiles[uploadKey];
  const viewId = viewRow.dataset.previewViewId;

  fileState.previewViews[viewId] = fileState.previewViews[viewId] || {
    baseImage: null,
    overlayImage: null,
  };

  viewRow.querySelector('.btn-remove-preview-view')?.addEventListener('click', () => {
    const list = viewRow.closest('.preview-view-list');

    if (list?.children.length <= 1) {
      AdminUI.showToast('Laat minimaal één previewzijde staan.', 'error');
      return;
    }

    delete fileState.previewViews[viewId];
    viewRow.remove();
    renumberPreviewViewRows(personalisationRow);
    refreshPreviewCalibration(personalisationRow, uploadState);
  });

  const baseInput = viewRow.querySelector('.preview-base-file');
  const baseOutput = viewRow.querySelector('.preview-base-output');
  const overlayInput = viewRow.querySelector('.preview-overlay-file');
  const overlayOutput = viewRow.querySelector('.preview-overlay-output');

  baseInput?.addEventListener('change', async event => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    fileState.previewViews[viewId].baseImage = await fileToDataURL(file);
    baseOutput.innerHTML = renderStoredFile(fileState.previewViews[viewId].baseImage, 'Basismockup');
    event.target.value = '';
    refreshPreviewCalibration(personalisationRow, uploadState);
  });

  viewRow.querySelector('.preview-base-remove')?.addEventListener('click', () => {
    fileState.previewViews[viewId].baseImage = null;
    baseOutput.innerHTML = renderStoredFile(null);
    refreshPreviewCalibration(personalisationRow, uploadState);
  });

  overlayInput?.addEventListener('change', async event => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    fileState.previewViews[viewId].overlayImage = await fileToDataURL(file);
    overlayOutput.innerHTML = renderStoredFile(fileState.previewViews[viewId].overlayImage, 'Overlay');
    event.target.value = '';
    refreshPreviewCalibration(personalisationRow, uploadState);
  });

  viewRow.querySelector('.preview-overlay-remove')?.addEventListener('click', () => {
    fileState.previewViews[viewId].overlayImage = null;
    overlayOutput.innerHTML = renderStoredFile(null);
    refreshPreviewCalibration(personalisationRow, uploadState);
  });

  viewRow.querySelectorAll('input, select').forEach(input => {
    if (input.matches('.preview-base-file, .preview-overlay-file')) {
      return;
    }

    const eventName = input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(eventName, () => {
      if (input.classList.contains('preview-view-label')) {
        const title = viewRow.querySelector('.preview-view-title');

        if (title) {
          title.textContent = input.value.trim() || 'Naamloze zijde';
        }
      }

      refreshPreviewCalibration(personalisationRow, uploadState);
    });
  });
}

function renumberPreviewViewRows(row) {
  row.querySelectorAll('.preview-view-row').forEach((viewRow, index) => {
    const header = viewRow.querySelector('.preview-view-header strong');
    const title = viewRow.querySelector('.preview-view-label')?.value.trim() || `Weergave ${index + 1}`;

    if (header) {
      header.innerHTML = `Zijde ${index + 1}: <span class="preview-view-title">${escHtml(title)}</span>`;
    }
  });
}

function updatePreviewDefaultViewOptions(row, config) {
  const select = row.querySelector('.pers-preview-default-view');

  if (!select) {
    return;
  }

  const currentValue = select.value;
  select.innerHTML = config.views.map(view => `
    <option value="${escHtml(view.id)}">${escHtml(view.label)}</option>
  `).join('');

  select.value = config.views.some(view => view.id === currentValue)
    ? currentValue
    : config.views[0]?.id || '';
}

async function refreshPreviewCalibration(row, uploadState) {
  if (!window.ProductPreview) {
    return;
  }

  const uploadKey = row.dataset.uploadKey;
  const fileState = uploadState.persFiles[uploadKey] || {};
  const spec = getAdminSpecFromRow(row);
  const config = collectPreviewConfigFromRow(row, fileState, spec);
  const type = getAdminPersonalisationDraft(row, config, spec);
  const product = getAdminProductDraft();
  const token = String(Date.now() + Math.random());

  row.dataset.previewRenderToken = token;
  updatePreviewDefaultViewOptions(row, config);

  const sourceCanvas = await buildAdminCalibrationSourceCanvas(row, config, spec, fileState.previewImageFile);

  if (row.dataset.previewRenderToken !== token) {
    return;
  }

  await Promise.all(config.views.map(async view => {
    const viewRow = [...row.querySelectorAll('.preview-view-row')]
      .find(candidate => candidate.dataset.previewViewId === view.id);
    const targetCanvas = viewRow?.querySelector('.preview-calibration-canvas');
    const status = viewRow?.querySelector('.preview-calibration-status');

    if (!targetCanvas) {
      return;
    }

    try {
      await ProductPreview.renderFromCanvas({
        sourceCanvas,
        targetCanvas,
        product,
        personalisationType: type,
        viewId: view.id,
        width: 620,
      });

      if (status) {
        status.textContent = view.mockup.baseImage
          ? 'Mockup geladen'
          : 'Voorbeeld zonder basismockup';
      }
    } catch (error) {
      console.warn('Calibratiepreview renderen mislukt', error);

      if (status) {
        status.textContent = 'Preview kon niet worden opgebouwd';
      }
    }
  }));
}

async function buildAdminCalibrationSourceCanvas(row, config, spec, previewImageFile) {
  const width = 700;
  const ratio = spec.exportWidthMm > 0 ? spec.exportHeightMm / spec.exportWidthMm : 0.7;
  const height = Math.max(220, Math.min(620, Math.round(width * ratio)));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, width, height);

  if (previewImageFile?.dataURL && window.ProductPreview?.loadImage) {
    try {
      const image = await ProductPreview.loadImage(previewImageFile);
      const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      const imageWidth = image.naturalWidth * scale;
      const imageHeight = image.naturalHeight * scale;
      context.drawImage(image, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
    } catch (error) {
      console.warn('Personalisatieafbeelding kon niet in calibratiepreview worden geladen', error);
    }
  }

  const trimX = spec.trimXmm / spec.exportWidthMm * width;
  const trimY = spec.trimYmm / spec.exportHeightMm * height;
  const finishWidth = spec.finishWidthMm / spec.exportWidthMm * width;
  const finishHeight = spec.finishHeightMm / spec.exportHeightMm * height;

  context.save();
  context.strokeStyle = '#A8A39B';
  context.lineWidth = 2;
  context.setLineDash([8, 6]);
  context.strokeRect(trimX, trimY, finishWidth, finishHeight);
  context.restore();

  const swatches = [
    ['rgba(92, 122, 92, .18)', '#3E5A3E'],
    ['rgba(201, 168, 76, .22)', '#9B7C24'],
    ['rgba(95, 127, 145, .18)', '#496A78'],
    ['rgba(192, 57, 43, .13)', '#8F2D22'],
  ];

  config.views.forEach((view, index) => {
    const [fill, stroke] = swatches[index % swatches.length];
    const x = (spec.trimXmm + view.sourceZone.x_mm) / spec.exportWidthMm * width;
    const y = (spec.trimYmm + view.sourceZone.y_mm) / spec.exportHeightMm * height;
    const zoneWidth = view.sourceZone.width_mm / spec.exportWidthMm * width;
    const zoneHeight = view.sourceZone.height_mm / spec.exportHeightMm * height;

    context.save();
    context.fillStyle = fill;
    context.strokeStyle = stroke;
    context.lineWidth = 2;
    context.fillRect(x, y, zoneWidth, zoneHeight);
    context.strokeRect(x, y, zoneWidth, zoneHeight);

    const fontSize = Math.max(12, Math.min(26, zoneWidth / 7));
    context.fillStyle = stroke;
    context.font = `700 ${fontSize}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(view.label, x + zoneWidth / 2, y + zoneHeight / 2, Math.max(20, zoneWidth - 12));
    context.restore();
  });

  const foldGuide = config.canvasGuides.find(guide => guide.type === 'line');

  if (foldGuide) {
    const x1 = (spec.trimXmm + foldGuide.x1_mm) / spec.exportWidthMm * width;
    const y1 = (spec.trimYmm + foldGuide.y1_mm) / spec.exportHeightMm * height;
    const x2 = (spec.trimXmm + foldGuide.x2_mm) / spec.exportWidthMm * width;
    const y2 = (spec.trimYmm + foldGuide.y2_mm) / spec.exportHeightMm * height;

    context.save();
    context.strokeStyle = '#C0392B';
    context.lineWidth = 3;
    context.setLineDash([10, 6]);
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
    context.restore();
  }

  return canvas;
}

function collectPreviewConfigFromRow(row, fileState = {}, spec = getAdminSpecFromRow(row)) {
  const panel = row.querySelector('[data-preview-panel]');

  if (!panel) {
    return {
      enabled: false,
      type: 'single-view',
      defaultViewId: null,
      views: [],
      canvasGuides: [],
    };
  }

  const views = [...panel.querySelectorAll('.preview-view-row')].map((viewRow, index) => {
    const viewId = viewRow.dataset.previewViewId || createPreviewViewId();
    const files = fileState.previewViews?.[viewId] || {};
    const label = viewRow.querySelector('.preview-view-label')?.value.trim() || `Weergave ${index + 1}`;

    return {
      id: viewId,
      label,
      helpText: viewRow.querySelector('.preview-view-help')?.value.trim() || '',
      sourceZone: {
        x_mm: finiteInputValue(viewRow.querySelector('.preview-source-x'), 0),
        y_mm: finiteInputValue(viewRow.querySelector('.preview-source-y'), 0),
        width_mm: positiveInputValue(viewRow.querySelector('.preview-source-width'), spec.finishWidthMm),
        height_mm: positiveInputValue(viewRow.querySelector('.preview-source-height'), spec.finishHeightMm),
        rotation: finiteInputValue(viewRow.querySelector('.preview-source-rotation'), 0),
        flipX: viewRow.querySelector('.preview-source-flip-x')?.checked || false,
        flipY: viewRow.querySelector('.preview-source-flip-y')?.checked || false,
      },
      mockup: {
        baseImage: files.baseImage || null,
        overlayImage: files.overlayImage || null,
        slot: {
          xPercent: finiteInputValue(viewRow.querySelector('.preview-slot-x'), 20),
          yPercent: finiteInputValue(viewRow.querySelector('.preview-slot-y'), 10),
          widthPercent: positiveInputValue(viewRow.querySelector('.preview-slot-width'), 60),
          heightPercent: positiveInputValue(viewRow.querySelector('.preview-slot-height'), 55),
          rotation: finiteInputValue(viewRow.querySelector('.preview-slot-rotation'), 0),
          borderRadius: Math.max(0, finiteInputValue(viewRow.querySelector('.preview-slot-radius'), 0)),
          fit: viewRow.querySelector('.preview-slot-fit')?.value || 'cover',
        },
      },
    };
  });

  const canvasGuides = [];

  [...panel.querySelectorAll('.preview-view-row')].forEach((viewRow, index) => {
    if (!viewRow.querySelector('.preview-guide-enabled')?.checked) {
      return;
    }

    const view = views[index];

    if (!view) {
      return;
    }

    canvasGuides.push({
      id: `${view.id}-zone`,
      type: 'label',
      viewId: view.id,
      label: view.label,
      description: viewRow.querySelector('.preview-guide-description')?.value.trim() || view.helpText || '',
      x_mm: view.sourceZone.x_mm,
      y_mm: view.sourceZone.y_mm,
      width_mm: view.sourceZone.width_mm,
      height_mm: view.sourceZone.height_mm,
    });
  });

  if (panel.querySelector('.preview-fold-enabled')?.checked) {
    canvasGuides.push({
      id: 'fold-line',
      type: 'line',
      label: panel.querySelector('.preview-fold-label')?.value.trim() || 'Vouwlijn',
      x1_mm: finiteInputValue(panel.querySelector('.preview-fold-x1'), 0),
      y1_mm: finiteInputValue(panel.querySelector('.preview-fold-y1'), 0),
      x2_mm: finiteInputValue(panel.querySelector('.preview-fold-x2'), spec.finishWidthMm),
      y2_mm: finiteInputValue(panel.querySelector('.preview-fold-y2'), 0),
    });
  }

  const selectedDefault = panel.querySelector('.pers-preview-default-view')?.value;
  const defaultViewId = views.some(view => view.id === selectedDefault)
    ? selectedDefault
    : views[0]?.id || null;

  const selectedType = panel.querySelector('.pers-preview-type')?.value || 'single-view';
  const previewType = views.length === 1
    ? 'single-view'
    : selectedType === 'single-view'
      ? (views.length === 2 ? 'two-sided-toggle' : 'multi-view-toggle')
      : selectedType;

  return {
    enabled: panel.querySelector('.pers-product-preview-enabled')?.checked || false,
    type: previewType,
    defaultViewId,
    views,
    canvasGuides,
  };
}

function getAdminSpecFromRow(row) {
  const finishWidthMm = positiveInputValue(row.querySelector('.pers-finish-w-mm') || row.querySelector('.pers-w-mm'), 100);
  const finishHeightMm = positiveInputValue(row.querySelector('.pers-finish-h-mm') || row.querySelector('.pers-h-mm'), 70);
  const bleedMm = Math.max(0, finiteInputValue(row.querySelector('.pers-bleed-mm'), 3));
  const safeMarginMm = Math.max(0, finiteInputValue(row.querySelector('.pers-m-mm'), 3));

  return normalizeAdminPrintSpec({
    width_mm: finishWidthMm,
    height_mm: finishHeightMm,
    finish_width_mm: finishWidthMm,
    finish_height_mm: finishHeightMm,
    bleed_mm: bleedMm,
    safe_margin_mm: safeMarginMm,
    margin_mm: safeMarginMm,
    includesBleed: false,
  });
}

function getAdminPersonalisationDraft(row, preview, spec = getAdminSpecFromRow(row)) {
  return {
    id: row.dataset.persistedId || row.dataset.uploadKey || 'preview-draft',
    label: row.querySelector('.pers-label')?.value.trim() || 'Standaard',
    width_mm: spec.finishWidthMm,
    height_mm: spec.finishHeightMm,
    finish_width_mm: spec.finishWidthMm,
    finish_height_mm: spec.finishHeightMm,
    export_width_mm: spec.exportWidthMm,
    export_height_mm: spec.exportHeightMm,
    bleed_mm: spec.bleedMm,
    safe_margin_mm: spec.safeMarginMm,
    margin_mm: spec.safeMarginMm,
    includesBleed: false,
    preview,
  };
}

function getAdminProductDraft() {
  return {
    id: document.getElementById('pf-id')?.value.trim() || 'preview-product',
    name: document.getElementById('pf-name')?.value.trim() || 'Product',
  };
}

function finiteInputValue(input, fallback = 0) {
  const value = Number(input?.value);
  return Number.isFinite(value) ? value : fallback;
}

function positiveInputValue(input, fallback = 1) {
  const value = Number(input?.value);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function numberInputValue(value, fallback = '') {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : String(fallback);
}

function createPreviewViewId() {
  return `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function bindProductImageUpload(uploadState) {
  document.getElementById('pf-img-file')?.addEventListener('change', async event => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    uploadState.imageProductFile = await fileToDataURL(file);
    document.getElementById('pf-img-preview').innerHTML = renderStoredFile(uploadState.imageProductFile);
    event.target.value = '';
  });

  document.getElementById('pf-img-remove')?.addEventListener('click', () => {
    uploadState.imageProductFile = null;
    document.getElementById('pf-img-preview').innerHTML = renderStoredFile(null);
  });
}

function bindExistingPersRows(uploadState, persTypes) {
  document.querySelectorAll('.pers-type-row').forEach((row, index) => {
    const existingType = persTypes[index] || {};
    const uploadKey = row.dataset.uploadKey || existingType.id || createUploadKey();

    row.dataset.uploadKey = uploadKey;

    uploadState.persFiles[uploadKey] = uploadState.persFiles[uploadKey] || {
      sourceType: { ...existingType },
      previewImageFile: existingType.previewImageFile || (existingType.previewImage ? {
        name: 'Personalisatieafbeelding',
        type: 'image/png',
        size: 0,
        dataURL: existingType.previewImage,
      } : null),
      templatePdf: existingType.templatePdf || null,
      ...createPreviewFileState(existingType.preview),
    };

    bindPersRowUploads(row, uploadState);
    bindPersPreview(row);
  });
}

function bindPersRowUploads(row, uploadState) {
  const uploadKey = row.dataset.uploadKey;

  uploadState.persFiles[uploadKey] = uploadState.persFiles[uploadKey] || {
    sourceType: {},
    previewImageFile: null,
    templatePdf: null,
    previewViews: {},
  };

  uploadState.persFiles[uploadKey].previewViews = uploadState.persFiles[uploadKey].previewViews || {};

  const previewInput = row.querySelector('.pers-preview-file');
  const previewRemove = row.querySelector('.pers-preview-remove');
  const previewOutput = row.querySelector('.pers-preview-output');

  const templateInput = row.querySelector('.pers-template-file');
  const templateRemove = row.querySelector('.pers-template-remove');
  const templateOutput = row.querySelector('.pers-template-output');

  row.querySelector('.btn-add-pers-slab')?.addEventListener('click', () => {
    const list = row.querySelector('.pers-slab-list');

    if (!list) {
      return;
    }

    list.insertAdjacentHTML('beforeend', personalisationSlabRow({
      from: '',
      to: '',
      price: '',
    }, list.children.length));
  });

  row.querySelector('.btn-add-blocked-zone')?.addEventListener('click', () => {
    const list = row.querySelector('.blocked-zone-list');

    if (!list) {
      return;
    }

    list.insertAdjacentHTML('beforeend', blockedZoneRow({
      type: 'circle',
      label: '',
      x_mm: '',
      y_mm: '',
      diameter_mm: '',
      x1_mm: '',
      y1_mm: '',
      x2_mm: '',
      y2_mm: '',
      width_mm: '',
      height_mm: '',
      line_width_mm: 0.3,
      margin_mm: '',
    }, list.children.length));

    const newZone = list.lastElementChild;

    if (newZone) {
      bindBlockedZoneTypeSwitch(newZone);
    }
  });

  row.querySelectorAll('.blocked-zone-row').forEach(zoneRow => {
    bindBlockedZoneTypeSwitch(zoneRow);
  });

  previewInput?.addEventListener('change', async event => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    uploadState.persFiles[uploadKey].previewImageFile = await fileToDataURL(file);
    previewOutput.innerHTML = renderStoredFile(uploadState.persFiles[uploadKey].previewImageFile);
    event.target.value = '';
    refreshPreviewCalibration(row, uploadState);
  });

  previewRemove?.addEventListener('click', () => {
    uploadState.persFiles[uploadKey].previewImageFile = null;
    previewOutput.innerHTML = renderStoredFile(null);
    refreshPreviewCalibration(row, uploadState);
  });

  templateInput?.addEventListener('change', async event => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== 'application/pdf') {
      AdminUI.showToast('Upload een PDF bestand als template', 'error');
      event.target.value = '';
      return;
    }

    uploadState.persFiles[uploadKey].templatePdf = await fileToDataURL(file);
    templateOutput.innerHTML = renderStoredFile(uploadState.persFiles[uploadKey].templatePdf, 'Template PDF');
    event.target.value = '';
  });

  templateRemove?.addEventListener('click', () => {
    uploadState.persFiles[uploadKey].templatePdf = null;
    templateOutput.innerHTML = renderStoredFile(null);
  });

  bindPreviewCalibration(row, uploadState);
}

function bindBlockedZoneTypeSwitch(zoneRow) {
  const select = zoneRow.querySelector('.blocked-zone-type');

  if (!select) {
    return;
  }

  const update = () => {
    zoneRow.querySelectorAll('.blocked-zone-fields').forEach(fields => {
      fields.style.display = 'none';
    });

    const activeFields = zoneRow.querySelector(`.blocked-zone-fields-${select.value}`);

    if (activeFields) {
      activeFields.style.display = '';
    }
  };

  select.addEventListener('change', update);
  update();
}

function bindPersPreview(row) {
  const widthInput = row.querySelector('.pers-finish-w-mm') || row.querySelector('.pers-w-mm');
  const heightInput = row.querySelector('.pers-finish-h-mm') || row.querySelector('.pers-h-mm');
  const bleedInput = row.querySelector('.pers-bleed-mm');
  const marginInput = row.querySelector('.pers-m-mm');
  const preview = row.querySelector('.pers-px-preview');

  const update = () => {
    if (!preview) {
      return;
    }

    const tempPersType = {
      width_mm: parseFloat(widthInput?.value) || null,
      height_mm: parseFloat(heightInput?.value) || null,
      finish_width_mm: parseFloat(widthInput?.value) || null,
      finish_height_mm: parseFloat(heightInput?.value) || null,
      bleed_mm: parseFloat(bleedInput?.value) || 3,
      safe_margin_mm: parseFloat(marginInput?.value) || 3,
      margin_mm: parseFloat(marginInput?.value) || 3,
      includesBleed: false,
    };

    const spec = normalizeAdminPrintSpec(tempPersType);

    preview.textContent = [
      `Eindformaat: ${formatMm(spec.finishWidthMm)}×${formatMm(spec.finishHeightMm)} mm`,
      `Afloop: ${formatMm(spec.bleedMm)} mm`,
      `Export: ${formatMm(spec.exportWidthMm)}×${formatMm(spec.exportHeightMm)} mm`,
      `${spec.exportWidthPx}×${spec.exportHeightPx}px op 300 DPI`,
      `Canvas: ${spec.displayWidthPx}×${spec.displayHeightPx}px`,
    ].join(' | ');
  };

  [widthInput, heightInput, bleedInput, marginInput].forEach(input => {
    input?.addEventListener('input', update);
    input?.addEventListener('change', update);
  });

  update();
}

function bindProductModalActions(uploadState, product, isEdit) {
  document.getElementById('btn-add-slab').addEventListener('click', () => {
    const list = document.getElementById('slab-list');
    list.insertAdjacentHTML('beforeend', slabRow({ from: '', to: '', price: '' }, list.children.length));
  });

  document.getElementById('btn-add-pers').addEventListener('click', () => {
    const list = document.getElementById('pers-type-list');
    const uploadKey = createUploadKey();

    uploadState.persFiles[uploadKey] = {
      sourceType: {},
      previewImageFile: null,
      templatePdf: null,
      previewViews: {},
    };

    list.insertAdjacentHTML('beforeend', persTypeRow({
      label: '',
      active: true,
      finish_width_mm: '',
      finish_height_mm: '',
      width_mm: '',
      height_mm: '',
      bleed_mm: 3,
      safe_margin_mm: 3,
      margin_mm: 3,
      includesBleed: false,
      clipShape: '',
      priceSlabs: [],
      blockedZones: [],
      preview: {
        enabled: false,
        type: 'single-view',
        defaultViewId: 'front',
        views: [],
        canvasGuides: [],
      },
    }, list.children.length, uploadKey));

    const newRow = list.lastElementChild;
    bindPersRowUploads(newRow, uploadState);
    bindPersPreview(newRow);
  });

  document.getElementById('btn-product-save').addEventListener('click', () => {
    saveProductFromModal(uploadState, product, isEdit);
  });
}

function saveProductFromModal(uploadState, product, isEdit) {
  const name = document.getElementById('pf-name').value.trim();
  const error = document.getElementById('pf-error');

  if (!name) {
    error.textContent = 'Productnaam is verplicht.';
    error.classList.add('visible');
    return;
  }

  const personalisatieTypes = collectPersonalisationTypes(uploadState);

  if (personalisatieTypes.length === 0) {
    error.textContent = 'Voeg minimaal één personalisatietype toe.';
    error.classList.add('visible');
    return;
  }

  const activePersonalisationTypes = personalisatieTypes.filter(type => type.active !== false);
  const previewValidationError = personalisatieTypes
    .map(validatePersonalisationPreview)
    .find(Boolean);

  if (previewValidationError) {
    error.textContent = previewValidationError;
    error.classList.add('visible');
    return;
  }

  if (activePersonalisationTypes.length === 0) {
    error.textContent = 'Zet minimaal één personalisatietype op actief.';
    error.classList.add('visible');
    return;
  }

  error.classList.remove('visible');

  const priceSlabs = [...document.querySelectorAll('#slab-list .slab-row')].map(row => ({
    from: parseFloat(row.querySelector('.slab-from').value) || 1,
    to: parseFloat(row.querySelector('.slab-to').value) || null,
    price: parseFloat(row.querySelector('.slab-price').value) || 0,
  })).filter(priceSlab => priceSlab.price > 0);

  const customId = document.getElementById('pf-id').value.trim();
  const firstPers = activePersonalisationTypes[0] || personalisatieTypes[0];

  const updated = {
    ...product,
    id: isEdit ? product.id : (customId || undefined),
    name,
    active: product.active !== false,
    priceSlabs,
    imageProductFile: uploadState.imageProductFile || null,
    imageProduct: uploadState.imageProductFile?.dataURL || '',
    personalisatieTypes,

    width_mm: firstPers.width_mm,
    height_mm: firstPers.height_mm,
    finish_width_mm: firstPers.finish_width_mm,
    finish_height_mm: firstPers.finish_height_mm,
    bleed_mm: firstPers.bleed_mm,
    safe_margin_mm: firstPers.safe_margin_mm,
    margin_mm: firstPers.margin_mm,
    includesBleed: false,
    export_width_mm: firstPers.export_width_mm,
    export_height_mm: firstPers.export_height_mm,

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
}

function validatePersonalisationPreview(personalisationType = {}) {
  const preview = personalisationType.preview || {};

  if (preview.enabled !== true) {
    return '';
  }

  const typeLabel = personalisationType.label || 'Personalisatietype';
  const views = Array.isArray(preview.views) ? preview.views : [];

  if (!views.length) {
    return `${typeLabel}: voeg minimaal één productpreviewzijde toe.`;
  }

  if (preview.type === 'single-view' && views.length !== 1) {
    return `${typeLabel}: het weergavetype “Eén weergave” vereist precies één zijde.`;
  }

  if (preview.type === 'two-sided-toggle' && views.length !== 2) {
    return `${typeLabel}: “Voor- en achterkant” vereist precies twee zijden.`;
  }

  if (preview.type === 'multi-view-toggle' && views.length < 2) {
    return `${typeLabel}: een meervoudige preview vereist minimaal twee zijden.`;
  }

  const viewIds = views.map(view => view.id);

  if (new Set(viewIds).size !== viewIds.length) {
    return `${typeLabel}: iedere previewzijde moet een uniek technisch ID hebben.`;
  }

  if (!views.some(view => view.id === preview.defaultViewId)) {
    return `${typeLabel}: kies een geldige standaardzijde voor de productpreview.`;
  }

  for (const view of views) {
    const zone = view.sourceZone || {};
    const viewLabel = view.label || view.id || 'Previewzijde';

    if (Number(zone.width_mm) <= 0 || Number(zone.height_mm) <= 0) {
      return `${typeLabel} – ${viewLabel}: vul een geldig brongebied in.`;
    }

    if (Number(zone.x_mm) < 0 || Number(zone.y_mm) < 0) {
      return `${typeLabel} – ${viewLabel}: X en Y mogen niet negatief zijn.`;
    }

    if (
      Number(zone.x_mm) + Number(zone.width_mm) > Number(personalisationType.finish_width_mm) + 0.01 ||
      Number(zone.y_mm) + Number(zone.height_mm) > Number(personalisationType.finish_height_mm) + 0.01
    ) {
      return `${typeLabel} – ${viewLabel}: het brongebied valt buiten het eindformaat.`;
    }

    if (!view.mockup?.baseImage?.dataURL) {
      return `${typeLabel} – ${viewLabel}: upload een basismockup voordat u de productpreview inschakelt.`;
    }

    if (Number(view.mockup?.slot?.widthPercent) <= 0 || Number(view.mockup?.slot?.heightPercent) <= 0) {
      return `${typeLabel} – ${viewLabel}: de mockup-slot moet een geldige breedte en hoogte hebben.`;
    }
  }

  return '';
}

function collectPersonalisationTypes(uploadState) {
  return [...document.querySelectorAll('#pers-type-list .pers-type-row')].map(row => {
    const label = row.querySelector('.pers-label').value.trim();
    const uploadKey = row.dataset.uploadKey;
    const persistedId = row.dataset.persistedId;
    const stableId = persistedId || uploadKey;
    const fileState = uploadState.persFiles[uploadKey] || {};

    const finishWidthMm = parseFloat(row.querySelector('.pers-finish-w-mm')?.value || row.querySelector('.pers-w-mm')?.value) || null;
    const finishHeightMm = parseFloat(row.querySelector('.pers-finish-h-mm')?.value || row.querySelector('.pers-h-mm')?.value) || null;
    const bleedMm = parseFloat(row.querySelector('.pers-bleed-mm')?.value) || 3;
    const safeMarginMm = parseFloat(row.querySelector('.pers-m-mm')?.value) || 3;

    const tempPersType = {
      width_mm: finishWidthMm,
      height_mm: finishHeightMm,
      finish_width_mm: finishWidthMm,
      finish_height_mm: finishHeightMm,
      bleed_mm: bleedMm,
      safe_margin_mm: safeMarginMm,
      margin_mm: safeMarginMm,
      includesBleed: false,
    };

    const spec = normalizeAdminPrintSpec(tempPersType);

    const priceSlabs = [...row.querySelectorAll('.pers-slab-row')].map(slabRow => ({
      from: parseFloat(slabRow.querySelector('.pers-slab-from').value) || 1,
      to: parseFloat(slabRow.querySelector('.pers-slab-to').value) || null,
      price: parseFloat(slabRow.querySelector('.pers-slab-price').value) || 0,
    })).filter(priceSlab => priceSlab.price > 0);

    const blockedZones = collectBlockedZonesFromRow(row);
    const preview = collectPreviewConfigFromRow(row, fileState, spec);

    return {
      ...(fileState.sourceType || {}),
      id: stableId,
      label: label || 'Standaard',
      active: row.querySelector('.pers-active')?.checked !== false,
      priceSlabs,
      blockedZones,

      previewImageFile: fileState.previewImageFile || null,
      previewImage: fileState.previewImageFile?.dataURL || '',
      templatePdf: fileState.templatePdf || null,
      preview,

      clipShape: row.querySelector('.pers-clip').value.trim() || null,
      allowBackgroundColor: row.querySelector('.pers-bg-allowed')?.checked || false,

      width_mm: spec.finishWidthMm,
      height_mm: spec.finishHeightMm,
      finish_width_mm: spec.finishWidthMm,
      finish_height_mm: spec.finishHeightMm,
      bleed_mm: spec.bleedMm,
      safe_margin_mm: spec.safeMarginMm,
      margin_mm: spec.safeMarginMm,
      includesBleed: false,

      export_width_mm: spec.exportWidthMm,
      export_height_mm: spec.exportHeightMm,
      width_px: spec.exportWidthPx,
      height_px: spec.exportHeightPx,
      margin_px: spec.safeMarginPx,
      canvas_display_width: spec.displayWidthPx,
      canvas_display_height: spec.displayHeightPx,
    };
  });
}

function collectBlockedZonesFromRow(row) {
  return [...row.querySelectorAll('.blocked-zone-row')].map((zoneRow, zoneIndex) => {
    const type = zoneRow.querySelector('.blocked-zone-type')?.value || 'circle';
    const label = zoneRow.querySelector('.blocked-zone-label')?.value.trim() || `Zone ${zoneIndex + 1}`;
    const marginMm = parseFloat(zoneRow.querySelector('.blocked-zone-margin')?.value) || 0;

    if (type === 'line') {
      return {
        id: zoneRow.dataset.zoneId || createBlockedZoneId(),
        type: 'line',
        label,
        x1_mm: parseFloat(zoneRow.querySelector('.blocked-zone-x1')?.value) || 0,
        y1_mm: parseFloat(zoneRow.querySelector('.blocked-zone-y1')?.value) || 0,
        x2_mm: parseFloat(zoneRow.querySelector('.blocked-zone-x2')?.value) || 0,
        y2_mm: parseFloat(zoneRow.querySelector('.blocked-zone-y2')?.value) || 0,
        line_width_mm: parseFloat(zoneRow.querySelector('.blocked-zone-line-width')?.value) || 0.3,
        margin_mm: marginMm,
      };
    }

    if (type === 'rect') {
      return {
        id: zoneRow.dataset.zoneId || createBlockedZoneId(),
        type: 'rect',
        label,
        x_mm: parseFloat(zoneRow.querySelector('.blocked-zone-rect-x')?.value) || 0,
        y_mm: parseFloat(zoneRow.querySelector('.blocked-zone-rect-y')?.value) || 0,
        width_mm: parseFloat(zoneRow.querySelector('.blocked-zone-width')?.value) || 0,
        height_mm: parseFloat(zoneRow.querySelector('.blocked-zone-height')?.value) || 0,
        margin_mm: marginMm,
      };
    }

    return {
      id: zoneRow.dataset.zoneId || createBlockedZoneId(),
      type: 'circle',
      label,
      x_mm: parseFloat(zoneRow.querySelector('.blocked-zone-x')?.value) || 0,
      y_mm: parseFloat(zoneRow.querySelector('.blocked-zone-y')?.value) || 0,
      diameter_mm: parseFloat(zoneRow.querySelector('.blocked-zone-diameter')?.value) || 0,
      margin_mm: marginMm,
    };
  }).filter(zone => {
    if (zone.type === 'line') {
      return zone.x1_mm !== zone.x2_mm || zone.y1_mm !== zone.y2_mm;
    }

    if (zone.type === 'rect') {
      return zone.width_mm > 0 && zone.height_mm > 0;
    }

    return zone.diameter_mm > 0;
  });
}

function normalizeAdminPrintSpec(persType = {}, product = {}) {
  if (window.PrintSpecs?.normalizePrintSpec) {
    return PrintSpecs.normalizePrintSpec({
      ...persType,
      includesBleed: false,
    }, {
      ...product,
      includesBleed: false,
    });
  }

  const dpi = 300;
  const mmPerInch = 25.4;
  const bleedMm = positiveNumber(persType.bleed_mm, product.bleed_mm, 3) || 3;

  const finishWidthMm = positiveNumber(
    persType.finish_width_mm,
    product.finish_width_mm,
    persType.width_mm,
    product.width_mm,
    100
  ) || 100;

  const finishHeightMm = positiveNumber(
    persType.finish_height_mm,
    product.finish_height_mm,
    persType.height_mm,
    product.height_mm,
    70
  ) || 70;

  const exportWidthMm = positiveNumber(
    persType.export_width_mm,
    product.export_width_mm,
    finishWidthMm + bleedMm * 2
  ) || finishWidthMm + bleedMm * 2;

  const exportHeightMm = positiveNumber(
    persType.export_height_mm,
    product.export_height_mm,
    finishHeightMm + bleedMm * 2
  ) || finishHeightMm + bleedMm * 2;

  const safeMarginMm = positiveNumber(
    persType.safe_margin_mm,
    persType.margin_mm,
    product.safe_margin_mm,
    product.margin_mm,
    3
  ) || 3;

  const exportWidthPx = Math.round(exportWidthMm / mmPerInch * dpi);
  const exportHeightPx = Math.round(exportHeightMm / mmPerInch * dpi);
  const safeMarginPx = Math.round(safeMarginMm / mmPerInch * dpi);
  const scale = exportWidthPx ? Math.min(1, 600 / exportWidthPx) : 1;
  const displayWidthPx = exportWidthPx ? Math.round(exportWidthPx * scale) : null;
  const displayHeightPx = exportHeightPx ? Math.round(exportHeightPx * scale) : null;

  return {
    dpi,
    finishWidthMm,
    finishHeightMm,
    exportWidthMm,
    exportHeightMm,
    bleedMm,
    safeMarginMm,
    includesBleed: false,
    trimXmm: Math.max(0, (exportWidthMm - finishWidthMm) / 2),
    trimYmm: Math.max(0, (exportHeightMm - finishHeightMm) / 2),
    exportWidthPx,
    exportHeightPx,
    safeMarginPx,
    displayWidthPx,
    displayHeightPx,
  };
}

function positiveNumber(...values) {
  for (const value of values) {
    const number = Number(value);

    if (Number.isFinite(number) && number > 0) {
      return number;
    }
  }

  return null;
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = event => {
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        dataURL: event.target.result,
      });
    };

    reader.onerror = () => reject(new Error('Bestand kon niet worden gelezen.'));
    reader.readAsDataURL(file);
  });
}

function renderStoredFile(file, fallbackLabel = 'Bestand opgeslagen') {
  if (!file?.dataURL) {
    return `<span class="form-hint">Geen bestand gekozen</span>`;
  }

  if (file.type?.startsWith('image/')) {
    return `
      <div class="file-preview-box">
        <img src="${file.dataURL}" alt="${escHtml(file.name || fallbackLabel)}">
      </div>
      <span class="form-hint">${escHtml(file.name || fallbackLabel)}</span>
    `;
  }

  return `<span class="form-hint">${escHtml(file.name || fallbackLabel)}</span>`;
}

function createUploadKey() {
  return `upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createBlockedZoneId() {
  return `zone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatEuro(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return `€ ${Number(value).toFixed(2).replace('.', ',')}`;
}

function formatMm(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return Number(value).toFixed(1).replace('.0', '').replace('.', ',');
}

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}