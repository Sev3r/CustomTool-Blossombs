/**
 * orders.js
 * Orders workflowbord voor Sales, Creatie en Archief.
 * Bestaande orders blijven backward-compatible via workflow-normalisatie.
 */

let orderSearch = '';
let orderStatusFilter = '';
let orderPillFilter = 'sales';
let manualOrderUpload = null;
let draggedOrderId = null;

const SALES_WORKFLOW_STATUSES = [
  { id: 'new_request', label: 'Nieuwe aanvraag' },
  { id: 'quote_required', label: 'Definitieve offerte nodig' },
  { id: 'customer_approval_needed', label: 'Klant akkoord nodig' },
];

const CREATION_DESIGN_STATUSES = [
  { id: 'design_new', label: 'Design new' },
  { id: 'pending', label: 'Pending' },
  { id: 'design_correction', label: 'Design correctie' },
  { id: 'pdf_check', label: 'PDF check' },
];

const CREATION_PRODUCTION_STATUSES = [
  { id: 'order_printwork', label: 'Bestellen drukwerk' },
  { id: 'awaiting_delivery', label: 'In afwachting levering drukwerk' },
];

const CREATION_WORKFLOW_STATUSES = [
  ...CREATION_DESIGN_STATUSES,
  ...CREATION_PRODUCTION_STATUSES,
];

const ARCHIVE_WORKFLOW_STATUSES = [
  { id: 'completed', label: 'Afgerond' },
  { id: 'cancelled', label: 'Geannuleerd' },
];

const ORDER_STATUS_OPTIONS = [
  ...SALES_WORKFLOW_STATUSES,
  ...CREATION_WORKFLOW_STATUSES,
  ...ARCHIVE_WORKFLOW_STATUSES,
].map(status => [status.id, status.label]);

const SALES_FLOW = SALES_WORKFLOW_STATUSES.map(status => status.id);
const CREATION_FREE_FLOW = CREATION_DESIGN_STATUSES.map(status => status.id);
const PRODUCTION_FLOW = CREATION_PRODUCTION_STATUSES.map(status => status.id);
const BLOCKED_DRAG_STATUSES = ['customer_approval_needed', 'order_printwork', 'awaiting_delivery'];

const ORDER_LEGACY_STATUS_MAP = {
  'offerte-aanvraag': { department: 'sales', status: 'new_request', archived: false },
  'offerte-verstuurd': { department: 'sales', status: 'customer_approval_needed', archived: false },
  'wacht-op-klantgoedkeuring': { department: 'sales', status: 'customer_approval_needed', archived: false },
  'wacht-op-ontwerp': { department: 'creation', status: 'design_new', archived: false },
  'wacht-op-bestandscheck': { department: 'creation', status: 'pdf_check', archived: false },
  'wacht-op-interne-controle': { department: 'creation', status: 'pdf_check', archived: false },
  'wacht-op-goedkeuring': { department: 'creation', status: 'pending', archived: false },
  akkoord: { department: 'creation', status: 'design_new', archived: false },
  'in-productie': { department: 'creation', status: 'awaiting_delivery', archived: false },
  printwork_ordered: { department: 'creation', status: 'awaiting_delivery', archived: false },
  verzonden: { department: 'archive', status: 'completed', archived: true },
  afgerond: { department: 'archive', status: 'completed', archived: true },
};

const PRINT_SUPPLIER_OPTIONS = [
  ['', 'Nog niet gekozen'],
  ['solfer', 'Solfer'],
  ['q', 'Q'],
  ['anders', 'Anders'],
];

function renderSalesOrdersPage() {
  orderPillFilter = 'sales';
  renderOrdersPage({
    pageElementId: 'page-sales',
    title: 'Sales',
    subtitle: 'Nieuwe aanvragen, offertes en klantakkoorden',
    statusOptions: SALES_WORKFLOW_STATUSES,
  });
}

function renderCreationOrdersPage() {
  orderPillFilter = 'creation';
  renderOrdersPage({
    pageElementId: 'page-creation',
    title: 'Creatie',
    subtitle: 'Ontwerp, PDF check, drukwerk en levering',
    statusOptions: CREATION_WORKFLOW_STATUSES,
  });
}

function renderOrdersPage({
  pageElementId = 'page-sales',
  title = 'Sales',
  subtitle = 'Werkvoorraad',
  statusOptions = SALES_WORKFLOW_STATUSES,
} = {}) {
  clearInactiveOrderPages(pageElementId);

  const el = document.getElementById(pageElementId);

  if (!el) {
    return;
  }

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${escHtml(title)}</h1>
        <p>${escHtml(subtitle)}</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" type="button" id="btn-order-add">+ Nieuwe order</button>
      </div>
    </div>

    <div class="filter-bar" style="flex-wrap:wrap;gap:8px">
      <div class="search-wrap">
        <span class="search-icon">${iconSearch()}</span>
        <input type="text" id="order-search" placeholder="Zoek op klant, bedrijf, aanvraagnummer..." value="${escHtml(orderSearch)}">
      </div>

      <select class="filter-select" id="order-status-filter">
        <option value="">Alle statussen</option>
        ${statusOptions.map(status => `
          <option value="${status.id}">${escHtml(status.label)}</option>
        `).join('')}
      </select>
    </div>

    <div class="orders-board-wrap" id="orders-table-wrap"></div>
  `;

  document.getElementById('order-search').value = orderSearch;
  document.getElementById('order-status-filter').value = orderStatusFilter;

  document.getElementById('btn-order-add').addEventListener('click', () => openOrderModal());

  document.getElementById('order-search').addEventListener('input', event => {
    orderSearch = event.target.value;
    renderOrdersTable();
  });

  document.getElementById('order-status-filter').addEventListener('change', event => {
    orderStatusFilter = event.target.value;
    renderOrdersTable();
  });

  renderOrdersTable();
}

function clearInactiveOrderPages(activePageElementId) {
  ['page-sales', 'page-creation'].forEach(pageId => {
    if (pageId !== activePageElementId) {
      const page = document.getElementById(pageId);

      if (page) {
        page.innerHTML = '';
      }
    }
  });
}

function renderOrdersTable() {
  const wrap = document.getElementById('orders-table-wrap');

  if (!wrap) {
    return;
  }

  let orders = getFilteredOrders({ includeArchive: false });
  const groups = getWorkflowBoardGroups();
  const visibleStatusIds = groups.flatMap(group => group.statuses.map(status => status.id));

  orders = orders.filter(order => visibleStatusIds.includes(normalizeOrderWorkflow(order).status));

  if (!orders.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${iconClipboard()}</div>
        <h3>Geen orders gevonden</h3>
        <p>Pas het filter aan of voeg een nieuwe order toe.</p>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <div class="orders-board">
      ${groups.map(group => renderWorkflowGroup(group, orders)).join('')}
    </div>
  `;

  bindWorkflowBoardEvents(wrap);
}

