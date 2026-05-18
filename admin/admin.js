/**
 * admin.js
 * SPA router + gedeelde utilities (modal, toast, confirm)
 */

// ─── ROUTER ──────────────────────────────────────────────────────────────────

const PAGES = {
  orders:   { el: 'page-orders',   render: renderOrdersPage   },
  products: { el: 'page-products', render: renderProductsPage },
  work:     { el: 'page-work',     render: renderWorkPage     },
};

function navigate(hash) {
  const page = hash.replace('#', '') || 'orders';
  if (!PAGES[page]) return navigate('orders');

  // Wissel actieve pagina
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');

  // Wissel actieve nav link
  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });

  PAGES[page].render();
  updateBadges();
}

function updateBadges() {
  const orders   = DS.getOrders();
  const pending  = orders.filter(o => o.status !== 'afgerond');
  const workItems = orders.filter(o => ['wacht-op-ontwerp','wacht-op-bestandscheck','wacht-op-goedkeuring'].includes(o.status));

  const bo = document.getElementById('badge-orders');
  const bw = document.getElementById('badge-work');
  if (bo) bo.textContent = orders.length   || '';
  if (bw) bw.textContent = workItems.length || '';
}

// ─── MODAL ───────────────────────────────────────────────────────────────────

function openModal({ title, body, footer }) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML    = '';
  document.getElementById('modal-footer').innerHTML  = '';

  if (typeof body === 'string') {
    document.getElementById('modal-body').innerHTML = body;
  } else {
    document.getElementById('modal-body').appendChild(body);
  }

  if (footer) {
    if (typeof footer === 'string') document.getElementById('modal-footer').innerHTML = footer;
    else document.getElementById('modal-footer').appendChild(footer);
  }

  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────

function confirmDialog(message) {
  return new Promise(resolve => {
    const footer = document.createElement('div');
    footer.style.display = 'flex'; footer.style.gap = '8px';
    footer.innerHTML = `
      <button class="btn btn-secondary" id="confirm-no">Annuleren</button>
      <button class="btn btn-danger"    id="confirm-yes">Verwijderen</button>
    `;
    openModal({ title: 'Bevestig', body: `<p style="padding:4px 0">${message}</p>`, footer });
    document.getElementById('confirm-yes').addEventListener('click', () => { closeModal(); resolve(true); });
    document.getElementById('confirm-no').addEventListener('click',  () => { closeModal(); resolve(false); });
  });
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatEuro(n) {
  if (n === undefined || n === null || n === '') return '—';
  return '€ ' + parseFloat(n).toFixed(2).replace('.', ',');
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  DS.seedDemoData();

  // Modal close handlers
  document.getElementById('btn-modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Reset data
  document.getElementById('btn-reset-data').addEventListener('click', async () => {
    const ok = await confirmDialog('Alle data resetten naar demo-data?');
    if (!ok) return;
    localStorage.removeItem('cot_orders');
    localStorage.removeItem('cot_products');
    DS.seedDemoData();
    navigate(location.hash || '#orders');
    showToast('Data gereset naar demo-data');
  });

  // Hash routing
  window.addEventListener('hashchange', () => navigate(location.hash));
  navigate(location.hash || '#orders');
});

// Globaal beschikbaar maken
window.AdminUI = { openModal, closeModal, confirmDialog, showToast, formatDate, formatEuro, escHtml, updateBadges };
