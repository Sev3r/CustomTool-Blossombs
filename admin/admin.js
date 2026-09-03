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

  production: {
    el: 'page-production',
    render: renderProductionOrdersPage,
  },

  history: {
    el: 'page-archive',
    render: renderArchivePage,
  },

  archive: {
    el: 'page-archive',
    render: renderArchivePage,
  },

  products: {
    el: 'page-products',
    render: renderProductsPage,
  },
};

function navigate(hash) {
  const requestedPage =
    String(hash || '')
      .replace('#', '') ||
    'creation';

  const page =
    requestedPage === 'archive'
      ? 'history'
      : requestedPage;

  if (!PAGES[page]) {
    navigate('#creation');
    return;
  }

  document
    .querySelectorAll('.page')
    .forEach(element => {
      element.classList.remove('active');
    });

  const pageElement =
    document.getElementById(
      PAGES[page].el
    );

  if (pageElement) {
    pageElement.classList.add('active');
  }

  document
    .querySelectorAll('.nav-item')
    .forEach(link => {
      link.classList.toggle(
        'active',
        link.dataset.page === page
      );
    });

  PAGES[page].render();

  updateBadges();
  closeSettingsMenu();
}

function updateBadges() {
  const orders =
    DS.getOrders();

  const workflowOrders =
    orders.map(order => ({
      order,
      workflow:
        getSafeOrderWorkflow(order),
    }));

  const salesOrders =
    workflowOrders.filter(
      ({ workflow }) =>
        workflow.department === 'sales' &&
        !workflow.archived
    );

  const creationOrders =
    workflowOrders.filter(
      ({ workflow }) =>
        workflow.department === 'creation' &&
        !workflow.archived
    );

  const archiveOrders =
    workflowOrders.filter(
      ({ workflow }) =>
        workflow.archived
    );

  setBadgeCount(
    'badge-sales',
    salesOrders.length
  );

  setBadgeCount(
    'badge-creation',
    creationOrders.length
  );

  setBadgeCount(
    'badge-history',
    archiveOrders.length
  );
}

function setBadgeCount(
  elementId,
  count
) {
  const badge =
    document.getElementById(
      elementId
    );

  if (!badge) {
    return;
  }

  badge.textContent =
    count > 0
      ? String(count)
      : '';
}

function getSafeOrderWorkflow(order) {
  if (
    typeof normalizeOrderWorkflow ===
    'function'
  ) {
    return normalizeOrderWorkflow(
      order
    );
  }

  const archivedStatuses = [
    'verzonden',
    'afgerond',
    'completed',
    'cancelled',
  ];

  return {
    department:
      archivedStatuses.includes(
        order.status
      )
        ? 'archive'
        : 'sales',

    status:
      order.status ||
      'new_request',

    archived:
      archivedStatuses.includes(
        order.status
      ),
  };
}

// ─── SETTINGS MENU ───────────────────────────────────────────────────────────

function toggleSettingsMenu() {
  const button =
    document.getElementById(
      'btn-settings-menu'
    );

  const menu =
    document.getElementById(
      'settings-menu'
    );

  if (
    !button ||
    !menu
  ) {
    return;
  }

  const nextOpen =
    menu.classList.contains(
      'hidden'
    );

  menu.classList.toggle(
    'hidden',
    !nextOpen
  );

  button.setAttribute(
    'aria-expanded',
    String(nextOpen)
  );
}

function closeSettingsMenu() {
  const button =
    document.getElementById(
      'btn-settings-menu'
    );

  const menu =
    document.getElementById(
      'settings-menu'
    );

  if (!menu) {
    return;
  }

  menu.classList.add(
    'hidden'
  );

  button?.setAttribute(
    'aria-expanded',
    'false'
  );
}

// ─── MODAL ───────────────────────────────────────────────────────────────────

function openModal({
  title,
  body,
  footer,
}) {
  const modalTitle =
    document.getElementById(
      'modal-title'
    );

  const modalBody =
    document.getElementById(
      'modal-body'
    );

  const modalFooter =
    document.getElementById(
      'modal-footer'
    );

  const modalOverlay =
    document.getElementById(
      'modal-overlay'
    );

  if (
    !modalTitle ||
    !modalBody ||
    !modalFooter ||
    !modalOverlay
  ) {
    return;
  }

  modalTitle.textContent =
    title;

  modalBody.innerHTML = '';
  modalFooter.innerHTML = '';

  if (
    typeof body ===
    'string'
  ) {
    modalBody.innerHTML =
      body;
  } else if (body) {
    modalBody.appendChild(
      body
    );
  }

  if (footer) {
    if (
      typeof footer ===
      'string'
    ) {
      modalFooter.innerHTML =
        footer;
    } else {
      modalFooter.appendChild(
        footer
      );
    }
  }

  modalOverlay.classList.remove(
    'hidden'
  );
}

