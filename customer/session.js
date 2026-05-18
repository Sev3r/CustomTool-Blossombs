/**
 * session.js
 * Beheert de sessiestatus in sessionStorage (sleutel: cot_session).
 * "Terug"-navigatie verliest geen data.
 *
 * SHOPIFY INTEGRATIEPUNT:
 * De sessiedata kan ook opgeslagen worden in Shopify Cart Attributes
 * via de Cart API: PUT /cart/update.js { attributes: { cot_session: JSON.stringify(data) } }
 */

const SESSION_KEY = 'cot_session';

const Session = {
  get() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || {};
    } catch { return {}; }
  },

  set(data) {
    const current = this.get();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, ...data }));
  },

  clear() {
    sessionStorage.removeItem(SESSION_KEY);
  },

  // Shortcuts
  getProduct()    { return this.get().product    || null; },
  getOptions()    { return this.get().options    || null; },
  getDesign()     { return this.get().design     || null; },
  getWensen()     { return this.get().wensen     || null; },
  getKlant()      { return this.get().klant      || null; },

  setProduct(p)   { this.set({ product: p }); },
  setOptions(o)   { this.set({ options: o }); },
  setDesign(d)    { this.set({ design: d }); },
  setWensen(w)    { this.set({ wensen: w }); },
  setKlant(k)     { this.set({ klant: k }); },
};

window.Session = Session;
