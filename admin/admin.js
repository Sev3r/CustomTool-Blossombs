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

  const archived =
    isOrderArchived(order);

  return {
    department:
      archived
        ? 'archive'
        : 'sales',

    status:
      order.status ||
      'new_request',

    archived,
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

  flushPendingRerender();
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
  type = 'success',
  duration = 3000
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
    }, duration);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// ─── VERBINDING & SAMENWERKEN ────────────────────────────────────────────────

let wasOffline = false;
let pendingRerender = false;

function updateConnectionBanner(online) {
  const banner =
    document.getElementById(
      'sync-banner'
    );

  const text =
    document.getElementById(
      'sync-banner-text'
    );

  if (
    !banner ||
    !text
  ) {
    return;
  }

  if (online) {
    banner.classList.add(
      'hidden'
    );

    return;
  }

  text.textContent =
    'Geen verbinding met de database. Je ziet mogelijk niet de laatste stand, en wijzigingen worden niet opgeslagen.';

  banner.classList.remove(
    'hidden'
  );
}

function handleConnection(event) {
  const online =
    Boolean(
      event.detail?.online
    );

  updateConnectionBanner(
    online
  );

  if (
    online &&
    wasOffline
  ) {
    showToast(
      'Verbinding hersteld'
    );
  }

  wasOffline =
    !online;
}

function getRecordNoun(kind) {
  return kind === 'products'
    ? 'Dit product'
    : 'Deze order';
}

function handleSaveError(event) {
  const detail =
    event.detail ||
    {};

  const noun =
    getRecordNoun(
      detail.kind
    );

  const messages = {
    conflict:
      `${noun} is intussen door iemand anders aangepast. De nieuwste versie staat nu op je scherm; voer je wijziging opnieuw uit.`,

    deleted:
      `${noun} is intussen door iemand anders verwijderd.`,

    failed:
      'Opslaan mislukt. Je wijziging is teruggedraaid; controleer je verbinding en probeer het opnieuw.',
  };

  showToast(
    messages[detail.type] ||
    messages.failed,
    'error',
    7000
  );
}

/**
 * Is de gebruiker midden in iets (modal open, slepen, typen)?
 * Dan het scherm niet onder haar handen vernieuwen.
 */
function isUserBusy() {
  const overlay =
    document.getElementById(
      'modal-overlay'
    );

  if (
    overlay &&
    !overlay.classList.contains(
      'hidden'
    )
  ) {
    return true;
  }

  if (
    typeof draggedOrderId !==
    'undefined' &&
    draggedOrderId
  ) {
    return true;
  }

  const active =
    document.activeElement;

  return Boolean(
    active &&
    active.closest?.(
      '.main-content'
    ) &&
    [
      'INPUT',
      'TEXTAREA',
      'SELECT',
    ].includes(
      active.tagName
    )
  );
}

function rerenderCurrentPage() {
  if (isUserBusy()) {
    pendingRerender = true;
    return;
  }

  pendingRerender = false;

  const scrollY =
    window.scrollY;

  navigate(
    location.hash ||
    '#creation'
  );

  window.scrollTo(
    0,
    scrollY
  );
}

function flushPendingRerender() {
  if (!pendingRerender) {
    return;
  }

  setTimeout(
    rerenderCurrentPage,
    0
  );
}

async function reconnect() {
  const button =
    document.getElementById(
      'btn-sync-retry'
    );

  if (button?.disabled) {
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent =
      'Bezig...';
  }

  const ok =
    await DS.reload();

  if (button) {
    button.disabled = false;
    button.textContent =
      'Opnieuw verbinden';
  }

  if (!ok) {
    showToast(
      'Nog geen verbinding. Probeer het zo opnieuw.',
      'error'
    );
  }
}

// ─── MIGRATIE BESTANDEN ──────────────────────────────────────────────────────

let migrationRunning = false;

async function runFileMigration() {
  closeSettingsMenu();

  if (migrationRunning) {
    return;
  }

  const confirmed =
    await confirmDialog(
      'Alle ontwerpen en documenten in bestaande orders worden naar Supabase Storage verplaatst. Dit kan een paar minuten duren; laat dit tabblad open tot je de eindmelding ziet.',
      {
        title:
          'Bestanden verplaatsen',

        confirmLabel:
          'Start',

        confirmClass:
          'btn-primary',
      }
    );

  if (!confirmed) {
    return;
  }

  migrationRunning = true;

  try {
    const result =
      await DS.migrateOrderFiles(
        progress => {
          showToast(
            `Bestanden verplaatsen: order ${progress.done} van ${progress.total}...`,
            'success',
            60000
          );
        }
      );

    const failedText =
      result.failed.length
        ? ` ${result.failed.length} mislukt (zie console).`
        : '';

    if (result.failed.length) {
      console.warn(
        'Bestanden verplaatsen mislukt voor:',
        result.failed
      );
    }

    showToast(
      `Klaar: ${result.migrated} order(s) verplaatst, ${result.skipped} hadden niets te verplaatsen.${failedText}`,
      result.failed.length
        ? 'error'
        : 'success',
      10000
    );
  } catch (error) {
    console.warn(
      'Bestanden verplaatsen mislukt.',
      error
    );

    showToast(
      'Bestanden verplaatsen mislukt. Controleer je verbinding en probeer het opnieuw.',
      'error',
      8000
    );
  } finally {
    migrationRunning = false;
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

window.addEventListener(
  'ds:connection',
  handleConnection
);

window.addEventListener(
  'ds:save-error',
  handleSaveError
);

window.addEventListener(
  'ds:data-changed',
  rerenderCurrentPage
);

window.addEventListener(
  'ds:load-warning',
  event => {
    const detail =
      event.detail ||
      {};

    const count =
      (detail.ids || []).length;

    const noun =
      detail.kind === 'products'
        ? (count === 1 ? 'product' : 'producten')
        : (count === 1 ? 'order' : 'orders');

    console.warn(
      'Niet geladen:',
      detail.kind,
      detail.ids
    );

    showToast(
      `${count} ${noun} kon${count === 1 ? '' : 'den'} niet worden geladen (waarschijnlijk te groot). Details staan in de console.`,
      'error',
      9000
    );
  }
);

document.addEventListener(
  'DOMContentLoaded',
  async () => {
    const syncRetryButton =
      document.getElementById(
        'btn-sync-retry'
      );

    if (syncRetryButton) {
      syncRetryButton.addEventListener(
        'click',
        reconnect
      );
    }

    await DS.init();
    DS.seedDemoData();
    DS.startAutoRefresh();

    document.addEventListener(
      'focusout',
      flushPendingRerender
    );

    document.addEventListener(
      'dragend',
      flushPendingRerender
    );

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

    document
      .getElementById(
        'btn-migrate-files'
      )
      ?.addEventListener(
        'click',
        runFileMigration
      );

    if (resetButton) {
      resetButton.addEventListener(
        'click',
        async () => {
          closeSettingsMenu();

          const ok =
            await DS.reload();

          showToast(
            ok
              ? 'Data opnieuw geladen'
              : 'Opnieuw laden mislukt. Controleer je verbinding.',
            ok
              ? 'success'
              : 'error'
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