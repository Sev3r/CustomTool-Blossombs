/**
 * shared/js/pricing.js
 * Centrale prijsberekening voor customer flow, admin en PDF.
 * Staffels worden primair gelezen vanaf het gekozen personalisatietype.
 * Backward compatible fallback: product.priceSlabs.
 */

function getPriceSlabsForPersonalisation(product, persTypeOrOptions = null) {
    const persType = persTypeOrOptions?.persType || persTypeOrOptions;

    if (Array.isArray(persType?.priceSlabs) && persType.priceSlabs.length > 0) {
        return persType.priceSlabs;
    }

    return Array.isArray(product?.priceSlabs) ? product.priceSlabs : [];
}

function getPriceForQty(product, quantity, persTypeOrOptions = null) {
    const qty = Number(quantity || 0);

    if (qty <= 0) {
        return null;
    }

    const priceSlabs = getPriceSlabsForPersonalisation(product, persTypeOrOptions);

    if (!priceSlabs.length) {
        return null;
    }

    const slab = priceSlabs.find(priceSlab =>
        qty >= Number(priceSlab.from || 0) &&
        (
            priceSlab.to === null ||
            priceSlab.to === undefined ||
            priceSlab.to === '' ||
            qty <= Number(priceSlab.to)
        )
    );

    return slab ? Number(priceSlabPrice(slab)) : null;
}

function priceSlabPrice(slab) {
    return slab.price ?? slab.unitPrice ?? 0;
}

function calculateOrderPricing(product, options = {}) {
    const quantity = Number(options.quantity || 0);
    const unitPrice = getPriceForQty(product, quantity, options) || 0;
    const designService = options.designChoice === 'laat-ontwerpen' ? 75 : 0;
    const fileCheck = options.addons?.includes('bestandscontrole') ? 15 : 0;

    const productsTotal = unitPrice * quantity;
    const totalIncl = productsTotal + designService + fileCheck;
    const totalExcl = totalIncl / 1.21;
    const vat = totalIncl - totalExcl;

    return {
        quantity,
        unitPrice,
        productsTotal,
        designService,
        fileCheck,
        totalExcl,
        vat,
        totalIncl,
    };
}

window.Pricing = {
    getPriceSlabsForPersonalisation,
    getPriceForQty,
    calculateOrderPricing,
};