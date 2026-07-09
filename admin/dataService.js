/**
 * dataService.js
 * Gedeelde datalaag voor orders en producten.
 *
 * Centrale opslag:
 * - Supabase voor gedeelde producten en orders tussen apparaten.
 * - localStorage als fallback/cache wanneer Supabase niet beschikbaar is.
 *
 * Let op:
 * - Deze implementatie gebruikt de Supabase anon key.
 * - De huidige RLS policies zijn geschikt voor prototype/demo, niet voor productie.
 */

const SUPABASE_URL = 'https://ewtxlqazjplxhomgfuqv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHhscWF6anBseGhvbWdmdXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1Njg1NTYsImV4cCI6MjA5OTE0NDU1Nn0.NYjHd_lL68D6N8yuDcKqUixjiYBmXQWKK3Rqc9ADcto';

const ENABLE_DEMO_DATA = false;

const KEYS = {
  orders: 'cot_orders',
  products: 'cot_products',
};

const DB_TABLES = {
  orders: 'orders',
  products: 'products',
};

const state = {
  initialized: false,
  initializing: null,
  supabase: null,
  orders: [],
  products: [],
};

// ─── INIT ───────────────────────────────────────────────────────────────────

async function init() {
  if (state.initialized) {
    return true;
  }

  if (state.initializing) {
    return state.initializing;
  }

  state.initializing = initializeDataService();

  return state.initializing;
}

async function initializeDataService() {
  state.supabase = createSupabaseClient();

  loadLocalCache();

  if (!state.supabase) {
    console.warn('Supabase client niet beschikbaar. dataService gebruikt localStorage fallback.');
    state.initialized = true;
    return false;
  }

  try {
    const [productsResult, ordersResult] = await Promise.all([
      fetchRemoteProducts(),
      fetchRemoteOrders(),
    ]);

    const remoteProducts = productsResult || [];
    const remoteOrders = ordersResult || [];

    const localProducts = readLocalArray(KEYS.products);
    const localOrders = readLocalArray(KEYS.orders);

    if (!remoteProducts.length && localProducts.length) {
      state.products = localProducts;
      await persistAllProductsRemote(localProducts);
    } else {
      state.products = remoteProducts;
    }

    if (!remoteOrders.length && localOrders.length) {
      state.orders = localOrders;
      await persistAllOrdersRemote(localOrders);
    } else {
      state.orders = remoteOrders;
    }

    writeLocalArray(KEYS.products, state.products);
    writeLocalArray(KEYS.orders, state.orders);

    state.initialized = true;
    return true;
  } catch (error) {
    console.warn('Supabase laden mislukt. dataService gebruikt localStorage fallback.', error);
    loadLocalCache();
    state.initialized = true;
    return false;
  }
}

function createSupabaseClient() {
  if (!window.supabase?.createClient) {
    return null;
  }

  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function loadLocalCache() {
  state.products = readLocalArray(KEYS.products);
  state.orders = readLocalArray(KEYS.orders);
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function uid(prefix = 'ORD') {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function now() {
  return new Date().toISOString();
}

function readLocalArray(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`localStorage lezen mislukt voor ${key}`, error);
    return [];
  }
}

function writeLocalArray(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify(items || []));
  } catch (error) {
    console.warn(`localStorage schrijven mislukt voor ${key}`, error);
  }
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value || null));
}

function normalizeRecordId(record, prefix) {
  if (record.id) {
    return record.id;
  }

  return uid(prefix);
}

function getOrderNumber(order) {
  return order.orderNumber || order.order_number || '';
}

function getOrderStatus(order) {
  return order.status || order.workflow?.status || '';
}

function getOrderWorkflow(order) {
  return order.workflow || {};
}

function queueRemoteTask(task, label) {
  task().catch(error => {
    console.warn(`${label} mislukt. Wijziging staat nog wel lokaal.`, error);
  });
}

// ─── ROW MAPPING ────────────────────────────────────────────────────────────

