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

    if (
        persType?.id &&
        Array.isArray(product?.personalisatieTypes)
    ) {
        const matchedPersType = product.personalisatieTypes.find(item => item.id === persType.id);

        if (Array.isArray(matchedPersType?.priceSlabs) && matchedPersType.priceSlabs.length > 0) {
            return matchedPersType.priceSlabs;
        }
    }

    if (
        persTypeOrOptions?.persTypeId &&
        Array.isArray(product?.personalisatieTypes)
    ) {
        const matchedPersType = product.personalisatieTypes.find(item => item.id === persTypeOrOptions.persTypeId);

        if (Array.isArray(matchedPersType?.priceSlabs) && matchedPersType.priceSlabs.length > 0) {
            return matchedPersType.priceSlabs;
        }
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
        (priceSlab.to === null || qty <= Number(priceSlab.to))
    );

    return slab ? Number(slab.price || 0) : null;
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