/**
 * shared/js/productPreview.js
 *
 * Gedeelde, niet-bewerkbare productpreview-engine voor admin en customerflow.
 * De engine verandert het actieve Fabric-canvas nooit en wordt niet gebruikt
 * voor de productie-export.
 */

const ProductPreview = (() => {
    const DEFAULT_CANVAS_WIDTH = 720;
    const DEFAULT_CANVAS_HEIGHT = 480;
    const MIN_CANVAS_WIDTH = 240;
    const MIN_CANVAS_HEIGHT = 180;
    const MAX_CANVAS_HEIGHT = 720;

    const FABRIC_CLONE_PROPERTIES = [
        '_layerId',
        '_uploadMeta',
        '_isGuide',
        '_isBlockedZone',
        '_isMargin',
        '_isPreviewGuide',
        '_isCenterGuide',
    ];

    const PREVIEW_TYPES = new Set([
        'single-view',
        'two-sided-toggle',
        'multi-view-toggle',
    ]);

    const SLOT_FITS = new Set([
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

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function normalizeRotation(value) {
        const rotation = finiteNumber(value, 0);

        return ((rotation % 360) + 360) % 360;
    }

    function normalizeFile(file) {
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
            size: Math.max(
                0,
                finiteNumber(file.size, 0)
            ),
            dataURL,
        };
    }

    function normalizeSourceZone(
        sourceZone = {},
        spec = {}
    ) {
        return {
            x_mm: finiteNumber(
                sourceZone.x_mm,
                0
            ),

            y_mm: finiteNumber(
                sourceZone.y_mm,
                0
            ),

            width_mm: positiveNumber(
                sourceZone.width_mm,
                positiveNumber(
                    spec.finishWidthMm,
                    100
                )
            ),

            height_mm: positiveNumber(
                sourceZone.height_mm,
                positiveNumber(
                    spec.finishHeightMm,
                    70
                )
            ),

            rotation: normalizeRotation(
                sourceZone.rotation
            ),

            flipX: Boolean(
                sourceZone.flipX
            ),

            flipY: Boolean(
                sourceZone.flipY
            ),
        };
    }

    function normalizeSlot(slot = {}) {
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

            rotation: finiteNumber(
                slot.rotation,
                0
            ),

            borderRadius: clamp(
                finiteNumber(slot.borderRadius, 0),
                0,
                50
            ),

            fit: SLOT_FITS.has(slot.fit)
                ? slot.fit
                : 'cover',
        };
    }

    function normalizeView(
        view = {},
        index = 0,
        spec = {}
    ) {
        return {
            id: String(
                view.id ||
                `view-${index + 1}`
            ),

            label: String(
                view.label ||
                `Weergave ${index + 1}`
            ),

            helpText: String(
                view.helpText ||
                ''
            ),

            sourceZone: normalizeSourceZone(
                view.sourceZone,
                spec
            ),

            mockup: {
                baseImage: normalizeFile(
                    view.mockup?.baseImage
                ),

                overlayImage: normalizeFile(
                    view.mockup?.overlayImage
                ),

                slot: normalizeSlot(
                    view.mockup?.slot
                ),
            },
        };
    }

    function normalizeCanvasGuide(
        guide = {},
        index = 0
    ) {
        if (guide.type === 'line') {
            return {
                id: String(
                    guide.id ||
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

                x1_mm: finiteNumber(
                    guide.x1_mm,
                    0
                ),

                y1_mm: finiteNumber(
                    guide.y1_mm,
                    0
                ),

                x2_mm: finiteNumber(
                    guide.x2_mm,
                    0
                ),

                y2_mm: finiteNumber(
                    guide.y2_mm,
                    0
                ),
            };
        }

        return {
            id: String(
                guide.id ||
                `guide-label-${index + 1}`
            ),

            type: 'label',

            viewId: guide.viewId
                ? String(guide.viewId)
                : null,

            label: String(
                guide.label ||
                'Gebied'
            ),

            description: String(
                guide.description ||
                ''
            ),

            x_mm: finiteNumber(
                guide.x_mm,
                0
            ),

            y_mm: finiteNumber(
                guide.y_mm,
                0
            ),

            width_mm: Math.max(
                0,
                finiteNumber(
                    guide.width_mm,
                    0
                )
            ),

            height_mm: Math.max(
                0,
                finiteNumber(
                    guide.height_mm,
                    0
                )
            ),
        };
    }

    function getPrintSpec(
        personalisationType = {},
        product = {}
    ) {
        if (
            window.PrintSpecs
                ?.normalizePrintSpec
        ) {
            return PrintSpecs.normalizePrintSpec(
                personalisationType,
                product
            );
        }

        const finishWidthMm = positiveNumber(
            personalisationType.finish_width_mm ||
            personalisationType.width_mm ||
            product.finish_width_mm ||
            product.width_mm,
            100
        );

        const finishHeightMm = positiveNumber(
            personalisationType.finish_height_mm ||
            personalisationType.height_mm ||
            product.finish_height_mm ||
            product.height_mm,
            70
        );

        const bleedMm = Math.max(
            0,
            finiteNumber(
                personalisationType.bleed_mm ??
                product.bleed_mm,
                3
            )
        );

        const exportWidthMm = positiveNumber(
            personalisationType.export_width_mm ||
            product.export_width_mm,
            finishWidthMm + bleedMm * 2
        );

        const exportHeightMm = positiveNumber(
            personalisationType.export_height_mm ||
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
                (
                    exportWidthMm -
                    finishWidthMm
                ) / 2
            ),

            trimYmm: Math.max(
                0,
                (
                    exportHeightMm -
                    finishHeightMm
                ) / 2
            ),
        };
    }

    function normalizeConfig(
        personalisationType = {},
        product = {}
    ) {
        const rawPreview =
            personalisationType.preview ||
            {};

        const spec = getPrintSpec(
            personalisationType,
            product
        );

        const views = Array.isArray(
            rawPreview.views
        )
            ? rawPreview.views.map(
                (view, index) => normalizeView(
                    view,
                    index,
                    spec
                )
            )
            : [];

        const defaultViewId = views.some(
            view =>
                view.id ===
                rawPreview.defaultViewId
        )
            ? rawPreview.defaultViewId
            : views[0]?.id || null;

        return {
            enabled:
                rawPreview.enabled === true &&
                views.length > 0,

            type: PREVIEW_TYPES.has(
                rawPreview.type
            )
                ? rawPreview.type
                : views.length > 1
                    ? 'two-sided-toggle'
                    : 'single-view',

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

    function getView(
        config,
        viewId = null
    ) {
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
                view =>
                    view.id ===
                    config.defaultViewId
            ) ||
            config.views[0];
    }

    function getImageSource(
        fileOrDataURL
    ) {
        if (
            typeof fileOrDataURL ===
            'string'
        ) {
            return fileOrDataURL;
        }

        return fileOrDataURL?.dataURL ||
            fileOrDataURL?.url ||
            fileOrDataURL?.src ||
            '';
    }

    function loadImage(
        fileOrDataURL
    ) {
        const src = getImageSource(
            fileOrDataURL
        );

        if (!src) {
            return Promise.resolve(null);
        }

        if (imageCache.has(src)) {
            return imageCache.get(src);
        }

        const imagePromise =
            new Promise(
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
                        image.crossOrigin =
                            'anonymous';
                    }

                    image.src = src;
                }
            );

        imageCache.set(
            src,
            imagePromise
        );

        return imagePromise;
    }

    function createCanvas(
        width,
        height
    ) {
        const canvas =
            document.createElement(
                'canvas'
            );

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

    function getSourceDimensions(
        source
    ) {
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
        const rotation =
            normalizeRotation(
                sourceZone.rotation
            );

        const swapsDimensions =
            rotation === 90 ||
            rotation === 270;

        const transformed =
            createCanvas(
                swapsDimensions
                    ? sourceCanvas.height
                    : sourceCanvas.width,

                swapsDimensions
                    ? sourceCanvas.width
                    : sourceCanvas.height
            );

        const context =
            transformed.getContext('2d');

        context.imageSmoothingEnabled =
            true;

        context.imageSmoothingQuality =
            'high';

        context.save();

        context.translate(
            transformed.width / 2,
            transformed.height / 2
        );

        context.rotate(
            rotation *
            Math.PI /
            180
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

        return transformed;
    }

    function cropSourceZone(
        source,
        sourceZone,
        spec
    ) {
        const dimensions =
            getSourceDimensions(source);

        if (
            !dimensions.width ||
            !dimensions.height
        ) {
            return null;
        }

        const exportWidthMm =
            positiveNumber(
                spec.exportWidthMm,
                positiveNumber(
                    spec.finishWidthMm,
                    100
                )
            );

        const exportHeightMm =
            positiveNumber(
                spec.exportHeightMm,
                positiveNumber(
                    spec.finishHeightMm,
                    70
                )
            );

        const trimXmm =
            finiteNumber(
                spec.trimXmm,
                0
            );

        const trimYmm =
            finiteNumber(
                spec.trimYmm,
                0
            );

        const sourceX = (
            (
                trimXmm +
                sourceZone.x_mm
            ) /
            exportWidthMm
        ) * dimensions.width;

        const sourceY = (
            (
                trimYmm +
                sourceZone.y_mm
            ) /
            exportHeightMm
        ) * dimensions.height;

        const sourceWidth = (
            sourceZone.width_mm /
            exportWidthMm
        ) * dimensions.width;

        const sourceHeight = (
            sourceZone.height_mm /
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

        const croppedCanvas =
            createCanvas(
                right - left,
                bottom - top
            );

        const context =
            croppedCanvas.getContext('2d');

        context.imageSmoothingEnabled =
            true;

        context.imageSmoothingQuality =
            'high';

        context.drawImage(
            source,
            left,
            top,
            right - left,
            bottom - top,
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
            Math.min(
                width,
                height
            ) / 2
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

        const scale =
            fit === 'contain'
                ? Math.min(
                    targetWidth /
                    sourceWidth,

                    targetHeight /
                    sourceHeight
                )
                : Math.max(
                    targetWidth /
                    sourceWidth,

                    targetHeight /
                    sourceHeight
                );

        const width =
            sourceWidth * scale;

        const height =
            sourceHeight * scale;

        return {
            x:
                (
                    targetWidth -
                    width
                ) / 2,

            y:
                (
                    targetHeight -
                    height
                ) / 2,

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

        const fittedRect =
            getFittedRect(
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
            slotX +
            slotWidth / 2,

            slotY +
            slotHeight / 2
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

            -slotWidth / 2 +
            fittedRect.x,

            -slotHeight / 2 +
            fittedRect.y,

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
        context.fillStyle =
            '#F7F4EE';

        context.fillRect(
            0,
            0,
            width,
            height
        );

        const inset =
            Math.round(
                Math.min(
                    width,
                    height
                ) * 0.055
            );

        const radius =
            Math.round(
                Math.min(
                    width,
                    height
                ) * 0.04
            );

        context.fillStyle =
            '#FFFFFF';

        context.strokeStyle =
            '#DDD8CC';

        context.lineWidth =
            Math.max(
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
        requestedWidth
    ) {
        let width = Math.max(
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

        let height =
            DEFAULT_CANVAS_HEIGHT;

        if (
            baseWidth > 0 &&
            baseHeight > 0
        ) {
            height = Math.round(
                width *
                baseHeight /
                baseWidth
            );
        }

        if (
            height >
            MAX_CANVAS_HEIGHT
        ) {
            const scale =
                MAX_CANVAS_HEIGHT /
                height;

            width = Math.max(
                MIN_CANVAS_WIDTH,

                Math.round(
                    width * scale
                )
            );

            height =
                MAX_CANVAS_HEIGHT;
        }

        targetCanvas.width =
            width;

        targetCanvas.height =
            Math.max(
                MIN_CANVAS_HEIGHT,
                height
            );
    }

    function isTechnicalGuide(
        object,
        customPredicate
    ) {
        return Boolean(
            object?._isGuide ||
            object?._isBlockedZone ||
            object?._isMargin ||
            object?._isPreviewGuide ||
            object?._isCenterGuide ||
            customPredicate?.(object)
        );
    }

    function createSourceCanvasFromFabric(
        fabricCanvas,
        options = {}
    ) {
        if (
            !fabricCanvas ||
            typeof fabricCanvas.clone !==
            'function'
        ) {
            return Promise.resolve(null);
        }

        return new Promise(
            (resolve, reject) => {
                try {
                    fabricCanvas.clone(
                        clonedCanvas => {
                            if (!clonedCanvas) {
                                reject(
                                    new Error(
                                        'Fabric-canvas kon niet worden gekloond.'
                                    )
                                );

                                return;
                            }

                            try {
                                clonedCanvas
                                    .getObjects()
                                    .filter(
                                        object =>
                                            isTechnicalGuide(
                                                object,
                                                options.isGuideObject
                                            )
                                    )
                                    .forEach(
                                        object =>
                                            clonedCanvas.remove(
                                                object
                                            )
                                    );

                                clonedCanvas.backgroundImage =
                                    null;

                                clonedCanvas.backgroundColor =
                                    fabricCanvas.backgroundColor ||
                                    '#FFFFFF';

                                clonedCanvas.setDimensions({
                                    width:
                                        fabricCanvas.getWidth(),

                                    height:
                                        fabricCanvas.getHeight(),
                                });

                                clonedCanvas.setViewportTransform(
                                    [1, 0, 0, 1, 0, 0]
                                );

                                clonedCanvas.discardActiveObject();
                                clonedCanvas.renderAll();

                                const sourceCanvas =
                                    createCanvas(
                                        fabricCanvas.getWidth(),
                                        fabricCanvas.getHeight()
                                    );

                                sourceCanvas
                                    .getContext('2d')
                                    .drawImage(
                                        clonedCanvas.lowerCanvasEl,
                                        0,
                                        0,
                                        sourceCanvas.width,
                                        sourceCanvas.height
                                    );

                                clonedCanvas.dispose();

                                resolve(sourceCanvas);
                            } catch (error) {
                                clonedCanvas.dispose();
                                reject(error);
                            }
                        },

                        FABRIC_CLONE_PROPERTIES
                    );
                } catch (error) {
                    reject(error);
                }
            }
        );
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

        const config =
            normalizeConfig(
                personalisationType,
                product
            );

        const view =
            getView(
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

        context.imageSmoothingEnabled =
            true;

        context.imageSmoothingQuality =
            'high';

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

        const spec =
            getPrintSpec(
                personalisationType,
                product
            );

        const croppedSource =
            source
                ? cropSourceZone(
                    source,
                    view.sourceZone,
                    spec
                )
                : null;

        const hasArtwork =
            drawSlot(
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

    function renderFromCanvas(
        options = {}
    ) {
        return render({
            ...options,
            source:
                options.sourceCanvas ||
                null,
        });
    }

    async function renderFromDataURL(
        options = {}
    ) {
        const sourceImage =
            options.sourceDataURL
                ? await loadImage(
                    options.sourceDataURL
                )
                : null;

        return render({
            ...options,
            source: sourceImage,
        });
    }

    async function renderFromFabric(
        options = {}
    ) {
        const sourceCanvas =
            await createSourceCanvasFromFabric(
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
        createSourceCanvasFromFabric,
        render,
        renderFromCanvas,
        renderFromDataURL,
        renderFromFabric,
    };
})();

window.ProductPreview =
    ProductPreview;