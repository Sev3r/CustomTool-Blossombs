/**
 * work.js
 * Pagina: Werkvoorraad — orders die actie vereisen
 */

let workFilter   = 'all';
let workSort     = 'deliveryDate-asc';

function renderWorkPage() {
  const el = document.getElementById('page-work');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Werkvoorraad</h1>
        <p>Orders waarvoor een medewerker actie moet ondernemen</p>
      </div>
    </div>

    <div class="filter-bar">
      <select class="filter-select" id="work-type-filter">
        <option value="all">Alle werktypes</option>
        <option value="ontwerp">✏️ Ontwerp nodig</option>
        <option value="bestandscheck">🔍 Bestandscheck</option>
      </select>
      <select class="filter-select" id="work-sort">
        <option value="deliveryDate-asc">Leverdatum (vroegst eerst)</option>
        <option value="deliveryDate-desc">Leverdatum (laatste eerst)</option>
        <option value="createdAt-asc">Orderdatum (oudst eerst)</option>
        <option value="createdAt-desc">Orderdat (nieuwst eerst)</option>
      </select>
    </div>

    <div class="work-grid" id="work-grid"></div>
  `;

  document.getElementById('work-type-filter').value = workFilter;
  document.getElementById('work-sort').value        = workSort;

  document.getElementById('work-type-filter').addEventListener('change', e => { workFilter = e.target.value; renderWorkGrid(); });
  document.getElementById('work-sort').addEventListener('change',        e => { workSort   = e.target.value; renderWorkGrid(); });

  renderWorkGrid();
}

function renderWorkGrid() {
  const grid = document.getElementById('work-grid');
  if (!grid) return;

  // Alleen orders die actie vereisen
  let orders = DS.getOrders().filter(o =>
    ['wacht-op-ontwerp', 'wacht-op-bestandscheck', 'wacht-op-goedkeuring'].includes(o.status)
  );

  // Filter op werktype
  if (workFilter !== 'all') {
    orders = orders.filter(o => o.workType === workFilter);
  }

  // Sorteren
  const [sortField, sortDir] = workSort.split('-');
  orders = orders.slice().sort((a, b) => {
    const av = a[sortField] || '';
    const bv = b[sortField] || '';
    return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  if (orders.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🎉</div>
        <h3>Geen openstaand werk</h3>
        <p>Alle orders zijn afgerond of er zijn geen orders die actie vereisen.</p>
      </div>`;
    return;
  }

  grid.innerHTML = orders.map(o => {
    const isOntwerp      = o.workType === 'ontwerp';
    const typeClass      = isOntwerp ? 'work-type-ontwerp' : 'work-type-bestandscheck';
    const typeBadge      = isOntwerp
      ? `<span class="badge badge-blue">✏️ Ontwerp nodig</span>`
      : `<span class="badge badge-orange">🔍 Bestandscheck</span>`;

    const urgency  = getUrgency(o.deliveryDate);
    const urgBadge = urgency ? `<span class="badge ${urgency.cls}">${urgency.label}</span>` : '';

    const fileSection = isOntwerp
      ? `<span class="label">Wensen</span><span>${o.notes ? `<span title="${escHtml(o.notes)}" style="cursor:help;text-decoration:underline dotted">Bekijk notities</span>` : '—'}</span>`
      : `<span class="label">Aangeleverd bestand</span><span>${o.designFile ? `<a href="#" style="color:var(--accent)">${escHtml(o.designFile)}</a>` : '<span style="color:var(--text-3)">Geen bestand</span>'}</span>`;

    return `
      <div class="work-card ${typeClass}">
        <div class="work-card-top">
          ${typeBadge}
          <div style="display:flex;gap:6px;align-items:center">
            ${urgBadge}
            <span class="mono" style="font-family:var(--font-mono);font-size:11px;color:var(--text-3)">${escHtml(o.orderNumber)}</span>
          </div>
        </div>
        <div class="work-card-body">
          <h3>${escHtml(o.customerName)}</h3>
          <div class="work-card-meta">
            <span><span class="label">E-mail</span><a href="mailto:${escHtml(o.customerEmail)}" style="color:var(--accent)">${escHtml(o.customerEmail)}</a></span>
            <span><span class="label">Adres</span><span>${escHtml(o.deliveryAddress) || '—'}</span></span>
            <span><span class="label">Product</span><span>${escHtml(o.productName)} × ${o.quantity || '?'}</span></span>
            <span><span class="label">Leverdatum</span><span style="font-weight:500">${formatDate(o.deliveryDate)}</span></span>
            <span><span class="label">Offerte</span><span>${formatEuro(o.quoteAmount)}</span></span>
            <span>${fileSection}</span>
          </div>
        </div>
        <div class="work-card-footer">
          <button class="btn btn-secondary btn-sm" onclick="openOrderModal('${o.id}')">✏️ Bewerken</button>
          <button class="btn btn-primary btn-sm"   onclick="markWorkDone('${o.id}')">✅ Afronden</button>
        </div>
      </div>
    `;
  }).join('');
}

function getUrgency(deliveryDate) {
  if (!deliveryDate) return null;
  const days = Math.ceil((new Date(deliveryDate) - new Date()) / 86400000);
  if (days < 0)  return { cls: 'badge-red',    label: '⚠️ Verlopen' };
  if (days <= 3) return { cls: 'badge-red',    label: `🔴 ${days}d` };
  if (days <= 7) return { cls: 'badge-orange', label: `🟠 ${days}d` };
  return null;
}

function markWorkDone(id) {
  const order = DS.getOrderById(id);
  if (!order) return;
  order.status = 'afgerond';
  DS.saveOrder(order);
  renderWorkGrid();
  AdminUI.updateBadges();
  AdminUI.showToast('Order gemarkeerd als afgerond ✅');
}
