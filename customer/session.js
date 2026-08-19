/**
 * session.js
 * Beheert lichte sessiemetadata in sessionStorage.
 * Zware ontwerpdata wordt in IndexedDB bewaard zodat grote PNG/PDF/Fabric-data
 * de sessionStorage-limiet niet kan blokkeren.
 */

const SESSION_KEY = 'cot_session';
const DESIGN_DB_NAME = 'cot_design_storage';
const DESIGN_DB_VERSION = 1;
const DESIGN_STORE_NAME = 'designs';
const DESIGN_STORAGE_KEY = 'current';

let designCache = null;
let designHydrated = false;
let designHydrationPromise = null;
let designStorageQueue = Promise.resolve();

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
    quantity:
      Number.isFinite(Number(options.quantity)) && Number(options.quantity) > 0
        ? Number(options.quantity)
        : null,
    designChoice: options.designChoice || 'laat-ontwerpen',
    addons: Array.isArray(options.addons) ? options.addons : [],
    persTypeId: options.persTypeId || options.persType?.id || null,
    persType: getLightPersonalisationType(options.persType),
    productId: options.productId || null,
  };
}

function getLightDesign(design) {
  if (!design) {
    return null;
  }

  return {
    fileName: design.fileName || '',
    tab: design.tab || null,
    source: design.source || null,
    backgroundColor: design.backgroundColor || null,
    editorViewId: design.editorViewId || null,
    previewViewId: design.previewViewId || null,
    prepressWarnings: Array.isArray(design.prepressWarnings)
      ? design.prepressWarnings
      : [],
    uploadCheck: design.uploadCheck || null,
    hasStoredDesign: true,
  };
}

function hasHeavyDesignData(design) {
  return Boolean(
    design &&
      (
        design.dataURL ||
        design.pdfDataURL ||
        design.rillinesPdfDataURL ||
        design.fabricJSON
      )
  );
}

function openDesignDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB wordt niet ondersteund door deze browser.'));
      return;
    }

    const request = window.indexedDB.open(
      DESIGN_DB_NAME,
      DESIGN_DB_VERSION
    );

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(DESIGN_STORE_NAME)) {
        database.createObjectStore(DESIGN_STORE_NAME, {
          keyPath: 'id',
        });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(
        request.error ||
          new Error('IndexedDB kon niet worden geopend.')
      );
    };

    request.onblocked = () => {
      reject(
        new Error('IndexedDB wordt door een ander browsertabblad geblokkeerd.')
      );
    };
  });
}

async function readStoredDesign() {
  const database = await openDesignDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      DESIGN_STORE_NAME,
      'readonly'
    );

    const request = transaction
      .objectStore(DESIGN_STORE_NAME)
      .get(DESIGN_STORAGE_KEY);

    request.onsuccess = () => {
      resolve(request.result?.design || null);
    };

    request.onerror = () => {
      reject(
        request.error ||
          new Error('Ontwerp kon niet uit IndexedDB worden gelezen.')
      );
    };

    transaction.oncomplete = () => {
      database.close();
    };

    transaction.onerror = () => {
      database.close();

      reject(
        transaction.error ||
          new Error('IndexedDB-leestransactie is mislukt.')
      );
    };

    transaction.onabort = () => {
      database.close();

      reject(
        transaction.error ||
          new Error('IndexedDB-leestransactie is afgebroken.')
      );
    };
  });
}

async function writeStoredDesign(design) {
  const database = await openDesignDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      DESIGN_STORE_NAME,
      'readwrite'
    );

    transaction
      .objectStore(DESIGN_STORE_NAME)
      .put({
        id: DESIGN_STORAGE_KEY,
        design,
        updatedAt: Date.now(),
      });

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };

    transaction.onerror = () => {
      database.close();

      reject(
        transaction.error ||
          new Error('Ontwerp kon niet in IndexedDB worden opgeslagen.')
      );
    };

    transaction.onabort = () => {
      database.close();

      reject(
        transaction.error ||
          new Error('IndexedDB-opslagtransactie is afgebroken.')
      );
    };
  });
}

async function deleteStoredDesign() {
  const database = await openDesignDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      DESIGN_STORE_NAME,
      'readwrite'
    );

    transaction
      .objectStore(DESIGN_STORE_NAME)
      .delete(DESIGN_STORAGE_KEY);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };

    transaction.onerror = () => {
      database.close();

      reject(
        transaction.error ||
          new Error('Opgeslagen ontwerp kon niet worden verwijderd.')
      );
    };

    transaction.onabort = () => {
      database.close();

      reject(
        transaction.error ||
          new Error('IndexedDB-verwijdertransactie is afgebroken.')
      );
    };
  });
}

function queueDesignStorageOperation(operation) {
  const queuedOperation = designStorageQueue.then(
    operation,
    operation
  );

  designStorageQueue = queuedOperation.catch(() => {});

  return queuedOperation;
}

function resetDesignCache() {
  designCache = null;
  designHydrated = true;
  designHydrationPromise = null;
}

function mergeDesignData(lightDesign, storedDesign) {
  if (!lightDesign && !storedDesign) {
    return null;
  }

  return {
    ...(lightDesign || {}),
    ...(storedDesign || {}),
  };
}

