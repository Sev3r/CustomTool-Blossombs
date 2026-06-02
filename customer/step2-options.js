/**
 * step2-options.js
 * Stap 2: Productopties
 * Meerdere personalisatietypes per product via tab-selector.
 * Template-download komt automatisch overeen met gekozen personalisatie.
 * Kostenoverzicht gebruikt centrale Pricing helper.
 * Conceptofferte PDF gebruikt gedeelde generateOffertePDF functie.
 */

const FIXED_QUANTITIES = [50, 100, 250, 500, 1000];

function renderOptionsPage() {
  const el = document.getElementById('page-options');
  const product = Session.getProduct();
  const saved = Session.getOptions() || {};

  if (!product) {
    navigateTo('select');
    return;
  }

  const persTypes = getProductPersonalisationTypes(product);
  const activePersId = saved.persTypeId || persTypes[0]?.id || 'standaard';
  const activePers = persTypes.find(persType => persType.id === activePersId) || persTypes[0];
  const designChoice = saved.designChoice || 'laat-ontwerpen';
  const addons = Array.isArray(saved.addons) ? saved.addons : [];
  const quantity = saved.quantity || '';

  const previewSrc = activePers?.previewImage || product.imageProduct || '';
  const initialOptions = collectOptionsFromValues(product, activePers, quantity, designChoice, addons);

  el.innerHTML = `
    <h1 class="page-title">${escHtml(product.name)}</h1>

    <div class="options-layout">

      <div>
        <div class="product-preview-main" id="preview-main"
             style="${activePers?.clipShape ? 'overflow:hidden' : ''}">
          ${previewSrc
      ? `<img id="preview-main-img" src="${escHtml(previewSrc)}" alt="Preview"
                 style="${activePers?.clipShape ? `clip-path:${escHtml(activePers.clipShape)};width:100%;height:100%;object-fit:cover` : ''}">`
      : `<span class="product-card-placeholder">Product</span>`}
        </div>

        ${persTypes.length > 1 ? `
          <div class="pers-type-tabs" style="margin-top:12px">
            ${persTypes.map(persType => `
              <button class="pers-tab ${persType.id === activePersId ? 'active' : ''}"
                      type="button"
                      data-pers="${escHtml(persType.id)}">
                ${escHtml(persType.label)}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div>
        <div class="options-title">Aantallen &amp; prijzen</div>

        <table class="staffel-table">
          <thead>
            <tr>
              <th>Stuks</th>
              <th>Prijs / stuk</th>
            </tr>
          </thead>
          <tbody>
            ${FIXED_QUANTITIES.map(qty => {
        const price = getPriceForQty(product, qty);
        const isActive = parseInt(quantity, 10) === qty;

        return `
                <tr class="${isActive ? 'highlighted' : ''}" data-qty="${qty}">
                  <td>${qty}</td>
                  <td>${price !== null ? formatEuro(price) : '—'}</td>
                </tr>
              `;
      }).join('')}
          </tbody>
        </table>

        <div class="staffel-custom">
          <label for="qty-custom">Anders:</label>
          <input type="number"
                 id="qty-custom"
                 value="${!FIXED_QUANTITIES.includes(parseInt(quantity, 10)) && quantity ? escHtml(quantity) : ''}"
                 placeholder="stuks"
                 min="1">
          <label for="qty-custom">stuks</label>
        </div>

        ${activePers?.templatePdf?.dataURL ? `
          <div class="template-downloads">
            <button class="template-download-btn"
                    type="button"
                    id="btn-template-download">
              Download template voor ${escHtml(activePers.label)}
            </button>
          </div>
        ` : ''}
      </div>

      <div>
        <div class="options-title">Ontwerp opties</div>

        <div class="toggle-options">
          ${[
      { key: 'laat-ontwerpen', label: 'Laat ons ontwerpen', price: 75 },
      { key: 'eigen-ontwerp', label: 'Eigen ontwerp', price: 0 },
    ].map(choice => `
            <div class="toggle-option ${designChoice === choice.key ? 'active' : ''}"
                 data-choice="${choice.key}">
              <div class="toggle-option-left">
                <span class="toggle-option-label">${escHtml(choice.label)}</span>
                <span class="toggle-option-price">
                  ${choice.price > 0 ? `+ ${formatEuro(choice.price)}` : 'Inbegrepen'}
                </span>
              </div>
              <label class="toggle-switch" onclick="event.stopPropagation()">
                <input type="radio"
                       name="design-choice"
                       value="${choice.key}"
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
            <span class="toggle-option-price">+ ${formatEuro(15)} combineerbaar met eigen ontwerp</span>
          </div>
          <label class="toggle-switch" onclick="event.stopPropagation()">
            <input type="checkbox" ${addons.includes('bestandscontrole') ? 'checked' : ''}>
            <span class="toggle-track"></span>
          </label>
        </div>

        ${renderOptionsCostSummary(product, initialOptions)}

        <div id="options-error" style="color:var(--danger);font-size:13px;display:none;margin-top:8px">
          Kies een aantal om verder te gaan.
        </div>
      </div>
    </div>

    <div class="flow-nav">
      <button class="btn btn-outline" type="button" onclick="navigateTo('select')">← Terug</button>
      <button class="btn btn-green" type="button" id="btn-options-next">Verder →</button>
    </div>
  `;

  bindPersonalisationTabs(el, product, persTypes);
  bindQuantitySelection(el, product, persTypes);
  bindDesignChoiceSelection(el, product, persTypes);
  bindAddonSelection(el, product, persTypes);
  bindTemplateDownload(el, product, persTypes);
  bindOptionsPdfButton(el, product, persTypes);
  bindNextButton(el, product, persTypes);
}

function getProductPersonalisationTypes(product) {
  if (Array.isArray(product.personalisatieTypes) && product.personalisatieTypes.length > 0) {
    return product.personalisatieTypes;
  }

  return [{
    id: 'standaard',
    label: 'Standaard',
    previewImage: product.imagePersonalize1 || product.imageProduct || '',
    width_mm: product.width_mm || null,
    height_mm: product.height_mm || null,
    margin_mm: product.margin_mm || null,
    width_px: product.width_px || null,
    height_px: product.height_px || null,
    margin_px: product.margin_px || null,
    canvas_display_width: product.canvas_display_width || null,
    canvas_display_height: product.canvas_display_height || null,
    clipShape: null,
    templatePdf: null,
  }];
}

function bindPersonalisationTabs(el, product, persTypes) {
  el.querySelectorAll('.pers-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const persId = tab.dataset.pers;
      const newPers = persTypes.find(persType => persType.id === persId);

      if (!newPers) {
        return;
      }

      el.querySelectorAll('.pers-tab').forEach(button => button.classList.remove('active'));
      tab.classList.add('active');

      updatePreviewForPersonalisation(newPers);
      updateTemplateDownloadForPersonalisation(el, newPers);
      saveOptions(el, product, persTypes);
    });
  });
}

function updatePreviewForPersonalisation(persType) {
  const mainImg = document.getElementById('preview-main-img');
  const mainDiv = document.getElementById('preview-main');

  if (mainDiv) {
    mainDiv.style.overflow = persType.clipShape ? 'hidden' : '';
  }

  if (!mainImg) {
    return;
  }

  if (persType.previewImage) {
    mainImg.src = persType.previewImage;
  }

  if (persType.clipShape) {
    mainImg.style.clipPath = persType.clipShape;
    mainImg.style.width = '100%';
    mainImg.style.height = '100%';
    mainImg.style.objectFit = 'cover';
  } else {
    mainImg.style.clipPath = '';
    mainImg.style.width = '';
    mainImg.style.height = '';
    mainImg.style.objectFit = '';
  }
}

function updateTemplateDownloadForPersonalisation(el, persType) {
  const existing = el.querySelector('.template-downloads');

  if (existing) {
    existing.remove();
  }

  if (!persType?.templatePdf?.dataURL) {
    return;
  }

  const customQtyWrapper = el.querySelector('.staffel-custom');

  if (!customQtyWrapper) {
    return;
  }

  customQtyWrapper.insertAdjacentHTML('afterend', `
    <div class="template-downloads">
      <button class="template-download-btn"
              type="button"
              id="btn-template-download">
        Download template voor ${escHtml(persType.label)}
      </button>
    </div>
  `);

  bindTemplateDownload(el, Session.getProduct(), getProductPersonalisationTypes(Session.getProduct()));
}

function bindQuantitySelection(el, product, persTypes) {
  el.querySelectorAll('.staffel-table tbody tr[data-qty]').forEach(row => {
    row.addEventListener('click', () => {
      el.querySelectorAll('.staffel-table tbody tr').forEach(tableRow => {
        tableRow.classList.remove('highlighted');
      });

      row.classList.add('highlighted');

      const customInput = document.getElementById('qty-custom');

      if (customInput) {
        customInput.value = '';
      }

      saveOptions(el, product, persTypes);
    });
  });

  document.getElementById('qty-custom')?.addEventListener('input', () => {
    el.querySelectorAll('.staffel-table tbody tr').forEach(row => {
      row.classList.remove('highlighted');
    });

    saveOptions(el, product, persTypes);
  });
}

function bindDesignChoiceSelection(el, product, persTypes) {
  el.querySelectorAll('.toggle-option[data-choice]').forEach(option => {
    option.addEventListener('click', () => {
      el.querySelectorAll('.toggle-option[data-choice]').forEach(choice => {
        choice.classList.remove('active');

        const input = choice.querySelector('input');

        if (input) {
          input.checked = false;
        }
      });

      option.classList.add('active');

      const input = option.querySelector('input');

      if (input) {
        input.checked = true;
      }

      saveOptions(el, product, persTypes);
    });
  });
}

function bindAddonSelection(el, product, persTypes) {
  el.querySelectorAll('.toggle-option[data-addon]').forEach(option => {
    option.addEventListener('click', () => {
      option.classList.toggle('active');

      const input = option.querySelector('input');

      if (input) {
        input.checked = option.classList.contains('active');
      }

      saveOptions(el, product, persTypes);
    });
  });
}

function bindTemplateDownload(el, product, persTypes) {
  document.getElementById('btn-template-download')?.addEventListener('click', () => {
    const options = collectOptions(el, product, persTypes);
    const template = options.persType?.templatePdf;

    if (!template?.dataURL) {
      return;
    }

    downloadDataFile(template.dataURL, template.name || `template-${options.persTypeId}.pdf`);
  });
}

function bindOptionsPdfButton(el, product, persTypes) {
  document.getElementById('btn-options-pdf')?.addEventListener('click', () => {
    const options = collectOptions(el, product, persTypes);

    if (!options.quantity) {
      const error = document.getElementById('options-error');

      if (error) {
        error.style.display = 'block';
      }

      return;
    }

    Session.setOptions(options);

    const pricing = Pricing.calculateOrderPricing(product, options);
    const persType = options.persType || null;

    const conceptOrder = {
      orderNumber: `CONCEPT-${Date.now()}`,
      createdAt: new Date().toISOString(),
      customerName: '',
      customerEmail: '',
      deliveryAddress: '',
      telefoon: '',
      kvk: '',
      productId: product.id,
      productName: product.name,
      persTypeId: persType?.id || null,
      persTypeLabel: persType?.label || null,
      persTypeDims: persType ? `${persType.width_mm}×${persType.height_mm}mm` : null,
      quantity: pricing.quantity,
      unitPrice: pricing.unitPrice,
      designFile: '',
      designDataURL: '',
      wensen: null,
      quoteAmount: pricing.totalIncl,
      workType: options.designChoice === 'laat-ontwerpen' ? 'ontwerp' : null,
      status: 'concept',
      confirmationSent: false,
      deliveryDate: '',
      notes: '',
      addons: options.addons || [],
    };

    if (typeof generateOffertePDF === 'function') {
      generateOffertePDF(conceptOrder, product, pricing);
    }
  });
}

function bindNextButton(el, product, persTypes) {
  document.getElementById('btn-options-next')?.addEventListener('click', () => {
    const options = collectOptions(el, product, persTypes);

    if (!options.quantity) {
      const error = document.getElementById('options-error');

      if (error) {
        error.style.display = 'block';
      }

      return;
    }

    const error = document.getElementById('options-error');

    if (error) {
      error.style.display = 'none';
    }

    Session.setOptions(options);
    navigateTo(options.designChoice === 'laat-ontwerpen' ? 'wensen' : 'design');
  });
}

function collectOptions(el, product, persTypes) {
  const selectedRow = el.querySelector('.staffel-table tbody tr.highlighted');
  const customQty = document.getElementById('qty-custom')?.value;
  const quantity = selectedRow
    ? parseInt(selectedRow.dataset.qty, 10)
    : customQty
      ? parseInt(customQty, 10)
      : null;

  const designChoice = el.querySelector('input[name="design-choice"]:checked')?.value || 'laat-ontwerpen';

  const addons = [];
  el.querySelectorAll('.toggle-option[data-addon].active').forEach(option => {
    addons.push(option.dataset.addon);
  });

  const activeTab = el.querySelector('.pers-tab.active');
  const persTypeId = activeTab ? activeTab.dataset.pers : (persTypes[0]?.id || 'standaard');
  const persType = persTypes.find(item => item.id === persTypeId) || persTypes[0];

  return {
    quantity,
    designChoice,
    addons,
    persTypeId,
    persType,
    productId: product.id,
  };
}

function collectOptionsFromValues(product, activePers, quantity, designChoice, addons) {
  return {
    quantity: quantity ? parseInt(quantity, 10) : null,
    designChoice,
    addons,
    persTypeId: activePers?.id || 'standaard',
    persType: activePers,
    productId: product.id,
  };
}

function saveOptions(el, product, persTypes) {
  const options = collectOptions(el, product, persTypes);
  Session.setOptions(options);
  refreshOptionsCostSummary(el, product, persTypes);
}

function renderOptionsCostSummary(product, options) {
  const pricing = Pricing.calculateOrderPricing(product, options);

  return `
    <div class="cost-summary" id="options-cost-summary">
      <div class="cost-summary-title">Kostenoverzicht</div>
      <div class="cost-summary-body">
        <div class="cost-row">
          <span>Aantal</span>
          <span>${pricing.quantity || '—'}</span>
        </div>
        <div class="cost-row">
          <span>Stukprijs</span>
          <span>${pricing.unitPrice ? formatEuro(pricing.unitPrice) : '—'}</span>
        </div>
        <div class="cost-row">
          <span>Ontwerp service</span>
          <span>${pricing.designService ? formatEuro(pricing.designService) : '€ 0,00'}</span>
        </div>
        <div class="cost-row">
          <span>Bestandscontrole</span>
          <span>${pricing.fileCheck ? formatEuro(pricing.fileCheck) : '€ 0,00'}</span>
        </div>
        <div class="cost-row">
          <span>Excl. BTW</span>
          <span>${pricing.totalIncl ? formatEuro(pricing.totalExcl) : '—'}</span>
        </div>
        <div class="cost-row total">
          <span>Totaal incl. BTW</span>
          <span>${pricing.totalIncl ? formatEuro(pricing.totalIncl) : '—'}</span>
        </div>
        <button class="btn btn-outline" type="button" id="btn-options-pdf" ${!pricing.quantity ? 'disabled' : ''}>
          Download offerte PDF
        </button>
      </div>
    </div>
  `;
}

function refreshOptionsCostSummary(el, product, persTypes) {
  const summary = document.getElementById('options-cost-summary');

  if (!summary) {
    return;
  }

  const options = collectOptions(el, product, persTypes);
  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderOptionsCostSummary(product, options);
  summary.replaceWith(wrapper.firstElementChild);

  bindOptionsPdfButton(el, product, persTypes);
}

function getPriceForQty(product, qty) {
  if (window.Pricing?.getPriceForQty) {
    return Pricing.getPriceForQty(product, qty);
  }

  if (!product.priceSlabs) {
    return null;
  }

  const slab = product.priceSlabs.find(priceSlab =>
    qty >= priceSlab.from && (priceSlab.to === null || qty <= priceSlab.to)
  );

  return slab ? slab.price : null;
}

function downloadDataFile(dataURL, fileName) {
  if (!dataURL) {
    return;
  }

  const link = document.createElement('a');
  link.href = dataURL;
  link.download = fileName || 'template.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function formatEuro(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return `€ ${Number(value).toFixed(2).replace('.', ',')}`;
}

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}