function productToRow(product) {
  const data = cloneData(product);

  return {
    id: product.id,
    data,
    created_at: product.createdAt || product.created_at || now(),
    updated_at: now(),
  };
}

function rowToProduct(row) {
  const data = row.data || {};

  return {
    ...data,
    id: row.id,
    createdAt: data.createdAt || row.created_at,
    updatedAt: data.updatedAt || row.updated_at,
  };
}

function orderToRow(order) {
  const data = cloneData(order);

  return {
    id: order.id,
    order_number: getOrderNumber(order),
    status: getOrderStatus(order),
    workflow: getOrderWorkflow(order),
    data,
    created_at: order.createdAt || order.created_at || now(),
    updated_at: now(),
  };
}

function rowToOrder(row) {
  const data = row.data || {};
  const workflow = data.workflow || row.workflow || {};

  return {
    ...data,
    id: row.id,
    orderNumber: data.orderNumber || row.order_number || '',
    status: data.status || row.status || workflow.status || '',
    workflow,
    createdAt: data.createdAt || row.created_at,
    updatedAt: data.updatedAt || row.updated_at,
  };
}

// ─── REMOTE FETCH ───────────────────────────────────────────────────────────

async function fetchRemoteProducts() {
  if (!state.supabase) {
    return [];
  }

  const { data, error } = await state.supabase
    .from(DB_TABLES.products)
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(rowToProduct);
}

async function fetchRemoteOrders() {
  if (!state.supabase) {
    return [];
  }

  const { data, error } = await state.supabase
    .from(DB_TABLES.orders)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(rowToOrder);
}

// ─── ORDERS ─────────────────────────────────────────────────────────────────

function getOrders() {
  return state.orders.slice();
}

function saveAllOrders(orders) {
  state.orders = Array.isArray(orders) ? orders.slice() : [];
  writeLocalArray(KEYS.orders, state.orders);

  if (state.supabase) {
    queueRemoteTask(() => persistAllOrdersRemote(state.orders), 'Orders synchroniseren');
  }
}

async function saveAllOrdersAsync(orders) {
  state.orders = Array.isArray(orders) ? orders.slice() : [];
  writeLocalArray(KEYS.orders, state.orders);

  if (state.supabase) {
    await persistAllOrdersRemote(state.orders);
  }

  return state.orders;
}

function saveOrder(order) {
  const savedOrder = prepareOrderForSave(order);
  const orders = state.orders.slice();
  const index = orders.findIndex(item => item.id === savedOrder.id);

  if (index > -1) {
    orders[index] = savedOrder;
  } else {
    orders.push(savedOrder);
  }

  state.orders = orders;
  writeLocalArray(KEYS.orders, state.orders);

  if (state.supabase) {
    queueRemoteTask(() => persistOrderRemote(savedOrder), 'Order opslaan');
  }

  return savedOrder;
}

async function saveOrderAsync(order) {
  const savedOrder = saveOrder(order);

  if (state.supabase) {
    await persistOrderRemote(savedOrder);
  }

  return savedOrder;
}

function prepareOrderForSave(order = {}) {
  const prepared = {
    ...order,
    id: normalizeRecordId(order, 'ORD'),
  };

  if (!prepared.orderNumber) {
    prepared.orderNumber = uid('BLO');
  }

  if (!prepared.createdAt) {
    prepared.createdAt = now();
  }

  prepared.updatedAt = now();

  return prepared;
}

function deleteOrder(id) {
  state.orders = state.orders.filter(order => order.id !== id);
  writeLocalArray(KEYS.orders, state.orders);

  if (state.supabase) {
    queueRemoteTask(() => deleteOrderRemote(id), 'Order verwijderen');
  }
}

async function deleteOrderAsync(id) {
  deleteOrder(id);

  if (state.supabase) {
    await deleteOrderRemote(id);
  }
}

function getOrderById(id) {
  return state.orders.find(order => order.id === id) || null;
}

