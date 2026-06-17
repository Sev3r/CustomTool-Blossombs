/**
 * shared/js/printSpecs.js
 * Centrale drukwerkspecificaties voor customerflow en admin.
 * Houdt bestaande productdata backward compatible.
 */

const PrintSpecs = (() => {
    const DPI = 300;
    const MIN_DPI = 150;
    const DEFAULT_BLEED_MM = 3;
    const DEFAULT_SAFE_MARGIN_MM = 3;
    const MM_PER_INCH = 25.4;

    function toNumber(...values) {
        for (const value of values) {
            const number = Number(value);

            if (Number.isFinite(number) && number > 0) {
                return number;
            }
        }

        return null;
    }

    function toBoolean(value, fallback = false) {
        if (value === true || value === 'true') {
            return true;
        }

        if (value === false || value === 'false') {
            return false;
        }

        return fallback;
    }

    function mmToPx(mm, dpi = DPI) {
        return Math.round((Number(mm || 0) / MM_PER_INCH) * dpi);
    }

    function pxToMm(px, dpi = DPI) {
        return (Number(px || 0) / dpi) * MM_PER_INCH;
    }

    function normalizePrintSpec(persType = {}, product = {}) {
        const bleedMm = toNumber(persType.bleed_mm, product.bleed_mm, DEFAULT_BLEED_MM) || DEFAULT_BLEED_MM;
        const includesBleed = toBoolean(persType.includesBleed, false);

        const legacyWidthMm = toNumber(persType.width_mm, product.width_mm, 100) || 100;
        const legacyHeightMm = toNumber(persType.height_mm, product.height_mm, 70) || 70;

        const finishWidthMm = toNumber(
            persType.finish_width_mm,
            product.finish_width_mm,
            includesBleed ? legacyWidthMm - bleedMm * 2 : legacyWidthMm,
            legacyWidthMm
        ) || 100;

        const finishHeightMm = toNumber(
            persType.finish_height_mm,
            product.finish_height_mm,
            includesBleed ? legacyHeightMm - bleedMm * 2 : legacyHeightMm,
            legacyHeightMm
        ) || 70;

        const exportWidthMm = toNumber(
            persType.export_width_mm,
            product.export_width_mm,
            finishWidthMm + bleedMm * 2
        ) || finishWidthMm + bleedMm * 2;

        const exportHeightMm = toNumber(
            persType.export_height_mm,
            product.export_height_mm,
            finishHeightMm + bleedMm * 2
        ) || finishHeightMm + bleedMm * 2;

        const trimXmm = Math.max(0, (exportWidthMm - finishWidthMm) / 2);
        const trimYmm = Math.max(0, (exportHeightMm - finishHeightMm) / 2);

        const safeMarginMm = toNumber(
            persType.safe_margin_mm,
            persType.margin_mm,
            product.safe_margin_mm,
            product.margin_mm,
            DEFAULT_SAFE_MARGIN_MM
        ) || DEFAULT_SAFE_MARGIN_MM;

        const exportWidthPx = mmToPx(exportWidthMm);
        const exportHeightPx = mmToPx(exportHeightMm);
        const finishWidthPx = mmToPx(finishWidthMm);
        const finishHeightPx = mmToPx(finishHeightMm);
        const bleedPx = mmToPx(bleedMm);
        const safeMarginPx = mmToPx(safeMarginMm);

        const scale = Math.min(1, 600 / exportWidthPx);
        const displayWidthPx = Math.max(1, Math.round(exportWidthPx * scale));
        const displayHeightPx = Math.max(1, Math.round(exportHeightPx * scale));

        return {
            dpi: DPI,
            minDpi: MIN_DPI,

            finishWidthMm,
            finishHeightMm,
            exportWidthMm,
            exportHeightMm,
            bleedMm,
            safeMarginMm,
            includesBleed,

            trimXmm,
            trimYmm,
            trimRightMm: trimXmm + finishWidthMm,
            trimBottomMm: trimYmm + finishHeightMm,

            finishWidthPx,
            finishHeightPx,
            exportWidthPx,
            exportHeightPx,
            bleedPx,
            safeMarginPx,
            displayWidthPx,
            displayHeightPx,

            requiredImageWidthPx300: exportWidthPx,
            requiredImageHeightPx300: exportHeightPx,
            requiredImageWidthPx150: mmToPx(exportWidthMm, MIN_DPI),
            requiredImageHeightPx150: mmToPx(exportHeightMm, MIN_DPI),
        };
    }

    function mmToCanvasX(mm, spec, canvasWidth) {
        return (Number(mm || 0) / spec.exportWidthMm) * canvasWidth;
    }

    function mmToCanvasY(mm, spec, canvasHeight) {
        return (Number(mm || 0) / spec.exportHeightMm) * canvasHeight;
    }

    function finishMmToCanvasX(mm, spec, canvasWidth) {
        return mmToCanvasX(spec.trimXmm + Number(mm || 0), spec, canvasWidth);
    }

    function finishMmToCanvasY(mm, spec, canvasHeight) {
        return mmToCanvasY(spec.trimYmm + Number(mm || 0), spec, canvasHeight);
    }

    function getImageDimensions(file) {
        return new Promise((resolve, reject) => {
            if (!file?.type?.startsWith('image/')) {
                resolve(null);
                return;
            }

            const image = new Image();
            const url = URL.createObjectURL(file);

            image.onload = () => {
                URL.revokeObjectURL(url);

                resolve({
                    width: image.naturalWidth,
                    height: image.naturalHeight,
                });
            };

            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Afbeelding kon niet worden gecontroleerd.'));
            };

            image.src = url;
        });
    }

    async function validateUploadFile(file, persType, product) {
        const allowedExtensions = ['pdf', 'ai', 'eps', 'png', 'jpg', 'jpeg'];
        const extension = String(file?.name || '').split('.').pop().toLowerCase();
        const warnings = [];
        const errors = [];
        const spec = normalizePrintSpec(persType, product);

        if (!file || !allowedExtensions.includes(extension)) {
            errors.push('Dit bestandstype wordt niet ondersteund. Gebruik PDF, AI, EPS, PNG, JPG of JPEG.');
            return {
                valid: false,
                errors,
                warnings,
                dimensions: null,
                spec,
            };
        }

        if (['pdf', 'ai', 'eps'].includes(extension)) {
            warnings.push('Dit bestand wordt na het plaatsen van de aanvraag technisch gecontroleerd door Blossombs.');
            return {
                valid: true,
                errors,
                warnings,
                dimensions: null,
                spec,
            };
        }

        const dimensions = await getImageDimensions(file);

        if (!dimensions) {
            warnings.push('De resolutie van dit bestand kon niet automatisch worden gecontroleerd.');
            return {
                valid: true,
                errors,
                warnings,
                dimensions,
                spec,
            };
        }

        const meets150Dpi =
            dimensions.width >= spec.requiredImageWidthPx150 &&
            dimensions.height >= spec.requiredImageHeightPx150;

        const meets300Dpi =
            dimensions.width >= spec.requiredImageWidthPx300 &&
            dimensions.height >= spec.requiredImageHeightPx300;

        if (!meets150Dpi) {
            warnings.push(`De afbeelding lijkt lager dan 150 DPI voor dit formaat. Gebruik bij voorkeur minimaal ${spec.requiredImageWidthPx300} × ${spec.requiredImageHeightPx300}px.`);
        } else if (!meets300Dpi) {
            warnings.push(`De afbeelding is bruikbaar, maar lager dan de aanbevolen 300 DPI. Aanbevolen formaat: ${spec.requiredImageWidthPx300} × ${spec.requiredImageHeightPx300}px.`);
        }

        return {
            valid: true,
            errors,
            warnings,
            dimensions,
            spec,
        };
    }

    return {
        DPI,
        MIN_DPI,
        DEFAULT_BLEED_MM,
        DEFAULT_SAFE_MARGIN_MM,
        mmToPx,
        pxToMm,
        normalizePrintSpec,
        mmToCanvasX,
        mmToCanvasY,
        finishMmToCanvasX,
        finishMmToCanvasY,
        validateUploadFile,
    };
})();

window.PrintSpecs = PrintSpecs;