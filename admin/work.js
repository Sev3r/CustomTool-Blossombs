/**
 * work.js
 * Punt 2: emoji's vervangen door SVG/tekstlabels
 * Punt 3: filters voor openstaand/afgehandeld/alles
 */

let workFilter = 'open';   // 'open' | 'done' | 'all'
let workTypeFilter = 'all';    // 'all' | 'ontwerp' | 'bestandscheck'
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
      <!-- Punt 3: status filter -->
      <div class="filter-group">
        <button class="filter-pill ${workFilter === 'open' ? 'active' : ''}" data-status="open">
          Openstaand
        </button>
        <button class="filter-pill ${workFilter === 'done' ? 'active' : ''}" data-status="done">
          Afgehandeld
        </button>
        <button class="filter-pill ${workFilter === 'all' ? 'active' : ''}" data-status="all">
          Alles
        </button>
      </div>

      <!-- Werktype filter -->
      <select class="filter-select" id="work-type-filter">
        <option value="all">Alle werktypes</option>
        <option value="ontwerp">Ontwerp nodig</option>
        <option value="bestandscheck">Bestandscheck</option>
      </select>

      <!-- Sortering -->
      <select class="filter-select" id="work-sort">
        <option value="deliveryDate-asc">Leverdatum (vroegst eerst)</option>
        <option value="deliveryDate-desc">Leverdatum (laatste eerst)</option>
        <option value="createdAt-asc">Orderdatum (oudst eerst)</option>
        <option value="createdAt-desc">Orderdatum (nieuwst eerst)</option>
      </select>
    </div>

    <div class="work-grid" id="work-grid"></div>
  `;

  document.getElementById('work-type-filter').value = workTypeFilter;
  document.getElementById('work-sort').value = workSort;

  // Status pills
  el.querySelectorAll('.filter-pill[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      workFilter = btn.dataset.status;
      el.querySelectorAll('.filter-pill[data-status]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderWorkGrid();
    });
  });

  document.getElementById('work-type-filter').addEventListener('change', e => {
    workTypeFilter = e.target.value; renderWorkGrid();
  });
  document.getElementById('work-sort').addEventListener('change', e => {
    workSort = e.target.value; renderWorkGrid();
  });

  renderWorkGrid();
}

function renderWorkGrid() {
  const grid = document.getElementById('work-grid');
  if (!grid) return;

  let orders = DS.getOrders();

  // Punt 3: filter op status
  if (workFilter === 'open') {
    orders = orders.filter(o =>
      ['wacht-op-ontwerp', 'wacht-op-bestandscheck', 'wacht-op-goedkeuring'].includes(o.status)
    );
  } else if (workFilter === 'done') {
    orders = orders.filter(o => o.status === 'afgerond');
  }
  // 'all' = geen statusfilter

  // Filter op werktype
  if (workTypeFilter !== 'all') {
    orders = orders.filter(o => o.workType === workTypeFilter);
  }

  // Sorteren
  const [sortField, sortDir] = workSort.split('-');
  orders = orders.slice().sort((a, b) => {
    const av = a[sortField] || '', bv = b[sortField] || '';
    return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  if (orders.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">
          ${iconCheck()}
        </div>
        <h3>${workFilter === 'open' ? 'Geen openstaand werk' : 'Geen items gevonden'}</h3>
        <p>${workFilter === 'open' ? 'Alle orders zijn afgerond.' : 'Pas het filter aan om items te bekijken.'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = orders.map(o => {
    const isOntwerp = o.workType === 'ontwerp';
    const isDone = o.status === 'afgerond';
    const typeClass = isOntwerp ? 'work-type-ontwerp' : 'work-type-bestandscheck';

    // Punt 2: geen emoji's — SVG badges
    const typeBadge = isOntwerp
      ? `<span class="badge badge-blue">${iconPen()} Ontwerp nodig</span>`
      : `<span class="badge badge-orange">${iconSearch()} Bestandscheck</span>`;

    const doneBadge = isDone
      ? `<span class="badge badge-green">${iconCheck()} Afgerond</span>`
      : '';

    const urgency = getUrgency(o.deliveryDate);
    const urgBadge = urgency
      ? `<span class="badge ${urgency.cls}">${urgency.label}</span>`
      : '';

    const fileSection = isOntwerp
      ? `<span class="label">Wensen</span>
         <span>${o.notes
        ? `<span title="${escHtml(o.notes)}" style="cursor:help;text-decoration:underline dotted">Bekijk notities</span>`
        : '—'}</span>`
      : `<span class="label">Bestand</span>
         <span>${o.designFile
        ? `<a href="#" style="color:var(--accent)">${escHtml(o.designFile)}</a>`
        : '<span style="color:var(--text-3)">Geen bestand</span>'}</span>`;

    return `
      <div class="work-card ${typeClass} ${isDone ? 'work-card-done' : ''}">
        <div class="work-card-top">
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${typeBadge}
            ${doneBadge}
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            ${urgBadge}
            <span style="font-family:var(--font-mono,monospace);font-size:11px;color:var(--text-3)">
              ${escHtml(o.orderNumber)}
            </span>
          </div>
        </div>
        <div class="work-card-body">
          <h3>${escHtml(o.customerName)}</h3>
          <div class="work-card-meta">
            <span>
              <span class="label">E-mail</span>
              <a href="mailto:${escHtml(o.customerEmail)}" style="color:var(--accent)">
                ${escHtml(o.customerEmail)}
              </a>
            </span>
            <span><span class="label">Adres</span><span>${escHtml(o.deliveryAddress) || '—'}</span></span>
            <span><span class="label">Product</span><span>${escHtml(o.productName)} &times; ${o.quantity || '?'}</span></span>
            <span>
              <span class="label">Leverdatum</span>
              <span style="font-weight:500">${formatDate(o.deliveryDate)}</span>
            </span>
            <span><span class="label">Offerte</span><span>${formatEuro(o.quoteAmount)}</span></span>
            <span>${fileSection}</span>
          </div>
        </div>
        <div class="work-card-footer">
          <button class="btn btn-secondary btn-sm" onclick="openOrderModal('${o.id}')">
            ${iconPen()} Bewerken
          </button>
          ${!isDone ? `
            <button class="btn btn-primary btn-sm" onclick="markWorkDone('${o.id}')">
              ${iconCheck()} Afronden
            </button>
          ` : `
            <button class="btn btn-secondary btn-sm" onclick="markWorkOpen('${o.id}')">
              Heropenen
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function getUrgency(deliveryDate) {
  if (!deliveryDate) return null;
  const days = Math.ceil((new Date(deliveryDate) - new Date()) / 86400000);
  if (days < 0) return { cls: 'badge-red', label: 'Verlopen' };
  if (days <= 3) return { cls: 'badge-red', label: `${days}d` };
  if (days <= 7) return { cls: 'badge-orange', label: `${days}d` };
  return null;
}

function markWorkDone(id) {
  const order = DS.getOrderById(id);
  if (!order) return;
  order.status = 'afgerond';
  DS.saveOrder(order);
  renderWorkGrid();
  AdminUI.updateBadges();
  AdminUI.showToast('Order gemarkeerd als afgerond');
}

function markWorkOpen(id) {
  const order = DS.getOrderById(id);
  if (!order) return;
  order.status = order.workType === 'ontwerp' ? 'wacht-op-ontwerp' : 'wacht-op-bestandscheck';
  DS.saveOrder(order);
  renderWorkGrid();
  AdminUI.updateBadges();
  AdminUI.showToast('Order heropend');
}

// ─── SVG ICONEN (punt 2) ──────────────────────────────────────────────────────
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