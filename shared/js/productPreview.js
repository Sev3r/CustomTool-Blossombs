/**
 * shared/js/productPreview.js
 *
 * Generieke, niet-bewerkbare productpreview-engine voor de admin- en customerflow.
 *
 * De engine:
 * - leest previewconfiguratie uit een personalisatietype;
 * - haalt één of meerdere brongebieden uit het volledige drukcanvas;
 * - ondersteunt rotatie en spiegeling voor gevouwen drukwerk;
 * - plaatst het geselecteerde brongebied in een configureerbare productmockup;
 * - tekent een optionele overlay boven het ontwerp;
 * - kan een Fabric-canvas uitlezen zonder technische hulplijnen mee te nemen.
 *
 * De productpreview is uitsluitend visueel. De bestaande productie-export wordt
 * door dit bestand niet aangepast.
 */

const ProductPreview = (() => {
    const DEFAULT_CANVAS_WIDTH = 720;
    const DEFAULT_CANVAS_HEIGHT = 480;
    const MIN_CANVAS_WIDTH = 240;
    const MIN_CANVAS_HEIGHT = 180;
    const MAX_CANVAS_HEIGHT = 720;

    const SUPPORTED_PREVIEW_TYPES = new Set([
        'single-view',
        'two-sided-toggle',
        'multi-view-toggle',
    ]);

    const SUPPORTED_SLOT_FITS = new Set([
        'cover',
        'contain',
        'stretch',
    ]);

    const imageCache = new Map();

    function finiteNumber(value, fallback = 0) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    }

    function positiveNumber(value, fallback) {
        const number = Number(value);

        return Number.isFinite(number) && number > 0
            ? number
            : fallback;
    }

    function toBoolean(value, fallback = false) {
        if (
            value === true ||
            value === 'true' ||
            value === 1 ||
            value === '1'
        ) {
            return true;
        }

        if (
            value === false ||
            value === 'false' ||
            value === 0 ||
            value === '0'
        ) {
            return false;
        }

        return fallback;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function normalizeRotation(value) {
        const rotation = finiteNumber(value, 0);

        return ((rotation % 360) + 360) % 360;
    }

    function normalizeIdentifier(value, fallback) {
        const normalized = String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '');

        return normalized || fallback;
    }

    function normalizeImageFile(file) {
        if (typeof file === 'string' && file.trim()) {
            return {
                name: 'Afbeelding',
                type: file.startsWith('data:image/webp')
                    ? 'image/webp'
                    : 'image/png',
                size: 0,
                dataURL: file,
            };
        }

        if (!file || typeof file !== 'object') {
            return null;
        }

        const dataURL = String(
            file.dataURL ||
            file.url ||
            file.src ||
            ''
        ).trim();

        if (!dataURL) {
            return null;
        }

        return {
            name: String(file.name || 'Afbeelding'),
            type: String(file.type || 'image/png'),
            size: Math.max(0, finiteNumber(file.size, 0)),
            dataURL,
        };
    }

    function normalizeSourceZone(sourceZone = {}, printSpec = {}) {
        const finishWidthMm = positiveNumber(
            printSpec.finishWidthMm,
            100
        );

        const finishHeightMm = positiveNumber(
            printSpec.finishHeightMm,
            70
        );

        return {
            x_mm: finiteNumber(sourceZone.x_mm, 0),
            y_mm: finiteNumber(sourceZone.y_mm, 0),
            width_mm: positiveNumber(
                sourceZone.width_mm,
                finishWidthMm
            ),
            height_mm: positiveNumber(
                sourceZone.height_mm,
                finishHeightMm
            ),
            rotation: normalizeRotation(sourceZone.rotation),
            flipX: toBoolean(sourceZone.flipX, false),
            flipY: toBoolean(sourceZone.flipY, false),
        };
    }

    function normalizeSlot(slot = {}) {
        const fit = SUPPORTED_SLOT_FITS.has(slot.fit)
            ? slot.fit
            : 'cover';

        return {
            xPercent: clamp(
                finiteNumber(slot.xPercent, 20),
                -200,
                300
            ),
            yPercent: clamp(
                finiteNumber(slot.yPercent, 10),
                -200,
                300
            ),
            widthPercent: clamp(
                positiveNumber(slot.widthPercent, 60),
                0.1,
                400
            ),
            heightPercent: clamp(
                positiveNumber(slot.heightPercent, 55),
                0.1,
                400
            ),
            rotation: finiteNumber(slot.rotation, 0),
            borderRadius: clamp(
                finiteNumber(slot.borderRadius, 0),
                0,
                50
            ),
            fit,
        };
    }

    function normalizeView(view = {}, index = 0, printSpec = {}) {
        const fallbackId = `view-${index + 1}`;

        return {
            id: normalizeIdentifier(view.id, fallbackId),
            label: String(
                view.label ||
                `Weergave ${index + 1}`
            ),
            helpText: String(view.helpText || ''),
            sourceZone: normalizeSourceZone(
                view.sourceZone,
                printSpec
            ),
            mockup: {
                baseImage: normalizeImageFile(
                    view.mockup?.baseImage
                ),
                overlayImage: normalizeImageFile(
                    view.mockup?.overlayImage
                ),
                slot: normalizeSlot(
                    view.mockup?.slot
                ),
            },
        };
    }

    function normalizeCanvasGuide(guide = {}, index = 0) {
        const type = guide.type === 'line'
            ? 'line'
            : 'label';

        if (type === 'line') {
            return {
                id: normalizeIdentifier(
                    guide.id,
                    `guide-line-${index + 1}`
                ),
                type: 'line',
                label: String(
                    guide.label ||
                    'Vouwlijn'
                ),
                description: String(
                    guide.description ||
                    ''
                ),
                x1_mm: finiteNumber(guide.x1_mm, 0),
                y1_mm: finiteNumber(guide.y1_mm, 0),
                x2_mm: finiteNumber(guide.x2_mm, 0),
                y2_mm: finiteNumber(guide.y2_mm, 0),
            };
        }

        return {
            id: normalizeIdentifier(
                guide.id,
                `guide-label-${index + 1}`
            ),
            type: 'label',
            viewId: guide.viewId
                ? normalizeIdentifier(guide.viewId, null)
                : null,
            label: String(
                guide.label ||
                'Gebied'
            ),
            description: String(
                guide.description ||
                ''
            ),
            x_mm: finiteNumber(guide.x_mm, 0),
            y_mm: finiteNumber(guide.y_mm, 0),
            width_mm: Math.max(
                0,
                finiteNumber(guide.width_mm, 0)
            ),
            height_mm: Math.max(
                0,
                finiteNumber(guide.height_mm, 0)
            ),
        };
    }

    function getPrintSpec(
        personalisationType = {},
        product = {}
    ) {
        if (window.PrintSpecs?.normalizePrintSpec) {
            return PrintSpecs.normalizePrintSpec(
                personalisationType,
                product
            );
        }

        const bleedMm = positiveNumber(
            personalisationType.bleed_mm ??
            product.bleed_mm,
            3
        );

        const legacyWidthMm = positiveNumber(
            personalisationType.width_mm ??
            product.width_mm,
            100
        );

        const legacyHeightMm = positiveNumber(
            personalisationType.height_mm ??
            product.height_mm,
            70
        );

        const includesBleed = toBoolean(
            personalisationType.includesBleed,
            false
        );

        const finishWidthMm = positiveNumber(
            personalisationType.finish_width_mm ??
            product.finish_width_mm,
            includesBleed
                ? Math.max(
                    0.1,
                    legacyWidthMm - bleedMm * 2
                )
                : legacyWidthMm
        );

        const finishHeightMm = positiveNumber(
            personalisationType.finish_height_mm ??
            product.finish_height_mm,
            includesBleed
                ? Math.max(
                    0.1,
                    legacyHeightMm - bleedMm * 2
                )
                : legacyHeightMm
        );

        const exportWidthMm = positiveNumber(
            personalisationType.export_width_mm ??
            product.export_width_mm,
            finishWidthMm + bleedMm * 2
        );

        const exportHeightMm = positiveNumber(
            personalisationType.export_height_mm ??
            product.export_height_mm,
            finishHeightMm + bleedMm * 2
        );

        return {
            finishWidthMm,
            finishHeightMm,
            exportWidthMm,
            exportHeightMm,
            bleedMm,
            trimXmm: Math.max(
                0,
                (exportWidthMm - finishWidthMm) / 2
            ),
            trimYmm: Math.max(
                0,
                (exportHeightMm - finishHeightMm) / 2
            ),
        };
    }

    function normalizeConfig(
        personalisationType = {},
        product = {}
    ) {
        const rawPreview = personalisationType.preview || {};
        const printSpec = getPrintSpec(
            personalisationType,
            product
        );

        const rawViews = Array.isArray(rawPreview.views)
            ? rawPreview.views
            : [];

        const usedViewIds = new Set();

        const views = rawViews.map((view, index) => {
            const normalizedView = normalizeView(
                view,
                index,
                printSpec
            );

            let uniqueId = normalizedView.id;
            let suffix = 2;

            while (usedViewIds.has(uniqueId)) {
                uniqueId = `${normalizedView.id}-${suffix}`;
                suffix += 1;
            }

            usedViewIds.add(uniqueId);

            return {
                ...normalizedView,
                id: uniqueId,
            };
        });

        const requestedDefaultViewId = normalizeIdentifier(
            rawPreview.defaultViewId,
            ''
        );

        const defaultViewId = views.some(
            view => view.id === requestedDefaultViewId
        )
            ? requestedDefaultViewId
            : views[0]?.id || null;

        const previewType = SUPPORTED_PREVIEW_TYPES.has(
            rawPreview.type
        )
            ? rawPreview.type
            : views.length > 1
                ? 'two-sided-toggle'
                : 'single-view';

        return {
            enabled: toBoolean(
                rawPreview.enabled,
                false
            ),
            type: previewType,
            defaultViewId,
            views,
            canvasGuides: Array.isArray(
                rawPreview.canvasGuides
            )
                ? rawPreview.canvasGuides.map(
                    normalizeCanvasGuide
                )
                : [],
        };
    }

    function getView(config, viewId = null) {
        if (
            !Array.isArray(config?.views) ||
            !config.views.length
        ) {
            return null;
        }

        return config.views.find(
            view => view.id === viewId
        ) ||
            config.views.find(
                view => view.id === config.defaultViewId
            ) ||
            config.views[0];
    }

    function getImageSource(fileOrDataURL) {
        if (typeof fileOrDataURL === 'string') {
            return fileOrDataURL;
        }

        return fileOrDataURL?.dataURL ||
            fileOrDataURL?.url ||
            fileOrDataURL?.src ||
            '';
    }

    function loadImage(fileOrDataURL) {
        const src = getImageSource(fileOrDataURL);

        if (!src) {
            return Promise.resolve(null);
        }

        if (imageCache.has(src)) {
            return imageCache.get(src);
        }

        const imagePromise = new Promise(
            (resolve, reject) => {
                const image = new Image();

                image.onload = () => {
                    resolve(image);
                };

                image.onerror = () => {
                    imageCache.delete(src);

                    reject(
                        new Error(
                            'Previewafbeelding kon niet worden geladen.'
                        )
                    );
                };

                if (
                    !src.startsWith('data:') &&
                    !src.startsWith('blob:')
                ) {
                    image.crossOrigin = 'anonymous';
                }

                image.src = src;
            }
        );

        imageCache.set(src, imagePromise);

        return imagePromise;
    }

    function clearImageCache() {
        imageCache.clear();
    }

    function createCanvas(width, height) {
        const canvas = document.createElement('canvas');

        canvas.width = Math.max(
            1,
            Math.round(width)
        );

        canvas.height = Math.max(
            1,
            Math.round(height)
        );

        return canvas;
    }

    function getSourceDimensions(source) {
        return {
            width:
                source?.naturalWidth ||
                source?.videoWidth ||
                source?.width ||
                0,
            height:
                source?.naturalHeight ||
                source?.videoHeight ||
                source?.height ||
                0,
        };
    }

    function applySourceTransform(
        sourceCanvas,
        sourceZone
    ) {
        const rotation = normalizeRotation(
            sourceZone.rotation
        );

        const swapsDimensions =
            rotation === 90 ||
            rotation === 270;

        const transformedCanvas = createCanvas(
            swapsDimensions
                ? sourceCanvas.height
                : sourceCanvas.width,
            swapsDimensions
                ? sourceCanvas.width
                : sourceCanvas.height
        );

        const context = transformedCanvas.getContext('2d');

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';

        context.save();

        context.translate(
            transformedCanvas.width / 2,
            transformedCanvas.height / 2
        );

        context.rotate(
            rotation * Math.PI / 180
        );

        context.scale(
            sourceZone.flipX ? -1 : 1,
            sourceZone.flipY ? -1 : 1
        );

        context.drawImage(
            sourceCanvas,
            -sourceCanvas.width / 2,
            -sourceCanvas.height / 2
        );

        context.restore();

        return transformedCanvas;
    }

    function cropSourceZone(
        source,
        sourceZone,
        printSpec
    ) {
        const dimensions = getSourceDimensions(source);

        if (
            !dimensions.width ||
            !dimensions.height
        ) {
            return null;
        }

        const exportWidthMm = positiveNumber(
            printSpec.exportWidthMm,
            positiveNumber(
                printSpec.finishWidthMm,
                100
            )
        );

        const exportHeightMm = positiveNumber(
            printSpec.exportHeightMm,
            positiveNumber(
                printSpec.finishHeightMm,
                70
            )
        );

        const trimXmm = finiteNumber(
            printSpec.trimXmm,
            Math.max(
                0,
                (
                    exportWidthMm -
                    positiveNumber(
                        printSpec.finishWidthMm,
                        exportWidthMm
                    )
                ) / 2
            )
        );

        const trimYmm = finiteNumber(
            printSpec.trimYmm,
            Math.max(
                0,
                (
                    exportHeightMm -
                    positiveNumber(
                        printSpec.finishHeightMm,
                        exportHeightMm
                    )
                ) / 2
            )
        );

        const sourceX = (
            (
                trimXmm +
                finiteNumber(sourceZone.x_mm, 0)
            ) /
            exportWidthMm
        ) * dimensions.width;

        const sourceY = (
            (
                trimYmm +
                finiteNumber(sourceZone.y_mm, 0)
            ) /
            exportHeightMm
        ) * dimensions.height;

        const sourceWidth = (
            positiveNumber(
                sourceZone.width_mm,
                printSpec.finishWidthMm
            ) /
            exportWidthMm
        ) * dimensions.width;

        const sourceHeight = (
            positiveNumber(
                sourceZone.height_mm,
                printSpec.finishHeightMm
            ) /
            exportHeightMm
        ) * dimensions.height;

        const left = clamp(
            sourceX,
            0,
            dimensions.width
        );

        const top = clamp(
            sourceY,
            0,
            dimensions.height
        );

        const right = clamp(
            sourceX + sourceWidth,
            0,
            dimensions.width
        );

        const bottom = clamp(
            sourceY + sourceHeight,
            0,
            dimensions.height
        );

        if (
            right <= left ||
            bottom <= top
        ) {
            return null;
        }

        const cropWidth = right - left;
        const cropHeight = bottom - top;

        const croppedCanvas = createCanvas(
            cropWidth,
            cropHeight
        );

        const context = croppedCanvas.getContext('2d');

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';

        context.drawImage(
            source,
            left,
            top,
            cropWidth,
            cropHeight,
            0,
            0,
            croppedCanvas.width,
            croppedCanvas.height
        );

        return applySourceTransform(
            croppedCanvas,
            sourceZone
        );
    }

    function createRoundedRectPath(
        context,
        x,
        y,
        width,
        height,
        radius
    ) {
        const safeRadius = clamp(
            radius,
            0,
            Math.min(width, height) / 2
        );

        context.beginPath();

        context.moveTo(
            x + safeRadius,
            y
        );

        context.lineTo(
            x + width - safeRadius,
            y
        );

        context.quadraticCurveTo(
            x + width,
            y,
            x + width,
            y + safeRadius
        );

        context.lineTo(
            x + width,
            y + height - safeRadius
        );

        context.quadraticCurveTo(
            x + width,
            y + height,
            x + width - safeRadius,
            y + height
        );

        context.lineTo(
            x + safeRadius,
            y + height
        );

        context.quadraticCurveTo(
            x,
            y + height,
            x,
            y + height - safeRadius
        );

        context.lineTo(
            x,
            y + safeRadius
        );

        context.quadraticCurveTo(
            x,
            y,
            x + safeRadius,
            y
        );

        context.closePath();
    }

    function getFittedRect(
        sourceWidth,
        sourceHeight,
        targetWidth,
        targetHeight,
        fit
    ) {
        if (
            !sourceWidth ||
            !sourceHeight ||
            !targetWidth ||
            !targetHeight
        ) {
            return null;
        }

        if (fit === 'stretch') {
            return {
                x: 0,
                y: 0,
                width: targetWidth,
                height: targetHeight,
            };
        }

        const scale = fit === 'contain'
            ? Math.min(
                targetWidth / sourceWidth,
                targetHeight / sourceHeight
            )
            : Math.max(
                targetWidth / sourceWidth,
                targetHeight / sourceHeight
            );

        const width = sourceWidth * scale;
        const height = sourceHeight * scale;

        return {
            x: (targetWidth - width) / 2,
            y: (targetHeight - height) / 2,
            width,
            height,
        };
    }

    function drawSlot(
        context,
        sourceCanvas,
        slot,
        canvasWidth,
        canvasHeight
    ) {
        if (!sourceCanvas) {
            return false;
        }

        const slotX =
            canvasWidth *
            slot.xPercent /
            100;

        const slotY =
            canvasHeight *
            slot.yPercent /
            100;

        const slotWidth =
            canvasWidth *
            slot.widthPercent /
            100;

        const slotHeight =
            canvasHeight *
            slot.heightPercent /
            100;

        const radius =
            Math.min(
                slotWidth,
                slotHeight
            ) *
            slot.borderRadius /
            100;

        const fittedRect = getFittedRect(
            sourceCanvas.width,
            sourceCanvas.height,
            slotWidth,
            slotHeight,
            slot.fit
        );

        if (!fittedRect) {
            return false;
        }

        context.save();

        context.translate(
            slotX + slotWidth / 2,
            slotY + slotHeight / 2
        );

        context.rotate(
            slot.rotation *
            Math.PI /
            180
        );

        createRoundedRectPath(
            context,
            -slotWidth / 2,
            -slotHeight / 2,
            slotWidth,
            slotHeight,
            radius
        );

        context.clip();

        context.drawImage(
            sourceCanvas,
            -slotWidth / 2 + fittedRect.x,
            -slotHeight / 2 + fittedRect.y,
            fittedRect.width,
            fittedRect.height
        );

        context.restore();

        return true;
    }

    function drawFallbackMockup(
        context,
        width,
        height
    ) {
        context.fillStyle = '#F7F4EE';

        context.fillRect(
            0,
            0,
            width,
            height
        );

        const inset = Math.round(
            Math.min(width, height) *
            0.055
        );

        const radius = Math.round(
            Math.min(width, height) *
            0.04
        );

        context.fillStyle = '#FFFFFF';
        context.strokeStyle = '#DDD8CC';
        context.lineWidth = Math.max(
            1,
            width / 500
        );

        createRoundedRectPath(
            context,
            inset,
            inset,
            width - inset * 2,
            height - inset * 2,
            radius
        );

        context.fill();
        context.stroke();
    }

    function setTargetCanvasDimensions(
        targetCanvas,
        baseImage,
        requestedWidth = DEFAULT_CANVAS_WIDTH
    ) {
        const requestedCanvasWidth = Math.max(
            MIN_CANVAS_WIDTH,
            Math.round(
                finiteNumber(
                    requestedWidth,
                    DEFAULT_CANVAS_WIDTH
                )
            )
        );

        const baseWidth =
            baseImage?.naturalWidth ||
            baseImage?.width ||
            0;

        const baseHeight =
            baseImage?.naturalHeight ||
            baseImage?.height ||
            0;

        let canvasWidth = requestedCanvasWidth;
        let canvasHeight = DEFAULT_CANVAS_HEIGHT;

        if (
            baseWidth > 0 &&
            baseHeight > 0
        ) {
            canvasHeight = Math.round(
                canvasWidth *
                baseHeight /
                baseWidth
            );
        }

        if (canvasHeight > MAX_CANVAS_HEIGHT) {
            const scale =
                MAX_CANVAS_HEIGHT /
                canvasHeight;

            canvasWidth = Math.max(
                MIN_CANVAS_WIDTH,
                Math.round(
                    canvasWidth * scale
                )
            );

            canvasHeight = MAX_CANVAS_HEIGHT;
        }

        targetCanvas.width = canvasWidth;

        targetCanvas.height = Math.max(
            MIN_CANVAS_HEIGHT,
            canvasHeight
        );
    }

    function defaultGuidePredicate(object) {
        return Boolean(
            object?._isGuide ||
            object?._isBlockedZone ||
            object?._isMargin ||
            object?._isPreviewGuide ||
            object?._isCenterGuide
        );
    }

    function isExcludedFabricObject(
        object,
        customPredicate
    ) {
        return defaultGuidePredicate(object) ||
            Boolean(
                customPredicate?.(object)
            );
    }

    function createSourceCanvasFromFabric(
        fabricCanvas,
        options = {}
    ) {
        if (!fabricCanvas) {
            return null;
        }

        const customPredicate =
            typeof options.isGuideObject === 'function'
                ? options.isGuideObject
                : null;

        const objects =
            typeof fabricCanvas.getObjects === 'function'
                ? fabricCanvas.getObjects()
                : [];

        const excludedObjects = objects.filter(
            object => isExcludedFabricObject(
                object,
                customPredicate
            )
        );

        const originalVisibility = excludedObjects.map(
            object => ({
                object,
                visible: object.visible,
            })
        );

        excludedObjects.forEach(object => {
            object.visible = false;
        });

        try {
            if (
                typeof fabricCanvas.toCanvasElement ===
                'function'
            ) {
                return fabricCanvas.toCanvasElement(
                    1,
                    {
                        enableRetinaScaling: false,
                    }
                );
            }

            const lowerCanvas =
                fabricCanvas.lowerCanvasEl;

            if (!lowerCanvas) {
                return null;
            }

            if (
                typeof fabricCanvas.renderAll ===
                'function'
            ) {
                fabricCanvas.renderAll();
            }

            const clonedCanvas = createCanvas(
                lowerCanvas.width,
                lowerCanvas.height
            );

            clonedCanvas
                .getContext('2d')
                .drawImage(
                    lowerCanvas,
                    0,
                    0
                );

            return clonedCanvas;
        } finally {
            originalVisibility.forEach(
                ({ object, visible }) => {
                    object.visible = visible;
                }
            );

            if (
                typeof fabricCanvas.requestRenderAll ===
                'function'
            ) {
                fabricCanvas.requestRenderAll();
            } else if (
                typeof fabricCanvas.renderAll ===
                'function'
            ) {
                fabricCanvas.renderAll();
            }
        }
    }

    async function render({
        source,
        targetCanvas,
        product = {},
        personalisationType = {},
        viewId = null,
        width = DEFAULT_CANVAS_WIDTH,
    } = {}) {
        if (!targetCanvas?.getContext) {
            throw new Error(
                'Een geldig doelcanvas is verplicht voor de productpreview.'
            );
        }

        const config = normalizeConfig(
            personalisationType,
            product
        );

        const view = getView(
            config,
            viewId
        );

        const context =
            targetCanvas.getContext('2d');

        if (!view) {
            targetCanvas.width =
                DEFAULT_CANVAS_WIDTH;

            targetCanvas.height =
                DEFAULT_CANVAS_HEIGHT;

            drawFallbackMockup(
                context,
                targetCanvas.width,
                targetCanvas.height
            );

            return {
                config,
                view: null,
                sourceCanvas: null,
                hasBaseImage: false,
                hasOverlayImage: false,
                hasArtwork: false,
            };
        }

        const [
            baseImage,
            overlayImage,
        ] = await Promise.all([
            loadImage(
                view.mockup.baseImage
            ).catch(() => null),

            loadImage(
                view.mockup.overlayImage
            ).catch(() => null),
        ]);

        setTargetCanvasDimensions(
            targetCanvas,
            baseImage,
            width
        );

        context.clearRect(
            0,
            0,
            targetCanvas.width,
            targetCanvas.height
        );

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';

        if (baseImage) {
            context.drawImage(
                baseImage,
                0,
                0,
                targetCanvas.width,
                targetCanvas.height
            );
        } else {
            drawFallbackMockup(
                context,
                targetCanvas.width,
                targetCanvas.height
            );
        }

        const printSpec = getPrintSpec(
            personalisationType,
            product
        );

        const croppedSource = source
            ? cropSourceZone(
                source,
                view.sourceZone,
                printSpec
            )
            : null;

        const hasArtwork = drawSlot(
            context,
            croppedSource,
            view.mockup.slot,
            targetCanvas.width,
            targetCanvas.height
        );

        if (overlayImage) {
            context.drawImage(
                overlayImage,
                0,
                0,
                targetCanvas.width,
                targetCanvas.height
            );
        }

        return {
            config,
            view,
            sourceCanvas: croppedSource,
            hasBaseImage: Boolean(baseImage),
            hasOverlayImage: Boolean(overlayImage),
            hasArtwork,
        };
    }

    async function renderFromCanvas(options = {}) {
        return render({
            ...options,
            source: options.sourceCanvas || null,
        });
    }

    async function renderFromDataURL(options = {}) {
        const sourceImage = options.sourceDataURL
            ? await loadImage(
                options.sourceDataURL
            )
            : null;

        return render({
            ...options,
            source: sourceImage,
        });
    }

    async function renderFromFabric(options = {}) {
        const sourceCanvas =
            createSourceCanvasFromFabric(
                options.fabricCanvas,
                {
                    isGuideObject:
                        options.isGuideObject,
                }
            );

        return render({
            ...options,
            source: sourceCanvas,
        });
    }

    return {
        normalizeConfig,
        getPrintSpec,
        getView,
        loadImage,
        clearImageCache,
        createSourceCanvasFromFabric,
        render,
        renderFromCanvas,
        renderFromDataURL,
        renderFromFabric,
    };
})();

window.ProductPreview = ProductPreview;