/**
 * work.js
 * Pagina: Werkvoorraad
 * Bestandscheck bevat downloadfunctie voor ontwerpbestand.
 * Ondersteunt nieuwe offerte/order statussen en verzenddatum met backward compatible fallback op deliveryDate.
 */

let workFilter = 'open';
let workTypeFilter = 'all';
let workSort = 'shipDate-asc';

const WORK_OPEN_STATUSES = [
  'offerte-aanvraag',
  'offerte-verstuurd',
  'wacht-op-klantgoedkeuring',
  'wacht-op-ontwerp',
  'wacht-op-bestandscheck',
  'wacht-op-interne-controle',
  'wacht-op-goedkeuring',
  'akkoord',
  'in-productie',
];

const WORK_DONE_STATUSES = [
  'verzonden',
  'afgerond',
];

function renderWorkPage() {
  const el = document.getElementById('page-work');

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Werkvoorraad</h1>
        <p>Orders waarvoor een medewerker actie moet ondernemen</p>
      </div>
    </div>

    <div class="filter-bar" style="flex-wrap:wrap;gap:8px">
      <div class="filter-group">
        <button class="filter-pill ${workFilter === 'open' ? 'active' : ''}" type="button" data-status="open">
          Openstaand
        </button>
        <button class="filter-pill ${workFilter === 'done' ? 'active' : ''}" type="button" data-status="done">
          Afgehandeld
        </button>
        <button class="filter-pill ${workFilter === 'all' ? 'active' : ''}" type="button" data-status="all">
          Alles
        </button>
      </div>

      <select class="filter-select" id="work-type-filter">
        <option value="all">Alle werktypes</option>
        <option value="ontwerp">Ontwerp nodig</option>
        <option value="bestandscheck">Bestandscheck</option>
      </select>

      <select class="filter-select" id="work-sort">
        <option value="shipDate-asc">Verzenddatum vroegst eerst</option>
        <option value="shipDate-desc">Verzenddatum laatste eerst</option>
        <option value="createdAt-asc">Aanvraagdatum oudst eerst</option>
        <option value="createdAt-desc">Aanvraagdatum nieuwst eerst</option>
      </select>
    </div>

    <div class="work-grid" id="work-grid"></div>
  `;

  document.getElementById('work-type-filter').value = workTypeFilter;
  document.getElementById('work-sort').value = workSort;

  el.querySelectorAll('.filter-pill[data-status]').forEach(button => {
    button.addEventListener('click', () => {
      workFilter = button.dataset.status;

      el.querySelectorAll('.filter-pill[data-status]').forEach(item => item.classList.remove('active'));
      button.classList.add('active');

      renderWorkGrid();
    });
  });

  document.getElementById('work-type-filter').addEventListener('change', event => {
    workTypeFilter = event.target.value;
    renderWorkGrid();
  });

  document.getElementById('work-sort').addEventListener('change', event => {
    workSort = event.target.value;
    renderWorkGrid();
  });

  renderWorkGrid();
}

function renderWorkGrid() {
  const grid = document.getElementById('work-grid');

  if (!grid) {
    return;
  }

  let orders = DS.getOrders();

  if (workFilter === 'open') {
    orders = orders.filter(order => WORK_OPEN_STATUSES.includes(order.status));
  } else if (workFilter === 'done') {
    orders = orders.filter(order => WORK_DONE_STATUSES.includes(order.status));
  }

  if (workTypeFilter !== 'all') {
    orders = orders.filter(order => order.workType === workTypeFilter);
  }

  const [sortField, sortDirection] = workSort.split('-');

  orders = orders.slice().sort((a, b) => {
    const aValue = getWorkSortValue(a, sortField);
    const bValue = getWorkSortValue(b, sortField);

    return sortDirection === 'asc'
      ? (aValue > bValue ? 1 : -1)
      : (aValue < bValue ? 1 : -1);
  });

  if (orders.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">${iconCheck()}</div>
        <h3>${workFilter === 'open' ? 'Geen openstaand werk' : 'Geen items gevonden'}</h3>
        <p>${workFilter === 'open' ? 'Alle orders zijn afgehandeld.' : 'Pas het filter aan om items te bekijken.'}</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = orders.map(order => {
    const isDesignWork = order.workType === 'ontwerp';
    const isDone = WORK_DONE_STATUSES.includes(order.status);
    const typeClass = isDesignWork ? 'work-type-ontwerp' : 'work-type-bestandscheck';
    const shipDate = getOrderShipDate(order);
    const address = formatWorkAddress(order);
    const requestNumber = order.orderNumber || '—';
    const officialOrderNumber = order.officialOrderNumber || '';

    const typeBadge = isDesignWork
      ? `<span class="badge badge-blue">${iconPen()} Ontwerp nodig</span>`
      : `<span class="badge badge-orange">${iconSearch()} Bestandscheck</span>`;

    const statusBadge = getWorkStatusBadge(order.status);

    const urgency = getUrgency(shipDate);
    const urgencyBadge = urgency
      ? `<span class="badge ${urgency.cls}">${urgency.label}</span>`
      : '';

    const hasWensen = Boolean(
      order.wensen ||
      order.notes ||
      order.designFile ||
      order.designDataURL ||
      order.designPdfDataURL
    );

    const fileSection = isDesignWork
      ? `<span class="label">Wensen</span>
         <span>${hasWensen
        ? `<button class="link-button" type="button" onclick="viewWorkWensen('${order.id}')">Bekijk wensen</button>`
        : '<span style="color:var(--text-3)">Geen wensen</span>'}</span>`
      : `<span class="label">Bestand</span>
         <span>${order.designFile || order.designDataURL || order.designPdfDataURL
        ? `<button class="link-button" type="button" onclick="viewWorkFiles('${order.id}')">Bekijk bestand</button>`
        : '<span style="color:var(--text-3)">Geen bestand</span>'}</span>`;

    return `
      <div class="work-card ${typeClass} ${isDone ? 'work-card-done' : ''}">
        <div class="work-card-top">
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${typeBadge}
            ${statusBadge}
          </div>

          <div style="display:flex;gap:6px;align-items:center">
            ${urgencyBadge}
            <span style="font-family:var(--font-mono,monospace);font-size:11px;color:var(--text-3)">
              ${escHtml(officialOrderNumber || requestNumber)}
            </span>
          </div>
        </div>

        <div class="work-card-body">
          <h3>${escHtml(order.companyName || order.customerName || 'Onbekende klant')}</h3>

          <div class="work-card-meta">
            ${order.companyName && order.customerName ? `
              <span><span class="label">Contactpersoon</span><span>${escHtml(order.customerName)}</span></span>
            ` : ''}

            <span>
              <span class="label">E-mail</span>
              ${order.customerEmail
        ? `<a href="mailto:${escHtml(order.customerEmail)}" style="color:var(--accent)">${escHtml(order.customerEmail)}</a>`
        : '<span style="color:var(--text-3)">—</span>'}
            </span>

            <span><span class="label">Adres</span><span>${address ? escHtml(address) : '—'}</span></span>
            <span><span class="label">Product</span><span>${escHtml(order.productName)} &times; ${order.quantity || '?'}</span></span>
            ${order.persTypeLabel ? `<span><span class="label">Type</span><span>${escHtml(order.persTypeLabel)}</span></span>` : ''}

            <span>
              <span class="label">Aanvraagdatum</span>
              <span>${formatDate(order.createdAt)}</span>
            </span>

            <span>
              <span class="label">Verzenddatum</span>
              <span style="font-weight:500">${formatDate(shipDate)}</span>
            </span>

            <span><span class="label">Offerte</span><span>${formatEuro(order.quoteAmount)}</span></span>

            ${order.vatNumber || order.btwNumber ? `
              <span><span class="label">BTW-nummer</span><span>${escHtml(order.vatNumber || order.btwNumber)}</span></span>
            ` : ''}

            ${order.kvk ? `
              <span><span class="label">KVK-nummer</span><span>${escHtml(order.kvk)}</span></span>
            ` : ''}

            ${officialOrderNumber ? `
              <span><span class="label">Ordernummer</span><span>${escHtml(officialOrderNumber)}</span></span>
            ` : `<span><span class="label">Aanvraagnummer</span><span>${escHtml(requestNumber)}</span></span>`}

            <span>${fileSection}</span>
          </div>
        </div>

        <div class="work-card-footer">
          <button class="btn btn-secondary btn-sm" type="button" onclick="openOrderModal('${order.id}')">
            ${iconPen()} Bewerken
          </button>

          ${!isDone ? `
            <button class="btn btn-primary btn-sm" type="button" onclick="markWorkDone('${order.id}')">
              ${iconCheck()} Afronden
            </button>
          ` : `
            <button class="btn btn-secondary btn-sm" type="button" onclick="markWorkOpen('${order.id}')">
              Heropenen
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function viewWorkWensen(id) {
  const order = DS.getOrderById(id);

  if (!order) {
    AdminUI.showToast('Order niet gevonden', 'error');
    return;
  }

  const wensen = order.wensen || {};
  const address = formatWorkAddress(order);
  const shipDate = getOrderShipDate(order);

  const body = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div>
        <div class="section-title">Aanvraag</div>
        <div style="font-size:13px;margin-top:8px;display:flex;flex-direction:column;gap:4px">
          <div><strong>Aanvraagnummer:</strong> ${escHtml(order.orderNumber || '—')}</div>
          ${order.officialOrderNumber ? `<div><strong>Ordernummer:</strong> ${escHtml(order.officialOrderNumber)}</div>` : ''}
          <div><strong>Status:</strong> ${statusLabel(order.status)}</div>
          <div><strong>Klant:</strong> ${escHtml(order.customerName || '—')}</div>
          ${order.companyName ? `<div><strong>Bedrijf:</strong> ${escHtml(order.companyName)}</div>` : ''}
          <div><strong>Product:</strong> ${escHtml(order.productName || '—')}</div>
          <div><strong>Personalisatie:</strong> ${escHtml(order.persTypeLabel || '—')}</div>
          <div><strong>Aantal:</strong> ${order.quantity || '—'}</div>
          <div><strong>Verzenddatum:</strong> ${formatDate(shipDate)}</div>
          ${address ? `<div><strong>Adres:</strong> ${escHtml(address)}</div>` : ''}
        </div>
      </div>

      <div>
        <div class="section-title">Wensen</div>
        <div style="font-size:13px;margin-top:8px;display:flex;flex-direction:column;gap:8px">
          ${wensen.tekst ? `<div><strong>Gewenste tekst:</strong><br>${escHtml(wensen.tekst)}</div>` : ''}
          ${wensen.kleur ? `<div><strong>Kleurvoorkeur:</strong><br>${escHtml(wensen.kleur)}</div>` : ''}
          ${wensen.stijl ? `<div><strong>Stijlvoorkeur:</strong><br>${escHtml(wensen.stijl)}</div>` : ''}
          ${wensen.opmerkingen ? `<div><strong>Aanvullende opmerkingen:</strong><br>${escHtml(wensen.opmerkingen)}</div>` : ''}
          ${order.notes ? `<div><strong>Ordernotities:</strong><br>${escHtml(order.notes)}</div>` : ''}
          ${wensen.refFileName ? `<div><strong>Referentiebestand:</strong><br>${escHtml(wensen.refFileName)}</div>` : ''}
          ${!wensen.tekst && !wensen.kleur && !wensen.stijl && !wensen.opmerkingen && !order.notes && !wensen.refFileName
      ? '<div style="color:var(--text-3)">Geen wensen ingevuld.</div>'
      : ''}
        </div>
      </div>
    </div>
  `;

  AdminUI.openModal({
    title: `Wensen — ${order.orderNumber || 'aanvraag'}`,
    body,
    footer: `<button class="btn btn-secondary" type="button" onclick="AdminUI.closeModal()">Sluiten</button>`,
  });
}

function viewWorkFiles(id) {
  if (typeof viewOrderFiles === 'function') {
    viewOrderFiles(id);
    return;
  }

  downloadWorkDesign(id);
}

function getWensenSummary(order) {
  const wensen = order.wensen || {};

  if (wensen.tekst || wensen.kleur || wensen.stijl || wensen.opmerkingen) {
    const summary = [
      wensen.tekst ? `Tekst: ${wensen.tekst}` : '',
      wensen.kleur ? `Kleur: ${wensen.kleur}` : '',
      wensen.stijl ? `Stijl: ${wensen.stijl}` : '',
      wensen.opmerkingen ? `Opmerking: ${wensen.opmerkingen}` : '',
    ].filter(Boolean).join(' | ');

    return `<span title="${escHtml(summary)}" style="cursor:help;text-decoration:underline dotted">Bekijk wensen</span>`;
  }

  return order.notes
    ? `<span title="${escHtml(order.notes)}" style="cursor:help;text-decoration:underline dotted">Bekijk notities</span>`
    : '—';
}

function getDownloadSection(order) {
  if (!order.designFile && !order.designDataURL && !order.designPdfDataURL) {
    return '<span style="color:var(--text-3)">Geen bestand</span>';
  }

  return `
    <button class="btn btn-secondary btn-sm" type="button" onclick="downloadWorkDesign('${order.id}')">
      Download ${escHtml(order.designFile || `ontwerp-${order.orderNumber}.png`)}
    </button>
  `;
}

function getUrgency(date) {
  if (!date) {
    return null;
  }

  const today = new Date();
  const targetDate = new Date(date);

  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const days = Math.ceil((targetDate - today) / 86400000);

  if (days < 0) {
    return { cls: 'badge-red', label: 'Verlopen' };
  }

  if (days <= 3) {
    return { cls: 'badge-red', label: `${days}d` };
  }

  if (days <= 7) {
    return { cls: 'badge-orange', label: `${days}d` };
  }

  return null;
}

function markWorkDone(id) {
  const order = DS.getOrderById(id);

  if (!order) {
    return;
  }

  order.status = 'afgerond';
  DS.saveOrder(order);

  renderWorkGrid();
  AdminUI.updateBadges();
  AdminUI.showToast('Order gemarkeerd als afgerond');
}

function markWorkOpen(id) {
  const order = DS.getOrderById(id);

  if (!order) {
    return;
  }

  if (order.workType === 'ontwerp') {
    order.status = 'wacht-op-ontwerp';
  } else if (order.workType === 'bestandscheck') {
    order.status = 'wacht-op-bestandscheck';
  } else {
    order.status = 'offerte-aanvraag';
  }

  DS.saveOrder(order);

  renderWorkGrid();
  AdminUI.updateBadges();
  AdminUI.showToast('Order heropend');
}

function downloadWorkDesign(id) {
  const order = DS.getOrderById(id);

  if (!order) {
    return;
  }

  const fileDataURL = order.designPdfDataURL || order.designDataURL;

  if (!fileDataURL) {
    AdminUI.showToast('Geen downloadbaar ontwerpbestand beschikbaar', 'error');
    return;
  }

  const extension = fileDataURL.startsWith('data:application/pdf') ? 'pdf' : 'png';
  const fileName = order.designFile || `ontwerp-${order.orderNumber}.${extension}`;

  const link = document.createElement('a');
  link.href = fileDataURL;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function getWorkSortValue(order, field) {
  if (field === 'shipDate') {
    return getOrderShipDate(order) || '';
  }

  return order[field] || '';
}

function getOrderShipDate(order) {
  return order.shipDate ||
    order.shippingDate ||
    order.dispatchDate ||
    order.deliveryDate ||
    '';
}

function formatWorkAddress(order) {
  const street = order.street || '';
  const houseNumber = order.houseNumber || '';
  const postalCode = order.postalCode || '';
  const city = order.city || '';
  const country = order.country || '';

  const structuredAddress = [
    [street, houseNumber].filter(Boolean).join(' '),
    [postalCode, city].filter(Boolean).join(' '),
    country,
  ].filter(Boolean).join(', ');

  return structuredAddress || order.deliveryAddress || '';
}

function getWorkStatusBadge(status) {
  const statusMap = {
    'offerte-aanvraag': ['badge-blue', 'Offerteaanvraag'],
    'offerte-verstuurd': ['badge-blue', 'Offerte verstuurd'],
    'wacht-op-klantgoedkeuring': ['badge-orange', 'Wacht op klant'],
    'wacht-op-ontwerp': ['badge-orange', 'Wacht op ontwerp'],
    'wacht-op-bestandscheck': ['badge-orange', 'Wacht op bestandscheck'],
    'wacht-op-interne-controle': ['badge-red', 'Interne controle'],
    'wacht-op-goedkeuring': ['badge-orange', 'Wacht op goedkeuring'],
    akkoord: ['badge-green', 'Akkoord'],
    'in-productie': ['badge-blue', 'In productie'],
    verzonden: ['badge-green', 'Verzonden'],
    afgerond: ['badge-green', 'Afgerond'],
  };

  const [className, label] = statusMap[status] || ['badge-gray', status || 'Onbekend'];

  return `<span class="badge ${className}">${escHtml(label)}</span>`;
}

function statusLabel(status) {
  const labels = {
    'offerte-aanvraag': 'Offerteaanvraag',
    'offerte-verstuurd': 'Offerte verstuurd',
    'wacht-op-klantgoedkeuring': 'Wacht op klantgoedkeuring',
    'wacht-op-ontwerp': 'Wacht op ontwerp',
    'wacht-op-bestandscheck': 'Wacht op bestandscheck',
    'wacht-op-interne-controle': 'Wacht op interne controle',
    'wacht-op-goedkeuring': 'Wacht op goedkeuring',
    akkoord: 'Akkoord',
    'in-productie': 'In productie',
    verzonden: 'Verzonden',
    afgerond: 'Afgerond',
  };

  return escHtml(labels[status] || status || '—');
}

function iconCheck() {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle">
    <path d="M1.5 6L4.5 9L10.5 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function iconPen() {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle">
    <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function iconSearch() {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle">
    <circle cx="5" cy="5" r="3.5" stroke="currentColor" stroke-width="1.5"/>
    <path d="M8 8L10.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
}

function formatDate(iso) {
  if (!iso) {
    return '—';
  }

  return new Date(iso).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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

window.downloadWorkDesign = downloadWorkDesign;
window.viewWorkWensen = viewWorkWensen;
window.viewWorkFiles = viewWorkFiles;