function renderArchivePage() {
  const el = document.getElementById('page-archive');

  if (!el) {
    return;
  }

  const orders = getFilteredOrders({ includeArchive: true })
    .filter(order => normalizeOrderWorkflow(order).archived);

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Archief</h1>
        <p>Afgeronde en geannuleerde orders</p>
      </div>
    </div>

    <div class="filter-bar" style="flex-wrap:wrap;gap:8px">
      <div class="search-wrap">
        <span class="search-icon">${iconSearch()}</span>
        <input type="text" id="archive-search" placeholder="Zoek in archief..." value="${escHtml(orderSearch)}">
      </div>
    </div>

    <div class="orders-board-wrap" id="archive-table-wrap">
      ${orders.length ? `
        <div class="orders-board">
          <section class="workflow-group workflow-group-archive">
            <div class="workflow-columns">
              ${ARCHIVE_WORKFLOW_STATUSES.map(status => renderWorkflowColumn(status, orders)).join('')}
            </div>
          </section>
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon">${iconClipboard()}</div>
          <h3>Geen orders in het archief</h3>
          <p>Afgeronde orders komen hier te staan.</p>
        </div>
      `}
    </div>
  `;

  const archiveSearch = document.getElementById('archive-search');

  if (archiveSearch) {
    archiveSearch.addEventListener('input', event => {
      orderSearch = event.target.value;
      renderArchivePage();
    });
  }

  bindWorkflowBoardEvents(el);
}

function getFilteredOrders({ includeArchive }) {
  let orders = DS.getOrders().map(order => ensureOrderWorkflow(order));

  orders = orders.filter(order => includeArchive || !normalizeOrderWorkflow(order).archived);

  if (orderSearch) {
    const query = orderSearch.toLowerCase();

    orders = orders.filter(order =>
      (order.customerName || '').toLowerCase().includes(query) ||
      (order.companyName || '').toLowerCase().includes(query) ||
      (order.customerEmail || '').toLowerCase().includes(query) ||
      (order.orderNumber || '').toLowerCase().includes(query) ||
      (order.officialOrderNumber || '').toLowerCase().includes(query)
    );
  }

  if (orderStatusFilter && !includeArchive) {
    orders = orders.filter(order => normalizeOrderWorkflow(order).status === orderStatusFilter);
  }

  return orders.sort((a, b) => {
    const aValue = a.createdAt || '';
    const bValue = b.createdAt || '';
    return aValue < bValue ? 1 : -1;
  });
}

function getWorkflowBoardGroups() {
  if (orderPillFilter === 'sales') {
    return [{ id: 'sales', title: 'Sales', statuses: SALES_WORKFLOW_STATUSES }];
  }

  if (orderPillFilter === 'creation') {
    return [{ id: 'creation', title: 'Creatie', statuses: CREATION_WORKFLOW_STATUSES }];
  }

  return [
    { id: 'sales', title: 'Sales', statuses: SALES_WORKFLOW_STATUSES },
    { id: 'creation', title: 'Creatie', statuses: CREATION_WORKFLOW_STATUSES },
  ];
}

function renderWorkflowGroup(group, orders) {
  return `
    <section class="workflow-group workflow-group-${escHtml(group.id)}">
      <div class="workflow-group-header">
        <h2>${escHtml(group.title)}</h2>
      </div>

      <div class="workflow-columns" data-workflow-group="${escHtml(group.id)}">
        ${group.statuses.map(status => renderWorkflowColumn(status, orders)).join('')}
      </div>
    </section>
  `;
}

function renderWorkflowColumn(status, orders) {
  const columnOrders = orders.filter(order => normalizeOrderWorkflow(order).status === status.id);

  return `
    <section class="workflow-column" data-status="${escHtml(status.id)}">
      <div class="workflow-column-header">
        <h3>${escHtml(status.label)}</h3>
        <span class="workflow-count">${columnOrders.length}</span>
      </div>

      <div class="workflow-column-body" data-drop-status="${escHtml(status.id)}">
        ${columnOrders.length
      ? columnOrders.map(order => renderWorkflowOrderCard(order)).join('')
      : '<div class="workflow-empty">Geen orders</div>'
    }
      </div>
    </section>
  `;
}

function getDisplayOrderNumber(order) {
  const workflow = normalizeOrderWorkflow(order);
  const exactOrderNumber = workflow.salesHandoff.exactOrderNumber || order.officialOrderNumber || '';

  if ((workflow.department === 'creation' || workflow.archived) && exactOrderNumber) {
    return exactOrderNumber;
  }

  return order.orderNumber || exactOrderNumber || '—';
}

function renderWorkflowOrderCard(order) {
  const workflow = normalizeOrderWorkflow(order);
  const orderId = escHtml(order.id);
  const isDragBlocked = BLOCKED_DRAG_STATUSES.includes(workflow.status) || workflow.archived;
  const customerTitle = order.companyName || order.customerName || 'Onbekende klant';
  const customerSubtitle = order.companyName && order.customerName
    ? `${order.customerName} · ${order.customerEmail || ''}`
    : order.customerEmail || '';
  const missingHandoffFields = workflow.status === 'customer_approval_needed'
    ? getMissingSalesHandoffFields(order)
    : [];
  const missingPrintFields = workflow.status === 'order_printwork'
    ? getMissingPrintOrderFields(order)
    : [];

  return `
    <article class="workflow-card ${isDragBlocked ? 'workflow-card-locked' : ''}" data-order-id="${orderId}" draggable="${isDragBlocked ? 'false' : 'true'}">
      <div class="workflow-card-top">
        <button class="workflow-card-title js-order-overview" type="button" data-order-id="${orderId}">
          <span class="mono">${escHtml(getDisplayOrderNumber(order))}</span>
          <strong>${escHtml(customerTitle)}</strong>
        </button>

        <div class="workflow-card-actions">
          <button class="icon-btn js-order-edit" type="button" data-order-id="${orderId}" title="Bewerken">${iconPen()}</button>
          <button class="icon-btn danger js-order-delete" type="button" data-order-id="${orderId}" title="Verwijderen">${iconTrash()}</button>
        </div>
      </div>

      <div class="workflow-card-body">
        <div class="workflow-card-subtitle">${escHtml(customerSubtitle || 'Geen e-mailadres')}</div>

        <div class="workflow-card-meta">
          <span><strong>Product</strong>${escHtml(order.productName || '—')}</span>
          <span><strong>Aantal</strong>${order.quantity || '—'}</span>
          <span><strong>Leverdatum</strong>${formatDate(getOrderShipDate(order))}</span>
          ${workflow.department === 'sales' && workflow.salesHandoff.exactOrderNumber ? `
            <span><strong>Exact</strong>${escHtml(workflow.salesHandoff.exactOrderNumber)}</span>
          ` : ''}
          ${workflow.department !== 'sales' && order.orderNumber && order.orderNumber !== getDisplayOrderNumber(order) ? `
            <span><strong>Aanvraag</strong>${escHtml(order.orderNumber)}</span>
          ` : ''}
        </div>

        ${missingHandoffFields.length ? renderWorkflowWarning('Nog nodig voor overdracht', missingHandoffFields) : ''}
        ${missingPrintFields.length ? renderWorkflowWarning('Nog nodig voor drukwerk', missingPrintFields) : ''}
        ${workflow.department === 'creation' ? renderProductionWorkflowSummary(order) : ''}

        <div class="workflow-card-footer">
          ${renderWorkflowPrimaryAction(order)}
        </div>
      </div>
    </article>
  `;
}

function renderWorkflowWarning(title, items) {
  return `
    <div class="workflow-warning">
      <strong>${escHtml(title)}:</strong>
      ${items.map(item => `<span>${escHtml(item)}</span>`).join('')}
    </div>
  `;
}

function renderWorkflowPrimaryAction(order) {
  const workflow = normalizeOrderWorkflow(order);

  if (workflow.status === 'customer_approval_needed') {
    return `<button class="btn btn-primary btn-sm js-sales-handoff" type="button" data-order-id="${escHtml(order.id)}">Doorzetten naar Creatie</button>`;
  }

  if (workflow.status === 'order_printwork') {
    return `<button class="btn btn-primary btn-sm js-printwork-order" type="button" data-order-id="${escHtml(order.id)}">Drukwerk bestellen</button>`;
  }

  if (workflow.status === 'awaiting_delivery') {
    return `<button class="btn btn-primary btn-sm js-printwork-received" type="button" data-order-id="${escHtml(order.id)}">Levering ontvangen</button>`;
  }

  if (workflow.archived) {
    return `<span class="badge badge-green">${escHtml(getWorkflowStatusLabel(workflow.status))}</span>`;
  }

  return '<span class="form-hint">Sleep naar een andere kolom</span>';
}

function renderProductionWorkflowSummary(order) {
  const workflow = normalizeOrderWorkflow(order);
  const production = workflow.production || {};
  const parts = [];

  if (hasDefinitiveProductionFiles(order)) {
    parts.push(`<span><strong>Definitief</strong>${production.definitiveFiles.length} bestand(en)</span>`);
  }

  if (production.printSupplier) {
    parts.push(`<span><strong>Leverancier</strong>${escHtml(getPrintSupplierLabel(production.printSupplier))}</span>`);
  }

  if (production.purchaseOrderNumber) {
    parts.push(`<span><strong>Inkoopnummer</strong>${escHtml(production.purchaseOrderNumber)}</span>`);
  }

  if (production.expectedPrintDeliveryDate) {
    parts.push(`<span><strong>Levering drukwerk</strong>${formatDate(production.expectedPrintDeliveryDate)}</span>`);
  }

  return parts.length ? `<div class="workflow-production-summary">${parts.join('')}</div>` : '';
}

function bindWorkflowBoardEvents(root) {
  root.querySelectorAll('.workflow-card[draggable="true"]').forEach(card => {
    card.addEventListener('dragstart', event => {
      draggedOrderId = card.dataset.orderId;
      card.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', draggedOrderId);
    });

    card.addEventListener('dragend', () => {
      draggedOrderId = null;
      card.classList.remove('is-dragging');
      root.querySelectorAll('.workflow-column-body.is-drag-over').forEach(column => column.classList.remove('is-drag-over'));
    });
  });

  root.querySelectorAll('.workflow-column-body[data-drop-status]').forEach(column => {
    column.addEventListener('dragover', event => {
      if (!draggedOrderId) {
        return;
      }

      event.preventDefault();
      column.classList.add('is-drag-over');
    });

    column.addEventListener('dragleave', () => {
      column.classList.remove('is-drag-over');
    });

    column.addEventListener('drop', event => {
      event.preventDefault();
      column.classList.remove('is-drag-over');
      handleWorkflowDrop(draggedOrderId || event.dataTransfer.getData('text/plain'), column.dataset.dropStatus);
    });
  });

  root.querySelectorAll('.js-order-overview').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      openOrderOverview(button.dataset.orderId);
    });
  });

  root.querySelectorAll('.workflow-card').forEach(card => {
    card.addEventListener('click', event => {
      if (event.target.closest('button, input, label, a, select')) {
        return;
      }

      openOrderOverview(card.dataset.orderId);
    });
  });

  root.querySelectorAll('.js-order-edit').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      openOrderModal(button.dataset.orderId);
    });
  });

  root.querySelectorAll('.js-order-delete').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      deleteOrderById(button.dataset.orderId);
    });
  });

  root.querySelectorAll('.js-order-files').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      viewOrderFiles(button.dataset.orderId);
    });
  });

  root.querySelectorAll('.js-sales-handoff').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      openSalesHandoffModal(button.dataset.orderId);
    });
  });

  root.querySelectorAll('.js-printwork-order').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      openPrintworkOrderModal(button.dataset.orderId);
    });
  });

  root.querySelectorAll('.js-printwork-received').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      confirmPrintworkReceived(button.dataset.orderId);
    });
  });
}

function handleWorkflowDrop(orderId, targetStatus) {
  if (!orderId || !targetStatus) {
    return;
  }

  const order = DS.getOrderById(orderId);

  if (!order) {
    AdminUI.showToast('Order niet gevonden', 'error');
    return;
  }

  const workflow = normalizeOrderWorkflow(order);

  if (workflow.status === targetStatus) {
    return;
  }

  if (BLOCKED_DRAG_STATUSES.includes(workflow.status)) {
    AdminUI.showToast(getBlockedDragMessage(workflow.status), 'error');
    renderCurrentOrdersView();
    return;
  }

  const validation = validateWorkflowMove(order, targetStatus);

  if (!validation.allowed) {
    if (validation.action === 'sales-handoff') {
      openSalesHandoffModal(orderId);
      return;
    }

    if (validation.action === 'definitive-files') {
      openDefinitiveFilesModal(orderId, targetStatus);
      return;
    }

    AdminUI.showToast(validation.message, 'error');
    renderCurrentOrdersView();
    return;
  }

  saveOrderStatus(order, targetStatus);
  AdminUI.showToast(`Order verplaatst naar ${getWorkflowStatusLabel(targetStatus)}`);
}

function validateWorkflowMove(order, targetStatus) {
  const workflow = normalizeOrderWorkflow(order);
  const currentStatus = workflow.status;

  if (workflow.archived) {
    return { allowed: false, message: 'Gearchiveerde orders kunnen niet worden versleept.' };
  }

  if (SALES_FLOW.includes(currentStatus)) {
    if (!SALES_FLOW.includes(targetStatus) && targetStatus !== 'design_new') {
      return { allowed: false, message: 'Sales orders kunnen alleen via klantakkoord naar Creatie.' };
    }

    if (targetStatus === 'design_new') {
      return canMoveOrderToCreation(order)
        ? { allowed: true }
        : { allowed: false, action: 'sales-handoff' };
    }

    return SALES_FLOW.indexOf(targetStatus) > SALES_FLOW.indexOf(currentStatus)
      ? { allowed: true }
      : { allowed: false, message: 'Binnen Sales kan de flow alleen vooruit.' };
  }

  if (CREATION_FREE_FLOW.includes(currentStatus)) {
    if (CREATION_FREE_FLOW.includes(targetStatus)) {
      return { allowed: true };
    }

    if (targetStatus === 'order_printwork') {
      return hasDefinitiveProductionFiles(order)
        ? { allowed: true }
        : { allowed: false, action: 'definitive-files' };
    }

    return { allowed: false, message: 'Deze verplaatsing past niet binnen de Creatie-flow.' };
  }

  if (PRODUCTION_FLOW.includes(currentStatus)) {
    return { allowed: false, message: getBlockedDragMessage(currentStatus) };
  }

  return { allowed: false, message: 'Deze status kan niet worden verplaatst.' };
}

function getBlockedDragMessage(status) {
  const messages = {
    customer_approval_needed: 'Vul eerst de Sales-overdracht in. Daarna gaat de order automatisch naar Creatie.',
    order_printwork: 'Vul eerst de drukwerkgegevens in. Daarna gaat de order automatisch naar in afwachting levering.',
    awaiting_delivery: 'Bevestig eerst dat de levering ontvangen is. Daarna gaat de order naar het archief.',
  };

  return messages[status] || 'Deze order kan niet versleept worden.';
}

function saveOrderStatus(order, status, overrides = {}) {
  const workflow = buildWorkflowForStatus(order, status, overrides.workflow || {});

  DS.saveOrder({
    ...order,
    ...overrides.order,
    status,
    workflow,
  });

  renderCurrentOrdersView();
  AdminUI.updateBadges();
}

function renderCurrentOrdersView() {
  if (location.hash === '#archive') {
    renderArchivePage();
    return;
  }

  if (location.hash === '#creation') {
    renderCreationOrdersPage();
    return;
  }

  renderSalesOrdersPage();
}

function ensureOrderWorkflow(order) {
  const workflow = normalizeOrderWorkflow(order);

  if (!order.workflow || order.workflow.status !== workflow.status || order.workflow.department !== workflow.department) {
    return { ...order, workflow };
  }

  return order;
}

function normalizeOrderWorkflow(order = {}) {
  const legacyWorkflow = ORDER_LEGACY_STATUS_MAP[order.status] || null;
  const workflow = order.workflow || {};
  const workflowStatusFromOrder = isKnownWorkflowStatus(order.status) ? order.status : null;
  const rawStatus = workflow.status || workflowStatusFromOrder || legacyWorkflow?.status || 'new_request';
  const status = rawStatus === 'printwork_ordered' ? 'awaiting_delivery' : rawStatus;
  const department = workflow.department || legacyWorkflow?.department || getDepartmentForWorkflowStatus(status);
  const archived = Boolean(workflow.archived || legacyWorkflow?.archived || isArchiveWorkflowStatus(status));
  const salesHandoff = workflow.salesHandoff || {};
  const production = workflow.production || {};

  return {
    department: archived ? 'archive' : department,
    status,
    archived,
    salesHandoffCompleted: Boolean(workflow.salesHandoffCompleted || false),
    salesHandoff: {
      exactOrderNumber: salesHandoff.exactOrderNumber || order.officialOrderNumber || '',
      expectedDeliveryDate: salesHandoff.expectedDeliveryDate || getOrderShipDate(order) || '',
      customerApprovedAt: salesHandoff.customerApprovedAt || null,
      approvedBy: salesHandoff.approvedBy || '',
      salesNotes: salesHandoff.salesNotes || '',
    },
    production: {
      definitiveFiles: Array.isArray(production.definitiveFiles) ? production.definitiveFiles : [],
      printSupplier: production.printSupplier || '',
      purchaseOrderNumber: production.purchaseOrderNumber || '',
      expectedPrintDeliveryDate: production.expectedPrintDeliveryDate || '',
      orderedAt: production.orderedAt || null,
      receivedAt: production.receivedAt || null,
    },
  };
}

function isKnownWorkflowStatus(status) {
  return ORDER_STATUS_OPTIONS.some(([value]) => value === status) || status === 'printwork_ordered';
}

function getDepartmentForWorkflowStatus(status) {
  if (SALES_WORKFLOW_STATUSES.some(item => item.id === status)) {
    return 'sales';
  }

  if (CREATION_WORKFLOW_STATUSES.some(item => item.id === status)) {
    return 'creation';
  }

  if (ARCHIVE_WORKFLOW_STATUSES.some(item => item.id === status)) {
    return 'archive';
  }

  return 'sales';
}

function isArchiveWorkflowStatus(status) {
  return ARCHIVE_WORKFLOW_STATUSES.some(item => item.id === status);
}

function buildWorkflowForStatus(order, status, overrides = {}) {
  const current = normalizeOrderWorkflow(order);
  const department = getDepartmentForWorkflowStatus(status);
  const archived = isArchiveWorkflowStatus(status);

  return {
    ...current,
    ...overrides,
    department,
    status,
    archived,
    salesHandoff: {
      ...current.salesHandoff,
      ...(overrides.salesHandoff || {}),
    },
    production: {
      ...current.production,
      ...(overrides.production || {}),
    },
  };
}

function getWorkflowStatusLabel(status) {
  const match = ORDER_STATUS_OPTIONS.find(([value]) => value === status);
  return match ? match[1] : status || '—';
}

function getMissingSalesHandoffFields(order) {
  const workflow = normalizeOrderWorkflow(order);
  const missing = [];

  if (!workflow.salesHandoff.exactOrderNumber && !order.officialOrderNumber) {
    missing.push('Ordernummer Exact');
  }

  if (!workflow.salesHandoff.expectedDeliveryDate && !getOrderShipDate(order)) {
    missing.push('Verwachte leverdatum');
  }

  if (!workflow.salesHandoff.customerApprovedAt) {
    missing.push('Klant akkoord bevestigd');
  }

  return missing;
}

function canMoveOrderToCreation(order) {
  return getMissingSalesHandoffFields(order).length === 0;
}

function hasDefinitiveProductionFiles(order) {
  const workflow = normalizeOrderWorkflow(order);
  return workflow.production.definitiveFiles.length > 0;
}

function getMissingPrintOrderFields(order) {
  const workflow = normalizeOrderWorkflow(order);
  const missing = [];

  if (!hasDefinitiveProductionFiles(order)) {
    missing.push('Definitieve documenten');
  }

  if (!workflow.production.printSupplier) {
    missing.push('Leverancier');
  }

  if (!workflow.production.purchaseOrderNumber) {
    missing.push('Inkoopnummer');
  }

  if (!workflow.production.expectedPrintDeliveryDate) {
    missing.push('Verwachte levering drukwerk');
  }

  return missing;
}

function canViewOrderFiles(order) {
  const workflow = normalizeOrderWorkflow(order);
  return (workflow.department === 'creation' || workflow.department === 'archive') && hasOrderFiles(order);
}

function canDownloadQuote(order) {
  const workflow = normalizeOrderWorkflow(order);
  return workflow.department === 'sales' || workflow.department === 'archive';
}

function openSalesHandoffModal(id) {
  const order = DS.getOrderById(id);

  if (!order) {
    AdminUI.showToast('Order niet gevonden', 'error');
    return;
  }

  const workflow = normalizeOrderWorkflow(order);

  const body = `
    <div class="section-title">Overdracht Sales naar Creatie</div>
    <p style="font-size:13px;color:var(--text-2);line-height:1.5">Vul deze velden in voordat de order wordt doorgezet naar Creatie.</p>

    <div class="form-row">
      <div class="form-group">
        <label>Ordernummer Exact *</label>
        <input type="text" id="handoff-exact-order-number" value="${escHtml(workflow.salesHandoff.exactOrderNumber || order.officialOrderNumber || '')}" placeholder="Bijvoorbeeld 2026-000123">
      </div>
      <div class="form-group">
        <label>Verwachte leverdatum *</label>
        <input type="date" id="handoff-expected-delivery-date" value="${escHtml(workflow.salesHandoff.expectedDeliveryDate || getOrderShipDate(order) || '')}">
        <span class="form-hint">Interne richtdatum. Deze datum is pas definitief na controle en bevestiging.</span>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Akkoord bevestigd door</label>
        <input type="text" id="handoff-approved-by" value="${escHtml(workflow.salesHandoff.approvedBy || '')}" placeholder="Naam medewerker">
      </div>
      <div class="form-group">
        <label>Klant akkoord bevestigd *</label>
        <label class="admin-toggle-row" style="box-shadow:none">
          <span><strong>Ja, klant heeft akkoord gegeven</strong><small>Bijvoorbeeld via mail of offertebevestiging.</small></span>
          <span class="toggle">
            <input type="checkbox" id="handoff-customer-approved" ${workflow.salesHandoff.customerApprovedAt ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </span>
        </label>
      </div>
    </div>

    <div class="form-row-1">
      <div class="form-group">
        <label>Salesnotitie</label>
        <textarea id="handoff-sales-notes" placeholder="Interne informatie voor Creatie">${escHtml(workflow.salesHandoff.salesNotes || '')}</textarea>
      </div>
    </div>

    <div id="handoff-error" class="form-error"></div>
  `;

  AdminUI.openModal({
    title: `Doorzetten naar Creatie — ${order.orderNumber || 'aanvraag'}`,
    body,
    footer: `
      <button class="btn btn-secondary" type="button" onclick="AdminUI.closeModal()">Annuleren</button>
      <button class="btn btn-primary" type="button" id="btn-sales-handoff-save">Doorzetten naar Creatie</button>
    `,
  });

  document.getElementById('btn-sales-handoff-save').addEventListener('click', () => {
    const exactOrderNumber = document.getElementById('handoff-exact-order-number').value.trim();
    const expectedDeliveryDate = document.getElementById('handoff-expected-delivery-date').value;
    const approved = document.getElementById('handoff-customer-approved').checked;
    const error = document.getElementById('handoff-error');

    if (!exactOrderNumber || !expectedDeliveryDate || !approved) {
      error.textContent = 'Vul ordernummer Exact en verwachte leverdatum in en bevestig dat de klant akkoord heeft gegeven.';
      error.classList.add('visible');
      return;
    }

    saveOrderStatus(order, 'design_new', {
      order: {
        officialOrderNumber: exactOrderNumber,
        shippingDate: expectedDeliveryDate,
        shipDate: expectedDeliveryDate,
        deliveryDate: expectedDeliveryDate,
      },
      workflow: {
        salesHandoffCompleted: true,
        salesHandoff: {
          exactOrderNumber,
          expectedDeliveryDate,
          customerApprovedAt: workflow.salesHandoff.customerApprovedAt || new Date().toISOString(),
          approvedBy: document.getElementById('handoff-approved-by').value.trim(),
          salesNotes: document.getElementById('handoff-sales-notes').value.trim(),
        },
      },
    });

    AdminUI.closeModal();
    AdminUI.showToast('Order doorgezet naar Creatie');
  });
}

function openDefinitiveFilesModal(id, targetStatus = 'order_printwork') {
  const order = DS.getOrderById(id);

  if (!order) {
    AdminUI.showToast('Order niet gevonden', 'error');
    return;
  }

  const workflow = normalizeOrderWorkflow(order);

  const body = `
    <div class="section-title">Definitieve documenten uploaden</div>
    <p style="font-size:13px;color:var(--text-2);line-height:1.5">
      Upload de definitieve documenten voordat de order naar Bestellen drukwerk gaat.
    </p>

    ${workflow.production.definitiveFiles.length ? `
      <div class="overview-grid">
        <div class="overview-item overview-wide">
          <span class="overview-label">Huidige definitieve documenten</span>
          <span class="overview-value">${workflow.production.definitiveFiles.map(file => escHtml(file.name)).join('<br>')}</span>
        </div>
      </div>
    ` : ''}

    <div class="form-row-1">
      <div class="form-group">
        <label>Definitieve documenten *</label>
        <input type="file" id="definitive-files" multiple accept=".pdf,.ai,.eps,.png,.jpg,.jpeg">
        <span class="form-hint">PDF, AI, EPS, PNG of JPG. Later bij hosting worden deze bestanden naar storage verplaatst.</span>
      </div>
    </div>

    <div id="definitive-files-error" class="form-error"></div>
  `;

  AdminUI.openModal({
    title: `Definitieve documenten — ${order.orderNumber || 'aanvraag'}`,
    body,
    footer: `
      <button class="btn btn-secondary" type="button" onclick="AdminUI.closeModal()">Annuleren</button>
      <button class="btn btn-primary" type="button" id="btn-definitive-files-save">Opslaan en doorzetten</button>
    `,
  });

  document.getElementById('btn-definitive-files-save').addEventListener('click', async () => {
    const input = document.getElementById('definitive-files');
    const error = document.getElementById('definitive-files-error');
    const files = Array.from(input.files || []);

    if (!files.length && !workflow.production.definitiveFiles.length) {
      error.textContent = 'Upload minimaal één definitief document.';
      error.classList.add('visible');
      return;
    }

    try {
      const uploadedFiles = files.length ? await readFilesAsDataURLs(files) : [];
      saveOrderStatus(order, targetStatus, {
        workflow: {
          production: {
            definitiveFiles: [...workflow.production.definitiveFiles, ...uploadedFiles],
          },
        },
      });

      AdminUI.closeModal();
      AdminUI.showToast('Definitieve documenten opgeslagen');
    } catch (errorObject) {
      console.warn('Definitieve documenten lezen mislukt', errorObject);
      error.textContent = 'Bestanden konden niet worden gelezen.';
      error.classList.add('visible');
    }
  });
}

function openPrintworkOrderModal(id) {
  const order = DS.getOrderById(id);

  if (!order) {
    AdminUI.showToast('Order niet gevonden', 'error');
    return;
  }

  const workflow = normalizeOrderWorkflow(order);
  const supplierOptions = PRINT_SUPPLIER_OPTIONS.map(([value, label]) =>
    `<option value="${value}" ${workflow.production.printSupplier === value ? 'selected' : ''}>${label}</option>`
  ).join('');

  const body = `
    <div class="section-title">Drukwerk bestellen</div>
    <p style="font-size:13px;color:var(--text-2);line-height:1.5">
      Vul de drukwerkgegevens in. Daarna gaat de order automatisch naar In afwachting levering drukwerk.
    </p>

    <div class="overview-grid">
      <div class="overview-item overview-wide">
        <span class="overview-label">Definitieve documenten</span>
        <span class="overview-value">${workflow.production.definitiveFiles.length ? workflow.production.definitiveFiles.map(file => escHtml(file.name)).join('<br>') : 'Nog niet geüpload'}</span>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Leverancier *</label>
        <select id="printwork-supplier">${supplierOptions}</select>
      </div>
      <div class="form-group">
        <label>Inkoopnummer *</label>
        <input type="text" id="printwork-purchase-order" value="${escHtml(workflow.production.purchaseOrderNumber || '')}" placeholder="Inkoopnummer">
      </div>
    </div>

    <div class="form-row-1">
      <div class="form-group">
        <label>Verwachte levering drukwerk *</label>
        <input type="date" id="printwork-expected-delivery" value="${escHtml(workflow.production.expectedPrintDeliveryDate || '')}">
      </div>
    </div>

    <div id="printwork-error" class="form-error"></div>
  `;

  AdminUI.openModal({
    title: `Drukwerk bestellen — ${order.orderNumber || 'aanvraag'}`,
    body,
    footer: `
      <button class="btn btn-secondary" type="button" onclick="AdminUI.closeModal()">Annuleren</button>
      <button class="btn btn-primary" type="button" id="btn-printwork-save">Opslaan en doorzetten</button>
    `,
  });

  document.getElementById('btn-printwork-save').addEventListener('click', () => {
    const printSupplier = document.getElementById('printwork-supplier').value;
    const purchaseOrderNumber = document.getElementById('printwork-purchase-order').value.trim();
    const expectedPrintDeliveryDate = document.getElementById('printwork-expected-delivery').value;
    const error = document.getElementById('printwork-error');

    if (!hasDefinitiveProductionFiles(order) || !printSupplier || !purchaseOrderNumber || !expectedPrintDeliveryDate) {
      error.textContent = 'Upload definitieve documenten en vul leverancier, inkoopnummer en verwachte levering in.';
      error.classList.add('visible');
      return;
    }

    saveOrderStatus(order, 'awaiting_delivery', {
      workflow: {
        production: {
          printSupplier,
          purchaseOrderNumber,
          expectedPrintDeliveryDate,
          orderedAt: workflow.production.orderedAt || new Date().toISOString(),
        },
      },
    });

    AdminUI.closeModal();
    AdminUI.showToast('Drukwerk besteld');
  });
}

async function confirmPrintworkReceived(id) {
  const order = DS.getOrderById(id);

  if (!order) {
    AdminUI.showToast('Order niet gevonden', 'error');
    return;
  }

  const ok = await AdminUI.confirmDialog('Is de levering van het drukwerk ontvangen?', {
    title: 'Levering ontvangen',
    confirmLabel: 'Ja, ontvangen',
    confirmClass: 'btn-primary',
  });

  if (!ok) {
    return;
  }

  saveOrderStatus(order, 'completed', {
    workflow: {
      production: {
        receivedAt: new Date().toISOString(),
      },
    },
  });

  AdminUI.showToast('Order verplaatst naar archief');
}

function readFilesAsDataURLs(files) {
  return Promise.all(files.map(file => new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = event => {
      resolve({
        id: `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        type: file.type || getFileTypeFromName(file.name),
        size: file.size,
        dataURL: event.target.result,
        uploadedAt: new Date().toISOString(),
      });
    };

    reader.onerror = () => reject(new Error(`Bestand kon niet worden gelezen: ${file.name}`));
    reader.readAsDataURL(file);
  })));
}