async function refreshOrders() {
  if (!state.supabase) {
    loadLocalCache();
    return state.orders;
  }

  state.orders = await fetchRemoteOrders();
  writeLocalArray(KEYS.orders, state.orders);

  return state.orders;
}

async function persistOrderRemote(order) {
  if (!state.supabase) {
    return;
  }

  const { error } = await state.supabase
    .from(DB_TABLES.orders)
    .upsert(orderToRow(order), { onConflict: 'id' });

  if (error) {
    throw error;
  }
}

async function persistAllOrdersRemote(orders) {
  if (!state.supabase || !orders.length) {
    return;
  }

  const rows = orders.map(orderToRow);

  const { error } = await state.supabase
    .from(DB_TABLES.orders)
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    throw error;
  }
}

async function deleteOrderRemote(id) {
  if (!state.supabase) {
    return;
  }

  const { error } = await state.supabase
    .from(DB_TABLES.orders)
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }
}

// ─── PRODUCTS ───────────────────────────────────────────────────────────────

function getProducts() {
  return state.products.slice();
}

function saveAllProducts(products) {
  state.products = Array.isArray(products) ? products.slice() : [];
  writeLocalArray(KEYS.products, state.products);

  if (state.supabase) {
    queueRemoteTask(() => persistAllProductsRemote(state.products), 'Producten synchroniseren');
  }
}

async function saveAllProductsAsync(products) {
  state.products = Array.isArray(products) ? products.slice() : [];
  writeLocalArray(KEYS.products, state.products);

  if (state.supabase) {
    await persistAllProductsRemote(state.products);
  }

  return state.products;
}

function saveProduct(product) {
  const savedProduct = prepareProductForSave(product);
  const products = state.products.slice();
  const index = products.findIndex(item => item.id === savedProduct.id);

  if (index > -1) {
    products[index] = savedProduct;
  } else {
    products.push(savedProduct);
  }

  state.products = products;
  writeLocalArray(KEYS.products, state.products);

  if (state.supabase) {
    queueRemoteTask(() => persistProductRemote(savedProduct), 'Product opslaan');
  }

  return savedProduct;
}

async function saveProductAsync(product) {
  const savedProduct = saveProduct(product);

  if (state.supabase) {
    await persistProductRemote(savedProduct);
  }

  return savedProduct;
}

function prepareProductForSave(product = {}) {
  const prepared = {
    ...product,
    id: normalizeRecordId(product, 'PRD'),
  };

  if (!prepared.createdAt) {
    prepared.createdAt = now();
  }

  prepared.updatedAt = now();

  return prepared;
}

function deleteProduct(id) {
  const linkedOrders = state.orders.filter(order => {
    const workflow = order.workflow || {};
    const archived = workflow.archived || order.status === 'afgerond' || order.status === 'completed';

    return order.productId === id && !archived;
  });

  if (linkedOrders.length > 0) {
    return {
      error: `Dit product heeft ${linkedOrders.length} actieve order(s). Verwijder of rond deze eerst af.`,
    };
  }

  state.products = state.products.filter(product => product.id !== id);
  writeLocalArray(KEYS.products, state.products);

  if (state.supabase) {
    queueRemoteTask(() => deleteProductRemote(id), 'Product verwijderen');
  }

  return { success: true };
}

async function deleteProductAsync(id) {
  const result = deleteProduct(id);

  if (result.error) {
    return result;
  }

  if (state.supabase) {
    await deleteProductRemote(id);
  }

  return result;
}

function getProductById(id) {
  return state.products.find(product => product.id === id) || null;
}

async function refreshProducts() {
  if (!state.supabase) {
    loadLocalCache();
    return state.products;
  }

  state.products = await fetchRemoteProducts();
  writeLocalArray(KEYS.products, state.products);

  return state.products;
}