const Session = {
  get() {
    return safeParseSession();
  },

  write(data) {
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error(
        'Sessie opslaan mislukt',
        error
      );

      throw error;
    }
  },

  set(data) {
    const current = this.get();

    this.write({
      ...current,
      ...data,
    });
  },

  async clear() {
    sessionStorage.removeItem(SESSION_KEY);

    resetDesignCache();

    try {
      await queueDesignStorageOperation(
        deleteStoredDesign
      );
    } catch (error) {
      console.warn(
        'Opgeslagen ontwerp opruimen mislukt',
        error
      );
    }
  },

  getProduct() {
    const session = this.get();
    const productId = session.productId || session.product?.id || null;

    if (
      productId &&
      typeof DS !== 'undefined' &&
      typeof DS.getProductById === 'function'
    ) {
      return DS.getProductById(productId) || session.product || null;
    }

    return session.product || null;
  },

  getOptions() {
    return this.get().options || null;
  },

  getDesign() {
    const session = this.get();

    return mergeDesignData(
      session.design || null,
      designCache
    );
  },

  async hydrateDesign() {
    if (designHydrated) {
      return this.getDesign();
    }

    if (designHydrationPromise) {
      return designHydrationPromise;
    }

    designHydrationPromise = (async () => {
      const session = this.get();
      const sessionDesign = session.design || null;

      if (hasHeavyDesignData(sessionDesign)) {
        designCache = {
          ...sessionDesign,
        };

        designHydrated = true;

        this.write({
          ...session,
          design: getLightDesign(sessionDesign),
          designStorageKey: DESIGN_STORAGE_KEY,
          designStorageVersion: DESIGN_DB_VERSION,
        });

        try {
          await queueDesignStorageOperation(() =>
            writeStoredDesign(designCache)
          );
        } catch (error) {
          console.warn(
            'Bestaand ontwerp kon niet naar IndexedDB worden gemigreerd',
            error
          );
        }

        return this.getDesign();
      }

      if (session.designStorageKey !== DESIGN_STORAGE_KEY) {
        designCache = sessionDesign;
        designHydrated = true;

        return this.getDesign();
      }

      try {
        await designStorageQueue;

        designCache = await readStoredDesign();
      } catch (error) {
        console.warn(
          'Opgeslagen ontwerp kon niet worden geladen',
          error
        );

        designCache = sessionDesign;
      }

      designHydrated = true;

      return this.getDesign();
    })().finally(() => {
      designHydrationPromise = null;
    });

    return designHydrationPromise;
  },

  async setDesign(design) {
    if (!design) {
      await this.clearDesign();
      return null;
    }

    const normalizedDesign = {
      ...design,
    };

    designCache = normalizedDesign;
    designHydrated = true;
    designHydrationPromise = null;

    const current = this.get();

    this.write({
      ...current,
      design: getLightDesign(normalizedDesign),
      designStorageKey: DESIGN_STORAGE_KEY,
      designStorageVersion: DESIGN_DB_VERSION,
    });

    try {
      await queueDesignStorageOperation(() =>
        writeStoredDesign(normalizedDesign)
      );
    } catch (error) {
      console.warn(
        'Ontwerp kon niet permanent in IndexedDB worden opgeslagen; de actieve pagina houdt het ontwerp wel beschikbaar.',
        error
      );
    }

    return normalizedDesign;
  },

  async clearDesign() {
    const current = this.get();

    const {
      designStorageKey,
      designStorageVersion,
      ...sessionWithoutDesignStorage
    } = current;

    this.write({
      ...sessionWithoutDesignStorage,
      design: null,
    });

    resetDesignCache();

    try {
      await queueDesignStorageOperation(
        deleteStoredDesign
      );
    } catch (error) {
      console.warn(
        'Opgeslagen ontwerp verwijderen mislukt',
        error
      );
    }
  },

  async flushDesignStorage() {
    await designStorageQueue;
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

    const productChanged = Boolean(
      currentProductId &&
        nextProductId &&
        currentProductId !== nextProductId
    );

    const {
      designStorageKey,
      designStorageVersion,
      ...sessionWithoutDesignStorage
    } = current;

    this.write({
      ...(productChanged ? sessionWithoutDesignStorage : current),
      productId: nextProductId,
      product: getLightProduct(product),
      options: productChanged ? null : current.options || null,
      design: productChanged ? null : current.design || null,
      wensen: productChanged ? null : current.wensen || null,
    });

    if (productChanged) {
      resetDesignCache();

      void queueDesignStorageOperation(
        deleteStoredDesign
      ).catch(error => {
        console.warn(
          'Ontwerp van vorig product opruimen mislukt',
          error
        );
      });
    }
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

    const designInvalidated =
      personalisationChanged ||
      designChoiceChanged;

    const {
      designStorageKey,
      designStorageVersion,
      ...sessionWithoutDesignStorage
    } = current;

    this.write({
      ...(designInvalidated ? sessionWithoutDesignStorage : current),
      options: safeOptions,
      design: designInvalidated ? null : current.design || null,
      wensen:
        safeOptions?.designChoice === 'laat-ontwerpen'
          ? current.wensen || null
          : null,
    });

    if (designInvalidated) {
      resetDesignCache();

      void queueDesignStorageOperation(
        deleteStoredDesign
      ).catch(error => {
        console.warn(
          'Oud ontwerp opruimen mislukt',
          error
        );
      });
    }
  },

  setWensen(wensen) {
    this.set({
      wensen,
    });
  },

  setKlant(klant) {
    this.set({
      klant,
    });
  },
};

window.Session = Session;