function openOrderOverview(id) {
  const order = DS.getOrderById(id);

  if (!order) {
    AdminUI.showToast('Order niet gevonden', 'error');
    return;
  }

  const workflow = normalizeOrderWorkflow(order);
  const pdfAvailable = Boolean(getOrderPdfDataURL(order));
  const rillinesPdfAvailable = Boolean(getOrderRillinesPdfDataURL(order));
  const showQuote = canDownloadQuote(order);
  const showFiles = canViewOrderFiles(order);
  const displayOrderNumber = getDisplayOrderNumber(order);

  const body = `
    <div class="order-overview">
      <div class="section-title">Aanvraag</div>
      <div class="overview-grid">
        <div class="overview-item">
          <span class="overview-label">Ordernummer</span>
          <span class="overview-value mono">${escHtml(displayOrderNumber)}</span>
        </div>

        ${order.orderNumber && order.orderNumber !== displayOrderNumber ? `
          <div class="overview-item">
            <span class="overview-label">Aanvraagnummer</span>
            <span class="overview-value mono">${escHtml(order.orderNumber)}</span>
          </div>
        ` : ''}

        <div class="overview-item">
          <span class="overview-label">Ordernummer Exact</span>
          <span class="overview-value mono">${escHtml(workflow.salesHandoff.exactOrderNumber || order.officialOrderNumber || 'Nog niet ingevuld')}</span>
        </div>

        <div class="overview-item">
          <span class="overview-label">Aanvraagdatum</span>
          <span class="overview-value">${formatDate(order.createdAt)}</span>
        </div>

        <div class="overview-item">
          <span class="overview-label">Verwachte leverdatum</span>
          <span class="overview-value">${formatDate(getOrderShipDate(order))}</span>
        </div>

        <div class="overview-item">
          <span class="overview-label">Workflowstatus</span>
          <span class="overview-value">${orderStatusBadge(workflow.status)}</span>
        </div>

        <div class="overview-item">
          <span class="overview-label">Afdeling</span>
          <span class="overview-value">${formatWorkflowDepartment(workflow.department)}</span>
        </div>
      </div>

      ${renderSalesHandoffOverview(order)}
      ${renderCustomerOverview(order)}
      ${renderProductOverview(order)}
      ${showFiles ? renderOrderFilesOverview(order) : ''}
      ${workflow.department !== 'sales' ? renderProductionWorkflowOverview(order) : ''}
      ${workflow.department !== 'sales' ? renderProductionInstructionOverview(order) : ''}

      <div class="section-title" style="margin-top:18px">Interne notities</div>
      <div class="overview-grid">
        <div class="overview-item overview-wide">
          <span class="overview-label">Notities</span>
          <span class="overview-value">${escHtml(order.notes || '—')}</span>
        </div>
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" type="button" onclick="AdminUI.closeModal()">Sluiten</button>
    ${showQuote ? `<button class="btn btn-secondary" type="button" onclick="generateOrderPDF('${order.id}')">Download offerte PDF</button>` : ''}
    ${showFiles && pdfAvailable ? `<button class="btn btn-secondary" type="button" onclick="downloadPrintPDF('${order.id}')">Download drukbestand PDF</button>` : ''}
    ${showFiles && rillinesPdfAvailable ? `<button class="btn btn-secondary" type="button" onclick="downloadRillinesPDF('${order.id}')">Download drukbestand met rillijnen</button>` : ''}
    ${workflow.status === 'customer_approval_needed' ? `<button class="btn btn-primary" type="button" onclick="openSalesHandoffModal('${order.id}')">Doorzetten naar Creatie</button>` : ''}
    ${workflow.status === 'order_printwork' ? `<button class="btn btn-primary" type="button" onclick="openPrintworkOrderModal('${order.id}')">Drukwerk bestellen</button>` : ''}
    ${workflow.status === 'awaiting_delivery' ? `<button class="btn btn-primary" type="button" onclick="confirmPrintworkReceived('${order.id}')">Levering ontvangen</button>` : ''}
    <button class="btn btn-primary" type="button" onclick="openOrderModal('${order.id}')">Aanpassen</button>
  `;

  AdminUI.openModal({
    title: `Orderoverzicht — ${displayOrderNumber}`,
    body,
    footer,
  });
}

