/**
 * step5-review.js
 * Stap 5: Review & Bestellen
 * Punt 4: ontwerp-preview van sessie
 * Punt 5: offerte PDF download op bevestigingspagina
 */

function renderReviewPage() {
  const el = document.getElementById('page-review');
  const product = Session.getProduct();
  const options = Session.getOptions();
  const design = Session.getDesign();
  const wensen = Session.getWensen();
  const savedKlant = Session.getKlant() || {};
  if (!product || !options) { navigateTo('select'); return; }

  const hasBC = options.addons?.includes('bestandscontrole');
  const isLatOntwerpen = options.designChoice === 'laat-ontwerpen';
  const persType = options.persType || null;
  const clipShape = persType?.clipShape || null;

  // Punt 4: ontwerp-preview
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

      <!-- MIDDEN: extra opties + wensen samenvatting -->
      <div>
        <div class="review-section">
          <div class="review-section-title">Extra opties</div>
          <div class="review-section-body">
            <div class="option-toggle-row">
              <div class="toggle-text">
                <strong>Bestandscontrole — + € 15,00</strong>
                <span>Onze medewerkers controleren uw bestand op resolutie, formaat en afloop vóór de druk.</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="r-bestandscontrole" ${hasBC ? 'checked' : ''}>
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
            </div>
          </div>
        ` : ''}
      </div>

      <!-- RECHTS: orderoverzicht + ontwerp preview -->
      <div class="review-section">
        <div class="review-section-title">Uw bestelling</div>
        <div class="review-section-body">
          ${designPreviewHTML}

          ${!design?.dataURL ? `
            <div class="order-summary-product">
              ${product.imageProduct
        ? `<img src="${escHtml(product.imageProduct)}" alt="${escHtml(product.name)}">`
        : '📦'}
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
          <div class="summary-row" id="summary-bc" style="${hasBC ? '' : 'display:none'}">
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
      <button class="btn btn-outline"
        onclick="navigateTo('${isLatOntwerpen ? 'wensen' : 'design'}')">← Terug</button>
      <button class="btn btn-green" id="btn-bestellen">Bestellen →</button>
    </div>
  `;

  updateSummaryPrice();

  document.getElementById('r-bestandscontrole')?.addEventListener('change', () => {
    updateSummaryPrice();
    document.getElementById('summary-bc').style.display =
      document.getElementById('r-bestandscontrole').checked ? '' : 'none';
  });

  ['r-naam', 'r-achternaam', 'r-email', 'r-tel', 'r-adres', 'r-kvk'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => Session.setKlant(collectKlant()));
  });

  document.getElementById('btn-bestellen')?.addEventListener('click', () => {
    const klant = collectKlant();
    if (!klant.naam || !klant.email || !klant.adres) {
      document.getElementById('review-error').style.display = 'block';
      ['r-naam', 'r-email', 'r-adres'].forEach(id => {
        const f = document.getElementById(id);
        if (f) f.classList.toggle('required-error', !f.value.trim());
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

function updateSummaryPrice() {
  const product = Session.getProduct();
  const options = Session.getOptions();
  if (!product || !options) return;

  const qty = options.quantity || 0;
  const slab = (product.priceSlabs || []).find(s => qty >= s.from && (s.to === null || qty <= s.to));
  const unitPrice = slab ? slab.price : 0;
  const isLatOntwerpen = options.designChoice === 'laat-ontwerpen';
  const hasBC = document.getElementById('r-bestandscontrole')?.checked;
  const subtotal = (unitPrice * qty) + (isLatOntwerpen ? 75 : 0) + (hasBC ? 15 : 0);

  document.getElementById('summary-unit-price').textContent = unitPrice ? formatEuro(unitPrice) : '—';
  document.getElementById('summary-excl').textContent = formatEuro(subtotal / 1.21);
  document.getElementById('summary-incl').textContent = formatEuro(subtotal);
}

function placeOrder(product, options, design, wensen, klant) {
  const hasBC = document.getElementById('r-bestandscontrole')?.checked;
  const qty = options.quantity || 0;
  const isLatOntwerpen = options.designChoice === 'laat-ontwerpen';
  const slab = (product.priceSlabs || []).find(s => qty >= s.from && (s.to === null || qty <= s.to));
  const unitPrice = slab ? slab.price : 0;
  const total = (unitPrice * qty) + (isLatOntwerpen ? 75 : 0) + (hasBC ? 15 : 0);
  const orderNumber = 'BLS-' + Date.now();
  const persType = options.persType || null;

  const order = {
    orderNumber,
    createdAt: new Date().toISOString(),
    customerName: `${klant.naam} ${klant.achternaam}`.trim(),
    customerEmail: klant.email,
    deliveryAddress: klant.adres,
    telefoon: klant.telefoon,
    kvk: klant.kvk,
    productId: product.id,
    productName: product.name,
    persTypeId: persType?.id || null,
    persTypeLabel: persType?.label || null,
    persTypeDims: persType ? `${persType.width_mm}×${persType.height_mm}mm` : null,
    quantity: qty,
    designFile: design?.fileName || '',
    designDataURL: design?.dataURL || '',
    wensen: wensen || null,
    quoteAmount: total,
    workType: isLatOntwerpen ? 'ontwerp' : (hasBC ? 'bestandscheck' : null),
    status: isLatOntwerpen ? 'wacht-op-ontwerp' : (hasBC ? 'wacht-op-bestandscheck' : 'wacht-op-goedkeuring'),
    confirmationSent: false,
    deliveryDate: '',
    notes: wensen?.opmerkingen || '',
    addons: options.addons || [],
  };

  // SHOPIFY INTEGRATIEPUNT: vervang door API call
  if (typeof DS !== 'undefined') DS.saveOrder(order);

  renderConfirmPage(order, product, total, unitPrice);
}

// ─── BEVESTIGINGSPAGINA + PDF ─────────────────────────────────────────────────

function renderConfirmPage(order, product, total, unitPrice) {
  document.querySelector('.progress-wrap').style.display = 'none';
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
        Een van onze medewerkers neemt zo snel mogelijk contact op via
        <strong>${escHtml(order.customerEmail)}</strong> om uw bestelling te bevestigen.<br><br>
        <em style="color:var(--text-3)">Geschatte offerte: ${formatEuro(total)} incl. BTW</em>
      </p>

      <!-- Punt 5: PDF download -->
      <div style="margin-top:32px;padding:20px;background:var(--cream-dark);
                  border-radius:var(--radius-card);border:1px solid var(--cream-border)">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">📄 Uw offerte</div>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:16px">
          Download uw offerte als PDF. U ontvangt ook een bevestiging per e-mail
          zodra onze medewerker uw bestelling heeft verwerkt.
        </p>
        <button class="btn btn-green" id="btn-download-pdf">⬇ Download offerte (PDF)</button>
      </div>

      <div style="margin-top:32px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a href="/" class="btn btn-outline">← Terug naar de webshop</a>
        <button class="btn btn-outline" onclick="startNieuweOrder()">Nieuwe bestelling</button>
      </div>
    </div>
  `;

  document.getElementById('btn-download-pdf')?.addEventListener('click', () => {
    generateOffertePDF(order, product, total, unitPrice);
  });

  Session.clear();
}

