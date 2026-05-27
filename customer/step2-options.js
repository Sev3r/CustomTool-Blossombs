/**
 * step2-options.js
 * Stap 2: Productopties
 * Punt 2: meerdere personalisatietypes per product via tab-selector
 * Punt 3: clipShape property doorgegeven aan sessie voor canvas clip-path
 */

const FIXED_QUANTITIES = [50, 100, 250, 500, 1000];

function renderOptionsPage() {
  const el = document.getElementById('page-options');
  const product = Session.getProduct();
  const saved = Session.getOptions() || {};
  if (!product) { navigateTo('select'); return; }

  // Personalisatietypes — fallback voor oude productstructuur
  const persTypes = product.personalisatieTypes || [{
    id: 'standaard', label: 'Standaard',
    previewImage: product.imagePersonalize1 || product.imageProduct || '',
    width_mm: product.width_mm, height_mm: product.height_mm,
    margin_mm: product.margin_mm, width_px: product.width_px,
    height_px: product.height_px, margin_px: product.margin_px,
    canvas_display_width: product.canvas_display_width,
    canvas_display_height: product.canvas_display_height,
    clipShape: null,
  }];

  const activePersId = saved.persTypeId || persTypes[0].id;
  const activePers = persTypes.find(p => p.id === activePersId) || persTypes[0];
  const designChoice = saved.designChoice || 'laat-ontwerpen';
  const addons = saved.addons || [];
  const quantity = saved.quantity || '';

  // Gebruik previewImage van het actieve type, anders productafbeelding
  const previewSrc = activePers.previewImage || product.imageProduct || '';

  el.innerHTML = `
    <h1 class="page-title">${escHtml(product.name)}</h1>

    <div class="options-layout">

      <!-- LINKS: preview -->
      <div>
        <div class="product-preview-main" id="preview-main"
             style="${activePers.clipShape ? `overflow:hidden` : ''}">
          ${previewSrc
      ? `<img id="preview-main-img" src="${escHtml(previewSrc)}" alt="Preview"
                 style="${activePers.clipShape ? `clip-path:${activePers.clipShape};width:100%;height:100%;object-fit:cover` : ''}">`
      : `<span style="font-size:64px">📦</span>`}
        </div>

        ${persTypes.length > 1 ? `
          <div class="pers-type-tabs" style="margin-top:12px">
            ${persTypes.map(pt => `
              <button class="pers-tab ${pt.id === activePersId ? 'active' : ''}"
                      data-pers="${pt.id}">${escHtml(pt.label)}</button>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <!-- MIDDEN: staffel -->
      <div>
        <div class="options-title">Aantallen &amp; Prijzen</div>
        <table class="staffel-table">
          <thead><tr><th>Stuks</th><th>Prijs / stuk</th></tr></thead>
          <tbody>
            ${FIXED_QUANTITIES.map(qty => {
        const price = getPriceForQty(product, qty);
        const isActive = parseInt(quantity) === qty;
        return `<tr class="${isActive ? 'highlighted' : ''}" data-qty="${qty}">
                <td>${qty}</td><td>${price !== null ? formatEuro(price) : '—'}</td>
              </tr>`;
      }).join('')}
          </tbody>
        </table>
        <div class="staffel-custom">
          <label>Anders:</label>
          <input type="number" id="qty-custom"
            value="${!FIXED_QUANTITIES.includes(parseInt(quantity)) && quantity ? quantity : ''}"
            placeholder="stuks" min="1">
          <label>stuks</label>
        </div>
        ${(product.templates || []).length > 0 ? `
          <div class="template-links" style="margin-top:20px">
            ${product.templates.map(t => `
              <a class="template-link" href="#" onclick="return false">📄 ${escHtml(t)}</a>
            `).join('')}
            <a class="template-link" href="#" onclick="return false">📋 Aanleverinformatie</a>
          </div>
        ` : ''}
        <a class="template-link" href="https://www.canva.com" target="_blank"
           style="margin-top:16px;display:inline-flex">
          🎨 Gratis ontwerpen met Canva
        </a>
      </div>

      <!-- RECHTS: ontwerp keuze -->
      <div>
        <div class="options-title">Ontwerp opties</div>
        <div class="toggle-options">
          ${[
      { key: 'laat-ontwerpen', label: 'Laat ons ontwerpen', price: 75, addon: false },
      { key: 'eigen-ontwerp', label: 'Eigen ontwerp', price: 0, addon: false },
    ].map(choice => `
            <div class="toggle-option ${designChoice === choice.key ? 'active' : ''}"
                 data-choice="${choice.key}">
              <div class="toggle-option-left">
                <span class="toggle-option-label">${choice.label}</span>
                <span class="toggle-option-price">${choice.price > 0 ? `+ ${formatEuro(choice.price)}` : 'Inbegrepen'}</span>
              </div>
              <label class="toggle-switch" onclick="event.stopPropagation()">
                <input type="radio" name="design-choice" value="${choice.key}"
                       ${designChoice === choice.key ? 'checked' : ''}>
                <span class="toggle-track"></span>
              </label>
            </div>
          `).join('')}
        </div>

        <div class="toggle-option addon ${addons.includes('bestandscontrole') ? 'active' : ''}"
             data-addon="bestandscontrole">
          <div class="toggle-option-left">
            <span class="toggle-option-label">Bestandscontrole</span>
            <span class="toggle-option-price">+ ${formatEuro(15)} — combineerbaar met eigen ontwerp</span>
          </div>
          <label class="toggle-switch" onclick="event.stopPropagation()">
            <input type="checkbox" ${addons.includes('bestandscontrole') ? 'checked' : ''}>
            <span class="toggle-track"></span>
          </label>
        </div>

        <div id="options-error" style="color:var(--danger);font-size:13px;display:none;margin-top:8px">
          Kies een aantal om verder te gaan.
        </div>
      </div>
    </div>

    <div class="flow-nav">
      <button class="btn btn-outline" onclick="navigateTo('select')">← Terug</button>
      <button class="btn btn-green" id="btn-options-next">Verder →</button>
    </div>
  `;

  // Personalisatietype tabs
  el.querySelectorAll('.pers-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const persId = tab.dataset.pers;
      const newPers = persTypes.find(p => p.id === persId);
      if (!newPers) return;

      el.querySelectorAll('.pers-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update preview
      const mainImg = document.getElementById('preview-main-img');
      const mainDiv = document.getElementById('preview-main');
      if (mainImg && newPers.previewImage) {
        mainImg.src = newPers.previewImage;
        if (newPers.clipShape) {
          mainImg.style.clipPath = newPers.clipShape;
          mainImg.style.width = '100%';
          mainImg.style.height = '100%';
          mainImg.style.objectFit = 'cover';
        } else {
          mainImg.style.clipPath = '';
        }
      }
      if (mainDiv) mainDiv.style.overflow = newPers.clipShape ? 'hidden' : '';

      saveOptions(el, product, persTypes);
    });
  });

  // Staffelrijen
  el.querySelectorAll('.staffel-table tbody tr[data-qty]').forEach(row => {
    row.addEventListener('click', () => {
      el.querySelectorAll('.staffel-table tbody tr').forEach(r => r.classList.remove('highlighted'));
      row.classList.add('highlighted');
      document.getElementById('qty-custom').value = '';
      saveOptions(el, product, persTypes);
    });
  });

  document.getElementById('qty-custom')?.addEventListener('input', () => {
    el.querySelectorAll('.staffel-table tbody tr').forEach(r => r.classList.remove('highlighted'));
    saveOptions(el, product, persTypes);
  });

  // Design choice
  el.querySelectorAll('.toggle-option[data-choice]').forEach(opt => {
    opt.addEventListener('click', () => {
      el.querySelectorAll('.toggle-option[data-choice]').forEach(o => {
        o.classList.remove('active');
        o.querySelector('input').checked = false;
      });
      opt.classList.add('active');
      opt.querySelector('input').checked = true;
      saveOptions(el, product, persTypes);
    });
  });

  // Addon
  el.querySelectorAll('.toggle-option[data-addon]').forEach(opt => {
    opt.addEventListener('click', () => {
      opt.classList.toggle('active');
      opt.querySelector('input').checked = opt.classList.contains('active');
      saveOptions(el, product, persTypes);
    });
  });

  // Verder
  document.getElementById('btn-options-next')?.addEventListener('click', () => {
    const opts = collectOptions(el, product, persTypes);
    if (!opts.quantity) {
      document.getElementById('options-error').style.display = 'block';
      return;
    }
    document.getElementById('options-error').style.display = 'none';
    Session.setOptions(opts);
    navigateTo(opts.designChoice === 'laat-ontwerpen' ? 'wensen' : 'design');
  });
}