async function persistProductRemote(product) {
  if (!state.supabase) {
    return;
  }

  const { error } = await state.supabase
    .from(DB_TABLES.products)
    .upsert(productToRow(product), { onConflict: 'id' });

  if (error) {
    throw error;
  }
}

async function persistAllProductsRemote(products) {
  if (!state.supabase || !products.length) {
    return;
  }

  const rows = products.map(productToRow);

  const { error } = await state.supabase
    .from(DB_TABLES.products)
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    throw error;
  }
}

async function deleteProductRemote(id) {
  if (!state.supabase) {
    return;
  }

  const { error } = await state.supabase
    .from(DB_TABLES.products)
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }
}

// ─── CANVAS DIMENSIONS ──────────────────────────────────────────────────────

function calcCanvasDimensions(widthMm, heightMm) {
  const DPI = 300;
  const MM_PER_INCH = 25.4;
  const MAX_DISPLAY = 700;

  const widthPx = Math.round((widthMm / MM_PER_INCH) * DPI);
  const heightPx = Math.round((heightMm / MM_PER_INCH) * DPI);
  const scale = MAX_DISPLAY / widthPx;
  const displayWidth = Math.round(widthPx * scale);
  const displayHeight = Math.round(heightPx * scale);

  return {
    width_px: widthPx,
    height_px: heightPx,
    canvas_display_width: displayWidth,
    canvas_display_height: displayHeight,
  };
}

// ─── DEMO DATA ───────────────────────────────────────────────────────────────

