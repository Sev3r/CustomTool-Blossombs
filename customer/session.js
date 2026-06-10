/**
 * session.js
 * Beheert de sessiestatus in sessionStorage (sleutel: cot_session).
 * Slaat bewust geen zware productbestanden, afbeeldingen of template PDF's op.
 */

const SESSION_KEY = 'cot_session';

function safeParseSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || {};
  } catch {
    return {};
  }
}

function getLightProduct(product) {
  if (!product) {
    return null;
  }

  return {
    id: product.id || null,
    name: product.name || '',
  };
}

function getLightPersonalisationType(persType) {
  if (!persType) {
    return null;
  }

  return {
    id: persType.id || null,
    label: persType.label || 'Standaard',
    active: persType.active !== false,
    width_mm: persType.width_mm || null,
    height_mm: persType.height_mm || null,
    margin_mm: persType.margin_mm || null,
    width_px: persType.width_px || null,
    height_px: persType.height_px || null,
    margin_px: persType.margin_px || null,
    canvas_display_width: persType.canvas_display_width || null,
    canvas_display_height: persType.canvas_display_height || null,
    clipShape: persType.clipShape || null,
    allowBackgroundColor: Boolean(persType.allowBackgroundColor),
    blockedZones: Array.isArray(persType.blockedZones) ? persType.blockedZones : [],
    priceSlabs: Array.isArray(persType.priceSlabs) ? persType.priceSlabs : [],
  };
}

function getLightOptions(options) {
  if (!options) {
    return null;
  }

  return {
    quantity: Number.isFinite(Number(options.quantity)) && Number(options.quantity) > 0
      ? Number(options.quantity)
      : null,
    designChoice: options.designChoice || 'laat-ontwerpen',
    addons: Array.isArray(options.addons) ? options.addons : [],
    persTypeId: options.persTypeId || options.persType?.id || null,
    persType: getLightPersonalisationType(options.persType),
    productId: options.productId || null,
  };
}

const Session = {
  get() {
    return safeParseSession();
  },

  write(data) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Sessie opslaan mislukt', error);
      throw error;
    }
  },

  set(data) {
    const current = this.get();
    this.write({ ...current, ...data });
  },

  clear() {
    sessionStorage.removeItem(SESSION_KEY);
  },

  getProduct() {
    const session = this.get();
    const productId = session.productId || session.product?.id || null;

    if (productId && typeof DS !== 'undefined' && typeof DS.getProductById === 'function') {
      return DS.getProductById(productId) || session.product || null;
    }

    return session.product || null;
  },

  getOptions() {
    return this.get().options || null;
  },

  getDesign() {
    return this.get().design || null;
  },

  getWensen() {
    return this.get().wensen || null;
  },

  getKlant() {
    return this.get().klant || null;
  },

  setProduct(product) {
    const current = this.get();
    const currentProductId = current.productId || current.product?.id || null;
    const nextProductId = product?.id || null;
    const productChanged = currentProductId && nextProductId && currentProductId !== nextProductId;

    this.write({
      ...current,
      productId: nextProductId,
      product: getLightProduct(product),
      options: productChanged ? null : current.options || null,
      design: productChanged ? null : current.design || null,
      wensen: productChanged ? null : current.wensen || null,
    });
  },

  setOptions(options) {
    const current = this.get();
    const previousOptions = current.options || {};
    const safeOptions = getLightOptions(options);

    const personalisationChanged = Boolean(
      previousOptions.persTypeId &&
      safeOptions?.persTypeId &&
      previousOptions.persTypeId !== safeOptions.persTypeId
    );

    const designChoiceChanged = Boolean(
      previousOptions.designChoice &&
      safeOptions?.designChoice &&
      previousOptions.designChoice !== safeOptions.designChoice
    );

    this.write({
      ...current,
      options: safeOptions,
      design: personalisationChanged || designChoiceChanged ? null : current.design || null,
      wensen: safeOptions?.designChoice === 'laat-ontwerpen' ? current.wensen || null : null,
    });
  },

  setDesign(design) {
    this.set({ design });
  },

  setWensen(wensen) {
    this.set({ wensen });
  },

  setKlant(klant) {
    this.set({ klant });
  },
};

window.Session = Session;