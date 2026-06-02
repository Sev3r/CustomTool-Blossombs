function getPriceForQty(product, qty) {
    if (!product?.priceSlabs || !qty) return null;

    const slab = product.priceSlabs.find(s =>
        qty >= s.from && (s.to === null || qty <= s.to)
    );

    return slab ? slab.price : null;
}

function calculateOrderPricing(product, options) {
    const quantity = Number(options?.quantity || 0);
    const unitPrice = getPriceForQty(product, quantity) || 0;
    const designService = options?.designChoice === 'laat-ontwerpen' ? 75 : 0;
    const fileCheck = options?.addons?.includes('bestandscontrole') ? 15 : 0;

    const totalIncl = (unitPrice * quantity) + designService + fileCheck;
    const totalExcl = totalIncl / 1.21;
    const vat = totalIncl - totalExcl;

    return {
        quantity,
        unitPrice,
        designService,
        fileCheck,
        totalExcl,
        vat,
        totalIncl,
    };
}

window.Pricing = {
    getPriceForQty,
    calculateOrderPricing,
};