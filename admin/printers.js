/**
 * printers.js
 * Beheer van drukkers: naam, standaard doorlooptijd (werkdagen) en besteldagen.
 * Deze gegevens bepalen samen met de drukkerregels per personalisatie
 * de vroegst mogelijke leverdatum in stap 5 van de klantflow.
 */

function renderPrintersPage() {
  const el = document.getElementById('page-printers');

  if (!el) {
    return;
  }

  const available = DS.isPrintersAvailable();

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Drukkers</h1>
        <p>Doorlooptijd en besteldagen per drukker. Hiermee wordt de vroegst mogelijke leverdatum voor de klant berekend.</p>
      </div>
      <button class="btn btn-primary" type="button" id="btn-printer-add" ${available ? '' : 'disabled'}>
        + Nieuwe drukker
      </button>
    </div>

    ${available ? '' : `
      <div class="empty-state">
        <h3>Drukkers-tabel niet gevonden</h3>
        <p>Voer eerst de SQL voor de tabel <code>printers</code> uit in Supabase en kies daarna tandwiel → Data opnieuw laden.</p>
      </div>
    `}

    <div class="product-grid" id="printer-grid"></div>
  `;

  document.getElementById('btn-printer-add')?.addEventListener('click', () => openPrinterModal());

  if (available) {
    renderPrinterGrid();
  }
}

function renderPrinterGrid() {
  const grid = document.getElementById('printer-grid');

  if (!grid) {
    return;
  }

  const printers = DS.getPrinters();

  if (!printers.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <h3>Nog geen drukkers</h3>
        <p>Voeg een drukker toe om leverdatums te kunnen berekenen.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = printers.map(printer => {
    const leadTime = DeliveryPlanning.normalizeLeadTime(printer.leadTimeDays);
    const isComplete = leadTime !== null;

    return `
      <div class="product-card">
        <div class="product-card-header">
          <span class="badge ${isComplete ? 'badge-green' : 'badge-gray'}">
            ${isComplete ? 'Compleet' : 'Doorlooptijd ontbreekt'}
          </span>
          <div style="display:flex;gap:4px">
            <button class="icon-btn" type="button" data-printer-edit="${escHtml(printer.id)}" title="Bewerken">✎</button>
            <button class="icon-btn danger" type="button" data-printer-delete="${escHtml(printer.id)}" title="Verwijderen">×</button>
          </div>
        </div>

        <div class="product-card-body">
          <h3>${escHtml(printer.name || printer.id)}</h3>
          <div class="product-card-id">${escHtml(printer.id)}</div>

          <div class="product-specs" style="margin-top:8px">
            <span class="spec-tag">
              Doorlooptijd: ${isComplete ? `${leadTime} werkdag${leadTime === 1 ? '' : 'en'}` : '—'}
            </span>
            <span class="spec-tag">
              Besteldagen: ${escHtml(DeliveryPlanning.formatWeekdays(printer.orderWeekdays))}
            </span>
          </div>

          ${isComplete ? '' : `
            <p class="form-hint" style="color:var(--danger);margin-top:8px">
              Zonder doorlooptijd kan voor deze drukker geen leverdatum worden berekend.
              Klanten zien dan "in overleg".
            </p>
          `}
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('[data-printer-edit]').forEach(button => {
    button.addEventListener('click', () => openPrinterModal(button.dataset.printerEdit));
  });

  grid.querySelectorAll('[data-printer-delete]').forEach(button => {
    button.addEventListener('click', () => deletePrinterById(button.dataset.printerDelete));
  });
}

