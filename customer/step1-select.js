/**
 * step1-select.js
 * Stap 1: Productselectie
 *
 * SHOPIFY INTEGRATIEPUNT:
 * Vervang DS.getProducts() door een fetch() naar:
 * GET /products.json?collection_id=YOUR_COLLECTION_ID
 * of lees uit Shopify Metafields via de Storefront API.
 */

function renderSelectPage() {
  const el = document.getElementById('page-select');

  // Laad alleen actieve producten
  const products = (typeof DS !== 'undefined' ? DS.getProducts() : [])
    .filter(p => p.active !== false);

  const selectedProduct = Session.getProduct();

  el.innerHTML = `
    <h1 class="page-title">Kies uw product</h1>
    <p class="page-subtitle">Selecteer het product dat u wilt personaliseren</p>

    ${products.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <h3>Geen producten beschikbaar</h3>
        <p>Er zijn momenteel geen producten beschikbaar. Probeer het later opnieuw.</p>
      </div>
    ` : `
      <div class="product-grid" id="product-grid">
        ${products.map(p => {
    const lowestPrice = getLowestPrice(p);
    const isSelected = selectedProduct?.id === p.id;
    return `
            <div class="product-card ${isSelected ? 'selected' : ''}" data-id="${p.id}">
              <div class="product-card-img">
                ${getProductImageSrc(p)
        ? `<img src="${getProductImageSrc(p)}" alt="${escHtml(p.name)}" onerror="this.style.display='none'">`
        : '📦'}
              </div>
              <div class="product-card-body">
                <div class="product-card-name">${escHtml(p.name)}</div>
                <div class="product-card-price">Vanaf ${formatEuro(lowestPrice)} / stuk</div>
              </div>
            </div>
          `;
  }).join('')}
      </div>
    `}

    <div class="flow-nav">
      <span></span>
      <button class="btn btn-green" id="btn-select-next" ${!selectedProduct ? 'disabled' : ''}>
        Verder →
      </button>
    </div>
  `;

  // Klik op product
  el.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const product = products.find(p => p.id === id);
      if (!product) return;

      // Selecteer visueel
      el.querySelectorAll('.product-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      // Sla op in sessie
      Session.setProduct(product);

      // Activeer "Verder"-knop
      document.getElementById('btn-select-next').disabled = false;
    });
  });

  document.getElementById('btn-select-next')?.addEventListener('click', () => {
    if (Session.getProduct()) navigateTo('options');
  });
}

function getLowestPrice(product) {
  if (!product.priceSlabs || product.priceSlabs.length === 0) return null;
  return Math.min(...product.priceSlabs.map(s => s.price));
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatEuro(n) {
  if (n === null || n === undefined) return '—';
  return '€ ' + parseFloat(n).toFixed(2).replace('.', ',');
}

function getProductImageSrc(product) {
  return product?.imageProductFile?.dataURL || product?.imageProduct || '';
}