function renderCustomerOverview(order) {
  return `
    <div class="section-title" style="margin-top:18px">Klantgegevens</div>
    <div class="overview-grid">
      <div class="overview-item"><span class="overview-label">Bedrijfsnaam</span><span class="overview-value">${escHtml(order.companyName || '—')}</span></div>
      <div class="overview-item"><span class="overview-label">Contactpersoon</span><span class="overview-value">${escHtml(order.customerName || '—')}</span></div>
      <div class="overview-item"><span class="overview-label">E-mail</span><span class="overview-value">${escHtml(order.customerEmail || '—')}</span></div>
      <div class="overview-item"><span class="overview-label">Telefoon</span><span class="overview-value">${escHtml(order.telefoon || order.phone || '—')}</span></div>
      <div class="overview-item"><span class="overview-label">BTW-nummer</span><span class="overview-value">${escHtml(order.vatNumber || order.btwNumber || '—')}</span></div>
      <div class="overview-item"><span class="overview-label">KVK-nummer</span><span class="overview-value">${escHtml(order.kvk || '—')}</span></div>
      <div class="overview-item overview-wide"><span class="overview-label">Adres</span><span class="overview-value">${escHtml(formatOrderAddress(order) || '—')}</span></div>
      <div class="overview-item overview-wide"><span class="overview-label">Factuuradres</span><span class="overview-value">${escHtml(order.billingAddress || order.invoiceAddress || '—')}</span></div>
    </div>
  `;
}

