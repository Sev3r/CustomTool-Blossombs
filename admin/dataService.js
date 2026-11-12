/**
 * dataService.js
 * Gedeelde datalaag voor orders en producten.
 *
 * Opslag:
 * - Supabase is de ENIGE opslag. Er wordt niets in localStorage bewaard,
 *   zodat iedereen dezelfde data ziet.
 * - Data staat alleen in het geheugen van de open pagina en wordt bij het
 *   laden (en daarna periodiek) uit Supabase opgehaald.
 *
 * Samenwerken (meerdere collega's tegelijk):
 * - Elk record krijgt in het geheugen een _version (= updated_at uit Supabase).
 * - Een wijziging wordt alleen opgeslagen als het record in Supabase nog
 *   dezelfde versie heeft als toen je het opende. Heeft een collega het
 *   intussen aangepast, dan wordt er NIETS overschreven: de nieuwste versie
 *   wordt geladen en er gaat een 'ds:save-error' (type 'conflict') uit.
 * - startAutoRefresh() haalt periodiek alleen gewijzigde records op.
 *
 * API:
 * - saveOrder/saveProduct/delete* (sync): passen het scherm direct aan en
 *   slaan daarna op. Mislukt het opslaan, dan wordt de wijziging teruggedraaid.
 * - save*Async/delete*Async: slaan eerst op en passen pas daarna het scherm
 *   aan. Gooien een fout als het mislukt.
 *
 * Events (op window):
 * - 'ds:connection'   { online, error }
 * - 'ds:data-changed' { source: 'remote' | 'reload' | 'revert' | 'conflict', kinds }
 * - 'ds:save-error'   { kind, id, type: 'conflict' | 'deleted' | 'failed', label, error }
 *
 * Let op:
 * - Deze implementatie gebruikt de Supabase anon key.
 * - De huidige RLS policies zijn geschikt voor prototype/demo, niet voor productie.
 */

const SUPABASE_URL = 'https://ewtxlqazjplxhomgfuqv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PzZox9nlVKF5jaJFg8OSbw_H-ubNqyo';

const ENABLE_DEMO_DATA = false;

const AUTO_REFRESH_INTERVAL_MS = 20000;
const FOCUS_REFRESH_MIN_GAP_MS = 5000;
const FETCH_CHUNK_SIZE = 100;

// Oude localStorage-sleutels uit eerdere versies. Worden bij het laden opgeruimd.
const LEGACY_LOCAL_KEYS = [
  'cot_orders',
  'cot_products',
  'cot_unsynced',
];

const KINDS = {
  orders: {
    table: 'orders',
    prefix: 'ORD',
  },
  products: {
    table: 'products',
    prefix: 'PRD',
  },
};

const state = {
  initialized: false,
  initializing: null,
  supabase: null,
  online: null,
  orders: [],
  products: [],
  lastConfirmed: {
    orders: {},
    products: {},
  },
  writeChains: {},
  pendingWrites: {},
  ownVersions: {},
  autoRefreshTimer: null,
  lastRefreshAt: 0,
  refreshing: null,
};

// ─── INIT ───────────────────────────────────────────────────────────────────

async function init() {
  if (state.initialized) {
    return Boolean(state.online);
  }

  if (state.initializing) {
    return state.initializing;
  }

  state.initializing = initializeDataService();

  return state.initializing;
}

async function initializeDataService() {
  removeLegacyLocalCache();

  state.supabase = createSupabaseClient();

  if (!state.supabase) {
    state.initialized = true;
    setOnline(false, new Error('Supabase client niet beschikbaar.'));
    return false;
  }

  try {
    await loadKinds(['products', 'orders']);
    state.initialized = true;
    return true;
  } catch (error) {
    console.warn('Supabase laden mislukt.', error);
    state.initialized = true;
    setOnline(false, error);
    return false;
  }
}

