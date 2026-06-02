/**
 * orders.js
 * Punt 2: emoji's vervangen door SVG iconen
 * Punt 3: filter pills voor actief/verwerkt/alles
 */

let orderSort = { field: 'createdAt', dir: 'desc' };
let orderSearch = '';
let orderStatusFilter = '';
let orderPillFilter = 'active'; // 'active' | 'processed' | 'all'

function renderOrdersPage() {
  const el = document.getElementById('page-orders');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Orders</h1>
        <p>Alle binnengekomen aanvragen via de custom order tool</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" id="btn-order-add">+ Nieuwe order</button>
      </div>
    </div>

    <div class="filter-bar" style="flex-wrap:wrap;gap:8px">
      <div class="filter-group">
        <button class="filter-pill ${orderPillFilter === 'active' ? 'active' : ''}" data-pill="active">Actief</button>
        <button class="filter-pill ${orderPillFilter === 'processed' ? 'active' : ''}" data-pill="processed">Verwerkt</button>
        <button class="filter-pill ${orderPillFilter === 'all' ? 'active' : ''}" data-pill="all">Alles</button>
      </div>
      <div class="search-wrap">
        <span class="search-icon">${iconSearch()}</span>
        <input type="text" id="order-search" placeholder="Zoek op naam, ordernummer..." value="${escHtml(orderSearch)}">
      </div>
      <select class="filter-select" id="order-status-filter">
        <option value="">Alle statussen</option>
        <option value="wacht-op-ontwerp">Wacht op ontwerp</option>
        <option value="wacht-op-bestandscheck">Wacht op bestandscheck</option>
        <option value="wacht-op-goedkeuring">Wacht op goedkeuring</option>
        <option value="afgerond">Afgerond</option>
      </select>
    </div>

    <div class="table-wrap" id="orders-table-wrap"></div>
  `;

  document.getElementById('order-search').value = orderSearch;
  document.getElementById('order-status-filter').value = orderStatusFilter;

  document.getElementById('btn-order-add').addEventListener('click', () => openOrderModal());

  document.getElementById('order-search').addEventListener('input', e => {
    orderSearch = e.target.value; renderOrdersTable();
  });
  document.getElementById('order-status-filter').addEventListener('change', e => {
    orderStatusFilter = e.target.value; renderOrdersTable();
  });

  el.querySelectorAll('.filter-pill[data-pill]').forEach(btn => {
    btn.addEventListener('click', () => {
      orderPillFilter = btn.dataset.pill;
      el.querySelectorAll('.filter-pill[data-pill]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderOrdersTable();
    });
  });

  renderOrdersTable();
}

function renderOrdersTable() {
  let orders = DS.getOrders();

  // Pill filter
  if (orderPillFilter === 'active') {
    orders = orders.filter(o => o.status !== 'afgerond');
  } else if (orderPillFilter === 'processed') {
    orders = orders.filter(o => o.status === 'afgerond');
  }

  // Zoeken
  if (orderSearch) {
    const q = orderSearch.toLowerCase();
    orders = orders.filter(o =>
      (o.customerName || '').toLowerCase().includes(q) ||
      (o.orderNumber || '').toLowerCase().includes(q)
    );
  }

  // Status dropdown
  if (orderStatusFilter) orders = orders.filter(o => o.status === orderStatusFilter);

  // Sorteren
  orders = orders.slice().sort((a, b) => {
    const av = a[orderSort.field] || '', bv = b[orderSort.field] || '';
    return orderSort.dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  const wrap = document.getElementById('orders-table-wrap');
  if (!wrap) return;

  if (orders.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${iconClipboard()}</div>
        <h3>Geen orders gevonden</h3>
        <p>Pas het filter aan of voeg een nieuwe order toe.</p>
      </div>`;
    return;
  }

  const cols = [
    { key: 'orderNumber', label: 'Order #' },
    { key: 'createdAt', label: 'Datum' },
    { key: 'customerName', label: 'Klant' },
    { key: 'productName', label: 'Product' },
    { key: 'quantity', label: 'Stuks' },
    { key: 'deliveryDate', label: 'Leverdatum' },
    { key: 'quoteAmount', label: 'Offerte' },
    { key: 'status', label: 'Status' },
    { key: 'confirmationSent', label: 'Bevestiging' },
    { key: '_files', label: 'Bestanden' },
    { key: '_actions', label: '' },
  ];

  const thHTML = cols.map(c => {
    if (c.key === '_actions' || c.key === '_files') return `<th></th>`;
    const cls = orderSort.field === c.key ? `sort-${orderSort.dir}` : '';
    return `<th class="${cls}" data-sort="${c.key}">${c.label}</th>`;
  }).join('');

  const rowsHTML = orders.map(o => {
    const hasDesign = !!(o.designDataURL || o.designFile);
    const hasWensen = !!(o.wensen && (o.wensen.tekst || o.wensen.kleur || o.wensen.stijl));

    const fileBadges = [
      hasDesign ? `<button class="icon-btn" onclick="viewOrderFiles('${o.id}')" title="Ontwerp bekijken">${iconImage()}</button>` : '',
      hasWensen ? `<button class="icon-btn" onclick="viewOrderFiles('${o.id}')" title="Wensen bekijken">${iconNote()}</button>` : '',
    ].filter(Boolean).join('') || '—';

    // Punt 5: toggle vergrendeld na versturen
    const toggleHTML = o.confirmationSent
      ? `<label class="toggle" title="Bevestiging verstuurd — vergrendeld" style="opacity:.6;cursor:not-allowed">
           <input type="checkbox" checked disabled>
           <span class="toggle-slider"></span>
         </label>`
      : `<label class="toggle" title="Markeer als verstuurd">
           <input type="checkbox" onchange="toggleOrderConfirmation('${o.id}', this.checked)">
           <span class="toggle-slider"></span>
         </label>`;

    return `
      <tr>
        <td class="mono">${escHtml(o.orderNumber)}</td>
        <td>${formatDate(o.createdAt)}</td>
        <td>
          <div style="font-weight:500">${escHtml(o.customerName)}</div>
          <div style="font-size:11px;color:var(--text-3)">${escHtml(o.customerEmail)}</div>
        </td>
        <td>${escHtml(o.productName)}</td>
        <td>${o.quantity || '—'}</td>
        <td>${formatDate(o.deliveryDate)}</td>
        <td style="font-weight:500">${formatEuro(o.quoteAmount)}</td>
        <td>${orderStatusBadge(o.status)}</td>
        <td>${toggleHTML}</td>
        <td>${fileBadges}</td>
        <td class="td-actions">
          <button class="icon-btn" onclick="openOrderModal('${o.id}')" title="Bewerken">${iconPen()}</button>
          <button class="icon-btn danger" onclick="deleteOrderById('${o.id}')" title="Verwijderen">${iconTrash()}</button>
        </td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `<table><thead><tr>${thHTML}</tr></thead><tbody>${rowsHTML}</tbody></table>`;

  wrap.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      orderSort = orderSort.field === field
        ? { field, dir: orderSort.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' };
      renderOrdersTable();
    });
  });
}

function orderStatusBadge(status) {
  const map = {
    'wacht-op-ontwerp': ['badge-blue', `${iconPen()} Ontwerp nodig`],
    'wacht-op-bestandscheck': ['badge-orange', `${iconSearch()} Bestandscheck`],
    'wacht-op-goedkeuring': ['badge-blue', `${iconClock()} Wacht op goedkeuring`],
    'afgerond': ['badge-green', `${iconCheck()} Afgerond`],
  };
  const [cls, label] = map[status] || ['badge-gray', status || '—'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function toggleOrderConfirmation(id, checked) {
  if (!checked) return;
  const order = DS.getOrderById(id);
  if (!order || order.confirmationSent) return;
  order.confirmationSent = true;
  DS.saveOrder(order);
  renderOrdersTable();
  AdminUI.updateBadges();
  AdminUI.showToast('Orderbevestiging gemarkeerd als verstuurd');
}

async function deleteOrderById(id) {
  const ok = await AdminUI.confirmDialog('Weet je zeker dat je deze order wilt verwijderen?');
  if (!ok) return;
  DS.deleteOrder(id);
  renderOrdersTable();
  AdminUI.updateBadges();
  AdminUI.showToast('Order verwijderd');
}

function viewOrderFiles(id) {
  const order = DS.getOrderById(id);
  if (!order) return;

  const hasDesign = !!(order.designDataURL);
  const hasUpload = !!(order.designFile && !order.designDataURL);
  const hasWensen = !!(order.wensen);

  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:20px';

  if (hasDesign) {
    body.innerHTML += `
      <div>
        <div class="section-title">Ontwerp</div>
        <div style="margin-top:10px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;display:inline-block">
          <img src="${order.designDataURL}" alt="Ontwerp" style="max-width:100%;max-height:320px;display:block">
        </div>
        <div style="margin-top:8px;display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="downloadDesign('${id}')">Download PNG</button>
          <button class="btn btn-secondary btn-sm" onclick="window.open('${order.designDataURL}','_blank')">Openen</button>
          <button class="btn btn-secondary btn-sm" onclick="generateOrderPDF('${id}')">Download offerte PDF</button>
        </div>
      </div>`;
  }

  if (hasUpload) {
    body.innerHTML += `
      <div>
        <div class="section-title">Geüpload bestand</div>
        <p style="font-size:13px;margin-top:6px">${iconNote()} ${escHtml(order.designFile)}</p>
        <p style="font-size:12px;color:var(--text-2);margin-top:4px">
          Bestand is lokaal geüpload — niet beschikbaar zonder backend opslag.
        </p>
      </div>`;
  }

  if (hasWensen) {
    const w = order.wensen;
    body.innerHTML += `
      <div>
        <div class="section-title">Wensenformulier</div>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;font-size:13px">
          ${w.tekst ? `<div><strong>Tekst:</strong> ${escHtml(w.tekst)}</div>` : ''}
          ${w.kleur ? `<div><strong>Kleur:</strong> ${escHtml(w.kleur)}</div>` : ''}
          ${w.stijl ? `<div><strong>Stijl:</strong> ${escHtml(w.stijl)}</div>` : ''}
          ${w.opmerkingen ? `<div><strong>Opmerkingen:</strong> ${escHtml(w.opmerkingen)}</div>` : ''}
          ${w.refFileName ? `<div><strong>Referentie:</strong> ${escHtml(w.refFileName)}</div>` : ''}
        </div>
      </div>`;
  }

  if (!hasDesign && !hasUpload && !hasWensen) {
    body.innerHTML = '<p style="color:var(--text-3);font-size:13px">Geen bestanden gekoppeld aan deze order.</p>';
  }

  AdminUI.openModal({
    title: `Bestanden — ${order.orderNumber}`,
    body,
    footer: `<button class="btn btn-secondary" onclick="AdminUI.closeModal()">Sluiten</button>`,
  });
}

function downloadDesign(id) {
  const order = DS.getOrderById(id);

  if (!order?.designDataURL) {
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

function generateOrderPDF(id) {
  const order = DS.getOrderById(id);

  if (!order) {
    return;
  }

  const product = DS.getProductById(order.productId) || {
    id: order.productId,
    name: order.productName,
    priceSlabs: [],
  };

  const pricing = {
    quantity: Number(order.quantity || 0),
    unitPrice: Number(order.unitPrice || 0),
    productsTotal: Number(order.unitPrice || 0) * Number(order.quantity || 0),
    designService: order.workType === 'ontwerp' ? 75 : 0,
    fileCheck: order.addons?.includes('bestandscontrole') ? 15 : 0,
    totalIncl: Number(order.quoteAmount || 0),
    totalExcl: Number(order.quoteAmount || 0) / 1.21,
    vat: Number(order.quoteAmount || 0) - Number(order.quoteAmount || 0) / 1.21,
  };

  if (typeof generateOffertePDF === 'function') {
    generateOffertePDF(order, product, pricing);
  } else {
    AdminUI.showToast('PDF functie niet beschikbaar', 'error');
  }
}

function openOrderModal(id = null) {
  const order = id ? DS.getOrderById(id) : {};
  const products = DS.getProducts().filter(p => p.active !== false);
  const isEdit = !!id;

  const productOptions = products.map(p =>
    `<option value="${p.id}" ${order.productId === p.id ? 'selected' : ''}>${escHtml(p.name)}</option>`
  ).join('');

  const statusOptions = [
    ['wacht-op-ontwerp', 'Wacht op ontwerp'],
    ['wacht-op-bestandscheck', 'Wacht op bestandscheck'],
    ['wacht-op-goedkeuring', 'Wacht op goedkeuring klant'],
    ['afgerond', 'Afgerond'],
  ].map(([v, l]) => `<option value="${v}" ${order.status === v ? 'selected' : ''}>${l}</option>`).join('');

  const workTypeOptions = [
    ['ontwerp', 'Ontwerp nodig'],
    ['bestandscheck', 'Bestandscheck'],
  ].map(([v, l]) => `<option value="${v}" ${order.workType === v ? 'selected' : ''}>${l}</option>`).join('');

  const body = `
    <div class="section-title">Klantgegevens</div>
    <div class="form-row">
      <div class="form-group"><label>Naam *</label>
        <input type="text" id="of-name" value="${escHtml(order.customerName || '')}" placeholder="Emma de Vries"></div>
      <div class="form-group"><label>E-mail *</label>
        <input type="email" id="of-email" value="${escHtml(order.customerEmail || '')}" placeholder="emma@bedrijf.nl"></div>
    </div>
    <div class="form-row-1">
      <div class="form-group"><label>Leveradres</label>
        <input type="text" id="of-address" value="${escHtml(order.deliveryAddress || '')}" placeholder="Straat 1, 1234 AB Stad"></div>
    </div>
    <div class="section-title" style="margin-top:4px">Order details</div>
    <div class="form-row">
      <div class="form-group"><label>Product *</label>
        <select id="of-product"><option value="">Kies product...</option>${productOptions}</select></div>
      <div class="form-group"><label>Aantal *</label>
        <input type="number" id="of-qty" value="${order.quantity || ''}" min="1" placeholder="10"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Leverdatum</label>
        <input type="date" id="of-delivery" value="${order.deliveryDate || ''}"></div>
      <div class="form-group"><label>Offerte (€)</label>
        <input type="number" id="of-quote" value="${order.quoteAmount || ''}" step="0.01" placeholder="0.00"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Status</label>
        <select id="of-status">${statusOptions}</select></div>
      <div class="form-group"><label>Werktype</label>
        <select id="of-worktype">${workTypeOptions}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Ontwerp bestandsnaam</label>
        <input type="text" id="of-file" value="${escHtml(order.designFile || '')}" placeholder="ontwerp-klant.png"></div>
    </div>
    <div class="form-row-1">
      <div class="form-group"><label>Notities</label>
        <textarea id="of-notes">${escHtml(order.notes || '')}</textarea></div>
    </div>
    <div id="of-error" class="form-error"></div>
  `;

  const footer = `
  ${isEdit ? `<button class="btn btn-secondary" type="button" onclick="generateOrderPDF('${order.id}')">Download offerte PDF</button>` : ''}
  ${isEdit && (order.designDataURL || order.designFile) ? `<button class="btn btn-secondary" type="button" onclick="downloadDesign('${order.id}')">Download ontwerp</button>` : ''}
  <button class="btn btn-secondary" type="button" onclick="AdminUI.closeModal()">Annuleren</button>
  <button class="btn btn-primary" type="button" id="btn-order-save">Opslaan</button>
`;

  AdminUI.openModal({ title: isEdit ? 'Order bewerken' : 'Nieuwe order', body, footer });

  document.getElementById('btn-order-save').addEventListener('click', () => {
    const productId = document.getElementById('of-product').value;
    const productName = productId ? (DS.getProductById(productId)?.name || '') : '';
    const name = document.getElementById('of-name').value.trim();
    const email = document.getElementById('of-email').value.trim();
    if (!name || !email || !productId) {
      const err = document.getElementById('of-error');
      err.textContent = 'Vul naam, e-mail en product in.';
      err.classList.add('visible');
      return;
    }
    DS.saveOrder({
      ...order,
      customerName: name,
      customerEmail: email,
      deliveryAddress: document.getElementById('of-address').value.trim(),
      productId, productName,
      quantity: parseInt(document.getElementById('of-qty').value) || null,
      deliveryDate: document.getElementById('of-delivery').value,
      quoteAmount: parseFloat(document.getElementById('of-quote').value) || null,
      status: document.getElementById('of-status').value,
      workType: document.getElementById('of-worktype').value,
      designFile: document.getElementById('of-file').value.trim(),
      notes: document.getElementById('of-notes').value.trim(),
    });
    AdminUI.closeModal();
    renderOrdersTable();
    AdminUI.updateBadges();
    AdminUI.showToast(isEdit ? 'Order bijgewerkt' : 'Order aangemaakt');
  });
}

// ─── SVG ICONEN ───────────────────────────────────────────────────────────────
function iconSearch() {
  return `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle">
    <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" stroke-width="1.5"/>
    <path d="M9 9L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
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
function iconTrash() {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle">
    <path d="M1.5 3H10.5M4.5 3V2H7.5V3M2.5 3L3.5 10H8.5L9.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
function iconImage() {
  return `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle">
    <rect x="1" y="1" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="4.5" cy="4.5" r="1" fill="currentColor"/>
    <path d="M1 9L4 6L6.5 8.5L8.5 6.5L12 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
function iconNote() {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle">
    <rect x="1.5" y="1" width="9" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
    <path d="M4 4.5H8M4 6.5H8M4 8.5H6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`;
}
function iconClock() {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle">
    <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5"/>
    <path d="M6 3.5V6L7.5 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
}
function iconClipboard() {
  return `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="8" width="20" height="20" rx="3" stroke="currentColor" stroke-width="2"/>
    <path d="M11 4H21V9H11V4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M11 16H21M11 20H17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

// helpers
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatEuro(n) {
  if (n === null || n === undefined) return '—';
  return '€ ' + parseFloat(n).toFixed(2).replace('.', ',');
}
function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.viewOrderFiles = viewOrderFiles;
window.downloadDesign = downloadDesign;
window.generateOrderPDF = generateOrderPDF;
window.toggleOrderConfirmation = toggleOrderConfirmation;