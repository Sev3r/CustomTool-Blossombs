/**
 * step5-review.js
 * Stap 5: Review & bestellen.
 * Gebruikt centrale Pricing helper.
 * Gebruikt gedeelde generateOffertePDF functie uit shared/js/offertePdf.js.
 */

function renderReviewPage() {
  const el = document.getElementById('page-review');
  const product = Session.getProduct();
  const options = Session.getOptions();
  const design = Session.getDesign();
  const wensen = Session.getWensen();
  const savedKlant = Session.getKlant() || {};

  if (!product || !options) {
    navigateTo('select');
    return;
  }

  const isLatOntwerpen = options.designChoice === 'laat-ontwerpen';
  const hasFileCheck = !isLatOntwerpen && options.addons?.includes('bestandscontrole');
  const persType = options.persType || null;
  const clipShape = persType?.clipShape || null;

  const designPreviewHTML = design?.dataURL ? `
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
                  color:var(--text-3);margin-bottom:8px">Uw ontwerp</div>
      <div style="border-radius:${clipShape?.startsWith('circle') ? '50%' : 'var(--radius-sm)'};
                  overflow:hidden;border:1px solid var(--cream-border);
                  display:inline-block;max-width:100%">
        <img src="${design.dataURL}" alt="Uw ontwerp"
             style="width:100%;max-width:280px;display:block;
                    ${clipShape ? `clip-path:${clipShape}` : ''}">
      </div>
    </div>
  ` : '';

  el.innerHTML = `
    <h1 class="page-title">Plaats uw bestelling</h1>
    <p class="page-subtitle">Controleer uw gegevens en bevestig uw bestelling</p>

    <div class="review-layout">
      <div class="review-section">
        <div class="review-section-title">Uw gegevens</div>
        <div class="review-section-body">
          <div class="review-field">
            <label>Bedrijfsnaam</label>
            <input type="text" id="r-company" value="${escHtml(savedKlant.companyName || '')}" placeholder="Bedrijfsnaam B.V.">
          </div>

          <div class="review-field">
            <label><span class="required-star">*</span> Voornaam</label>
            <input type="text" id="r-naam" value="${escHtml(savedKlant.naam || '')}" placeholder="Emma">
          </div>

          <div class="review-field">
            <label>Achternaam</label>
            <input type="text" id="r-achternaam" value="${escHtml(savedKlant.achternaam || '')}" placeholder="de Vries">
          </div>

          <div class="review-field">
            <label><span class="required-star">*</span> E-mailadres</label>
            <input type="email" id="r-email" value="${escHtml(savedKlant.email || '')}" placeholder="emma@bedrijf.nl">
          </div>

          <div class="review-field">
            <label>Telefoonnummer</label>
            <input type="tel" id="r-tel" value="${escHtml(savedKlant.telefoon || '')}" placeholder="+31 6 12345678">
          </div>

          <div class="review-field">
            <label><span class="required-star">*</span> Straat</label>
            <input type="text" id="r-straat" value="${escHtml(savedKlant.straat || '')}" placeholder="Hoofdstraat">
          </div>

          <div class="review-field">
            <label><span class="required-star">*</span> Huisnummer</label>
            <input type="text" id="r-huisnummer" value="${escHtml(savedKlant.huisnummer || '')}" placeholder="12A">
          </div>

          <div class="review-field">
            <label><span class="required-star">*</span> Postcode</label>
            <input type="text" id="r-postcode" value="${escHtml(savedKlant.postcode || '')}" placeholder="1234 AB">
          </div>

          <div class="review-field">
            <label><span class="required-star">*</span> Plaats</label>
            <input type="text" id="r-plaats" value="${escHtml(savedKlant.plaats || '')}" placeholder="Amsterdam">
          </div>

          <div class="review-field">
            <label>Land</label>
            <input type="text" id="r-land" value="${escHtml(savedKlant.land || 'Nederland')}" placeholder="Nederland">
          </div>

          <div class="review-field">
            <label><span class="required-star">*</span> Factuuradres</label>
            <input type="text" id="r-factuuradres" value="${escHtml(savedKlant.factuuradres || '')}" placeholder="Volledig factuuradres">
          </div>

          <div class="review-field">
            <label>KvK-nummer</label>
            <input type="text" id="r-kvk" value="${escHtml(savedKlant.kvk || '')}" placeholder="12345678">
          </div>

          <div class="review-field">
            <label>BTW-nummer</label>
            <input type="text" id="r-btw" value="${escHtml(savedKlant.btw || '')}" placeholder="NL123456789B01">
          </div>

          <div id="review-error" style="color:var(--danger);font-size:13px;display:none">
            Vul alle verplichte velden in.
          </div>
        </div>
      </div>

      <div>
        ${!isLatOntwerpen ? `
          <div class="review-section">
            <div class="review-section-title">Extra opties</div>
            <div class="review-section-body">
              <div class="option-toggle-row">
                <div class="toggle-text">
                  <strong>Bestandscontrole + € 15,00</strong>
                  <span>Onze medewerkers controleren uw bestand op resolutie, formaat en afloop vóór de druk.</span>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="r-bestandscontrole" ${hasFileCheck ? 'checked' : ''}>
                  <span class="toggle-track"></span>
                </label>
              </div>
            </div>
          </div>
        ` : ''}

        ${persType ? `
          <div class="review-section" style="margin-top:16px">
            <div class="review-section-title">Personalisatietype</div>
            <div class="review-section-body" style="font-size:13px;color:var(--text-2)">
              <span>${escHtml(persType.label)}</span>
              ${persType.width_mm ? `<span style="color:var(--text-3)">${persType.width_mm} × ${persType.height_mm} mm</span>` : ''}
            </div>
          </div>
        ` : ''}

        ${isLatOntwerpen && wensen ? `
          <div class="review-section" style="margin-top:16px">
            <div class="review-section-title">Uw wensen</div>
            <div class="review-section-body" style="font-size:13px;color:var(--text-2);gap:6px">
              ${wensen.tekst ? `<div><strong>Tekst:</strong> ${escHtml(wensen.tekst)}</div>` : ''}
              ${wensen.kleur ? `<div><strong>Kleur:</strong> ${escHtml(wensen.kleur)}</div>` : ''}
              ${wensen.stijl ? `<div><strong>Stijl:</strong> ${escHtml(wensen.stijl)}</div>` : ''}
              ${wensen.opmerkingen ? `<div><strong>Opmerkingen:</strong> ${escHtml(wensen.opmerkingen)}</div>` : ''}
              ${wensen.refFileName ? `<div><strong>Referentie:</strong> ${escHtml(wensen.refFileName)}</div>` : ''}
            </div>
          </div>
        ` : ''}
      </div>

      <div class="review-section">
        <div class="review-section-title">Uw bestelling</div>
        <div class="review-section-body">
          ${designPreviewHTML}

          ${!design?.dataURL ? `
            <div class="order-summary-product">
              ${product.imageProduct
        ? `<img src="${escHtml(product.imageProduct)}" alt="${escHtml(product.name)}">`
        : 'Product'}
            </div>
          ` : ''}

          <div class="summary-row">
            <span class="label">Product</span>
            <span>${escHtml(product.name)}</span>
          </div>

          ${persType ? `
            <div class="summary-row">
              <span class="label">Type</span>
              <span>${escHtml(persType.label)}</span>
            </div>
          ` : ''}

          <div class="summary-row">
            <span class="label">Aantal</span>
            <span>${options.quantity || '—'}</span>
          </div>

          <div class="summary-row">
            <span class="label">Stukprijs</span>
            <span id="summary-unit-price">—</span>
          </div>

          <div class="summary-row">
            <span class="label">Ontwerp service</span>
            <span>${isLatOntwerpen ? '+ € 75,00' : 'Eigen ontwerp'}</span>
          </div>

          <div class="summary-row" id="summary-bc" style="${hasFileCheck ? '' : 'display:none'}">
            <span class="label">Bestandscontrole</span>
            <span>+ € 15,00</span>
          </div>

          <div class="summary-row">
            <span class="label">Excl. BTW (21%)</span>
            <span id="summary-excl">—</span>
          </div>

          <div class="summary-row total">
            <span class="label">Totaal incl. BTW</span>
            <span id="summary-incl">—</span>
          </div>

          <button class="btn btn-outline" type="button" id="btn-review-pdf">
            Download offerte PDF
          </button>
        </div>
      </div>
    </div>

    <div class="flow-nav">
      <button class="btn btn-outline"
        type="button"
        onclick="navigateTo('${isLatOntwerpen ? 'wensen' : 'design'}')">← Terug</button>
      <button class="btn btn-green" type="button" id="btn-bestellen">Aanvraag versturen →</button>
    </div>
  `;

  updateSummaryPrice();

  document.getElementById('r-bestandscontrole')?.addEventListener('change', () => {
    updateSummaryPrice();

    const summaryBc = document.getElementById('summary-bc');

    if (summaryBc) {
      summaryBc.style.display = document.getElementById('r-bestandscontrole').checked ? '' : 'none';
    }
  });

  [
    'r-company',
    'r-naam',
    'r-achternaam',
    'r-email',
    'r-tel',
    'r-straat',
    'r-huisnummer',
    'r-postcode',
    'r-plaats',
    'r-land',
    'r-kvk',
    'r-btw',
    'r-factuuradres',
  ].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      Session.setKlant(collectKlant());
    });
  });

  document.getElementById('btn-review-pdf')?.addEventListener('click', () => {
    const klant = collectKlant();
    const previewOrder = buildOrder(product, options, design, wensen, klant, `CONCEPT-${Date.now()}`, 'concept');
    const pricing = getCurrentPricing(product, options);

    generateOffertePDF(previewOrder, product, pricing);
  });

  document.getElementById('btn-bestellen')?.addEventListener('click', () => {
    const klant = collectKlant();

    if (!klant.naam || !klant.email || !klant.straat || !klant.huisnummer || !klant.postcode || !klant.plaats || !klant.factuuradres) {
      document.getElementById('review-error').style.display = 'block';

      ['r-naam', 'r-email', 'r-straat', 'r-huisnummer', 'r-postcode', 'r-plaats', 'r-factuuradres'].forEach(id => {
        const field = document.getElementById(id);

        if (field) {
          field.classList.toggle('required-error', !field.value.trim());
        }
      });

      return;
    }

    Session.setKlant(klant);
    placeOrder(product, options, design, wensen, klant);
  });
}