function createSupabaseClient() {
  if (!window.supabase?.createClient) {
    return null;
  }

  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function removeLegacyLocalCache() {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }

    LEGACY_LOCAL_KEYS.forEach(key => localStorage.removeItem(key));
  } catch {
    // Opruimen is best effort.
  }
}

function isRemoteAvailable() {
  return Boolean(state.supabase) && state.online === true;
}

function isOnline() {
  return state.online === true;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function uid(prefix = 'ORD') {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function now() {
  return new Date().toISOString();
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value || null));
}

function recordKey(kind, id) {
  return `${kind}:${id}`;
}

function emit(name, detail) {
  window.dispatchEvent(
    new CustomEvent(name, {
      detail,
    })
  );
}

function setOnline(online, error = null) {
  const changed = state.online !== online;

  state.online = online;

  if (changed) {
    emit('ds:connection', {
      online,
      error,
    });
  }
}

function sameVersion(a, b) {
  if (!a || !b) {
    return false;
  }

  if (a === b) {
    return true;
  }

  const timeA = new Date(a).getTime();
  const timeB = new Date(b).getTime();

  return Number.isFinite(timeA) && timeA === timeB;
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

// ─── ROW MAPPING ────────────────────────────────────────────────────────────

/**
 * Kopie van het record zonder interne velden (zoals _version).
 */
function toStoredData(record) {
  const data = cloneData(record) || {};

  delete data._version;

  return data;
}

function productToRow(product, updatedAt) {
  return {
    id: product.id,
    data: toStoredData(product),
    created_at: product.createdAt || product.created_at || updatedAt,
    updated_at: updatedAt,
  };
}

function rowToProduct(row) {
  const data = row.data || {};

  return {
    ...data,
    id: row.id,
    createdAt: data.createdAt || row.created_at,
    updatedAt: data.updatedAt || row.updated_at,
    _version: row.updated_at || null,
  };
}

function orderToRow(order, updatedAt) {
  return {
    id: order.id,
    order_number: getOrderNumber(order),
    status: getOrderStatus(order),
    workflow: getOrderWorkflow(order),
    data: toStoredData(order),
    created_at: order.createdAt || order.created_at || updatedAt,
    updated_at: updatedAt,
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
    _version: row.updated_at || null,
  };
}

function toRow(kind, record, updatedAt) {
  return kind === 'orders'
    ? orderToRow(record, updatedAt)
    : productToRow(record, updatedAt);
}

function fromRow(kind, row) {
  return kind === 'orders'
    ? rowToOrder(row)
    : rowToProduct(row);
}

// ─── IN-MEMORY STATE ────────────────────────────────────────────────────────

function getLocal(kind, id) {
  return state[kind].find(item => item.id === id) || null;
}

function putLocal(kind, record) {
  const items = state[kind].slice();
  const index = items.findIndex(item => item.id === record.id);

  if (index > -1) {
    items[index] = record;
  } else {
    items.push(record);
  }

  state[kind] = items;
}

function removeLocal(kind, id) {
  state[kind] = state[kind].filter(item => item.id !== id);
}

function setConfirmed(kind, record) {
  state.lastConfirmed[kind][record.id] = record;
}

function clearConfirmed(kind, id) {
  delete state.lastConfirmed[kind][id];
}

function restoreConfirmed(kind, id) {
  const confirmed = state.lastConfirmed[kind][id];

  if (confirmed) {
    putLocal(kind, confirmed);
  } else {
    removeLocal(kind, id);
  }
}

function isPending(kind, id) {
  return (state.pendingWrites[recordKey(kind, id)] || 0) > 0;
}

// ─── REMOTE: LEZEN ──────────────────────────────────────────────────────────

async function fetchAll(kind) {
  const { data, error } = await state.supabase
    .from(KINDS[kind].table)
    .select('*')
    .order('created_at', { ascending: kind === 'products' });

  if (error) {
    throw error;
  }

  return (data || []).map(row => fromRow(kind, row));
}

async function fetchByIds(kind, ids) {
  const results = [];

  for (let index = 0; index < ids.length; index += FETCH_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + FETCH_CHUNK_SIZE);

    const { data, error } = await state.supabase
      .from(KINDS[kind].table)
      .select('*')
      .in('id', chunk);

    if (error) {
      throw error;
    }

    (data || []).forEach(row => {
      results.push(fromRow(kind, row));
    });
  }

  return results;
}

