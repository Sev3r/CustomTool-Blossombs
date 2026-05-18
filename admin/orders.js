/**
 * orders.js
 * Pagina: Orders overzicht
 */

let orderSort = { field: 'createdAt', dir: 'desc' };
let orderSearch = '';
let orderStatusFilter = '';

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

    <div class="filter-bar">
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
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
  document.getElementById('order-search').addEventListener('input', e => { orderSearch = e.target.value; renderOrdersTable(); });
  document.getElementById('order-status-filter').addEventListener('change', e => { orderStatusFilter = e.target.value; renderOrdersTable(); });

  renderOrdersTable();
}

function renderOrdersTable() {
  let orders = DS.getOrders();

  // Filter
  if (orderSearch) {
    const q = orderSearch.toLowerCase();
    orders = orders.filter(o =>
      (o.customerName || '').toLowerCase().includes(q) ||
      (o.orderNumber  || '').toLowerCase().includes(q)
    );
  }
  if (orderStatusFilter) {
    orders = orders.filter(o => o.status === orderStatusFilter);
  }

  // Sort
  orders = orders.slice().sort((a, b) => {
    const av = a[orderSort.field] || '';
    const bv = b[orderSort.field] || '';
    return orderSort.dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  const wrap = document.getElementById('orders-table-wrap');
  if (!wrap) return;

  if (orders.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>Geen orders gevonden</h3>
        <p>Pas je filter aan of voeg een nieuwe order toe.</p>
      </div>`;
    return;
  }

  const cols = [
    { key: 'orderNumber', label: 'Order #' },
    { key: 'createdAt',   label: 'Datum' },
    { key: 'customerName',label: 'Klant' },
    { key: 'productName', label: 'Product' },
    { key: 'quantity',    label: 'Stuks' },
    { key: 'deliveryDate',label: 'Leverdatum' },
    { key: 'quoteAmount', label: 'Offerte' },
    { key: 'status',      label: 'Status' },
    { key: 'confirmationSent', label: 'Bevestiging' },
    { key: '_actions',    label: '' },
  ];

  const thHTML = cols.map(c => {
    if (c.key === '_actions') return `<th></th>`;
    const cls = orderSort.field === c.key ? `sort-${orderSort.dir}` : '';
    return `<th class="${cls}" data-sort="${c.key}">${c.label}</th>`;
  }).join('');

  const rowsHTML = orders.map(o => `
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
      <td>
        <label class="toggle" title="Orderbevestiging verstuurd">
          <input type="checkbox" ${o.confirmationSent ? 'checked' : ''} onchange="toggleOrderConfirmation('${o.id}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td class="td-actions">
        <button class="icon-btn" onclick="openOrderModal('${o.id}')" title="Bewerken">✏️</button>
        <button class="icon-btn danger" onclick="deleteOrderById('${o.id}')" title="Verwijderen">🗑️</button>
      </td>
    </tr>
  `).join('');

  wrap.innerHTML = `
    <table>
      <thead><tr>${thHTML}</tr></thead>
      <tbody>${rowsHTML}</tbody>
    </table>
  `;

  // Sort headers
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
    'wacht-op-ontwerp':       ['badge-blue',   '✏️ Ontwerp nodig'],
    'wacht-op-bestandscheck': ['badge-orange', '🔍 Bestandscheck'],
    'wacht-op-goedkeuring':   ['badge-blue',   '⏳ Wacht op goedkeuring'],
    'afgerond':               ['badge-green',  '✅ Afgerond'],
  };
  const [cls, label] = map[status] || ['badge-gray', status || '—'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function toggleOrderConfirmation(id, checked) {
  const order = DS.getOrderById(id);
  if (!order) return;
  order.confirmationSent = checked;
  DS.saveOrder(order);
  showToast(checked ? 'Bevestiging gemarkeerd als verstuurd' : 'Bevestiging gemarkeerd als niet verstuurd');
}

async function deleteOrderById(id) {
  const ok = await AdminUI.confirmDialog('Weet je zeker dat je deze order wilt verwijderen?');
  if (!ok) return;
  DS.deleteOrder(id);
  renderOrdersTable();
  AdminUI.updateBadges();
  AdminUI.showToast('Order verwijderd', 'success');
}

// ─── ORDER MODAL ─────────────────────────────────────────────────────────────

function openOrderModal(id = null) {
  const order    = id ? DS.getOrderById(id) : {};
  const products = DS.getProducts().filter(p => p.active !== false);
  const isEdit   = !!id;

  const productOptions = products.map(p =>
    `<option value="${p.id}" ${order.productId === p.id ? 'selected' : ''}>${escHtml(p.name)}</option>`
  ).join('');

  const statusOptions = [
    ['wacht-op-ontwerp',       'Wacht op ontwerp'],
    ['wacht-op-bestandscheck', 'Wacht op bestandscheck'],
    ['wacht-op-goedkeuring',   'Wacht op goedkeuring klant'],
    ['afgerond',               'Afgerond'],
  ].map(([v, l]) => `<option value="${v}" ${order.status === v ? 'selected' : ''}>${l}</option>`).join('');

  const workTypeOptions = [
    ['ontwerp',       'Ontwerp nodig'],
    ['bestandscheck', 'Bestandscheck'],
  ].map(([v, l]) => `<option value="${v}" ${order.workType === v ? 'selected' : ''}>${l}</option>`).join('');

  const body = `
    <div class="section-title">Klantgegevens</div>
    <div class="form-row">
      <div class="form-group">
        <label>Naam klant *</label>
        <input type="text" id="of-name" value="${escHtml(order.customerName)}" placeholder="Emma de Vries">
      </div>
      <div class="form-group">
        <label>E-mailadres *</label>
        <input type="email" id="of-email" value="${escHtml(order.customerEmail)}" placeholder="emma@bedrijf.nl">
      </div>
    </div>
    <div class="form-row-1">
      <div class="form-group">
        <label>Leveradres</label>
        <input type="text" id="of-address" value="${escHtml(order.deliveryAddress)}" placeholder="Straat 1, 1234 AB Stad">
      </div>
    </div>

    <div class="section-title" style="margin-top:4px">Order details</div>
    <div class="form-row">
      <div class="form-group">
        <label>Product *</label>
        <select id="of-product"><option value="">Kies product...</option>${productOptions}</select>
      </div>
      <div class="form-group">
        <label>Aantal stuks *</label>
        <input type="number" id="of-qty" value="${order.quantity || ''}" min="1" placeholder="10">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Uiterlijke leverdatum</label>
        <input type="date" id="of-delivery" value="${order.deliveryDate || ''}">
      </div>
      <div class="form-group">
        <label>Offertebedrag (€)</label>
        <input type="number" id="of-quote" value="${order.quoteAmount || ''}" step="0.01" placeholder="0.00">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Status</label>
        <select id="of-status">${statusOptions}</select>
      </div>
      <div class="form-group">
        <label>Werktype</label>
        <select id="of-worktype">${workTypeOptions}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Ontwerp bestandsnaam</label>
        <input type="text" id="of-file" value="${escHtml(order.designFile)}" placeholder="ontwerp-klant.png">
      </div>
    </div>
    <div class="form-row-1">
      <div class="form-group">
        <label>Notities</label>
        <textarea id="of-notes" placeholder="Interne notities...">${escHtml(order.notes)}</textarea>
      </div>
    </div>
    <div id="of-error" class="form-error"></div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="AdminUI.closeModal()">Annuleren</button>
    <button class="btn btn-primary"   id="btn-order-save">Opslaan</button>
  `;

  AdminUI.openModal({ title: isEdit ? 'Order bewerken' : 'Nieuwe order', body, footer });

  document.getElementById('btn-order-save').addEventListener('click', () => {
    const productId   = document.getElementById('of-product').value;
    const productName = productId ? (DS.getProductById(productId)?.name || '') : '';
    const name        = document.getElementById('of-name').value.trim();
    const email       = document.getElementById('of-email').value.trim();

    if (!name || !email || !productId) {
      const err = document.getElementById('of-error');
      err.textContent = 'Vul naam, e-mailadres en product in.';
      err.classList.add('visible');
      return;
    }

    const updated = {
      ...order,
      customerName:     name,
      customerEmail:    email,
      deliveryAddress:  document.getElementById('of-address').value.trim(),
      productId,
      productName,
      quantity:         parseInt(document.getElementById('of-qty').value) || null,
      deliveryDate:     document.getElementById('of-delivery').value,
      quoteAmount:      parseFloat(document.getElementById('of-quote').value) || null,
      status:           document.getElementById('of-status').value,
      workType:         document.getElementById('of-worktype').value,
      designFile:       document.getElementById('of-file').value.trim(),
      notes:            document.getElementById('of-notes').value.trim(),
    };

    DS.saveOrder(updated);
    AdminUI.closeModal();
    renderOrdersTable();
    AdminUI.updateBadges();
    AdminUI.showToast(isEdit ? 'Order bijgewerkt' : 'Order aangemaakt');
  });
}