function collectKlant() {
  const straat = document.getElementById('r-straat')?.value.trim() || '';
  const huisnummer = document.getElementById('r-huisnummer')?.value.trim() || '';
  const postcode = document.getElementById('r-postcode')?.value.trim() || '';
  const plaats = document.getElementById('r-plaats')?.value.trim() || '';
  const land = document.getElementById('r-land')?.value.trim() || '';
  const adres = [
    [straat, huisnummer].filter(Boolean).join(' '),
    [postcode, plaats].filter(Boolean).join(' '),
    land,
  ].filter(Boolean).join(', ');

  return {
    companyName: document.getElementById('r-company')?.value.trim() || '',
    naam: document.getElementById('r-naam')?.value.trim() || '',
    achternaam: document.getElementById('r-achternaam')?.value.trim() || '',
    email: document.getElementById('r-email')?.value.trim() || '',
    telefoon: document.getElementById('r-tel')?.value.trim() || '',
    straat,
    huisnummer,
    postcode,
    plaats,
    land,
    adres,
    factuuradres: document.getElementById('r-factuuradres')?.value.trim() || '',
    kvk: document.getElementById('r-kvk')?.value.trim() || '',
    btw: document.getElementById('r-btw')?.value.trim() || '',
  };
}

function getCurrentOptions(options) {
  const isLatOntwerpen = options.designChoice === 'laat-ontwerpen';

  if (isLatOntwerpen) {
    return {
      ...options,
      addons: (options.addons || []).filter(addon => addon !== 'bestandscontrole'),
    };
  }

  const hasFileCheck = document.getElementById('r-bestandscontrole')?.checked;

  return {
    ...options,
    addons: hasFileCheck
      ? [...new Set([...(options.addons || []), 'bestandscontrole'])]
      : (options.addons || []).filter(addon => addon !== 'bestandscontrole'),
  };
}