function closeModal() {
  const modalOverlay =
    document.getElementById(
      'modal-overlay'
    );

  if (modalOverlay) {
    modalOverlay.classList.add(
      'hidden'
    );
  }
}

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────

function confirmDialog(
  message,
  options = {}
) {
  return new Promise(resolve => {
    const confirmLabel =
      options.confirmLabel ||
      'Verwijderen';

    const confirmClass =
      options.confirmClass ||
      'btn-danger';

    const footer =
      document.createElement(
        'div'
      );

    footer.className =
      'confirm-actions';

    footer.innerHTML = `
      <button
        class="btn btn-secondary"
        id="confirm-no"
        type="button"
      >
        Annuleren
      </button>

      <button
        class="btn ${confirmClass}"
        id="confirm-yes"
        type="button"
      >
        ${escHtml(confirmLabel)}
      </button>
    `;

    openModal({
      title:
        options.title ||
        'Bevestig',

      body:
        `<p class="confirm-message">${escHtml(message)}</p>`,

      footer,
    });

    document
      .getElementById(
        'confirm-yes'
      )
      .addEventListener(
        'click',
        () => {
          closeModal();
          resolve(true);
        }
      );

    document
      .getElementById(
        'confirm-no'
      )
      .addEventListener(
        'click',
        () => {
          closeModal();
          resolve(false);
        }
      );
  });
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

let toastTimer;

function showToast(
  message,
  type = 'success'
) {
  const toast =
    document.getElementById(
      'toast'
    );

  if (!toast) {
    return;
  }

  toast.textContent =
    message;

  toast.className =
    `toast ${type}`;

  clearTimeout(
    toastTimer
  );

  toastTimer =
    setTimeout(() => {
      toast.classList.add(
        'hidden'
      );
    }, 3000);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) {
    return '—';
  }

  const date =
    new Date(iso);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—';
  }

  return date.toLocaleDateString(
    'nl-NL',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }
  );
}

function formatEuro(value) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return '—';
  }

  return `€ ${parseFloat(value).toFixed(2).replace('.', ',')}`;
}

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener(
  'DOMContentLoaded',
  async () => {
    await DS.init();
    DS.seedDemoData();

    const modalCloseButton =
      document.getElementById(
        'btn-modal-close'
      );

    const modalOverlay =
      document.getElementById(
        'modal-overlay'
      );

    const resetButton =
      document.getElementById(
        'btn-reset-data'
      );

    const newOrderButton =
      document.getElementById(
        'btn-global-new-order'
      );

    const settingsButton =
      document.getElementById(
        'btn-settings-menu'
      );

    if (modalCloseButton) {
      modalCloseButton.addEventListener(
        'click',
        closeModal
      );
    }

    if (modalOverlay) {
      modalOverlay.addEventListener(
        'click',
        event => {
          if (
            event.target ===
            event.currentTarget
          ) {
            closeModal();
          }
        }
      );
    }

    if (newOrderButton) {
      newOrderButton.addEventListener(
        'click',
        () => {
          if (
            typeof openOrderModal ===
            'function'
          ) {
            openOrderModal();
          }
        }
      );
    }

    if (settingsButton) {
      settingsButton.addEventListener(
        'click',
        event => {
          event.stopPropagation();
          toggleSettingsMenu();
        }
      );
    }

    document.addEventListener(
      'click',
      event => {
        if (
          !event.target.closest(
            '.settings-menu-wrap'
          )
        ) {
          closeSettingsMenu();
        }
      }
    );

    document.addEventListener(
      'keydown',
      event => {
        if (
          event.key ===
          'Escape'
        ) {
          closeSettingsMenu();
          closeModal();
        }
      }
    );

    if (resetButton) {
      resetButton.addEventListener(
        'click',
        async () => {
          const confirmed =
            await confirmDialog(
              'Alle lokaal gecachte data resetten?',
              {
                title:
                  'Reset data',

                confirmLabel:
                  'Reset data',

                confirmClass:
                  'btn-danger',
              }
            );

          if (!confirmed) {
            return;
          }

          localStorage.removeItem(
            'cot_orders'
          );

          localStorage.removeItem(
            'cot_products'
          );

          await Promise.all([
            typeof DS.refreshOrders ===
            'function'
              ? DS.refreshOrders()
              : Promise.resolve(),

            typeof DS.refreshProducts ===
            'function'
              ? DS.refreshProducts()
              : Promise.resolve(),
          ]);

          navigate(
            location.hash ||
            '#creation'
          );

          showToast(
            'Lokale cache opnieuw geladen'
          );
        }
      );
    }

    window.addEventListener(
      'hashchange',
      () => {
        navigate(
          location.hash
        );
      }
    );

    navigate(
      location.hash ||
      '#creation'
    );
  }
);

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