// ─── PDF GENERATIE ────────────────────────────────────────────────────────────

async function generateOffertePDF(order, product, total, unitPrice) {
  if (!window.jspdf) {
    alert('jsPDF niet geladen. Voeg jspdf.umd.min.js toe aan index.html.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const margin = 20;
  const pageW = 210;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Header ─────────────────────────────────────────────────────────────────
  doc.setFillColor(92, 122, 92); // --green
  doc.rect(0, 0, pageW, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20); doc.setFont('helvetica', 'bold');
  doc.text('🌸 Blossombs', margin, 16);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('Offerte / Orderbevestiging', margin, 26);
  y = 50;

  // ── Ordernummer + datum ────────────────────────────────────────────────────
  doc.setTextColor(42, 42, 34);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(`Ordernummer: ${order.orderNumber}`, margin, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(107, 102, 96);
  doc.text(`Datum: ${new Date(order.createdAt).toLocaleDateString('nl-NL')}`, margin, y + 6);
  doc.text(`Status: Wacht op bevestiging`, margin, y + 12);
  y += 24;

  // ── Lijn ──────────────────────────────────────────────────────────────────
  doc.setDrawColor(221, 216, 204);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // ── Klantgegevens ─────────────────────────────────────────────────────────
  doc.setTextColor(168, 163, 155); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('KLANTGEGEVENS', margin, y);
  y += 6;

  const klantRows = [
    ['Naam', order.customerName],
    ['E-mail', order.customerEmail],
    ['Adres', order.deliveryAddress],
    ['Telefoon', order.telefoon || '—'],
    ['KvK', order.kvk || '—'],
  ];

  doc.setFontSize(10); doc.setTextColor(42, 42, 34);
  klantRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold'); doc.text(label + ':', margin, y);
    doc.setFont('helvetica', 'normal'); doc.text(String(value || '—'), margin + 30, y);
    y += 6;
  });
  y += 6;

  // ── Lijn ──────────────────────────────────────────────────────────────────
  doc.setDrawColor(221, 216, 204); doc.line(margin, y, pageW - margin, y); y += 10;

  // ── Productdetails ────────────────────────────────────────────────────────
  doc.setTextColor(168, 163, 155); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('ORDERDETAILS', margin, y); y += 6;

  const productRows = [
    ['Product', order.productName],
    ['Personalisatietype', order.persTypeLabel || '—'],
    ['Afmetingen', order.persTypeDims || '—'],
    ['Aantal', `${order.quantity} stuks`],
    ['Stukprijs', formatEuro(unitPrice)],
    ['Ontwerp service', order.workType === 'ontwerp' ? '+ € 75,00 (laat ons ontwerpen)' : 'Eigen ontwerp'],
    ...(order.addons?.includes('bestandscontrole') ? [['Bestandscontrole', '+ € 15,00']] : []),
  ];

  doc.setFontSize(10); doc.setTextColor(42, 42, 34);
  productRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold'); doc.text(label + ':', margin, y);
    doc.setFont('helvetica', 'normal'); doc.text(String(value || '—'), margin + 50, y);
    y += 6;
  });
  y += 6;

  // ── Prijsoverzicht ────────────────────────────────────────────────────────
  doc.setDrawColor(221, 216, 204); doc.line(margin, y, pageW - margin, y); y += 10;
  doc.setTextColor(168, 163, 155); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('PRIJSOVERZICHT', margin, y); y += 8;

  const exclBtw = total / 1.21;
  const btw = total - exclBtw;

  const prijsRows = [
    ['Subtotaal excl. BTW', formatEuro(exclBtw)],
    ['BTW (21%)', formatEuro(btw)],
  ];

  doc.setFontSize(10); doc.setTextColor(42, 42, 34);
  prijsRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal'); doc.text(label, margin, y);
    doc.text(value, pageW - margin, y, { align: 'right' });
    y += 6;
  });

  // Totaalregel
  y += 2;
  doc.setFillColor(237, 242, 237);
  doc.roundedRect(margin, y - 4, contentW, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(62, 90, 62);
  doc.text('Totaal incl. BTW', margin + 3, y + 3);
  doc.text(formatEuro(total), pageW - margin - 3, y + 3, { align: 'right' });
  y += 18;

  // ── Ontwerp preview ──────────────────────────────────────────────────────
  if (order.designDataURL && order.designDataURL.startsWith('data:image')) {
    doc.setDrawColor(221, 216, 204); doc.line(margin, y, pageW - margin, y); y += 10;
    doc.setTextColor(168, 163, 155); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('UW ONTWERP', margin, y); y += 6;

    try {
      const imgW = 60, imgH = 40;
      doc.addImage(order.designDataURL, 'PNG', margin, y, imgW, imgH);
      y += imgH + 8;
    } catch (e) {
      doc.setFontSize(9); doc.setTextColor(107, 102, 96);
      doc.text('(Preview niet beschikbaar)', margin, y); y += 8;
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFillColor(247, 244, 238);
  doc.rect(0, 280, pageW, 17, 'F');
  doc.setFontSize(8); doc.setTextColor(168, 163, 155); doc.setFont('helvetica', 'normal');
  doc.text('Blossombs — info@blossombs.nl — www.blossombs.nl', pageW / 2, 288, { align: 'center' });
  doc.text('Deze offerte is onder voorbehoud van definitieve bevestiging.', pageW / 2, 293, { align: 'center' });

  doc.save(`blossombs-offerte-${order.orderNumber}.pdf`);
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
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.startNieuweOrder = startNieuweOrder;