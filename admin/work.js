/**
 * work.js
 * Pagina: Werkvoorraad
 * Bestandscheck bevat downloadfunctie voor ontwerpbestand.
 */

let workFilter = 'open';
let workTypeFilter = 'all';
let workSort = 'deliveryDate-asc';

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
        <option value="deliveryDate-asc">Leverdatum vroegst eerst</option>
        <option value="deliveryDate-desc">Leverdatum laatste eerst</option>
        <option value="createdAt-asc">Orderdatum oudst eerst</option>
        <option value="createdAt-desc">Orderdatum nieuwst eerst</option>
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
    orders = orders.filter(order =>
      ['wacht-op-ontwerp', 'wacht-op-bestandscheck', 'wacht-op-goedkeuring'].includes(order.status)
    );
  } else if (workFilter === 'done') {
    orders = orders.filter(order => order.status === 'afgerond');
  }

  if (workTypeFilter !== 'all') {
    orders = orders.filter(order => order.workType === workTypeFilter);
  }

  const [sortField, sortDirection] = workSort.split('-');

  orders = orders.slice().sort((a, b) => {
    const aValue = a[sortField] || '';
    const bValue = b[sortField] || '';

    return sortDirection === 'asc'
      ? (aValue > bValue ? 1 : -1)
      : (aValue < bValue ? 1 : -1);
  });

  if (orders.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">${iconCheck()}</div>
        <h3>${workFilter === 'open' ? 'Geen openstaand werk' : 'Geen items gevonden'}</h3>
        <p>${workFilter === 'open' ? 'Alle orders zijn afgerond.' : 'Pas het filter aan om items te bekijken.'}</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = orders.map(order => {
    const isDesignWork = order.workType === 'ontwerp';
    const isDone = order.status === 'afgerond';
    const typeClass = isDesignWork ? 'work-type-ontwerp' : 'work-type-bestandscheck';

    const typeBadge = isDesignWork
      ? `<span class="badge badge-blue">${iconPen()} Ontwerp nodig</span>`
      : `<span class="badge badge-orange">${iconSearch()} Bestandscheck</span>`;

    const doneBadge = isDone
      ? `<span class="badge badge-green">${iconCheck()} Afgerond</span>`
      : '';

    const urgency = getUrgency(order.deliveryDate);
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
            ${doneBadge}
          </div>

          <div style="display:flex;gap:6px;align-items:center">
            ${urgencyBadge}
            <span style="font-family:var(--font-mono,monospace);font-size:11px;color:var(--text-3)">
              ${escHtml(order.orderNumber)}
            </span>
          </div>
        </div>

        <div class="work-card-body">
          <h3>${escHtml(order.customerName)}</h3>

          <div class="work-card-meta">
            <span>
              <span class="label">E-mail</span>
              <a href="mailto:${escHtml(order.customerEmail)}" style="color:var(--accent)">
                ${escHtml(order.customerEmail)}
              </a>
            </span>
            <span><span class="label">Adres</span><span>${escHtml(order.deliveryAddress) || '—'}</span></span>
            <span><span class="label">Product</span><span>${escHtml(order.productName)} &times; ${order.quantity || '?'}</span></span>
            ${order.persTypeLabel ? `<span><span class="label">Type</span><span>${escHtml(order.persTypeLabel)}</span></span>` : ''}
            <span>
              <span class="label">Leverdatum</span>
              <span style="font-weight:500">${formatDate(order.deliveryDate)}</span>
            </span>
            <span><span class="label">Offerte</span><span>${formatEuro(order.quoteAmount)}</span></span>
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

  const body = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div>
        <div class="section-title">Order</div>
        <div style="font-size:13px;margin-top:8px;display:flex;flex-direction:column;gap:4px">
          <div><strong>Ordernummer:</strong> ${escHtml(order.orderNumber || '—')}</div>
          <div><strong>Klant:</strong> ${escHtml(order.customerName || '—')}</div>
          <div><strong>Product:</strong> ${escHtml(order.productName || '—')}</div>
          <div><strong>Personalisatie:</strong> ${escHtml(order.persTypeLabel || '—')}</div>
          <div><strong>Aantal:</strong> ${order.quantity || '—'}</div>
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
    title: `Wensen — ${order.orderNumber}`,
    body,
    footer: `<button class="btn btn-secondary" type="button" onclick="AdminUI.closeModal()">Sluiten</button>`,
  });
}

function viewWorkFiles(id) {
  if (typeof viewOrderFiles === 'function') {
    viewOrderFiles(id);
    return;
  }

  AdminUI.showToast('Bestandenvenster niet beschikbaar', 'error');
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
  if (!order.designFile && !order.designDataURL) {
    return '<span style="color:var(--text-3)">Geen bestand</span>';
  }

  return `
    <button class="btn btn-secondary btn-sm" type="button" onclick="downloadWorkDesign('${order.id}')">
      Download ${escHtml(order.designFile || `ontwerp-${order.orderNumber}.png`)}
    </button>
  `;
}

function getUrgency(deliveryDate) {
  if (!deliveryDate) {
    return null;
  }

  const days = Math.ceil((new Date(deliveryDate) - new Date()) / 86400000);

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

  order.status = order.workType === 'ontwerp'
    ? 'wacht-op-ontwerp'
    : 'wacht-op-bestandscheck';

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

  if (!order.designDataURL) {
    AdminUI.showToast('Geen downloadbaar ontwerpbestand beschikbaar', 'error');
    return;
  }

  const extension = order.designDataURL.startsWith('data:application/pdf') ? 'pdf' : 'png';
  const fileName = order.designFile || `ontwerp-${order.orderNumber}.${extension}`;

  const link = document.createElement('a');
  link.href = order.designDataURL;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
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