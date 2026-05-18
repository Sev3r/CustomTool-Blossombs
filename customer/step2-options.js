/**
 * step2-options.js
 * Stap 2: Productopties (ontwerp keuze, aantallen, staffel)
 */

const FIXED_QUANTITIES = [50, 100, 250, 500, 1000];
const DESIGN_CHOICES = [
  { key: 'laat-ontwerpen',  label: 'Laat ons ontwerpen', price: 75,  addon: false },
  { key: 'eigen-ontwerp',   label: 'Eigen ontwerp',       price: 0,   addon: false },
];
const ADDON_CHOICES = [
  { key: 'bestandscontrole', label: 'Bestandscontrole', price: 15, addon: true },
];

function renderOptionsPage() {
  const el      = document.getElementById('page-options');
  const product = Session.getProduct();
  const saved   = Session.getOptions() || {};

  if (!product) { navigateTo('select'); return; }

  const images = [
    product.imageProduct      || null,
    product.imagePersonalize1 || null,
    product.imagePersonalize2 || null,
  ].filter(Boolean);

  const activeImg    = saved.activeImageIdx || 0;
  const designChoice = saved.designChoice   || 'laat-ontwerpen';
  const addons       = saved.addons         || [];
  const quantity     = saved.quantity       || '';

  el.innerHTML = `
    <h1 class="page-title">${escHtml(product.name)}</h1>

    <div class="options-layout">
      <!-- LINKS: productafbeelding -->
      <div>
        <div class="product-preview-main" id="preview-main">
          ${images.length > 0
            ? `<img id="preview-main-img" src="${images[activeImg]}" alt="Product">`
            : '📦'}
        </div>
        ${images.length > 1 ? `
          <div class="thumb-row">
            ${images.map((img, i) => `
              <div class="thumb ${i === activeImg ? 'active' : ''}" data-idx="${i}">
                <img src="${img}" alt="Afbeelding ${i+1}" onerror="this.parentElement.textContent='📦'">
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <!-- MIDDEN: staffel en templates -->
      <div>
        <div class="options-title">Aantallen &amp; Prijzen</div>

        <table class="staffel-table">
          <thead><tr><th>Stuks</th><th>Prijs / stuk</th></tr></thead>
          <tbody>
            ${FIXED_QUANTITIES.map(qty => {
              const price = getPriceForQty(product, qty);
              const isActive = parseInt(quantity) === qty;
              return `
                <tr class="${isActive ? 'highlighted' : ''}" data-qty="${qty}" style="cursor:pointer">
                  <td>${qty}</td>
                  <td>${price !== null ? formatEuro(price) : '—'}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>

        <div class="staffel-custom">
          <label>Anders, namelijk:</label>
          <input type="number" id="qty-custom" value="${!FIXED_QUANTITIES.includes(parseInt(quantity)) && quantity ? quantity : ''}" placeholder="stuks" min="1">
          <label>stuks</label>
        </div>

        ${(product.templates || []).length > 0 ? `
          <div class="template-links" style="margin-top:20px">
            <strong style="font-size:13px;color:var(--text-2);margin-bottom:4px">Templates &amp; informatie</strong>
            ${product.templates.map(t => `
              <a class="template-link" href="#" onclick="return false">
                📄 ${escHtml(t)}
              </a>
            `).join('')}
            <a class="template-link" href="#" onclick="return false">📋 Aanleverinformatie</a>
          </div>
        ` : ''}

        <a class="template-link" href="https://www.canva.com" target="_blank" style="margin-top:16px;display:inline-flex">
          🎨 Gratis ontwerpen met Canva
        </a>
      </div>

      <!-- RECHTS: ontwerp keuzes -->
      <div>
        <div class="options-title">Ontwerp opties</div>

        <div class="toggle-options" id="design-choices">
          ${DESIGN_CHOICES.map(choice => `
            <div class="toggle-option ${designChoice === choice.key ? 'active' : ''}" data-choice="${choice.key}">
              <div class="toggle-option-left">
                <span class="toggle-option-label">${choice.label}</span>
                <span class="toggle-option-price">${choice.price > 0 ? `+ ${formatEuro(choice.price)}` : 'Inbegrepen'}</span>
              </div>
              <label class="toggle-switch" onclick="event.stopPropagation()">
                <input type="radio" name="design-choice" value="${choice.key}" ${designChoice === choice.key ? 'checked' : ''}>
                <span class="toggle-track"></span>
              </label>
            </div>
          `).join('')}
        </div>

        <div style="margin-top:8px;margin-bottom:16px">
          ${ADDON_CHOICES.map(addon => `
            <div class="toggle-option addon ${addons.includes(addon.key) ? 'active' : ''}" data-addon="${addon.key}">
              <div class="toggle-option-left">
                <span class="toggle-option-label">${addon.label}</span>
                <span class="toggle-option-price">+ ${formatEuro(addon.price)} — combineerbaar met eigen ontwerp</span>
              </div>
              <label class="toggle-switch" onclick="event.stopPropagation()">
                <input type="checkbox" name="addon-${addon.key}" ${addons.includes(addon.key) ? 'checked' : ''}>
                <span class="toggle-track"></span>
              </label>
            </div>
          `).join('')}
        </div>

        <div id="options-error" style="color:var(--danger);font-size:13px;display:none;margin-bottom:8px">
          Kies een aantal om verder te gaan.
        </div>
      </div>
    </div>

    <div class="flow-nav">
      <button class="btn btn-outline" onclick="navigateTo('select')">← Terug</button>
      <button class="btn btn-green" id="btn-options-next">Verder →</button>
    </div>
  `;

  // Thumbnail klikken
  el.querySelectorAll('.thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const idx   = parseInt(thumb.dataset.idx);
      const img   = images[idx];
      el.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      const mainImg = document.getElementById('preview-main-img');
      if (mainImg && img) mainImg.src = img;
      saveOptions();
    });
  });

  // Design choice klikken
  el.querySelectorAll('.toggle-option[data-choice]').forEach(opt => {
    opt.addEventListener('click', () => {
      el.querySelectorAll('.toggle-option[data-choice]').forEach(o => {
        o.classList.remove('active');
        o.querySelector('input').checked = false;
      });
      opt.classList.add('active');
      opt.querySelector('input').checked = true;
      saveOptions();
    });
  });

  // Addon klikken
  el.querySelectorAll('.toggle-option[data-addon]').forEach(opt => {
    opt.addEventListener('click', () => {
      opt.classList.toggle('active');
      opt.querySelector('input').checked = opt.classList.contains('active');
      saveOptions();
    });
  });

  // Staffelrij klikken
  el.querySelectorAll('.staffel-table tbody tr[data-qty]').forEach(row => {
    row.addEventListener('click', () => {
      el.querySelectorAll('.staffel-table tbody tr').forEach(r => r.classList.remove('highlighted'));
      row.classList.add('highlighted');
      document.getElementById('qty-custom').value = '';
      saveOptions();
    });
  });

  // Custom quantity
  document.getElementById('qty-custom')?.addEventListener('input', () => {
    el.querySelectorAll('.staffel-table tbody tr').forEach(r => r.classList.remove('highlighted'));
    saveOptions();
  });

  // Verder
  document.getElementById('btn-options-next')?.addEventListener('click', () => {
    const opts = collectOptions(el, product);
    if (!opts.quantity) {
      document.getElementById('options-error').style.display = 'block';
      return;
    }
    document.getElementById('options-error').style.display = 'none';
    Session.setOptions(opts);
    // Stuur door naar juiste stap
    if (opts.designChoice === 'laat-ontwerpen') {
      navigateTo('wensen');
    } else {
      navigateTo('design');
    }
  });
}

function collectOptions(el, product) {
  const selectedRow = el.querySelector('.staffel-table tbody tr.highlighted');
  const customQty   = document.getElementById('qty-custom')?.value;
  const quantity    = selectedRow ? parseInt(selectedRow.dataset.qty) : (customQty ? parseInt(customQty) : null);

  const designChoice = el.querySelector('input[name="design-choice"]:checked')?.value || 'laat-ontwerpen';

  const addons = [];
  el.querySelectorAll('.toggle-option[data-addon].active').forEach(opt => {
    addons.push(opt.dataset.addon);
  });

  const activeThumb = el.querySelector('.thumb.active');
  const activeImageIdx = activeThumb ? parseInt(activeThumb.dataset.idx) : 0;

  return { quantity, designChoice, addons, activeImageIdx, productId: product.id };
}

function saveOptions() {
  const el      = document.getElementById('page-options');
  const product = Session.getProduct();
  if (!el || !product) return;
  const opts = collectOptions(el, product);
  Session.setOptions(opts);
}

function getPriceForQty(product, qty) {
  if (!product.priceSlabs) return null;
  const slab = product.priceSlabs.find(s => qty >= s.from && (s.to === null || qty <= s.to));
  return slab ? slab.price : null;
}

function formatEuro(n) {
  if (n === null || n === undefined) return '—';
  return '€ ' + parseFloat(n).toFixed(2).replace('.', ',');
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