async function fetchVersions(kind) {
  const { data, error } = await state.supabase
    .from(KINDS[kind].table)
    .select('id, updated_at');

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Volledig (her)laden. Records met een lopende opslag blijven ongemoeid.
 */
async function loadKinds(kinds) {
  if (!state.supabase) {
    throw new Error('Geen verbinding met de database.');
  }

  const results = await Promise.all(kinds.map(kind => fetchAll(kind)));

  kinds.forEach((kind, index) => {
    const remoteItems = results[index];

    const merged = remoteItems.map(item =>
      isPending(kind, item.id)
        ? getLocal(kind, item.id) || item
        : item
    );

    state[kind]
      .filter(item => isPending(kind, item.id) && !merged.some(entry => entry.id === item.id))
      .forEach(item => merged.push(item));

    state[kind] = merged;
    state.lastConfirmed[kind] = {};

    remoteItems.forEach(item => setConfirmed(kind, item));
  });

  state.lastRefreshAt = Date.now();
  setOnline(true);
}

async function reload() {
  try {
    await loadKinds(['products', 'orders']);

    emit('ds:data-changed', {
      source: 'reload',
      kinds: ['products', 'orders'],
    });

    return true;
  } catch (error) {
    console.warn('Opnieuw laden mislukt.', error);
    setOnline(false, error);
    return false;
  }
}

/**
 * Haalt alleen gewijzigde, nieuwe en verwijderde records op.
 */
async function syncKindFromRemote(kind) {
  const versions = await fetchVersions(kind);
  const remoteVersions = new Map(versions.map(row => [row.id, row.updated_at]));

  const changedIds = [];

  remoteVersions.forEach((version, id) => {
    if (isPending(kind, id)) {
      return;
    }

    const local = getLocal(kind, id);

    if (!local || !sameVersion(local._version, version)) {
      changedIds.push(id);
    }
  });

  const removedIds = state[kind]
    .filter(item =>
      !remoteVersions.has(item.id) &&
      !isPending(kind, item.id) &&
      item._version
    )
    .map(item => item.id);

  if (changedIds.length) {
    const freshItems = await fetchByIds(kind, changedIds);

    freshItems.forEach(item => {
      if (!isPending(kind, item.id)) {
        putLocal(kind, item);
        setConfirmed(kind, item);
      }
    });
  }

  removedIds.forEach(id => {
    removeLocal(kind, id);
    clearConfirmed(kind, id);
  });

  return changedIds.length > 0 || removedIds.length > 0;
}

async function refresh() {
  if (!state.supabase) {
    return false;
  }

  if (state.refreshing) {
    return state.refreshing;
  }

  state.refreshing = (async () => {
    try {
      const changedKinds = [];

      for (const kind of ['products', 'orders']) {
        if (await syncKindFromRemote(kind)) {
          changedKinds.push(kind);
        }
      }

      state.lastRefreshAt = Date.now();
      setOnline(true);

      if (changedKinds.length) {
        emit('ds:data-changed', {
          source: 'remote',
          kinds: changedKinds,
        });
      }

      return true;
    } catch (error) {
      console.warn('Verversen mislukt.', error);
      setOnline(false, error);
      return false;
    } finally {
      state.refreshing = null;
    }
  })();

  return state.refreshing;
}

function refreshIfStale() {
  if (Date.now() - state.lastRefreshAt >= FOCUS_REFRESH_MIN_GAP_MS) {
    refresh();
  }
}

function startAutoRefresh(intervalMs = AUTO_REFRESH_INTERVAL_MS) {
  if (state.autoRefreshTimer) {
    return;
  }

  state.autoRefreshTimer = setInterval(() => {
    if (
      typeof document === 'undefined' ||
      document.visibilityState === 'visible'
    ) {
      refresh();
    }
  }, intervalMs);

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        refreshIfStale();
      }
    });
  }

  window.addEventListener('focus', refreshIfStale);
  window.addEventListener('online', () => refresh());
}

function stopAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
}

async function refreshOrders() {
  await loadKinds(['orders']);
  return state.orders;
}

async function refreshProducts() {
  await loadKinds(['products']);
  return state.products;
}

// ─── REMOTE: SCHRIJVEN ──────────────────────────────────────────────────────

function conflictError(kind, id) {
  const error = new Error('Record is intussen door iemand anders gewijzigd.');

  error.code = 'DS_CONFLICT';
  error.kind = kind;
  error.id = id;

  return error;
}

/**
 * Houdt bij welke versie deze pagina zelf heeft vervangen door welke nieuwe,
 * zodat twee snelle opeenvolgende eigen wijzigingen geen vals conflict geven.
 */
function recordOwnVersion(key, fromVersion, toVersion) {
  if (!fromVersion || !toVersion) {
    return;
  }

  if (!state.ownVersions[key]) {
    state.ownVersions[key] = {};
  }

  state.ownVersions[key][fromVersion] = toVersion;
}

function resolveExpectedVersion(key, version) {
  const map = state.ownVersions[key] || {};
  let current = version;
  let guard = 0;

  while (current && map[current] && guard < 100) {
    current = map[current];
    guard += 1;
  }

  return current || null;
}

/**
 * Nieuw record (geen versie): upsert.
 * Bestaand record: update ALLEEN als de versie in Supabase nog klopt.
 * Geeft de nieuwe versie terug.
 */
async function persistRecord(kind, record, expectedVersion, { returnVersion = true } = {}) {
  const table = KINDS[kind].table;
  const updatedAt = now();
  const row = toRow(kind, record, updatedAt);

  if (!expectedVersion) {
    const query = state.supabase
      .from(table)
      .upsert(row, { onConflict: 'id' });

    if (!returnVersion) {
      const { error } = await query;

      if (error) {
        throw error;
      }

      return updatedAt;
    }

    const { data, error } = await query.select('updated_at');

    if (error) {
      throw error;
    }

    return data?.[0]?.updated_at || updatedAt;
  }

  const { data, error } = await state.supabase
    .from(table)
    .update(row)
    .eq('id', record.id)
    .eq('updated_at', expectedVersion)
    .select('id, updated_at');

  if (error) {
    throw error;
  }

  if (!data || !data.length) {
    throw conflictError(kind, record.id);
  }

  return data[0].updated_at;
}

async function deleteRemote(kind, id, expectedVersion) {
  const table = KINDS[kind].table;

  if (!expectedVersion) {
    const { error } = await state.supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return;
  }

  const { data, error } = await state.supabase
    .from(table)
    .delete()
    .eq('id', id)
    .eq('updated_at', expectedVersion)
    .select('id');

  if (error) {
    throw error;
  }

  if (!data || !data.length) {
    throw conflictError(kind, id);
  }
}

/**
 * Schrijfacties per record worden achter elkaar uitgevoerd.
 */
function queueWrite(kind, id, task) {
  const key = recordKey(kind, id);
  const previous = state.writeChains[key] || Promise.resolve();

  state.pendingWrites[key] = (state.pendingWrites[key] || 0) + 1;

  const run = previous.then(task);

  state.writeChains[key] = run.catch(() => {});

  return run.finally(() => {
    state.pendingWrites[key] -= 1;

    if (state.pendingWrites[key] <= 0) {
      delete state.pendingWrites[key];
      delete state.writeChains[key];
    }
  });
}

/**
 * Bij een conflict: nieuwste versie ophalen en tonen. Er wordt niets overschreven.
 */