function renderProductOverview(order) {
  return `
    <div class="section-title" style="margin-top:18px">Product en prijs</div>
    <div class="overview-grid">
      <div class="overview-item"><span class="overview-label">Product</span><span class="overview-value">${escHtml(order.productName || '—')}</span></div>
      <div class="overview-item"><span class="overview-label">Aantal</span><span class="overview-value">${order.quantity || '—'}</span></div>
      <div class="overview-item"><span class="overview-label">Personalisatie</span><span class="overview-value">${escHtml(order.persTypeLabel || '—')}</span></div>
      <div class="overview-item"><span class="overview-label">Afmetingen</span><span class="overview-value">${escHtml(order.persTypeDims || '—')}</span></div>
      <div class="overview-item"><span class="overview-label">Stukprijs</span><span class="overview-value">${formatEuro(order.unitPrice)}</span></div>
      <div class="overview-item"><span class="overview-label">Offertebedrag</span><span class="overview-value">${formatEuro(order.quoteAmount)}</span></div>
      <div class="overview-item"><span class="overview-label">Werktype</span><span class="overview-value">${formatWorkType(order.workType)}</span></div>
      <div class="overview-item"><span class="overview-label">Extra opties</span><span class="overview-value">${formatAddons(order.addons)}</span></div>
    </div>
  `;
}

function renderSalesHandoffOverview(order) {
  const workflow = normalizeOrderWorkflow(order);

  return `
    <div class="section-title" style="margin-top:18px">Sales overdracht</div>
    <div class="overview-grid">
      <div class="overview-item"><span class="overview-label">Ordernummer Exact</span><span class="overview-value">${escHtml(workflow.salesHandoff.exactOrderNumber || '—')}</span></div>
      <div class="overview-item"><span class="overview-label">Verwachte leverdatum</span><span class="overview-value">${formatDate(workflow.salesHandoff.expectedDeliveryDate)}</span></div>
      <div class="overview-item"><span class="overview-label">Klant akkoord</span><span class="overview-value">${workflow.salesHandoff.customerApprovedAt ? formatDate(workflow.salesHandoff.customerApprovedAt) : 'Nog niet bevestigd'}</span></div>
      <div class="overview-item"><span class="overview-label">Akkoord bevestigd door</span><span class="overview-value">${escHtml(workflow.salesHandoff.approvedBy || '—')}</span></div>
      <div class="overview-item overview-wide"><span class="overview-label">Salesnotitie</span><span class="overview-value">${escHtml(workflow.salesHandoff.salesNotes || '—')}</span></div>
    </div>
  `;
}

function renderOrderFilesOverview(order) {
  const workflow = normalizeOrderWorkflow(order);

  return `
    <div class="section-title" style="margin-top:18px">Bestanden</div>
    <div class="overview-grid">
      <div class="overview-item">
        <span class="overview-label">Bestandsnaam</span>
        <span class="overview-value">${escHtml(order.designFile || '—')}</span>
      </div>

      <div class="overview-item">
        <span class="overview-label">Drukbestand PDF</span>
        <span class="overview-value">${getOrderPdfDataURL(order) ? 'Beschikbaar' : 'Niet beschikbaar'}</span>
      </div>

      <div class="overview-item">
        <span class="overview-label">Drukbestand met rillijnen</span>
        <span class="overview-value">${getOrderRillinesPdfDataURL(order) ? 'Beschikbaar' : 'Niet beschikbaar'}</span>
      </div>

      <div class="overview-item overview-wide">
        <span class="overview-label">Definitieve documenten</span>
        <span class="overview-value">
          ${workflow.production.definitiveFiles.length
      ? workflow.production.definitiveFiles.map(file => escHtml(file.name)).join('<br>')
      : 'Nog niet geüpload'
    }
        </span>
      </div>

      ${order.wensen ? `
        <div class="overview-item overview-wide">
          <span class="overview-label">Wensenformulier</span>
          <span class="overview-value">${formatWensen(order.wensen)}</span>
        </div>
      ` : ''}
    </div>
  `;
}

