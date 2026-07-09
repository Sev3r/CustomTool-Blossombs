/**
 * step1-select.js
 * Stap 1: Productselectie.
 * Laadt producten via DS. DS.init() wordt in flow.js uitgevoerd voordat deze pagina rendert.
 */

async function renderSelectPage() {
  const el = document.getElementById('page-select');

  if (!el) {
    return;
  }

  if (typeof DS !== 'undefined' && typeof DS.init === 'function') {
    await DS.init();
  }

  const products = (typeof DS !== 'undefined' ? DS.getProducts() : [])
    .filter(product => product.active !== false);

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
        ${products.map(product => {
    const lowestPrice = getLowestPrice(product);
    const isSelected = selectedProduct?.id === product.id;
    const productImageSrc = getProductImageSrc(product);

    return `
            <div class="product-card ${isSelected ? 'selected' : ''}" data-id="${escHtml(product.id)}">
              <div class="product-card-img">
                ${productImageSrc
        ? `<img src="${escHtml(productImageSrc)}" alt="${escHtml(product.name)}" onerror="this.style.display='none'">`
        : '📦'
      }
              </div>

              <div class="product-card-body">
                <div class="product-card-name">${escHtml(product.name)}</div>
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

  el.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const product = products.find(item => item.id === id);

      if (!product) {
        return;
      }

      el.querySelectorAll('.product-card').forEach(item => {
        item.classList.remove('selected');
      });

      card.classList.add('selected');

      Session.setProduct(product);

      const nextButton = document.getElementById('btn-select-next');

      if (nextButton) {
        nextButton.disabled = false;
      }
    });
  });

  document.getElementById('btn-select-next')?.addEventListener('click', async () => {
    if (Session.getProduct()) {
      await navigateTo('options');
    }
  });
}

function getLowestPrice(product) {
  const allPriceSlabs = [];

  if (Array.isArray(product.personalisatieTypes)) {
    product.personalisatieTypes.forEach(persType => {
      if (Array.isArray(persType.priceSlabs)) {
        allPriceSlabs.push(...persType.priceSlabs);
      }
    });
  }

  if (allPriceSlabs.length === 0 && Array.isArray(product.priceSlabs)) {
    allPriceSlabs.push(...product.priceSlabs);
  }

  const validPrices = allPriceSlabs
    .map(priceSlab => Number(priceSlab.price))
    .filter(price => Number.isFinite(price) && price > 0);

  if (!validPrices.length) {
    return null;
  }

  return Math.min(...validPrices);
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatEuro(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) {
    return '—';
  }

  return `€ ${parseFloat(n).toFixed(2).replace('.', ',')}`;
}

function getProductImageSrc(product) {
  return product?.imageProductFile?.dataURL || product?.imageProduct || '';
}