function collectOptions(el, product, persTypes) {
  const selectedRow = el.querySelector('.staffel-table tbody tr.highlighted');
  const customQty = document.getElementById('qty-custom')?.value;
  const quantity = selectedRow ? parseInt(selectedRow.dataset.qty) : (customQty ? parseInt(customQty) : null);
  const designChoice = el.querySelector('input[name="design-choice"]:checked')?.value || 'laat-ontwerpen';
  const addons = [];
  el.querySelectorAll('.toggle-option[data-addon].active').forEach(o => addons.push(o.dataset.addon));
  const activeTab = el.querySelector('.pers-tab.active');
  const persTypeId = activeTab ? activeTab.dataset.pers : (persTypes[0]?.id || 'standaard');
  const persType = persTypes.find(p => p.id === persTypeId) || persTypes[0];

  return { quantity, designChoice, addons, persTypeId, persType, productId: product.id };
}

function saveOptions(el, product, persTypes) {
  const opts = collectOptions(el, product, persTypes);
  Session.setOptions(opts);
}

function getPriceForQty(product, qty) {
  if (!product.priceSlabs) return null;
  const slab = product.priceSlabs.find(s => qty >= s.from && (s.to === null || qty <= s.to));
  return slab ? slab.price : null;
}

function formatEuro(n) {
  if (n === null || n === undefined) return '—';
  return '€ ' + parseFloat(n).toFixed(2).replace('.', ',');
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}