async function resolveConflict(kind, id, label) {
  try {
    const [fresh] = await fetchByIds(kind, [id]);

    if (fresh) {
      putLocal(kind, fresh);
      setConfirmed(kind, fresh);
      emit('ds:save-error', { kind, id, type: 'conflict', label });
    } else {
      removeLocal(kind, id);
      clearConfirmed(kind, id);
      emit('ds:save-error', { kind, id, type: 'deleted', label });
    }
  } catch (error) {
    restoreConfirmed(kind, id);
    emit('ds:save-error', { kind, id, type: 'failed', label, error });
  }

  emit('ds:data-changed', {
    source: 'conflict',
    kinds: [kind],
  });
}

function handleWriteFailure(kind, id, error, label) {
  if (error?.code === 'DS_CONFLICT') {
    return resolveConflict(kind, id, label);
  }

  console.warn(`${label} mislukt.`, error);

  restoreConfirmed(kind, id);

  emit('ds:save-error', { kind, id, type: 'failed', label, error });
  emit('ds:data-changed', { source: 'revert', kinds: [kind] });

  return Promise.resolve();
}

function prepareForSave(kind, record = {}) {
  const prepared = {
    ...record,
    id: record.id || uid(KINDS[kind].prefix),
  };

  if (kind === 'orders' && !prepared.orderNumber) {
    prepared.orderNumber = uid('BLO');
  }

  if (!prepared.createdAt) {
    prepared.createdAt = now();
  }

  prepared.updatedAt = now();

  return prepared;
}

/**
 * Optimistisch opslaan: scherm direct bijwerken, daarna Supabase.
 * Mislukt het, dan wordt teruggedraaid naar de laatst bevestigde versie.
 */
function saveRecord(kind, record, label) {
  const saved = prepareForSave(kind, record);
  const key = recordKey(kind, saved.id);

  putLocal(kind, saved);

  if (!state.supabase) {
    handleWriteFailure(kind, saved.id, new Error('Geen verbinding met de database.'), label);
    return saved;
  }

  queueWrite(kind, saved.id, async () => {
    const expected = resolveExpectedVersion(key, saved._version || null);
    const newVersion = await persistRecord(kind, saved, expected);

    recordOwnVersion(key, expected, newVersion);
    saved._version = newVersion;
    setConfirmed(kind, saved);

    // Was er intussen teruggedraaid door een eerdere mislukte poging, toon dan alsnog deze versie.
    if (getLocal(kind, saved.id) !== saved && (state.pendingWrites[key] || 0) <= 1) {
      putLocal(kind, saved);
      emit('ds:data-changed', { source: 'remote', kinds: [kind] });
    }
  }).catch(error => handleWriteFailure(kind, saved.id, error, label));

  return saved;
}

/**
 * Eerst opslaan, dan pas het scherm bijwerken. Gooit een fout bij falen.
 * returnVersion: false voor de klantkant (die hoeft niets terug te lezen).
 */
async function saveRecordAsync(kind, record, label, { returnVersion = true } = {}) {
  if (!state.supabase) {
    throw new Error('Geen verbinding met de database.');
  }

  const saved = prepareForSave(kind, record);
  const key = recordKey(kind, saved.id);

  try {
    await queueWrite(kind, saved.id, async () => {
      const expected = resolveExpectedVersion(key, saved._version || null);
      const newVersion = await persistRecord(kind, saved, expected, { returnVersion });

      recordOwnVersion(key, expected, newVersion);
      saved._version = newVersion;
    });
  } catch (error) {
    if (error?.code === 'DS_CONFLICT') {
      await resolveConflict(kind, saved.id, label);
    }

    throw error;
  }

  putLocal(kind, saved);
  setConfirmed(kind, saved);

  return saved;
}

function deleteRecord(kind, id, label) {
  const existing = getLocal(kind, id);
  const key = recordKey(kind, id);

  removeLocal(kind, id);

  if (!state.supabase) {
    handleWriteFailure(kind, id, new Error('Geen verbinding met de database.'), label);
    return;
  }

  queueWrite(kind, id, async () => {
    const expected = resolveExpectedVersion(key, existing?._version || null);

    await deleteRemote(kind, id, expected);
    clearConfirmed(kind, id);
  }).catch(error => handleWriteFailure(kind, id, error, label));
}

