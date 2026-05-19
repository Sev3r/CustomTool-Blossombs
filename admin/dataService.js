/**
 * dataService.js
 * Gedeelde datalaag voor orders en producten.
 * Gebruikt localStorage als tijdelijke opslag.
 *
 * SHOPIFY INTEGRATIEPUNT:
 * Vervang de localStorage-aanroepen in elke functie door fetch()-calls
 * naar de Shopify Admin API of een eigen backend:
 *   - getOrders()   → GET  /admin/api/orders.json
 *   - saveOrder()   → POST /admin/api/orders.json  of  PUT .../orders/{id}.json
 *   - deleteOrder() → DELETE /admin/api/orders/{id}.json
 * Idem voor producten via Shopify Products API of Metafields.
 */

const KEYS = {
  orders: 'cot_orders',
  products: 'cot_products',
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

function uid(prefix = 'ORD') {
  return prefix + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function now() {
  return new Date().toISOString();
}

// ─── ORDERS ─────────────────────────────────────────────────────────────────

function getOrders() {
  // SHOPIFY INTEGRATIEPUNT: vervang door fetch('/admin/api/orders.json')
  const raw = localStorage.getItem(KEYS.orders);
  return raw ? JSON.parse(raw) : [];
}

function saveAllOrders(orders) {
  // SHOPIFY INTEGRATIEPUNT: vervang door bulk-update of losse PUT-calls
  localStorage.setItem(KEYS.orders, JSON.stringify(orders));
}

function saveOrder(order) {
  const orders = getOrders();
  if (!order.id) {
    order.id = uid('ORD');
    order.orderNumber = uid('BLO');
    order.createdAt = now();
    orders.push(order);
  } else {
    const idx = orders.findIndex(o => o.id === order.id);
    if (idx > -1) orders[idx] = order;
    else orders.push(order);
  }
  saveAllOrders(orders);
  return order;
}

function deleteOrder(id) {
  const orders = getOrders().filter(o => o.id !== id);
  saveAllOrders(orders);
}

function getOrderById(id) {
  return getOrders().find(o => o.id === id) || null;
}

// ─── PRODUCTS ───────────────────────────────────────────────────────────────

function getProducts() {
  // SHOPIFY INTEGRATIEPUNT: vervang door fetch('/admin/api/products.json')
  const raw = localStorage.getItem(KEYS.products);
  return raw ? JSON.parse(raw) : [];
}

function saveAllProducts(products) {
  localStorage.setItem(KEYS.products, JSON.stringify(products));
}

function saveProduct(product) {
  const products = getProducts();
  if (!product.id) {
    product.id = uid('PRD');
    product.createdAt = now();
    products.push(product);
  } else {
    const idx = products.findIndex(p => p.id === product.id);
    if (idx > -1) products[idx] = product;
    else products.push(product);
  }
  saveAllProducts(products);
  return product;
}

function deleteProduct(id) {
  // Controleer of er actieve orders aan dit product gekoppeld zijn
  const linked = getOrders().filter(o => o.productId === id && o.status !== 'afgerond');
  if (linked.length > 0) {
    return { error: `Dit product heeft ${linked.length} actieve order(s). Verwijder of rond deze eerst af.` };
  }
  saveAllProducts(getProducts().filter(p => p.id !== id));
  return { success: true };
}

function getProductById(id) {
  return getProducts().find(p => p.id === id) || null;
}

// Bij het opslaan van een product, bereken canvas-dimensies automatisch:
function calcCanvasDimensions(widthMm, heightMm) {
  const DPI = 300;
  const MM_PER_INCH = 25.4;
  const MAX_DISPLAY = 700; // max breedte van de canvas in de UI (px)

  // Werkelijke printpixels (300 DPI)
  const widthPx = Math.round((widthMm / MM_PER_INCH) * DPI);
  const heightPx = Math.round((heightMm / MM_PER_INCH) * DPI);

  // Display-formaat: schaal naar max 700px breed, behoud ratio
  const scale = MAX_DISPLAY / widthPx;
  const displayWidth = Math.round(widthPx * scale);
  const displayHeight = Math.round(heightPx * scale);

  return {
    width_px: widthPx, height_px: heightPx,
    canvas_display_width: displayWidth, canvas_display_height: displayHeight
  };
}

// ─── DEMO DATA ───────────────────────────────────────────────────────────────

function seedDemoData() {
  if (getProducts().length > 0 || getOrders().length > 0) return;

  const products = [
    {
      id: 'PRD-DEMO1', createdAt: now(),
      name: 'Kleine geschenkdoos', active: true,
      priceSlabs: [
        { from: 1, to: 9, price: 4.95 },
        { from: 10, to: 49, price: 3.75 },
        { from: 50, to: null, price: 2.95 },
      ],
      templates: ['template-klein-01.png', 'template-klein-02.png'],
      imageProduct: '', imagePersonalize1: '', imagePersonalize2: '',
      width_mm: 100, height_mm: 70, margin_mm: 5,
      width_px: 1181, height_px: 827, margin_px: 59,
      canvas_display_width: 500, canvas_display_height: 350,
    },
    {
      id: 'PRD-DEMO2', createdAt: now(),
      name: 'Grote geschenkdoos', active: true,
      priceSlabs: [
        { from: 1, to: 9, price: 7.50 },
        { from: 10, to: 49, price: 5.95 },
        { from: 50, to: null, price: 4.50 },
      ],
      templates: ['template-groot-01.png'],
      imageProduct: '', imagePersonalize1: '', imagePersonalize2: '',
      width_mm: 200, height_mm: 120, margin_mm: 8,
      width_px: 2362, height_px: 1417, margin_px: 94,
      canvas_display_width: 600, canvas_display_height: 360,
    },
    {
      id: 'PRD-DEMO3', createdAt: now(),
      name: 'Envelop zakje', active: false,
      priceSlabs: [
        { from: 1, to: 9, price: 2.50 },
        { from: 10, to: null, price: 1.95 },
      ],
      templates: [],
      imageProduct: '', imagePersonalize1: '', imagePersonalize2: '',
      width_mm: 80, height_mm: 110, margin_mm: 4,
      width_px: 945, height_px: 1299, margin_px: 47,
      canvas_display_width: 300, canvas_display_height: 420,
    },
  ];

  const orders = [
    {
      id: 'ORD-DEMO1', orderNumber: 'BLO-AA1', createdAt: '2025-05-01T09:12:00Z',
      customerName: 'Emma de Vries', customerEmail: 'emma@devries.nl',
      deliveryAddress: 'Hoofdstraat 12, 1234 AB Amsterdam',
      productId: 'PRD-DEMO1', productName: 'Kleine geschenkdoos', quantity: 25,
      designFile: 'ontwerp-emma.png', deliveryDate: '2025-05-20',
      quoteAmount: 93.75, confirmationSent: true,
      workType: 'bestandscheck', status: 'wacht-op-bestandscheck',
      notes: 'Klant heeft eigen ontwerp aangeleverd',
    },
    {
      id: 'ORD-DEMO2', orderNumber: 'BLO-BB2', createdAt: '2025-05-03T14:30:00Z',
      customerName: 'Lars Bakker', customerEmail: 'lars@bakker.com',
      deliveryAddress: 'Kerkweg 5, 5678 CD Rotterdam',
      productId: 'PRD-DEMO2', productName: 'Grote geschenkdoos', quantity: 10,
      designFile: '', deliveryDate: '2025-05-25',
      quoteAmount: 59.50, confirmationSent: false,
      workType: 'ontwerp', status: 'wacht-op-ontwerp',
      notes: 'Wil groene kleur, logo bijgevoegd per mail',
    },
    {
      id: 'ORD-DEMO3', orderNumber: 'BLO-CC3', createdAt: '2025-05-05T11:00:00Z',
      customerName: 'Sophie Jansen', customerEmail: 'sophie@jansen.nl',
      deliveryAddress: 'Dorpsstraat 88, 9012 EF Utrecht',
      productId: 'PRD-DEMO1', productName: 'Kleine geschenkdoos', quantity: 50,
      designFile: 'ontwerp-sophie-v2.png', deliveryDate: '2025-05-18',
      quoteAmount: 147.50, confirmationSent: true,
      workType: 'bestandscheck', status: 'wacht-op-goedkeuring',
      notes: '',
    },
    {
      id: 'ORD-DEMO4', orderNumber: 'BLO-DD4', createdAt: '2025-05-07T16:45:00Z',
      customerName: 'Tim van den Berg', customerEmail: 'tim@vdberg.nl',
      deliveryAddress: 'Nieuwstraat 3, 3456 GH Den Haag',
      productId: 'PRD-DEMO2', productName: 'Grote geschenkdoos', quantity: 5,
      designFile: '', deliveryDate: '2025-06-01',
      quoteAmount: 37.50, confirmationSent: false,
      workType: 'ontwerp', status: 'wacht-op-ontwerp',
      notes: 'Deadline is flexibel',
    },
    {
      id: 'ORD-DEMO5', orderNumber: 'BLO-EE5', createdAt: '2025-04-28T08:00:00Z',
      customerName: 'Nora Smits', customerEmail: 'nora@smits.com',
      deliveryAddress: 'Parallelweg 17, 7890 IJ Eindhoven',
      productId: 'PRD-DEMO1', productName: 'Kleine geschenkdoos', quantity: 15,
      designFile: 'ontwerp-nora-final.png', deliveryDate: '2025-05-10',
      quoteAmount: 56.25, confirmationSent: true,
      workType: 'bestandscheck', status: 'afgerond',
      notes: '',
    },
  ];

  saveAllProducts(products);
  saveAllOrders(orders);
}

// Exporteer alles als globaal object zodat alle pagina's er bij kunnen
window.DS = {
  getOrders, saveOrder, deleteOrder, getOrderById,
  getProducts, saveProduct, deleteProduct, getProductById,
  seedDemoData,
};