function getCurrentPricing(product, options) {
  const currentOptions = getCurrentOptions(options);
  return Pricing.calculateOrderPricing(product, currentOptions);
}

function updateSummaryPrice() {
  const product = Session.getProduct();
  const options = Session.getOptions();

  if (!product || !options) {
    return;
  }

  const pricing = getCurrentPricing(product, options);

  document.getElementById('summary-unit-price').textContent = pricing.unitPrice ? formatEuro(pricing.unitPrice) : '—';
  document.getElementById('summary-excl').textContent = formatEuro(pricing.totalExcl);
  document.getElementById('summary-incl').textContent = formatEuro(pricing.totalIncl);
}

function placeOrder(product, options, design, wensen, klant) {
  const orderNumber = `BLS-${Date.now()}`;
  const order = buildOrder(product, options, design, wensen, klant, orderNumber, null);
  const pricing = getCurrentPricing(product, options);

  if (typeof DS !== 'undefined') {
    DS.saveOrder(order);
  }

  renderConfirmPage(order, product, pricing);
}

function buildOrder(product, options, design, wensen, klant, orderNumber, forcedStatus) {
  const finalOptions = getCurrentOptions(options);
  const pricing = Pricing.calculateOrderPricing(product, finalOptions);
  const isLatOntwerpen = finalOptions.designChoice === 'laat-ontwerpen';
  const hasFileCheck = finalOptions.addons?.includes('bestandscontrole');
  const persType = getSelectedPersonalisationType(product, finalOptions);
  const printSpec = buildOrderPrintSpec(product, persType);
  const blockedZonesSnapshot = getBlockedZonesSnapshot(persType);
  const prepressWarnings = Array.isArray(design?.prepressWarnings) ? design.prepressWarnings : [];
  const uploadCheck = design?.uploadCheck || null;

  return {
    orderNumber,
    createdAt: new Date().toISOString(),
    companyName: klant.companyName || '',
    customerName: `${klant.naam || ''} ${klant.achternaam || ''}`.trim(),
    customerEmail: klant.email || '',
    deliveryAddress: klant.adres || '',
    billingAddress: klant.factuuradres || '',
    invoiceAddress: klant.factuuradres || '',
    addressStreet: klant.straat || '',
    addressHouseNumber: klant.huisnummer || '',
    addressPostalCode: klant.postcode || '',
    addressCity: klant.plaats || '',
    addressCountry: klant.land || '',
    telefoon: klant.telefoon || '',
    kvk: klant.kvk || '',
    vatNumber: klant.btw || '',
    productId: product.id,
    productName: product.name,
    persTypeId: persType?.id || null,
    persTypeLabel: persType?.label || null,
    persTypeDims: persType ? `${persType.width_mm}×${persType.height_mm}mm` : null,
    quantity: pricing.quantity,
    unitPrice: pricing.unitPrice,
    designFile: design?.fileName || '',
    designDataURL: design?.dataURL || '',
    designPdfDataURL: design?.pdfDataURL || (design?.dataURL?.startsWith('data:application/pdf') ? design.dataURL : ''),
    wensen: wensen || null,
    quoteAmount: pricing.totalIncl,
    workType: isLatOntwerpen ? 'ontwerp' : (hasFileCheck ? 'bestandscheck' : null),
    status: forcedStatus || 'offerte-aanvraag',
    confirmationSent: false,
    deliveryDate: '',
    shippingDate: '',
    officialOrderNumber: '',
    notes: wensen?.opmerkingen || '',
    addons: finalOptions.addons || [],
    printSpec,
    blockedZonesSnapshot,
    prepressWarnings,
    uploadCheck,
  };
}

