/**
 * shared/js/offertePdf.js
 * Gedeelde offerte PDF generatie.
 * Vereist: jsPDF geladen vóór dit bestand.
 */

async function generateOffertePDF(order, product, pricingInput = null) {
    if (!window.jspdf) {
        alert('jsPDF niet geladen.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pricing = pricingInput || {
        unitPrice: Number(order.unitPrice || 0),
        totalIncl: Number(order.quoteAmount || 0),
        totalExcl: Number(order.quoteAmount || 0) / 1.21,
        vat: Number(order.quoteAmount || 0) - Number(order.quoteAmount || 0) / 1.21,
        designService: order.workType === 'ontwerp' ? 75 : 0,
        fileCheck: order.addons?.includes('bestandscontrole') ? 15 : 0,
        quantity: Number(order.quantity || 0),
    };

    const margin = 20;
    const pageWidth = 210;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    doc.setFillColor(92, 122, 92);
    doc.rect(0, 0, pageWidth, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Blossombs', margin, 16);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Offerte / Orderbevestiging', margin, 26);

    y = 50;

    doc.setTextColor(42, 42, 34);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Ordernummer: ${order.orderNumber || 'Concept'}`, margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 102, 96);
    doc.text(`Datum: ${new Date(order.createdAt || Date.now()).toLocaleDateString('nl-NL')}`, margin, y + 6);
    doc.text(`Status: ${order.status === 'concept' ? 'Conceptofferte' : 'Wacht op bevestiging'}`, margin, y + 12);

    y += 24;

    doc.setDrawColor(221, 216, 204);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setTextColor(168, 163, 155);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('KLANTGEGEVENS', margin, y);
    y += 6;

    const customerRows = [
        ['Naam', order.customerName || 'Nog niet ingevuld'],
        ['E-mail', order.customerEmail || 'Nog niet ingevuld'],
        ['Adres', order.deliveryAddress || 'Nog niet ingevuld'],
        ['Telefoon', order.telefoon || '—'],
        ['KvK', order.kvk || '—'],
    ];

    doc.setFontSize(10);
    doc.setTextColor(42, 42, 34);

    customerRows.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(value || '—'), margin + 30, y);
        y += 6;
    });

    y += 6;

    doc.setDrawColor(221, 216, 204);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setTextColor(168, 163, 155);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('ORDERDETAILS', margin, y);
    y += 6;

    const productRows = [
        ['Product', order.productName || product?.name || '—'],
        ['Personalisatietype', order.persTypeLabel || '—'],
        ['Afmetingen', order.persTypeDims || '—'],
        ['Aantal', `${order.quantity || pricing.quantity || 0} stuks`],
        ['Stukprijs', formatPdfEuro(pricing.unitPrice)],
        ['Ontwerp service', pricing.designService ? '+ € 75,00' : 'Eigen ontwerp'],
    ];

    if (pricing.fileCheck) {
        productRows.push(['Bestandscontrole', '+ € 15,00']);
    }

    doc.setFontSize(10);
    doc.setTextColor(42, 42, 34);

    productRows.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(value || '—'), margin + 50, y);
        y += 6;
    });

    y += 6;

    doc.setDrawColor(221, 216, 204);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setTextColor(168, 163, 155);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('PRIJSOVERZICHT', margin, y);
    y += 8;

    const priceRows = [
        ['Subtotaal excl. BTW', formatPdfEuro(pricing.totalExcl)],
        ['BTW (21%)', formatPdfEuro(pricing.vat)],
    ];

    doc.setFontSize(10);
    doc.setTextColor(42, 42, 34);

    priceRows.forEach(([label, value]) => {
        doc.setFont('helvetica', 'normal');
        doc.text(label, margin, y);
        doc.text(value, pageWidth - margin, y, { align: 'right' });
        y += 6;
    });

    y += 2;

    doc.setFillColor(237, 242, 237);
    doc.roundedRect(margin, y - 4, contentWidth, 10, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(62, 90, 62);
    doc.text('Totaal incl. BTW', margin + 3, y + 3);
    doc.text(formatPdfEuro(pricing.totalIncl), pageWidth - margin - 3, y + 3, { align: 'right' });

    y += 18;

    if (order.designDataURL && order.designDataURL.startsWith('data:image')) {
        doc.setDrawColor(221, 216, 204);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;

        doc.setTextColor(168, 163, 155);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('UW ONTWERP', margin, y);
        y += 6;

        try {
            doc.addImage(order.designDataURL, 'PNG', margin, y, 60, 40);
            y += 48;
        } catch {
            doc.setFontSize(9);
            doc.setTextColor(107, 102, 96);
            doc.text('(Preview niet beschikbaar)', margin, y);
            y += 8;
        }
    }

    doc.setFillColor(247, 244, 238);
    doc.rect(0, 280, pageWidth, 17, 'F');

    doc.setFontSize(8);
    doc.setTextColor(168, 163, 155);
    doc.setFont('helvetica', 'normal');
    doc.text('Blossombs — info@blossombs.nl — www.blossombs.nl', pageWidth / 2, 288, { align: 'center' });
    doc.text('Deze offerte is onder voorbehoud van definitieve bevestiging.', pageWidth / 2, 293, { align: 'center' });

    doc.save(`blossombs-offerte-${order.orderNumber || 'concept'}.pdf`);
}

function formatPdfEuro(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return '—';
    }

    return `€ ${Number(value).toFixed(2).replace('.', ',')}`;
}

window.generateOffertePDF = generateOffertePDF;