function openPrinterModal(id = null) {
  const printer = id ? DS.getPrinterById(id) : null;
  const isEdit = Boolean(printer);
  const orderWeekdays = DeliveryPlanning.normalizeOrderWeekdays(printer?.orderWeekdays);
  const leadTime = DeliveryPlanning.normalizeLeadTime(printer?.leadTimeDays);

  const body = document.createElement('div');

  body.innerHTML = `
    <div class="form-row-1">
      <div class="form-group">
        <label for="pr-name">Naam *</label>
        <input type="text" id="pr-name" value="${escHtml(printer?.name || '')}" placeholder="Bijvoorbeeld Solfer">
      </div>
    </div>

    <div class="form-row-1">
      <div class="form-group">
        <label for="pr-lead">Standaard doorlooptijd (werkdagen) *</label>
        <input type="number" id="pr-lead" min="0" step="1" value="${leadTime === null ? '' : escHtml(leadTime)}" placeholder="Bijvoorbeeld 5">
        <span class="form-hint">Werkdagen vanaf het moment van bestellen tot het drukwerk binnen is.</span>
      </div>
    </div>

    <div class="form-row-1">
      <div class="form-group">
        <label>Besteldagen</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${DeliveryPlanning.ORDER_WEEKDAY_OPTIONS.map(option => `
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
              <input type="checkbox" class="pr-weekday" value="${option.value}" ${orderWeekdays.includes(option.value) ? 'checked' : ''}>
              ${escHtml(option.label)}
            </label>
          `).join('')}
        </div>
        <span class="form-hint">Op welke dagen kan bij deze drukker besteld worden? Niets aangevinkt = elke werkdag.</span>
      </div>
    </div>

    <div id="pr-error" style="display:none;color:var(--danger);font-size:13px;margin-top:8px"></div>
  `;

  const footer = document.createElement('div');

  footer.className = 'confirm-actions';
  footer.innerHTML = `
    <button class="btn btn-secondary" type="button" id="pr-cancel">Annuleren</button>
    <button class="btn btn-primary" type="button" id="pr-save">${isEdit ? 'Opslaan' : 'Toevoegen'}</button>
  `;

  AdminUI.openModal({
    title: isEdit ? 'Drukker bewerken' : 'Nieuwe drukker',
    body,
    footer,
  });

  document.getElementById('pr-cancel')?.addEventListener('click', () => AdminUI.closeModal());
  document.getElementById('pr-save')?.addEventListener('click', () => savePrinterFromModal(printer));
}

function savePrinterFromModal(printer) {
  const error = document.getElementById('pr-error');
  const name = document.getElementById('pr-name')?.value.trim() || '';
  const leadRaw = document.getElementById('pr-lead')?.value;
  const leadTimeDays = DeliveryPlanning.normalizeLeadTime(leadRaw);
  const orderWeekdays = [...document.querySelectorAll('.pr-weekday:checked')]
    .map(input => Number(input.value));

  const showError = message => {
    if (error) {
      error.textContent = message;
      error.style.display = 'block';
    }
  };

  if (!name) {
    showError('Naam is verplicht.');
    return;
  }

  if (leadTimeDays === null) {
    showError('Vul een doorlooptijd in van 0 of meer werkdagen.');
    return;
  }

  const duplicate = DS.getPrinters().some(item =>
    item.id !== printer?.id &&
    String(item.name || '').trim().toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    showError('Er bestaat al een drukker met deze naam.');
    return;
  }

  DS.savePrinter({
    ...(printer || {}),
    id: printer?.id || createPrinterId(name),
    name,
    leadTimeDays,
    orderWeekdays,
  });

  AdminUI.closeModal();
  renderPrinterGrid();
  AdminUI.showToast(printer ? 'Drukker opgeslagen' : 'Drukker toegevoegd');
}

function createPrinterId(name) {
  const base = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'drukker';

  let id = base;
  let counter = 2;

  while (DS.getPrinterById(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }

  return id;
}

async function deletePrinterById(id) {
  const printer = DS.getPrinterById(id);

  if (!printer) {
    return;
  }

  const confirmed = await AdminUI.confirmDialog(
    `Drukker "${printer.name || printer.id}" verwijderen?`,
    {
      title: 'Drukker verwijderen',
    }
  );

  if (!confirmed) {
    return;
  }

  const result = DS.deletePrinter(id);

  if (result.error) {
    AdminUI.showToast(result.error, 'error', 8000);
    return;
  }

  renderPrinterGrid();
  AdminUI.showToast('Drukker verwijderd');
}

window.renderPrintersPage = renderPrintersPage;