/**
 * admin.js
 * SPA router + gedeelde utilities (modal, toast, confirm)
 */

// ─── ROUTER ──────────────────────────────────────────────────────────────────

const PAGES = {
  sales: {
    el: 'page-sales',
    render: renderSalesOrdersPage,
  },
  creation: {
    el: 'page-creation',
    render: renderCreationOrdersPage,
  },
  archive: {
    el: 'page-archive',
    render: () => {
      if (typeof renderArchivePage === 'function') {
        renderArchivePage();
        return;
      }

      renderArchiveFallbackPage();
    },
  },
  products: {
    el: 'page-products',
    render: renderProductsPage,
  },
};

function navigate(hash) {
  const page = hash.replace('#', '') || 'sales';

  if (!PAGES[page]) {
    navigate('#sales');
    return;
  }

  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));

  const pageElement = document.getElementById(PAGES[page].el);

  if (pageElement) {
    pageElement.classList.add('active');
  }

  document.querySelectorAll('.nav-item').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  PAGES[page].render();
  updateBadges();
}

function renderArchiveFallbackPage() {
  const el = document.getElementById('page-archive');

  if (!el) {
    return;
  }

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Archief</h1>
        <p>Afgeronde en geannuleerde orders</p>
      </div>
    </div>

    <div class="empty-state">
      <div class="empty-state-icon">⌛</div>
      <h3>Archief wordt geladen</h3>
      <p>De archiefweergave wordt toegevoegd in orders.js.</p>
    </div>
  `;
}

function updateBadges() {
  const orders = DS.getOrders();

  const workflowOrders = orders.map(order => ({
    order,
    workflow: getSafeOrderWorkflow(order),
  }));

  const salesOrders = workflowOrders.filter(({ workflow }) =>
    workflow.department === 'sales' && !workflow.archived
  );

  const creationOrders = workflowOrders.filter(({ workflow }) =>
    workflow.department === 'creation' && !workflow.archived
  );

  const archiveOrders = workflowOrders.filter(({ workflow }) =>
    workflow.archived
  );

  const salesBadge = document.getElementById('badge-sales');
  const creationBadge = document.getElementById('badge-creation');
  const archiveBadge = document.getElementById('badge-archive');

  if (salesBadge) {
    salesBadge.textContent = salesOrders.length || '';
  }

  if (creationBadge) {
    creationBadge.textContent = creationOrders.length || '';
  }

  if (archiveBadge) {
    archiveBadge.textContent = archiveOrders.length || '';
  }
}

function getSafeOrderWorkflow(order) {
  if (typeof normalizeOrderWorkflow === 'function') {
    return normalizeOrderWorkflow(order);
  }

  const archivedStatuses = ['verzonden', 'afgerond', 'completed', 'cancelled'];

  return {
    department: archivedStatuses.includes(order.status) ? 'archive' : 'sales',
    status: order.status || 'new_request',
    archived: archivedStatuses.includes(order.status),
  };
}

// ─── MODAL ───────────────────────────────────────────────────────────────────

function openModal({ title, body, footer }) {
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');
  const modalOverlay = document.getElementById('modal-overlay');

  if (!modalTitle || !modalBody || !modalFooter || !modalOverlay) {
    return;
  }

  modalTitle.textContent = title;
  modalBody.innerHTML = '';
  modalFooter.innerHTML = '';

  if (typeof body === 'string') {
    modalBody.innerHTML = body;
  } else if (body) {
    modalBody.appendChild(body);
  }

  if (footer) {
    if (typeof footer === 'string') {
      modalFooter.innerHTML = footer;
    } else {
      modalFooter.appendChild(footer);
    }
  }

  modalOverlay.classList.remove('hidden');
}

function closeModal() {
  const modalOverlay = document.getElementById('modal-overlay');

  if (modalOverlay) {
    modalOverlay.classList.add('hidden');
  }
}

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────

function confirmDialog(message, options = {}) {
  return new Promise(resolve => {
    const confirmLabel = options.confirmLabel || 'Verwijderen';
    const confirmClass = options.confirmClass || 'btn-danger';

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '8px';

    footer.innerHTML = `
      <button class="btn btn-secondary" id="confirm-no" type="button">Annuleren</button>
      <button class="btn ${confirmClass}" id="confirm-yes" type="button">${escHtml(confirmLabel)}</button>
    `;

    openModal({
      title: options.title || 'Bevestig',
      body: `<p style="padding:4px 0">${escHtml(message)}</p>`,
      footer,
    });

    document.getElementById('confirm-yes').addEventListener('click', () => {
      closeModal();
      resolve(true);
    });

    document.getElementById('confirm-no').addEventListener('click', () => {
      closeModal();
      resolve(false);
    });
  });
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

let toastTimer;

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');

  if (!toast) {
    return;
  }

  toast.textContent = msg;
  toast.className = `toast ${type}`;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) {
    return '—';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatEuro(n) {
  if (n === undefined || n === null || n === '') {
    return '—';
  }

  return `€ ${parseFloat(n).toFixed(2).replace('.', ',')}`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  DS.seedDemoData();

  const modalCloseButton = document.getElementById('btn-modal-close');
  const modalOverlay = document.getElementById('modal-overlay');
  const resetButton = document.getElementById('btn-reset-data');

  if (modalCloseButton) {
    modalCloseButton.addEventListener('click', closeModal);
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', event => {
      if (event.target === event.currentTarget) {
        closeModal();
      }
    });
  }

  if (resetButton) {
    resetButton.addEventListener('click', async () => {
      const ok = await confirmDialog('Alle data resetten naar demo-data?', {
        title: 'Reset data',
        confirmLabel: 'Reset data',
        confirmClass: 'btn-danger',
      });

      if (!ok) {
        return;
      }

      localStorage.removeItem('cot_orders');
      localStorage.removeItem('cot_products');

      DS.seedDemoData();
      navigate(location.hash || '#sales');
      showToast('Data gereset naar demo-data');
    });
  }

  window.addEventListener('hashchange', () => navigate(location.hash));
  navigate(location.hash || '#sales');
});

// Globaal beschikbaar maken

window.AdminUI = {
  openModal,
  closeModal,
  confirmDialog,
  showToast,
  formatDate,
  formatEuro,
  escHtml,
  updateBadges,
};