async function deleteRecordAsync(kind, id, label) {
  if (!state.supabase) {
    throw new Error('Geen verbinding met de database.');
  }

  const existing = getLocal(kind, id);
  const key = recordKey(kind, id);

  try {
    await queueWrite(kind, id, async () => {
      const expected = resolveExpectedVersion(key, existing?._version || null);

      await deleteRemote(kind, id, expected);
    });
  } catch (error) {
    if (error?.code === 'DS_CONFLICT') {
      await resolveConflict(kind, id, label);
    }

    throw error;
  }

  removeLocal(kind, id);
  clearConfirmed(kind, id);
}

// ─── ORDERS ─────────────────────────────────────────────────────────────────

function getOrders() {
  return state.orders.slice();
}

function getOrderById(id) {
  return getLocal('orders', id);
}

function saveOrder(order) {
  return saveRecord('orders', order, 'Order opslaan');
}

async function saveOrderAsync(order, options = {}) {
  return saveRecordAsync('orders', order, 'Order opslaan', options);
}

function deleteOrder(id) {
  deleteRecord('orders', id, 'Order verwijderen');
}

async function deleteOrderAsync(id) {
  await deleteRecordAsync('orders', id, 'Order verwijderen');
}

function saveAllOrders(orders) {
  (Array.isArray(orders) ? orders : []).forEach(order => saveOrder(order));
}

async function saveAllOrdersAsync(orders) {
  const list = Array.isArray(orders) ? orders : [];

  for (const order of list) {
    await saveOrderAsync(order);
  }

  return getOrders();
}

// ─── PRODUCTS ───────────────────────────────────────────────────────────────

function getProducts() {
  return state.products.slice();
}

function getProductById(id) {
  return getLocal('products', id);
}

function saveProduct(product) {
  return saveRecord('products', product, 'Product opslaan');
}

async function saveProductAsync(product, options = {}) {
  return saveRecordAsync('products', product, 'Product opslaan', options);
}

function getDeleteProductBlocker(id) {
  const linkedOrders = state.orders.filter(
    order => order.productId === id && !isOrderArchived(order)
  );

  if (linkedOrders.length > 0) {
    return {
      error: `Dit product heeft ${linkedOrders.length} actieve order(s). Verwijder of rond deze eerst af.`,
    };
  }

  return null;
}

function deleteProduct(id) {
  const blocker = getDeleteProductBlocker(id);

  if (blocker) {
    return blocker;
  }

  deleteRecord('products', id, 'Product verwijderen');

  return { success: true };
}

async function deleteProductAsync(id) {
  const blocker = getDeleteProductBlocker(id);

  if (blocker) {
    return blocker;
  }

  await deleteRecordAsync('products', id, 'Product verwijderen');

  return { success: true };
}

function saveAllProducts(products) {
  (Array.isArray(products) ? products : []).forEach(product => saveProduct(product));
}

async function saveAllProductsAsync(products) {
  const list = Array.isArray(products) ? products : [];

  for (const product of list) {
    await saveProductAsync(product);
  }

  return getProducts();
}

// ─── CANVAS DIMENSIONS ──────────────────────────────────────────────────────

function calcCanvasDimensions(widthMm, heightMm) {
  const DPI = 300;
  const MM_PER_INCH = 25.4;
  const MAX_DISPLAY = 700;

  if (!(Number(widthMm) > 0 && Number(heightMm) > 0)) {
    console.warn('calcCanvasDimensions: breedte en hoogte moeten groter dan 0 zijn.', { widthMm, heightMm });

    return {
      width_px: 0,
      height_px: 0,
      canvas_display_width: 0,
      canvas_display_height: 0,
    };
  }

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
  reload,
  refresh,
  startAutoRefresh,
  stopAutoRefresh,
  isRemoteAvailable,
  isOnline,

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