function seedDemoData() {
  if (!ENABLE_DEMO_DATA) {
    return;
  }

  if (getProducts().length > 0 || getOrders().length > 0) {
    return;
  }

  const products = [
    {
      id: 'PRD-DEMO1',
      createdAt: now(),
      name: 'Kleine geschenkdoos',
      active: true,
      priceSlabs: [
        { from: 1, to: 9, price: 4.95 },
        { from: 10, to: 49, price: 3.75 },
        { from: 50, to: null, price: 2.95 },
      ],
      templates: ['template-klein-01.png', 'template-klein-02.png'],
      imageProduct: '',
      imagePersonalize1: '',
      imagePersonalize2: '',
      width_mm: 100,
      height_mm: 70,
      margin_mm: 5,
      width_px: 1181,
      height_px: 827,
      margin_px: 59,
      canvas_display_width: 500,
      canvas_display_height: 350,
    },
    {
      id: 'PRD-DEMO2',
      createdAt: now(),
      name: 'Grote geschenkdoos',
      active: true,
      priceSlabs: [
        { from: 1, to: 9, price: 7.50 },
        { from: 10, to: 49, price: 5.95 },
        { from: 50, to: null, price: 4.50 },
      ],
      templates: ['template-groot-01.png'],
      imageProduct: '',
      imagePersonalize1: '',
      imagePersonalize2: '',
      width_mm: 200,
      height_mm: 120,
      margin_mm: 8,
      width_px: 2362,
      height_px: 1417,
      margin_px: 94,
      canvas_display_width: 600,
      canvas_display_height: 360,
    },
    {
      id: 'PRD-DEMO3',
      createdAt: now(),
      name: 'Envelop zakje',
      active: false,
      priceSlabs: [
        { from: 1, to: 9, price: 2.50 },
        { from: 10, to: null, price: 1.95 },
      ],
      templates: [],
      imageProduct: '',
      imagePersonalize1: '',
      imagePersonalize2: '',
      width_mm: 80,
      height_mm: 110,
      margin_mm: 4,
      width_px: 945,
      height_px: 1299,
      margin_px: 47,
      canvas_display_width: 300,
      canvas_display_height: 420,
    },
  ];

  const orders = [
    {
      id: 'ORD-DEMO1',
      orderNumber: 'BLO-AA1',
      createdAt: '2025-05-01T09:12:00Z',
      customerName: 'Emma de Vries',
      customerEmail: 'emma@devries.nl',
      deliveryAddress: 'Hoofdstraat 12, 1234 AB Amsterdam',
      productId: 'PRD-DEMO1',
      productName: 'Kleine geschenkdoos',
      quantity: 25,
      designFile: 'ontwerp-emma.png',
      deliveryDate: '2025-05-20',
      quoteAmount: 93.75,
      confirmationSent: true,
      workType: 'bestandscheck',
      status: 'wacht-op-bestandscheck',
      notes: 'Klant heeft eigen ontwerp aangeleverd',
    },
    {
      id: 'ORD-DEMO2',
      orderNumber: 'BLO-BB2',
      createdAt: '2025-05-03T14:30:00Z',
      customerName: 'Lars Bakker',
      customerEmail: 'lars@bakker.com',
      deliveryAddress: 'Kerkweg 5, 5678 CD Rotterdam',
      productId: 'PRD-DEMO2',
      productName: 'Grote geschenkdoos',
      quantity: 10,
      designFile: '',
      deliveryDate: '2025-05-25',
      quoteAmount: 59.50,
      confirmationSent: false,
      workType: 'ontwerp',
      status: 'wacht-op-ontwerp',
      notes: 'Wil groene kleur, logo bijgevoegd per mail',
    },
    {
      id: 'ORD-DEMO3',
      orderNumber: 'BLO-CC3',
      createdAt: '2025-05-05T11:00:00Z',
      customerName: 'Sophie Jansen',
      customerEmail: 'sophie@jansen.nl',
      deliveryAddress: 'Dorpsstraat 88, 9012 EF Utrecht',
      productId: 'PRD-DEMO1',
      productName: 'Kleine geschenkdoos',
      quantity: 50,
      designFile: 'ontwerp-sophie-v2.png',
      deliveryDate: '2025-05-18',
      quoteAmount: 147.50,
      confirmationSent: true,
      workType: 'bestandscheck',
      status: 'wacht-op-goedkeuring',
      notes: '',
    },
    {
      id: 'ORD-DEMO4',
      orderNumber: 'BLO-DD4',
      createdAt: '2025-05-07T16:45:00Z',
      customerName: 'Tim van den Berg',
      customerEmail: 'tim@vdberg.nl',
      deliveryAddress: 'Nieuwstraat 3, 3456 GH Den Haag',
      productId: 'PRD-DEMO2',
      productName: 'Grote geschenkdoos',
      quantity: 5,
      designFile: '',
      deliveryDate: '2025-06-01',
      quoteAmount: 37.50,
      confirmationSent: false,
      workType: 'ontwerp',
      status: 'wacht-op-ontwerp',
      notes: 'Deadline is flexibel',
    },
    {
      id: 'ORD-DEMO5',
      orderNumber: 'BLO-EE5',
      createdAt: '2025-04-28T08:00:00Z',
      customerName: 'Nora Smits',
      customerEmail: 'nora@smits.com',
      deliveryAddress: 'Parallelweg 17, 7890 IJ Eindhoven',
      productId: 'PRD-DEMO1',
      productName: 'Kleine geschenkdoos',
      quantity: 15,
      designFile: 'ontwerp-nora-final.png',
      deliveryDate: '2025-05-10',
      quoteAmount: 56.25,
      confirmationSent: true,
      workType: 'bestandscheck',
      status: 'afgerond',
      notes: '',
    },
  ];

  saveAllProducts(products);
  saveAllOrders(orders);
}

// ─── EXPORT ─────────────────────────────────────────────────────────────────

window.DS = {
  init,

  getOrders,
  saveAllOrders,
  saveAllOrdersAsync,
  saveOrder,
  saveOrderAsync,
  deleteOrder,
  deleteOrderAsync,
  getOrderById,
  refreshOrders,

  getProducts,
  saveAllProducts,
  saveAllProductsAsync,
  saveProduct,
  saveProductAsync,
  deleteProduct,
  deleteProductAsync,
  getProductById,
  refreshProducts,

  calcCanvasDimensions,
  seedDemoData,
};