function getSelectedPersonalisationType(product, options) {
  const sessionPersType = options?.persType || null;
  const persTypeId = options?.persTypeId || sessionPersType?.id || null;
  const productPersTypes = Array.isArray(product?.personalisatieTypes) ? product.personalisatieTypes : [];
  const productPersType = productPersTypes.find(type => type.id === persTypeId) || null;

  if (productPersType) {
    return productPersType;
  }

  if (sessionPersType) {
    return sessionPersType;
  }

  return productPersTypes.find(type => type.active !== false) || productPersTypes[0] || null;
}

function buildOrderPrintSpec(product, persType) {
  const spec = getNormalizedPrintSpec(product, persType);

  if (!spec) {
    return null;
  }

  const finishWidthMm = getPositiveNumber(spec.finishWidthMm, persType?.finish_width_mm, persType?.width_mm, product?.finish_width_mm, product?.width_mm);
  const finishHeightMm = getPositiveNumber(spec.finishHeightMm, persType?.finish_height_mm, persType?.height_mm, product?.finish_height_mm, product?.height_mm);
  const bleedMm = getPositiveNumber(spec.bleedMm, persType?.bleed_mm, product?.bleed_mm, 3);
  const exportWidthMm = getPositiveNumber(spec.exportWidthMm, persType?.export_width_mm, product?.export_width_mm, finishWidthMm ? finishWidthMm + bleedMm * 2 : null);
  const exportHeightMm = getPositiveNumber(spec.exportHeightMm, persType?.export_height_mm, product?.export_height_mm, finishHeightMm ? finishHeightMm + bleedMm * 2 : null);
  const safeMarginMm = getPositiveNumber(spec.safeMarginMm, persType?.safe_margin_mm, persType?.margin_mm, product?.safe_margin_mm, product?.margin_mm, 3);
  const trimXmm = getNumberOrNull(spec.trimXmm);
  const trimYmm = getNumberOrNull(spec.trimYmm);
  const trimRightMm = getNumberOrNull(spec.trimRightMm);
  const trimBottomMm = getNumberOrNull(spec.trimBottomMm);

  return {
    finishWidthMm,
    finishHeightMm,
    bleedMm,
    exportWidthMm,
    exportHeightMm,
    safeMarginMm,
    dpi: getPositiveNumber(spec.dpi, 300),
    minDpi: getPositiveNumber(spec.minDpi, 150),
    personalisationTypeId: persType?.id || null,
    personalisationTypeLabel: persType?.label || null,
    trimBox: {
      x: trimXmm,
      y: trimYmm,
      width: finishWidthMm,
      height: finishHeightMm,
      right: trimRightMm,
      bottom: trimBottomMm,
    },
    bleedBox: {
      x: 0,
      y: 0,
      width: exportWidthMm,
      height: exportHeightMm,
      right: exportWidthMm,
      bottom: exportHeightMm,
    },
  };
}

