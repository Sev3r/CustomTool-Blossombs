/**
 * step5-review.js
 * Stap 5: Review & Bestellen
 *
 * SHOPIFY INTEGRATIEPUNT:
 * Bij het plaatsen van een order:
 * 1. Maak een Draft Order aan via: POST /admin/api/draft_orders.json
 * 2. Of sla op als Cart met custom attributes via de Storefront API
 * 3. De orderbevestiging wordt handmatig verstuurd vanuit de admin omgeving
 *    (confirmationSent: false) — dit behoudt het persoonlijke klantcontact.
 */

function renderReviewPage() {
  const el      = document.getElementById('page-review');
  const product = Session.getProduct();
  const options = Session.getOptions();
  const design  = Session.getDesign();
  const wensen  = Session.getWensen();
  const savedKlant = Session.getKlant() || {};

  if (!product || !options) { navigateTo('select'); return; }

  const hasBestandscontrole = options.addons?.includes('bestandscontrole');
  const isLatOntwerpen      = options.designChoice === 'laat-ontwerpen';

  el.innerHTML = `
    <h1 class="page-title">Plaats uw bestelling</h1>
    <p class="page-subtitle">Controleer uw gegevens en bevestig uw bestelling</p>

    <div class="review-layout">

      <!-- LINKS: klantgegevens -->
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

      <!-- MIDDEN: extra opties -->
      <div>
        <div class="review-section">
          <div class="review-section-title">Extra opties</div>
          <div class="review-section-body">
            <div class="option-toggle-row">
              <div class="toggle-text">
                <strong>Bestandscontrole — + € 15,00</strong>
                <span>Onze medewerkers controleren uw aangeleverde bestand op resolutie, formaat en afloop vóór de druk.</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="r-bestandscontrole" ${hasBestandscontrole ? 'checked' : ''}>
                <span class="toggle-track"></span>
              </label>
            </div>
          </div>
        </div>

        ${isLatOntwerpen && wensen ? `
          <div class="review-section" style="margin-top:16px">
            <div class="review-section-title">Uw wensen</div>
            <div class="review-section-body" style="font-size:13px;color:var(--text-2)">
              ${wensen.tekst       ? `<div><strong>Tekst:</strong> ${escHtml(wensen.tekst)}</div>` : ''}
              ${wensen.kleur       ? `<div><strong>Kleur:</strong> ${escHtml(wensen.kleur)}</div>` : ''}
              ${wensen.stijl       ? `<div><strong>Stijl:</strong> ${escHtml(wensen.stijl)}</div>` : ''}
              ${wensen.opmerkingen ? `<div><strong>Opmerkingen:</strong> ${escHtml(wensen.opmerkingen)}</div>` : ''}
              ${wensen.refFileName ? `<div><strong>Referentie:</strong> 📎 ${escHtml(wensen.refFileName)}</div>` : ''}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- RECHTS: orderoverzicht -->
      <div class="review-section">
        <div class="review-section-title">Uw bestelling</div>
        <div class="review-section-body">
          <div class="order-summary-product">
            ${product.imageProduct
              ? `<img src="${product.imageProduct}" alt="${escHtml(product.name)}" onerror="this.style.display='none'">`
              : '📦'}
          </div>

          <div class="summary-row">
            <span class="label">Product</span>
            <span>${escHtml(product.name)}</span>
          </div>
          <div class="summary-row">
            <span class="label">Aantal stuks</span>
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
          <div class="summary-row" id="summary-bestandscontrole" style="${hasBestandscontrole ? '' : 'display:none'}">
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
        </div>
      </div>

    </div>

    <div class="flow-nav">
      <button class="btn btn-outline" onclick="navigateTo('${isLatOntwerpen ? 'wensen' : 'design'}')">← Terug</button>
      <button class="btn btn-green" id="btn-bestellen">Bestellen →</button>
    </div>
  `;

  // Bereken en toon prijs
  updateSummaryPrice();

  // Toggle bestandscontrole update prijs
  document.getElementById('r-bestandscontrole')?.addEventListener('change', () => {
    updateSummaryPrice();
    const row = document.getElementById('summary-bestandscontrole');
    row.style.display = document.getElementById('r-bestandscontrole').checked ? '' : 'none';
  });

  // Sla klantdata op bij typen
  ['r-naam','r-achternaam','r-email','r-tel','r-adres','r-kvk'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      Session.setKlant(collectKlant());
    });
  });

  // Bestellen
  document.getElementById('btn-bestellen')?.addEventListener('click', () => {
    const klant = collectKlant();
    if (!klant.naam || !klant.email || !klant.adres) {
      document.getElementById('review-error').style.display = 'block';
      // Markeer lege verplichte velden
      ['r-naam','r-email','r-adres'].forEach(id => {
        const el = document.getElementById(id);
        if (!el.value.trim()) el.classList.add('required-error');
        else el.classList.remove('required-error');
      });
      return;
    }

    Session.setKlant(klant);
    placeOrder(product, options, design, wensen, klant);
  });
}

function collectKlant() {
  return {
    naam:      document.getElementById('r-naam')?.value.trim()      || '',
    achternaam:document.getElementById('r-achternaam')?.value.trim() || '',
    email:     document.getElementById('r-email')?.value.trim()     || '',
    telefoon:  document.getElementById('r-tel')?.value.trim()       || '',
    adres:     document.getElementById('r-adres')?.value.trim()     || '',
    kvk:       document.getElementById('r-kvk')?.value.trim()       || '',
  };
}

function updateSummaryPrice() {
  const product = Session.getProduct();
  const options = Session.getOptions();
  if (!product || !options) return;

  const qty          = options.quantity || 0;
  const slab         = (product.priceSlabs || []).find(s => qty >= s.from && (s.to === null || qty <= s.to));
  const unitPrice    = slab ? slab.price : 0;
  const isLatOntwerpen   = options.designChoice === 'laat-ontwerpen';
  const hasBC        = document.getElementById('r-bestandscontrole')?.checked;

  const subtotal = (unitPrice * qty) + (isLatOntwerpen ? 75 : 0) + (hasBC ? 15 : 0);
  const exclBtw  = subtotal / 1.21;
  const inclBtw  = subtotal;

  document.getElementById('summary-unit-price').textContent = unitPrice ? formatEuro(unitPrice) : '—';
  document.getElementById('summary-excl').textContent       = formatEuro(exclBtw);
  document.getElementById('summary-incl').textContent       = formatEuro(inclBtw);
}

function placeOrder(product, options, design, wensen, klant) {
  const hasBC = document.getElementById('r-bestandscontrole')?.checked;
  const qty   = options.quantity || 0;
  const isLatOntwerpen = options.designChoice === 'laat-ontwerpen';

  const slab      = (product.priceSlabs || []).find(s => qty >= s.from && (s.to === null || qty <= s.to));
  const unitPrice = slab ? slab.price : 0;
  const total     = (unitPrice * qty) + (isLatOntwerpen ? 75 : 0) + (hasBC ? 15 : 0);

  const orderNumber = 'BLS-' + Date.now();

  const order = {
    // SHOPIFY INTEGRATIEPUNT: vervang DS.saveOrder() door een POST naar:
    // /admin/api/draft_orders.json of je eigen backend endpoint
    orderNumber,
    createdAt:         new Date().toISOString(),
    customerName:      `${klant.naam} ${klant.achternaam}`.trim(),
    customerEmail:     klant.email,
    deliveryAddress:   klant.adres,
    telefoon:          klant.telefoon,
    kvk:               klant.kvk,
    productId:         product.id,
    productName:       product.name,
    quantity:          qty,
    designFile:        design?.fileName || '',
    designDataURL:     design?.dataURL  || '',
    wensen:            wensen           || null,
    quoteAmount:       total,
    workType:          isLatOntwerpen ? 'ontwerp' : (hasBC ? 'bestandscheck' : null),
    status:            isLatOntwerpen ? 'wacht-op-ontwerp' : (hasBC ? 'wacht-op-bestandscheck' : 'wacht-op-goedkeuring'),
    confirmationSent:  false, // Handmatig verstuurd vanuit admin — behoud klantcontact
    deliveryDate:      '',
    notes:             wensen?.opmerkingen || '',
    addons:            options.addons || [],
  };

  // SHOPIFY INTEGRATIEPUNT: vervang door API call
  if (typeof DS !== 'undefined') DS.saveOrder(order);

  // Toon bevestigingspagina
  renderConfirmPage(order);
}

function renderConfirmPage(order) {
  // Verberg progress bar
  document.querySelector('.progress-wrap').style.display = 'none';

  // Toon bevestigingspagina
  document.querySelectorAll('.flow-page').forEach(el => el.classList.remove('active'));
  const confirmEl = document.getElementById('page-confirm');
  confirmEl.classList.add('active');

  confirmEl.innerHTML = `
    <div class="confirm-page">
      <div class="confirm-icon">🌸</div>
      <div class="confirm-number">Uw ordernummer</div>
      <div class="confirm-num-value">${order.orderNumber}</div>
      <p class="confirm-text">
        Bedankt voor uw bestelling! We hebben uw aanvraag ontvangen.<br><br>
        Een van onze medewerkers neemt zo snel mogelijk contact met u op via
        <strong>${escHtml(order.customerEmail)}</strong> om uw bestelling te bevestigen
        en een offerte te versturen.<br><br>
        <em style="color:var(--text-3)">Geschatte offerte: ${formatEuro(order.quoteAmount)} incl. BTW</em>
      </p>
      <div style="margin-top:40px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a href="/" class="btn btn-outline">← Terug naar de webshop</a>
        <button class="btn btn-green" onclick="startNieuweOrder()">Nieuwe bestelling plaatsen</button>
      </div>
    </div>
  `;

  // Wis sessie
  Session.clear();
}

function startNieuweOrder() {
  document.querySelector('.progress-wrap').style.display = '';
  navigateTo('select');
}

function formatEuro(n) {
  if (n === null || n === undefined) return '—';
  return '€ ' + parseFloat(n).toFixed(2).replace('.', ',');
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

window.startNieuweOrder = startNieuweOrder;