function renderProductionWorkflowOverview(order) {
  const workflow = normalizeOrderWorkflow(order);
  const production = workflow.production || {};

  return `
    <div class="section-title" style="margin-top:18px">Creatie en drukwerk</div>
    <div class="overview-grid">
      <div class="overview-item"><span class="overview-label">Leverancier drukwerk</span><span class="overview-value">${escHtml(getPrintSupplierLabel(production.printSupplier))}</span></div>
      <div class="overview-item"><span class="overview-label">Inkoopnummer</span><span class="overview-value">${escHtml(production.purchaseOrderNumber || '—')}</span></div>
      <div class="overview-item"><span class="overview-label">Verwachte levering drukwerk</span><span class="overview-value">${formatDate(production.expectedPrintDeliveryDate)}</span></div>
      <div class="overview-item"><span class="overview-label">Ontvangen op</span><span class="overview-value">${formatDate(production.receivedAt)}</span></div>
    </div>
  `;
}

function renderProductionInstructionOverview(order) {
  const instruction = buildProductionInstruction(order);

  return `
    <div class="section-title" style="margin-top:18px">Productie-instructie</div>
    <div class="overview-grid">
      <div class="overview-item overview-wide">
        <span class="overview-label">Instructie voor creatie / prepress</span>
        <span class="overview-value"><pre style="white-space:pre-wrap;font-family:var(--font-mono);font-size:12px;line-height:1.5;margin:0">${escHtml(instruction)}</pre></span>
      </div>
      <div class="overview-item overview-wide">
        <span class="overview-label">Actie</span>
        <span class="overview-value"><button class="btn btn-secondary btn-sm" type="button" onclick="copyProductionInstruction('${escHtml(order.id)}')">Kopieer productie-instructie</button></span>
      </div>
    </div>
  `;
}

function buildProductionInstruction(order) {
  const workflow = normalizeOrderWorkflow(order);
  const production = workflow.production;
  const printSpec = order.printSpec || {};

  return [
    `Aanvraag: ${order.orderNumber || '—'}`,
    `Ordernummer Exact: ${workflow.salesHandoff.exactOrderNumber || order.officialOrderNumber || 'Nog niet ingevuld'}`,
    `Workflowstatus: ${getWorkflowStatusLabel(workflow.status)}`,
    `Klant: ${order.companyName || order.customerName || '—'}`,
    `Contactpersoon: ${order.customerName || '—'}`,
    `Product: ${order.productName || '—'}`,
    `Personalisatie: ${order.persTypeLabel || '—'}`,
    `Aantal: ${order.quantity || '—'}`,
    `Verwachte leverdatum: ${workflow.salesHandoff.expectedDeliveryDate || getOrderShipDate(order) || '—'}`,
    `Ontwerpbron: ${getOrderDesignSource(order)}`,
    `Bestandsnaam: ${order.designFile || '—'}`,
    '',
    `Definitieve documenten: ${production.definitiveFiles.length ? production.definitiveFiles.map(file => file.name).join(', ') : 'Nog niet geüpload'}`,
    `Leverancier drukwerk: ${getPrintSupplierLabel(production.printSupplier)}`,
    `Inkoopnummer: ${production.purchaseOrderNumber || '—'}`,
    `Verwachte levering drukwerk: ${production.expectedPrintDeliveryDate || '—'}`,
    '',
    `Eindformaat: ${formatPrintSizePlain(printSpec.finishWidthMm, printSpec.finishHeightMm)}`,
    `Afloop: ${formatMmPlain(printSpec.bleedMm)}`,
    `Exportformaat: ${formatPrintSizePlain(printSpec.exportWidthMm, printSpec.exportHeightMm)}`,
    `Veilige marge: ${formatMmPlain(printSpec.safeMarginMm)}`,
    `DPI advies: ${printSpec.dpi || '—'}`,
    '',
    'Adobe actie: CMYK, kleurprofiel, PDF/X en definitieve preflight uitvoeren.',
    'Controleer daarnaast of TrimBox, BleedBox, snijtekens, afloop en rillijnen correct staan.',
  ].join('\n');
}

async function copyProductionInstruction(id) {
  const order = DS.getOrderById(id);

  if (!order) {
    AdminUI.showToast('Order niet gevonden', 'error');
    return;
  }

  const instruction = buildProductionInstruction(order);

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(instruction);
    } else {
      copyTextFallback(instruction);
    }

    AdminUI.showToast('Productie-instructie gekopieerd');
  } catch (error) {
    console.warn('Kopiëren mislukt', error);
    copyTextFallback(instruction);
    AdminUI.showToast('Productie-instructie gekopieerd');
  }
}

