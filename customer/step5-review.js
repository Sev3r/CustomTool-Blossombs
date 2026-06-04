/**
 * step5-review.js
 * Stap 5: Review & bestellen.
 * Gebruikt centrale Pricing helper.
 * Gebruikt gedeelde generateOffertePDF functie uit shared/js/offertePdf.js.
 * Slaat drukklare ontwerp PDF op als designPdfDataURL.
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

  const hasFileCheck = options.addons?.includes('bestandscontrole');
  const isLatOntwerpen = options.designChoice === 'laat-ontwerpen';
  const persType = options.persType || null;
  const clipShape = persType?.clipShape || null;

  const designPreviewHTML = design?.dataURL && design.dataURL.startsWith('data:image') ? `
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

  const uploadedPdfHTML = design?.dataURL && design.dataURL.startsWith('data:application/pdf') ? `
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
                  color:var(--text-3);margin-bottom:8px">Uw bestand</div>
      <div style="font-size:13px;color:var(--text-2);padding:12px;border:1px solid var(--cream-border);
                  border-radius:var(--radius-sm);background:var(--cream-dark)">
        ${escHtml(design.fileName || 'PDF bestand geüpload')}
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
            <label><span class="required-star">*</span> Leveradres</label>
            <input type="text" id="r-adres" value="${escHtml(savedKlant.adres || '')}" placeholder="Straat 1, 1234 AB Stad">
          </div>

          <div class="review-field">
            <label>KvK-nummer</label>
            <input type="text" id="r-kvk" value="${escHtml(savedKlant.kvk || '')}" placeholder="12345678">
          </div>

          <div id="review-error" style="color:var(--danger);font-size:13px;display:none">
            Vul alle verplichte velden in.
          </div>
        </div>
      </div>

      <div>
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
          ${uploadedPdfHTML}

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
      <button class="btn btn-green" type="button" id="btn-bestellen">Bestellen →</button>
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

  ['r-naam', 'r-achternaam', 'r-email', 'r-tel', 'r-adres', 'r-kvk'].forEach(id => {
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

    if (!klant.naam || !klant.email || !klant.adres) {
      document.getElementById('review-error').style.display = 'block';

      ['r-naam', 'r-email', 'r-adres'].forEach(id => {
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
  return {
    naam: document.getElementById('r-naam')?.value.trim() || '',
    achternaam: document.getElementById('r-achternaam')?.value.trim() || '',
    email: document.getElementById('r-email')?.value.trim() || '',
    telefoon: document.getElementById('r-tel')?.value.trim() || '',
    adres: document.getElementById('r-adres')?.value.trim() || '',
    kvk: document.getElementById('r-kvk')?.value.trim() || '',
  };
}

function getCurrentOptions(options) {
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
  const persType = finalOptions.persType || null;

  const uploadedDesignIsPdf = design?.dataURL?.startsWith('data:application/pdf');
  const designPdfDataURL = design?.pdfDataURL || (uploadedDesignIsPdf ? design.dataURL : '');

  return {
    orderNumber,
    createdAt: new Date().toISOString(),
    customerName: `${klant.naam || ''} ${klant.achternaam || ''}`.trim(),
    customerEmail: klant.email || '',
    deliveryAddress: klant.adres || '',
    telefoon: klant.telefoon || '',
    kvk: klant.kvk || '',
    productId: product.id,
    productName: product.name,
    persTypeId: persType?.id || null,
    persTypeLabel: persType?.label || null,
    persTypeDims: persType ? `${persType.width_mm}×${persType.height_mm}mm` : null,
    quantity: pricing.quantity,
    unitPrice: pricing.unitPrice,
    designFile: design?.fileName || '',
    designDataURL: uploadedDesignIsPdf ? '' : (design?.dataURL || ''),
    designPdfDataURL,
    wensen: wensen || null,
    quoteAmount: pricing.totalIncl,
    workType: isLatOntwerpen ? 'ontwerp' : (hasFileCheck ? 'bestandscheck' : null),
    status: forcedStatus || (isLatOntwerpen ? 'wacht-op-ontwerp' : (hasFileCheck ? 'wacht-op-bestandscheck' : 'wacht-op-goedkeuring')),
    confirmationSent: false,
    deliveryDate: '',
    notes: wensen?.opmerkingen || '',
    addons: finalOptions.addons || [],
  };
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

      <div class="confirm-number">Uw ordernummer</div>
      <div class="confirm-num-value">${escHtml(order.orderNumber)}</div>

      <p class="confirm-text">
        Bedankt voor uw bestelling. We hebben uw aanvraag ontvangen.<br><br>
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

function startNieuweOrder() {
  clearStoredDesignData();

  const progressWrap = document.querySelector('.progress-wrap');

  if (progressWrap) {
    progressWrap.style.display = '';
  }

  navigateTo('select');
}

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function clearStoredDesignData() {
  Object.keys(localStorage)
    .filter(key => key.startsWith('cot_design_state'))
    .forEach(key => localStorage.removeItem(key));

  sessionStorage.removeItem('cot_session');
}

window.startNieuweOrder = startNieuweOrder;