function getNormalizedPrintSpec(product, persType) {
  if (window.PrintSpecs?.normalizePrintSpec) {
    return PrintSpecs.normalizePrintSpec(persType || {}, product || {});
  }

  const bleedMm = getPositiveNumber(persType?.bleed_mm, product?.bleed_mm, 3) || 3;
  const finishWidthMm = getPositiveNumber(persType?.finish_width_mm, product?.finish_width_mm, persType?.width_mm, product?.width_mm, 100) || 100;
  const finishHeightMm = getPositiveNumber(persType?.finish_height_mm, product?.finish_height_mm, persType?.height_mm, product?.height_mm, 70) || 70;
  const exportWidthMm = getPositiveNumber(persType?.export_width_mm, product?.export_width_mm, finishWidthMm + bleedMm * 2) || finishWidthMm + bleedMm * 2;
  const exportHeightMm = getPositiveNumber(persType?.export_height_mm, product?.export_height_mm, finishHeightMm + bleedMm * 2) || finishHeightMm + bleedMm * 2;
  const safeMarginMm = getPositiveNumber(persType?.safe_margin_mm, persType?.margin_mm, product?.safe_margin_mm, product?.margin_mm, 3) || 3;
  const trimXmm = Math.max(0, (exportWidthMm - finishWidthMm) / 2);
  const trimYmm = Math.max(0, (exportHeightMm - finishHeightMm) / 2);

  return {
    dpi: 300,
    minDpi: 150,
    finishWidthMm,
    finishHeightMm,
    bleedMm,
    exportWidthMm,
    exportHeightMm,
    safeMarginMm,
    trimXmm,
    trimYmm,
    trimRightMm: trimXmm + finishWidthMm,
    trimBottomMm: trimYmm + finishHeightMm,
  };
}

function getBlockedZonesSnapshot(persType) {
  if (!Array.isArray(persType?.blockedZones)) {
    return [];
  }

  return persType.blockedZones
    .map(zone => sanitizeBlockedZone(zone))
    .filter(Boolean);
}