function copyTextFallback(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';

  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

async function deleteOrderById(id) {
  const ok = await AdminUI.confirmDialog('Weet je zeker dat je deze order wilt verwijderen?');

  if (!ok) {
    return;
  }

  DS.deleteOrder(id);
  renderCurrentOrdersView();
  AdminUI.updateBadges();
  AdminUI.showToast('Order verwijderd');
}

function viewOrderFiles(id) {
  const order = DS.getOrderById(id);

  if (!order) {
    return;
  }

  if (!canViewOrderFiles(order)) {
    AdminUI.showToast('Bestanden zijn niet beschikbaar in deze fase.', 'error');
    return;
  }

  const workflow = normalizeOrderWorkflow(order);
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:20px';

  if (order.designDataURL && order.designDataURL.startsWith('data:image')) {
    body.innerHTML += `<div><div class="section-title">Ontwerp preview</div><div style="margin-top:10px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;display:inline-block"><img src="${order.designDataURL}" alt="Ontwerp preview" style="max-width:100%;max-height:320px;display:block"></div></div>`;
  }

  if (getOrderPdfDataURL(order)) {
    body.innerHTML += `<div><div class="section-title">Drukbestand PDF</div><button class="btn btn-secondary btn-sm" type="button" onclick="downloadPrintPDF('${id}')">Download drukbestand PDF</button></div>`;
  }

  if (getOrderRillinesPdfDataURL(order)) {
    body.innerHTML += `<div><div class="section-title">Drukbestand met rillijnen</div><button class="btn btn-secondary btn-sm" type="button" onclick="downloadRillinesPDF('${id}')">Download drukbestand met rillijnen</button></div>`;
  }

  if (workflow.production.definitiveFiles.length) {
    body.innerHTML += `
      <div>
        <div class="section-title">Definitieve documenten</div>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
          ${workflow.production.definitiveFiles.map(file => `
            <button class="btn btn-secondary btn-sm" type="button" onclick="downloadDefinitiveFile('${id}', '${escHtml(file.id)}')">
              Download ${escHtml(file.name)}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (order.wensen) {
    body.innerHTML += `<div><div class="section-title">Wensenformulier</div><div style="margin-top:10px;font-size:13px">${formatWensen(order.wensen)}</div></div>`;
  }

  if (!body.innerHTML.trim()) {
    body.innerHTML = '<p style="color:var(--text-3);font-size:13px">Geen bestanden gekoppeld aan deze order.</p>';
  }

  AdminUI.openModal({
    title: `Bestanden — ${order.orderNumber}`,
    body,
    footer: `<button class="btn btn-secondary" type="button" onclick="AdminUI.closeModal()">Sluiten</button>`,
  });
}

function downloadDefinitiveFile(id, fileId) {
  const order = DS.getOrderById(id);
  const file = normalizeOrderWorkflow(order).production.definitiveFiles.find(item => item.id === fileId);

  if (!file?.dataURL) {
    AdminUI.showToast('Bestand niet gevonden', 'error');
    return;
  }

  downloadDataURL(file.dataURL, file.name || 'definitief-document');
}

function downloadPrintPDF(id) {
  const order = DS.getOrderById(id);
  const pdfDataURL = order ? getOrderPdfDataURL(order) : '';

  if (!pdfDataURL) {
    AdminUI.showToast('Geen drukbestand PDF beschikbaar', 'error');
    return;
  }

  downloadDataURL(pdfDataURL, `drukbestand-${getDisplayOrderNumber(order)}.pdf`);
}

function downloadRillinesPDF(id) {
  const order = DS.getOrderById(id);
  const pdfDataURL = order ? getOrderRillinesPdfDataURL(order) : '';

  if (!pdfDataURL) {
    AdminUI.showToast('Geen drukbestand met rillijnen beschikbaar', 'error');
    return;
  }

  downloadDataURL(pdfDataURL, `drukbestand-met-rillijnen-${getDisplayOrderNumber(order)}.pdf`);
}

function downloadDataURL(dataURL, fileName) {
  const link = document.createElement('a');
  link.href = dataURL;
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

  if (!canDownloadQuote(order)) {
    AdminUI.showToast('Offerte PDF is niet beschikbaar in Creatie.', 'error');
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
  const products = DS.getProducts().filter(product => product.active !== false);
  const isEdit = Boolean(id);
  const workflow = normalizeOrderWorkflow(order);

  manualOrderUpload = null;

  const productOptions = products.map(product =>
    `<option value="${product.id}" ${order.productId === product.id ? 'selected' : ''}>${escHtml(product.name)}</option>`
  ).join('');

  const statusOptions = ORDER_STATUS_OPTIONS.map(([value, label]) =>
    `<option value="${value}" ${workflow.status === value ? 'selected' : ''}>${label}</option>`
  ).join('');

  const supplierOptions = PRINT_SUPPLIER_OPTIONS.map(([value, label]) =>
    `<option value="${value}" ${workflow.production.printSupplier === value ? 'selected' : ''}>${label}</option>`
  ).join('');

  const body = `
    <div class="section-title">Klantgegevens</div>
    <div class="form-row">
      <div class="form-group"><label>Bedrijfsnaam</label><input type="text" id="of-company" value="${escHtml(order.companyName || '')}" placeholder="Bedrijfsnaam"></div>
      <div class="form-group"><label>Contactpersoon *</label><input type="text" id="of-name" value="${escHtml(order.customerName || '')}" placeholder="Emma de Vries"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>E-mail *</label><input type="email" id="of-email" value="${escHtml(order.customerEmail || '')}" placeholder="emma@bedrijf.nl"></div>
      <div class="form-group"><label>Telefoon</label><input type="text" id="of-phone" value="${escHtml(order.telefoon || order.phone || '')}" placeholder="+31 6 12345678"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>BTW-nummer</label><input type="text" id="of-vat" value="${escHtml(order.vatNumber || order.btwNumber || '')}" placeholder="NL123456789B01"></div>
      <div class="form-group"><label>KVK-nummer</label><input type="text" id="of-kvk" value="${escHtml(order.kvk || '')}" placeholder="12345678"></div>
    </div>

    <div class="section-title" style="margin-top:4px">Adresgegevens</div>
    <div class="form-row">
      <div class="form-group"><label>Straat</label><input type="text" id="of-street" value="${escHtml(order.street || order.addressStreet || '')}" placeholder="Straatnaam"></div>
      <div class="form-group"><label>Huisnummer</label><input type="text" id="of-house-number" value="${escHtml(order.houseNumber || order.addressHouseNumber || '')}" placeholder="12A"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Postcode</label><input type="text" id="of-postal-code" value="${escHtml(order.postalCode || order.addressPostalCode || '')}" placeholder="1234 AB"></div>
      <div class="form-group"><label>Plaats</label><input type="text" id="of-city" value="${escHtml(order.city || order.addressCity || '')}" placeholder="Breda"></div>
    </div>
    <div class="form-row-1"><div class="form-group"><label>Land</label><input type="text" id="of-country" value="${escHtml(order.country || order.addressCountry || '')}" placeholder="Nederland"></div></div>
    <div class="form-row-1"><div class="form-group"><label>Factuuradres</label><textarea id="of-billing-address" placeholder="Volledig factuuradres">${escHtml(order.billingAddress || order.invoiceAddress || '')}</textarea></div></div>

    <div class="section-title" style="margin-top:4px">Order details</div>
    <div class="form-row">
      <div class="form-group"><label>Aanvraagnummer</label><input type="text" id="of-request-number" value="${escHtml(order.orderNumber || '')}" placeholder="Wordt automatisch gevuld"></div>
      <div class="form-group"><label>Ordernummer Exact</label><input type="text" id="of-official-order-number" value="${escHtml(workflow.salesHandoff.exactOrderNumber || order.officialOrderNumber || '')}" placeholder="Bij akkoord invullen"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Product *</label><select id="of-product"><option value="">Kies product...</option>${productOptions}</select></div>
      <div class="form-group"><label>Aantal *</label><input type="number" id="of-qty" value="${order.quantity || ''}" min="1" placeholder="10"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Aanvraagdatum</label><input type="date" id="of-created-date" value="${formatDateInput(order.createdAt)}"></div>
      <div class="form-group"><label>Verwachte leverdatum</label><input type="date" id="of-shipping-date" value="${workflow.salesHandoff.expectedDeliveryDate || getOrderShipDate(order) || ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Offerte (€)</label><input type="number" id="of-quote" value="${order.quoteAmount || ''}" step="0.01" placeholder="0.00"></div>
      <div class="form-group"><label>Status</label><select id="of-status">${statusOptions}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Werktype</label><select id="of-worktype"><option value="" ${!order.workType ? 'selected' : ''}>Geen intern werk</option><option value="ontwerp" ${order.workType === 'ontwerp' ? 'selected' : ''}>Ontwerp nodig</option><option value="bestandscheck" ${order.workType === 'bestandscheck' ? 'selected' : ''}>Bestandscheck</option></select></div>
      <div class="form-group"><label>Ontwerp bestandsnaam</label><input type="text" id="of-file" value="${escHtml(order.designFile || '')}" placeholder="ontwerp-klant.pdf"></div>
    </div>

    <div class="section-title" style="margin-top:4px">Sales overdracht</div>
    <div class="form-row">
      <div class="form-group"><label>Akkoord bevestigd door</label><input type="text" id="of-approved-by" value="${escHtml(workflow.salesHandoff.approvedBy || '')}" placeholder="Naam medewerker"></div>
      <div class="form-group"><label>Klant akkoord bevestigd</label><label class="admin-toggle-row" style="box-shadow:none"><span><strong>Klant heeft akkoord gegeven</strong><small>Nodig voordat de order naar Creatie gaat.</small></span><span class="toggle"><input type="checkbox" id="of-customer-approved" ${workflow.salesHandoff.customerApprovedAt ? 'checked' : ''}><span class="toggle-slider"></span></span></label></div>
    </div>
    <div class="form-row-1"><div class="form-group"><label>Salesnotitie</label><textarea id="of-sales-notes">${escHtml(workflow.salesHandoff.salesNotes || '')}</textarea></div></div>

    <div class="section-title" style="margin-top:4px">Creatie en drukwerk</div>
    <div class="form-row">
      <div class="form-group"><label>Drukwerkleverancier</label><select id="of-print-supplier">${supplierOptions}</select></div>
      <div class="form-group"><label>Inkoopnummer</label><input type="text" id="of-purchase-order-number" value="${escHtml(workflow.production.purchaseOrderNumber || '')}" placeholder="Inkoopnummer"></div>
    </div>
    <div class="form-row-1"><div class="form-group"><label>Verwachte levering drukwerk</label><input type="date" id="of-expected-print-delivery-date" value="${escHtml(workflow.production.expectedPrintDeliveryDate || '')}"></div></div>

    <div class="form-row-1"><div class="form-group"><label>Ontwerpbestand uploaden</label><input type="file" id="of-file-upload" accept=".png,.jpg,.jpeg,.pdf"><span class="form-hint" id="of-file-upload-hint">${order.designFile ? `Huidig bestand: ${escHtml(order.designFile)}` : 'PNG, JPG of PDF'}</span></div></div>
    <div class="form-row-1"><div class="form-group"><label>Notities</label><textarea id="of-notes">${escHtml(order.notes || '')}</textarea></div></div>
    <div id="of-error" class="form-error"></div>
  `;

  const footer = `
    <button class="btn btn-secondary" type="button" onclick="AdminUI.closeModal()">Annuleren</button>
    ${isEdit && canDownloadQuote(order) ? `<button class="btn btn-secondary" type="button" onclick="generateOrderPDF('${order.id}')">Download offerte PDF</button>` : ''}
    ${isEdit && canViewOrderFiles(order) ? `<button class="btn btn-secondary" type="button" onclick="viewOrderFiles('${order.id}')">Bestanden bekijken</button>` : ''}
    <button class="btn btn-primary" type="button" id="btn-order-save">Opslaan</button>
  `;

  AdminUI.openModal({
    title: isEdit ? 'Order aanpassen' : 'Nieuwe order',
    body,
    footer,
  });

  bindManualOrderUpload();

  document.getElementById('btn-order-save').addEventListener('click', () => saveOrderFromModal(order, isEdit));
}

function saveOrderFromModal(order, isEdit) {
  const productId = document.getElementById('of-product').value;
  const productName = productId ? (DS.getProductById(productId)?.name || '') : '';
  const name = document.getElementById('of-name').value.trim();
  const email = document.getElementById('of-email').value.trim();
  const error = document.getElementById('of-error');

  if (!name || !email || !productId) {
    error.textContent = 'Vul contactpersoon, e-mail en product in.';
    error.classList.add('visible');
    return;
  }

  const selectedStatus = document.getElementById('of-status').value || 'new_request';
  const targetDepartment = getDepartmentForWorkflowStatus(selectedStatus);
  const officialOrderNumber = document.getElementById('of-official-order-number').value.trim();
  const shippingDate = document.getElementById('of-shipping-date').value;
  const customerApproved = document.getElementById('of-customer-approved').checked;

  if (targetDepartment === 'creation' && (!officialOrderNumber || !shippingDate || !customerApproved)) {
    error.textContent = 'Voor een Creatie-status zijn ordernummer Exact, verwachte leverdatum en klantakkoord verplicht.';
    error.classList.add('visible');
    return;
  }

  if (selectedStatus === 'order_printwork' && !hasDefinitiveProductionFiles(order)) {
    error.textContent = 'Upload definitieve documenten via het workflowbord voordat de order naar Bestellen drukwerk gaat.';
    error.classList.add('visible');
    return;
  }

  const createdDate = document.getElementById('of-created-date').value;
  const createdAt = createdDate ? new Date(`${createdDate}T12:00:00`).toISOString() : order.createdAt || new Date().toISOString();
  const currentWorkflow = normalizeOrderWorkflow(order);
  const street = document.getElementById('of-street').value.trim();
  const houseNumber = document.getElementById('of-house-number').value.trim();
  const postalCode = document.getElementById('of-postal-code').value.trim();
  const city = document.getElementById('of-city').value.trim();
  const country = document.getElementById('of-country').value.trim();
  const uploadData = manualOrderUpload || {};

  const workflow = buildWorkflowForStatus(order, selectedStatus, {
    salesHandoffCompleted: targetDepartment === 'creation' ? true : currentWorkflow.salesHandoffCompleted,
    salesHandoff: {
      exactOrderNumber: officialOrderNumber,
      expectedDeliveryDate: shippingDate,
      customerApprovedAt: customerApproved ? currentWorkflow.salesHandoff.customerApprovedAt || new Date().toISOString() : null,
      approvedBy: document.getElementById('of-approved-by').value.trim(),
      salesNotes: document.getElementById('of-sales-notes').value.trim(),
    },
    production: {
      printSupplier: document.getElementById('of-print-supplier').value,
      purchaseOrderNumber: document.getElementById('of-purchase-order-number').value.trim(),
      expectedPrintDeliveryDate: document.getElementById('of-expected-print-delivery-date').value,
    },
  });

  DS.saveOrder({
    ...order,
    orderNumber: document.getElementById('of-request-number').value.trim() || order.orderNumber,
    officialOrderNumber,
    companyName: document.getElementById('of-company').value.trim(),
    customerName: name,
    customerEmail: email,
    telefoon: document.getElementById('of-phone').value.trim(),
    phone: document.getElementById('of-phone').value.trim(),
    vatNumber: document.getElementById('of-vat').value.trim(),
    btwNumber: document.getElementById('of-vat').value.trim(),
    kvk: document.getElementById('of-kvk').value.trim(),
    street,
    houseNumber,
    postalCode,
    city,
    country,
    addressStreet: street,
    addressHouseNumber: houseNumber,
    addressPostalCode: postalCode,
    addressCity: city,
    addressCountry: country,
    deliveryAddress: formatStructuredAddress({ street, houseNumber, postalCode, city, country }),
    billingAddress: document.getElementById('of-billing-address').value.trim(),
    invoiceAddress: document.getElementById('of-billing-address').value.trim(),
    productId,
    productName,
    quantity: parseInt(document.getElementById('of-qty').value, 10) || null,
    createdAt,
    shippingDate,
    shipDate: shippingDate,
    deliveryDate: shippingDate,
    quoteAmount: parseFloat(document.getElementById('of-quote').value) || null,
    status: selectedStatus,
    workflow,
    workType: document.getElementById('of-worktype').value || null,
    designFile: uploadData.fileName || document.getElementById('of-file').value.trim(),
    designDataURL: uploadData.designDataURL || order.designDataURL || '',
    designPdfDataURL: uploadData.designPdfDataURL || order.designPdfDataURL || '',
    designRillinesPdfDataURL: order.designRillinesPdfDataURL || '',
    notes: document.getElementById('of-notes').value.trim(),
  });

  AdminUI.closeModal();
  renderCurrentOrdersView();
  AdminUI.updateBadges();
  AdminUI.showToast(isEdit ? 'Order bijgewerkt' : 'Order aangemaakt');
}

function bindManualOrderUpload() {
  const input = document.getElementById('of-file-upload');
  const fileNameInput = document.getElementById('of-file');
  const hint = document.getElementById('of-file-upload-hint');

  if (!input) {
    return;
  }

  input.addEventListener('change', event => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = readerEvent => {
      const dataURL = readerEvent.target.result;

      manualOrderUpload = {
        fileName: file.name,
        designDataURL: dataURL,
        designPdfDataURL: dataURL.startsWith('data:application/pdf') ? dataURL : '',
      };

      if (fileNameInput) {
        fileNameInput.value = file.name;
      }

      if (hint) {
        hint.textContent = `Geüpload: ${file.name}`;
      }
    };

    reader.readAsDataURL(file);
  });
}

function getOrderPdfDataURL(order) {
  return order.designPdfDataURL ||
    (order.designDataURL && order.designDataURL.startsWith('data:application/pdf') ? order.designDataURL : '');
}

function getOrderRillinesPdfDataURL(order) {
  return order.designRillinesPdfDataURL || '';
}

function getOrderShipDate(order) {
  return order.shippingDate || order.shipDate || order.dispatchDate || order.deliveryDate || '';
}

function formatStructuredAddress({ street, houseNumber, postalCode, city, country }) {
  return [[street, houseNumber].filter(Boolean).join(' '), [postalCode, city].filter(Boolean).join(' '), country].filter(Boolean).join(', ');
}

function formatOrderAddress(order) {
  return formatStructuredAddress({
    street: order.street || order.addressStreet || '',
    houseNumber: order.houseNumber || order.addressHouseNumber || '',
    postalCode: order.postalCode || order.addressPostalCode || '',
    city: order.city || order.addressCity || '',
    country: order.country || order.addressCountry || '',
  }) || order.deliveryAddress || '';
}

function formatAddons(addons) {
  if (!Array.isArray(addons) || !addons.length) {
    return '—';
  }

  const labels = { bestandscontrole: 'Bestandscontrole' };
  return addons.map(addon => labels[addon] || addon).join(', ');
}

function formatWorkType(workType) {
  const labels = { ontwerp: 'Ontwerp nodig', bestandscheck: 'Bestandscheck' };
  return labels[workType] || 'Geen intern werk';
}

function formatWorkflowDepartment(department) {
  const labels = { sales: 'Sales', creation: 'Creatie', archive: 'Archief' };
  return labels[department] || department || '—';
}

function getPrintSupplierLabel(value) {
  const match = PRINT_SUPPLIER_OPTIONS.find(([optionValue]) => optionValue === value);
  return match ? match[1] : value || 'Nog niet gekozen';
}

function getOrderDesignSource(order) {
  if (order.wensen && !order.designDataURL && !order.designFile) {
    return 'Laat ontwerpen';
  }

  if (order.designFile) {
    return 'Upload';
  }

  if (order.designDataURL || order.designPdfDataURL) {
    return 'Ontwerptool';
  }

  return 'Niet beschikbaar';
}

function formatWensen(wensen = {}) {
  return [
    wensen.tekst ? `<div><strong>Tekst:</strong> ${escHtml(wensen.tekst)}</div>` : '',
    wensen.kleur ? `<div><strong>Kleur:</strong> ${escHtml(wensen.kleur)}</div>` : '',
    wensen.stijl ? `<div><strong>Stijl:</strong> ${escHtml(wensen.stijl)}</div>` : '',
    wensen.opmerkingen ? `<div><strong>Opmerkingen:</strong> ${escHtml(wensen.opmerkingen)}</div>` : '',
    wensen.refFileName ? `<div><strong>Referentie:</strong> ${escHtml(wensen.refFileName)}</div>` : '',
  ].filter(Boolean).join('') || '—';
}

function formatPrintSizePlain(width, height) {
  return isFinitePositive(width) && isFinitePositive(height) ? `${formatNumber(width)} x ${formatNumber(height)} mm` : '—';
}

function formatMmPlain(value) {
  return value === null || value === undefined || Number.isNaN(Number(value)) ? '—' : `${formatNumber(value)} mm`;
}

function isFinitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return Number(value).toFixed(2).replace(/\.00$/, '').replace('.', ',');
}

function hasOrderFiles(order) {
  const workflow = normalizeOrderWorkflow(order);

  return Boolean(
    order.designDataURL ||
    order.designPdfDataURL ||
    order.designRillinesPdfDataURL ||
    order.designFile ||
    order.wensen ||
    workflow.production.definitiveFiles.length
  );
}

function orderStatusBadge(status) {
  const map = {
    new_request: ['badge-blue', `${iconNote()} Nieuwe aanvraag`],
    quote_required: ['badge-blue', `${iconNote()} Offerte nodig`],
    customer_approval_needed: ['badge-orange', `${iconClock()} Klant akkoord nodig`],
    design_new: ['badge-blue', `${iconPen()} Design new`],
    pending: ['badge-orange', `${iconClock()} Pending`],
    design_correction: ['badge-orange', `${iconPen()} Design correctie`],
    pdf_check: ['badge-red', `${iconSearch()} PDF check`],
    order_printwork: ['badge-blue', `${iconNote()} Bestellen drukwerk`],
    awaiting_delivery: ['badge-orange', `${iconClock()} In afwachting levering`],
    completed: ['badge-green', `${iconCheck()} Afgerond`],
    cancelled: ['badge-gray', 'Geannuleerd'],
  };

  const [className, label] = map[status] || ['badge-gray', getWorkflowStatusLabel(status)];
  return `<span class="badge ${className}">${label}</span>`;
}

function formatDateInput(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) {
    return '—';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatEuro(value) {
  return value === null || value === undefined || Number.isNaN(Number(value)) ? '—' : `€ ${Number(value).toFixed(2).replace('.', ',')}`;
}

function getFileTypeFromName(fileName) {
  const extension = String(fileName || '').split('.').pop().toLowerCase();
  const map = {
    pdf: 'application/pdf',
    ai: 'application/postscript',
    eps: 'application/postscript',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  };

  return map[extension] || 'application/octet-stream';
}

function iconSearch() {
  return `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle"><circle cx="5.5" cy="5.5" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M9 9L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}

function iconCheck() {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle"><path d="M1.5 6L4.5 9L10.5 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function iconPen() {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle"><path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function iconTrash() {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle"><path d="M1.5 3H10.5M4.5 3V2H7.5V3M2.5 3L3.5 10H8.5L9.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function iconImage() {
  return `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle"><rect x="1" y="1" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/><circle cx="4.5" cy="4.5" r="1" fill="currentColor"/><path d="M1 9L4 6L6.5 8.5L8.5 6.5L12 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function iconNote() {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle"><rect x="1.5" y="1" width="9" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M4 4.5H8M4 6.5H8M4 8.5H6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
}

function iconClock() {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5"/><path d="M6 3.5V6L7.5 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}

function iconClipboard() {
  return `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="8" width="20" height="20" rx="3" stroke="currentColor" stroke-width="2"/><path d="M11 4H21V9H11V4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M11 16H21M11 20H17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

window.viewOrderFiles = viewOrderFiles;
window.downloadPrintPDF = downloadPrintPDF;
window.downloadRillinesPDF = downloadRillinesPDF;
window.downloadDefinitiveFile = downloadDefinitiveFile;
window.generateOrderPDF = generateOrderPDF;
window.openOrderModal = openOrderModal;
window.openOrderOverview = openOrderOverview;
window.openSalesHandoffModal = openSalesHandoffModal;
window.openPrintworkOrderModal = openPrintworkOrderModal;
window.confirmPrintworkReceived = confirmPrintworkReceived;
window.copyProductionInstruction = copyProductionInstruction;
window.renderArchivePage = renderArchivePage;
window.normalizeOrderWorkflow = normalizeOrderWorkflow;
window.renderSalesOrdersPage = renderSalesOrdersPage;
window.renderCreationOrdersPage = renderCreationOrdersPage;