function sanitizeBlockedZone(zone) {
  if (!zone || typeof zone !== 'object') {
    return null;
  }

  const base = {
    id: zone.id || null,
    type: zone.type || null,
    label: zone.label || '',
    margin_mm: getNumberOrNull(zone.margin_mm) || 0,
  };

  if (zone.type === 'line') {
    return {
      ...base,
      type: 'line',
      x1_mm: getNumberOrNull(zone.x1_mm) || 0,
      y1_mm: getNumberOrNull(zone.y1_mm) || 0,
      x2_mm: getNumberOrNull(zone.x2_mm) || 0,
      y2_mm: getNumberOrNull(zone.y2_mm) || 0,
      line_width_mm: getPositiveNumber(zone.line_width_mm, 0.3) || 0.3,
    };
  }

  if (zone.type === 'rect') {
    return {
      ...base,
      type: 'rect',
      x_mm: getNumberOrNull(zone.x_mm) || 0,
      y_mm: getNumberOrNull(zone.y_mm) || 0,
      width_mm: getPositiveNumber(zone.width_mm) || 0,
      height_mm: getPositiveNumber(zone.height_mm) || 0,
    };
  }

  if (zone.type === 'circle') {
    return {
      ...base,
      type: 'circle',
      x_mm: getNumberOrNull(zone.x_mm) || 0,
      y_mm: getNumberOrNull(zone.y_mm) || 0,
      diameter_mm: getPositiveNumber(zone.diameter_mm) || 0,
    };
  }

  return null;
}

function getPositiveNumber(...values) {
  for (const value of values) {
    const number = Number(value);

    if (Number.isFinite(number) && number > 0) {
      return number;
    }
  }

  return null;
}

function getNumberOrNull(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function renderConfirmPage(order, product, pricing) {
  document.querySelectorAll('.flow-page').forEach(el => el.classList.remove('active'));

  const confirmEl = document.getElementById('page-confirm');
  confirmEl.classList.add('active');

  const progressWrap = document.querySelector('.progress-wrap');

  if (progressWrap) {
    progressWrap.style.display = 'none';
  }

  confirmEl.innerHTML = `
    <div class="confirm-page">
      <div class="confirm-icon">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="28" cy="28" r="26" stroke="#5C7A5C" stroke-width="2.5" fill="#EDF2ED"/>
          <path d="M16 28L23 35L40 18" stroke="#5C7A5C" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <div class="confirm-number">Uw aanvraagnummer</div>
      <div class="confirm-num-value">${escHtml(order.orderNumber)}</div>

      <p class="confirm-text">
        Bedankt. We hebben uw offerteaanvraag ontvangen.<br><br>
        Een van onze medewerkers neemt zo snel mogelijk contact op via
        <strong>${escHtml(order.customerEmail)}</strong> om uw bestelling te bevestigen.<br><br>
        <em style="color:var(--text-3)">Geschatte offerte: ${formatEuro(pricing.totalIncl)} incl. BTW</em>
      </p>

      <div style="margin-top:32px;padding:20px;background:var(--cream-dark);
                  border-radius:var(--radius-card);border:1px solid var(--cream-border)">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">Uw offerte</div>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:16px">
          Download uw offerte als PDF. U ontvangt ook een bevestiging per e-mail
          zodra onze medewerker uw bestelling heeft verwerkt.
        </p>
        <button class="btn btn-green" type="button" id="btn-download-pdf">Download offerte PDF</button>
      </div>

      <div style="margin-top:32px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a href="/" class="btn btn-outline">Terug naar de webshop</a>
        <button class="btn btn-outline" type="button" onclick="resetFlow()">Nieuwe bestelling plaatsen</button>
      </div>
    </div>
  `;

  document.getElementById('btn-download-pdf')?.addEventListener('click', () => {
    generateOffertePDF(order, product, pricing);
  });

  clearStoredDesignData();
  Session.clear();
}

function clearStoredDesignData() {
  Object.keys(localStorage)
    .filter(key => key.startsWith('cot_design_state'))
    .forEach(key => localStorage.removeItem(key));

  sessionStorage.removeItem('cot_session');
}

function startNieuweOrder() {
  clearStoredDesignData();

  const progressWrap = document.querySelector('.progress-wrap');

  if (progressWrap) {
    progressWrap.style.display = '';
  }

  navigateTo('select');
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

window.startNieuweOrder = startNieuweOrder;