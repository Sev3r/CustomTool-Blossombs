/**
 * customer/liveProductPreview.js
 *
 * Integreert de gedeelde ProductPreview-engine met de bestaande customerflow.
 *
 * Dit bestand blijft bewust los van step3-design.js, zodat de bestaande
 * Fabric-, autosave-, upload- en productie-exportflow ongewijzigd blijft.
 */

(() => {
    'use strict';

    const DESIGN_STATE_KEY = 'cot_design_state';
    const RENDER_THROTTLE_MS = 70;
    const MAX_RENDER_WIDTH = 720;

    let state = null;
    let activeViewId = null;
    let resizeObserver = null;
    let windowResizeHandler = null;
    let pageAbortController = null;
    let connectedFabricCanvas = null;

    const renderTimers = {
        tool: null,
        upload: null,
    };

    const renderTokens = {
        tool: 0,
        upload: 0,
    };

    function initialize() {
        if (!validateDependencies()) {
            return;
        }

        decorateSessionDesignStorage();
        decorateDesignPageRenderer();
        decorateFabricInitializer();
        decorateGuideRenderer();
        decorateBackgroundLoader();
    }

    function validateDependencies() {
        const missing = [];

        if (!window.ProductPreview) {
            missing.push('ProductPreview');
        }

        if (!window.Session) {
            missing.push('Session');
        }

        if (typeof window.renderDesignPage !== 'function') {
            missing.push('renderDesignPage');
        }

        if (typeof window.initFabricTool !== 'function') {
            missing.push('initFabricTool');
        }

        if (typeof window.redrawGuides !== 'function') {
            missing.push('redrawGuides');
        }

        if (missing.length) {
            console.error(
                `Live productpreview niet gestart. Ontbrekend: ${missing.join(', ')}.`
            );

            return false;
        }

        return true;
    }

    function decorateSessionDesignStorage() {
        if (
            !window.Session ||
            Session._liveProductPreviewSetDesignDecorated
        ) {
            return;
        }

        const originalSetDesign = Session.setDesign.bind(Session);

        Session.setDesign = design => {
            const nextDesign =
                design &&
                    typeof design === 'object' &&
                    activeViewId
                    ? {
                        ...design,
                        previewViewId:
                            design.previewViewId ||
                            activeViewId,
                    }
                    : design;

            return originalSetDesign(nextDesign);
        };

        Session._liveProductPreviewSetDesignDecorated = true;
    }

    function decorateDesignPageRenderer() {
        if (
            typeof window.renderDesignPage !== 'function' ||
            window.renderDesignPage._liveProductPreviewDecorated
        ) {
            return;
        }

        const originalRenderDesignPage =
            window.renderDesignPage;

        const decoratedRenderDesignPage =
            function decoratedRenderDesignPage(...args) {
                const result = originalRenderDesignPage.apply(
                    this,
                    args
                );

                mount();

                return result;
            };

        decoratedRenderDesignPage._liveProductPreviewDecorated =
            true;

        decoratedRenderDesignPage._original =
            originalRenderDesignPage;

        window.renderDesignPage =
            decoratedRenderDesignPage;
    }

    function decorateFabricInitializer() {
        if (
            typeof window.initFabricTool !== 'function' ||
            window.initFabricTool._liveProductPreviewDecorated
        ) {
            return;
        }

        const originalInitFabricTool =
            window.initFabricTool;

        const decoratedInitFabricTool =
            function decoratedInitFabricTool(...args) {
                const result = originalInitFabricTool.apply(
                    this,
                    args
                );

                requestAnimationFrame(() => {
                    connectFabricCanvas();
                    scheduleRender('tool', true);
                });

                window.setTimeout(() => {
                    connectFabricCanvas();
                    scheduleRender('tool', true);
                }, 160);

                return result;
            };

        decoratedInitFabricTool._liveProductPreviewDecorated =
            true;

        decoratedInitFabricTool._original =
            originalInitFabricTool;

        window.initFabricTool =
            decoratedInitFabricTool;
    }

    function decorateGuideRenderer() {
        if (
            typeof window.redrawGuides !== 'function' ||
            window.redrawGuides._liveProductPreviewDecorated
        ) {
            return;
        }

        const originalRedrawGuides =
            window.redrawGuides;

        const decoratedRedrawGuides =
            function decoratedRedrawGuides(
                canvas,
                activePers,
                product,
                margin,
                canvasWidth,
                canvasHeight,
                isWarning = false
            ) {
                const result = originalRedrawGuides.call(
                    this,
                    canvas,
                    activePers,
                    product,
                    margin,
                    canvasWidth,
                    canvasHeight,
                    isWarning
                );

                drawPreviewGuides(
                    canvas,
                    activePers,
                    product,
                    canvasWidth,
                    canvasHeight
                );

                return result;
            };

        decoratedRedrawGuides._liveProductPreviewDecorated =
            true;

        decoratedRedrawGuides._original =
            originalRedrawGuides;

        window.redrawGuides =
            decoratedRedrawGuides;
    }

    function decorateBackgroundLoader() {
        if (
            typeof window.loadBackgroundImage !== 'function' ||
            window.loadBackgroundImage._liveProductPreviewDecorated
        ) {
            return;
        }

        const originalLoadBackgroundImage =
            window.loadBackgroundImage;

        const decoratedLoadBackgroundImage =
            function decoratedLoadBackgroundImage(...args) {
                const result = originalLoadBackgroundImage.apply(
                    this,
                    args
                );

                window.setTimeout(
                    () => scheduleRender('tool', true),
                    80
                );

                window.setTimeout(
                    () => scheduleRender('tool', true),
                    320
                );

                return result;
            };

        decoratedLoadBackgroundImage._liveProductPreviewDecorated =
            true;

        decoratedLoadBackgroundImage._original =
            originalLoadBackgroundImage;

        window.loadBackgroundImage =
            decoratedLoadBackgroundImage;
    }

    function mount() {
        cleanupMountedState();

        const resolvedState = resolveState();

        if (!resolvedState?.config.enabled) {
            state = resolvedState;
            activeViewId = null;
            return;
        }

        state = resolvedState;
        activeViewId = resolveActiveViewId(
            resolvedState
        );

        injectToolPreview();
        injectUploadPreview();
        bindViewControls();
        bindPageEvents();
        observePreviewStages();
        connectFabricCanvas();
        syncPanels();

        scheduleRender('tool', true);
        scheduleRender('upload', true);
    }

    function cleanupMountedState() {
        pageAbortController?.abort();
        pageAbortController = null;

        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }

        if (windowResizeHandler) {
            window.removeEventListener(
                'resize',
                windowResizeHandler
            );

            windowResizeHandler = null;
        }

        Object.keys(renderTimers).forEach(context => {
            if (renderTimers[context]) {
                clearTimeout(renderTimers[context]);
                renderTimers[context] = null;
            }

            renderTokens[context] += 1;
        });
    }

    function resolveState() {
        const product = Session.getProduct();
        const options = Session.getOptions();

        if (
            !product ||
            !options ||
            !window.ProductPreview
        ) {
            return null;
        }

        const personalisationTypes =
            Array.isArray(product.personalisatieTypes)
                ? product.personalisatieTypes.filter(
                    type => type.active !== false
                )
                : [];

        const activePers =
            personalisationTypes.find(
                type => type.id === options.persTypeId
            ) ||
            options.persType ||
            personalisationTypes[0] ||
            null;

        const config =
            ProductPreview.normalizeConfig(
                activePers || {},
                product || {}
            );

        const normalizedConfig = {
            ...config,
            enabled:
                config.enabled === true &&
                config.views.length > 0,
        };

        return {
            product,
            activePers,
            config: normalizedConfig,
            stateKey:
                `${DESIGN_STATE_KEY}_${product.id}_${activePers?.id || 'standaard'}`,
        };
    }

    function resolveActiveViewId(resolvedState) {
        const design = Session.getDesign() || {};
        const localState = readLocalDesignState(
            resolvedState.stateKey
        );

        const storedViewId =
            design.previewViewId ||
            localState.previewViewId ||
            null;

        if (
            resolvedState.config.views.some(
                view => view.id === storedViewId
            )
        ) {
            return storedViewId;
        }

        return (
            resolvedState.config.defaultViewId ||
            resolvedState.config.views[0]?.id ||
            null
        );
    }

    function readLocalDesignState(stateKey) {
        if (!stateKey) {
            return {};
        }

        try {
            const value = JSON.parse(
                localStorage.getItem(stateKey) ||
                '{}'
            );

            return value &&
                typeof value === 'object'
                ? value
                : {};
        } catch {
            return {};
        }
    }

    function persistActiveView() {
        if (
            !state?.stateKey ||
            !activeViewId
        ) {
            return;
        }

        try {
            const current = readLocalDesignState(
                state.stateKey
            );

            localStorage.setItem(
                state.stateKey,
                JSON.stringify({
                    ...current,
                    previewViewId: activeViewId,
                    savedAt: Date.now(),
                })
            );
        } catch (error) {
            console.warn(
                'Productpreviewweergave opslaan mislukt',
                error
            );
        }
    }

    function injectToolPreview() {
        const layerPanel =
            document.getElementById('layer-panel');

        if (
            !layerPanel ||
            layerPanel.querySelector(
                '[data-product-preview-context="tool"]'
            )
        ) {
            return;
        }

        layerPanel.insertAdjacentHTML(
            'afterbegin',
            renderPanel('tool', {
                compact: true,
                title: 'Live weergave',
            })
        );
    }

    function injectUploadPreview() {
        const uploadTab =
            document.getElementById('tab-upload');

        const uploadColumn =
            uploadTab?.querySelector(
                '.design-layout > div:last-child'
            );

        if (
            !uploadColumn ||
            uploadColumn.querySelector(
                '[data-product-preview-context="upload"]'
            )
        ) {
            return;
        }

        uploadColumn.classList.add(
            'upload-preview-column',
            'has-product-preview'
        );

        const legacyPreviewBox =
            uploadColumn.querySelector('.preview-box');

        const legacyCaption =
            legacyPreviewBox?.nextElementSibling;

        if (legacyPreviewBox) {
            legacyPreviewBox.hidden = true;
        }

        if (
            legacyCaption?.tagName === 'P'
        ) {
            legacyCaption.hidden = true;
        }

        uploadColumn.insertAdjacentHTML(
            'afterbegin',
            renderPanel('upload', {
                title: 'Weergave op het product',
            })
        );

        if (getUploadedDataURL()) {
            uploadColumn.insertAdjacentHTML(
                'beforeend',
                `
          <button
            class="btn btn-outline btn-upload-source"
            type="button"
            id="btn-product-preview-source"
          >
            Origineel bestand bekijken
          </button>
        `
            );
        }
    }

    function renderPanel(context, options = {}) {
        const view = ProductPreview.getView(
            state.config,
            activeViewId
        );

        const compactClass = options.compact
            ? ' product-preview-panel-compact'
            : '';

        const canvasId =
            `${context}-product-preview-canvas`;

        const titleId =
            `${context}-product-preview-title`;

        return `
      <section
        class="product-preview-panel${compactClass}"
        data-product-preview-context="${context}"
        aria-labelledby="${titleId}"
      >
        <div class="product-preview-header">
          <div>
            <div class="product-preview-eyebrow">
              Productvoorbeeld
            </div>

            <strong id="${titleId}">
              ${escapeHtml(options.title || 'Productvoorbeeld')}
            </strong>
          </div>

          <span
            class="product-preview-live-indicator"
            aria-hidden="true"
          ></span>
        </div>

        ${state.config.views.length > 1
                ? renderTabs(context, canvasId)
                : ''}

        <div
          class="product-preview-stage"
          id="${context}-product-preview-stage"
        >
          <canvas
            id="${canvasId}"
            class="product-preview-canvas"
            role="img"
            aria-label="${escapeHtml(view?.label || 'Productvoorbeeld')}"
          ></canvas>

          <div
            class="product-preview-loading"
            id="${context}-product-preview-loading"
            hidden
          >
            Voorbeeld bijwerken…
          </div>
        </div>

        <p
          class="product-preview-help"
          id="${context}-product-preview-help"
        >
          ${escapeHtml(
                    view?.helpText ||
                    'Deze preview is een visuele indicatie van het eindproduct.'
                )}
        </p>

        <p
          class="product-preview-status"
          id="${context}-product-preview-status"
          aria-live="polite"
        ></p>
      </section>
    `;
    }

    function renderTabs(context, canvasId) {
        return `
      <div
        class="product-preview-tabs"
        role="tablist"
        aria-label="Productzijde kiezen"
      >
        ${state.config.views.map(view => {
            const isActive =
                view.id === activeViewId;

            return `
            <button
              class="product-preview-tab${isActive ? ' active' : ''}"
              type="button"
              role="tab"
              aria-selected="${isActive ? 'true' : 'false'}"
              aria-controls="${canvasId}"
              tabindex="${isActive ? '0' : '-1'}"
              data-product-preview-context-tab="${context}"
              data-product-preview-view-id="${escapeHtml(view.id)}"
            >
              ${escapeHtml(view.label)}
            </button>
          `;
        }).join('')}
      </div>
    `;
    }

    function bindViewControls() {
        document
            .querySelectorAll(
                '[data-product-preview-view-id]'
            )
            .forEach(button => {
                button.addEventListener('click', () => {
                    const nextViewId =
                        button.dataset.productPreviewViewId;

                    if (
                        !state.config.views.some(
                            view => view.id === nextViewId
                        )
                    ) {
                        return;
                    }

                    activeViewId = nextViewId;

                    persistActiveView();
                    syncPanels();
                    scheduleRender('tool', true);
                    scheduleRender('upload', true);
                });
            });
    }

    function bindPageEvents() {
        const page =
            document.getElementById('page-design');

        if (!page) {
            return;
        }

        pageAbortController =
            new AbortController();

        const { signal } =
            pageAbortController;

        page.addEventListener(
            'input',
            event => {
                if (
                    isPreviewRelevantControl(
                        event.target
                    )
                ) {
                    requestAnimationFrame(
                        () => scheduleRender('tool')
                    );
                }
            },
            { signal }
        );

        page.addEventListener(
            'change',
            event => {
                if (
                    isPreviewRelevantControl(
                        event.target
                    )
                ) {
                    requestAnimationFrame(
                        () => scheduleRender('tool')
                    );
                }
            },
            { signal }
        );

        page.addEventListener(
            'click',
            event => {
                const button =
                    event.target.closest('button');

                if (!button) {
                    return;
                }

                if (
                    button.id ===
                    'btn-product-preview-source'
                ) {
                    const source =
                        getUploadedDataURL();

                    if (source) {
                        window.open(
                            source,
                            '_blank',
                            'noopener'
                        );
                    }

                    return;
                }

                if (
                    isPreviewRelevantButton(
                        button.id
                    )
                ) {
                    window.setTimeout(
                        () => scheduleRender(
                            'tool',
                            true
                        ),
                        0
                    );
                }
            },
            { signal }
        );
    }

    function isPreviewRelevantControl(element) {
        return Boolean(
            element?.matches?.([
                '#font-select',
                '#font-size',
                '#custom-element-color',
                '#custom-background-color',
            ].join(','))
        );
    }

    function isPreviewRelevantButton(buttonId) {
        return [
            'btn-text',
            'btn-delete',
            'btn-front',
            'btn-back',
            'btn-undo',
            'btn-clear',
        ].includes(buttonId);
    }

    function observePreviewStages() {
        const stages = [
            ...document.querySelectorAll(
                '.product-preview-stage'
            ),
        ];

        if (!stages.length) {
            return;
        }

        if (
            typeof ResizeObserver === 'function'
        ) {
            resizeObserver =
                new ResizeObserver(entries => {
                    entries.forEach(entry => {
                        const context =
                            entry.target
                                .closest(
                                    '[data-product-preview-context]'
                                )
                                ?.dataset
                                .productPreviewContext;

                        if (
                            context === 'tool' ||
                            context === 'upload'
                        ) {
                            scheduleRender(context);
                        }
                    });
                });

            stages.forEach(stage => {
                resizeObserver.observe(stage);
            });

            return;
        }

        windowResizeHandler = () => {
            scheduleRender('tool');
            scheduleRender('upload');
        };

        window.addEventListener(
            'resize',
            windowResizeHandler
        );
    }

    function connectFabricCanvas() {
        const canvas = getFabricCanvas();

        if (!canvas) {
            return;
        }

        if (
            canvas === connectedFabricCanvas &&
            canvas._liveProductPreviewBound
        ) {
            return;
        }

        connectedFabricCanvas = canvas;

        if (canvas._liveProductPreviewBound) {
            return;
        }

        const schedule = () => {
            scheduleRender('tool');
        };

        const scheduleImmediate = () => {
            scheduleRender('tool', true);
        };

        canvas.on(
            'object:moving',
            schedule
        );

        canvas.on(
            'object:rotating',
            schedule
        );

        canvas.on(
            'object:scaling',
            schedule
        );

        canvas.on(
            'text:changed',
            schedule
        );

        canvas.on(
            'object:modified',
            scheduleImmediate
        );

        canvas.on(
            'object:moved',
            scheduleImmediate
        );

        canvas.on(
            'object:added',
            event => {
                if (
                    !isTechnicalGuide(
                        event.target
                    )
                ) {
                    schedule();
                }
            }
        );

        canvas.on(
            'object:removed',
            event => {
                if (
                    !isTechnicalGuide(
                        event.target
                    )
                ) {
                    schedule();
                }
            }
        );

        canvas._liveProductPreviewBound = true;
    }

    function getFabricCanvas() {
        try {
            return typeof fabricCanvas !== 'undefined'
                ? fabricCanvas
                : null;
        } catch {
            return null;
        }
    }

    function getUploadedDataURL() {
        try {
            if (
                typeof uploadedDataURL !== 'undefined' &&
                uploadedDataURL
            ) {
                return uploadedDataURL;
            }
        } catch {
            // De fallback hieronder gebruikt de sessie.
        }

        const design = Session.getDesign();

        return design?.source === 'upload'
            ? design.dataURL || null
            : null;
    }

    function isTechnicalGuide(object) {
        if (
            typeof window.isGuideObject === 'function'
        ) {
            return window.isGuideObject(object);
        }

        return Boolean(
            object?._isGuide ||
            object?._isBlockedZone ||
            object?._isMargin ||
            object?._isPreviewGuide ||
            object?._isCenterGuide
        );
    }

    function scheduleRender(
        context,
        immediate = false
    ) {
        if (
            !state?.config.enabled ||
            !document.getElementById(
                `${context}-product-preview-canvas`
            )
        ) {
            return;
        }

        if (renderTimers[context]) {
            clearTimeout(
                renderTimers[context]
            );

            renderTimers[context] = null;
        }

        const execute = () => {
            renderTimers[context] = null;

            requestAnimationFrame(
                () => renderTarget(context)
            );
        };

        if (immediate) {
            execute();
            return;
        }

        renderTimers[context] =
            window.setTimeout(
                execute,
                RENDER_THROTTLE_MS
            );
    }

    async function renderTarget(context) {
        const targetCanvas =
            document.getElementById(
                `${context}-product-preview-canvas`
            );

        if (
            !targetCanvas ||
            !state?.config.enabled
        ) {
            return;
        }

        const token =
            ++renderTokens[context];

        const stagingCanvas =
            document.createElement('canvas');

        const width =
            getRenderWidth(context);

        setLoading(context, true);

        try {
            let result;

            if (context === 'tool') {
                const canvas =
                    getFabricCanvas();

                if (!canvas) {
                    setStatus(
                        context,
                        'De ontwerptool wordt geladen.'
                    );

                    return;
                }

                result =
                    await ProductPreview.renderFromFabric({
                        fabricCanvas: canvas,
                        targetCanvas: stagingCanvas,
                        product: state.product,
                        personalisationType:
                            state.activePers,
                        viewId: activeViewId,
                        width,
                        isGuideObject:
                            isTechnicalGuide,
                    });
            } else {
                const sourceDataURL =
                    getUploadedDataURL();

                result =
                    isRasterDataURL(sourceDataURL)
                        ? await ProductPreview.renderFromDataURL({
                            sourceDataURL,
                            targetCanvas: stagingCanvas,
                            product: state.product,
                            personalisationType:
                                state.activePers,
                            viewId: activeViewId,
                            width,
                        })
                        : await ProductPreview.renderFromCanvas({
                            sourceCanvas: null,
                            targetCanvas: stagingCanvas,
                            product: state.product,
                            personalisationType:
                                state.activePers,
                            viewId: activeViewId,
                            width,
                        });
            }

            if (
                token !==
                renderTokens[context]
            ) {
                return;
            }

            copyCanvas(
                stagingCanvas,
                targetCanvas
            );

            if (!result?.hasBaseImage) {
                setStatus(
                    context,
                    'Voor deze zijde ontbreekt een mockupafbeelding.',
                    true
                );

                return;
            }

            if (context === 'upload') {
                const sourceDataURL =
                    getUploadedDataURL();

                if (!sourceDataURL) {
                    setStatus(
                        context,
                        'Upload een bestand om het ontwerp op het product te zien.'
                    );

                    return;
                }

                if (
                    !isRasterDataURL(
                        sourceDataURL
                    )
                ) {
                    setStatus(
                        context,
                        'De productpreview van PDF-, AI- en EPS-bestanden wordt na de technische controle beschikbaar.'
                    );

                    return;
                }
            }

            setStatus(
                context,
                result?.hasArtwork
                    ? 'Voorbeeld bijgewerkt.'
                    : 'Er is nog geen ontwerp om te tonen.'
            );
        } catch (error) {
            console.warn(
                'Productpreview renderen mislukt',
                error
            );

            if (
                token ===
                renderTokens[context]
            ) {
                setStatus(
                    context,
                    'De productpreview kon niet worden geladen.',
                    true
                );
            }
        } finally {
            if (
                token ===
                renderTokens[context]
            ) {
                setLoading(
                    context,
                    false
                );
            }
        }
    }

    function getRenderWidth(context) {
        const stage =
            document.getElementById(
                `${context}-product-preview-stage`
            );

        const cssWidth = Math.max(
            240,
            stage?.clientWidth || 320
        );

        const pixelRatio = Math.min(
            2,
            Math.max(
                1,
                window.devicePixelRatio || 1
            )
        );

        return Math.min(
            MAX_RENDER_WIDTH,
            Math.round(
                cssWidth * pixelRatio
            )
        );
    }

    function copyCanvas(
        sourceCanvas,
        targetCanvas
    ) {
        targetCanvas.width =
            sourceCanvas.width;

        targetCanvas.height =
            sourceCanvas.height;

        const context =
            targetCanvas.getContext('2d');

        context.clearRect(
            0,
            0,
            targetCanvas.width,
            targetCanvas.height
        );

        context.drawImage(
            sourceCanvas,
            0,
            0
        );
    }

    function syncPanels() {
        if (!state?.config.enabled) {
            return;
        }

        const view =
            ProductPreview.getView(
                state.config,
                activeViewId
            );

        if (!view) {
            return;
        }

        activeViewId = view.id;

        document
            .querySelectorAll(
                '[data-product-preview-view-id]'
            )
            .forEach(button => {
                const isActive =
                    button.dataset
                        .productPreviewViewId ===
                    view.id;

                button.classList.toggle(
                    'active',
                    isActive
                );

                button.setAttribute(
                    'aria-selected',
                    isActive ? 'true' : 'false'
                );

                button.setAttribute(
                    'tabindex',
                    isActive ? '0' : '-1'
                );
            });

        ['tool', 'upload'].forEach(context => {
            const canvas =
                document.getElementById(
                    `${context}-product-preview-canvas`
                );

            const help =
                document.getElementById(
                    `${context}-product-preview-help`
                );

            canvas?.setAttribute(
                'aria-label',
                view.label || 'Productvoorbeeld'
            );

            if (help) {
                help.textContent =
                    view.helpText ||
                    'Deze preview is een visuele indicatie van het eindproduct.';
            }
        });
    }

    function setLoading(
        context,
        loading
    ) {
        const panel =
            document.querySelector(
                `[data-product-preview-context="${context}"]`
            );

        const element =
            document.getElementById(
                `${context}-product-preview-loading`
            );

        panel?.classList.toggle(
            'is-loading',
            loading
        );

        if (element) {
            element.hidden = !loading;
        }
    }

    function setStatus(
        context,
        message,
        isError = false
    ) {
        const element =
            document.getElementById(
                `${context}-product-preview-status`
            );

        if (!element) {
            return;
        }

        element.textContent =
            message || '';

        element.classList.toggle(
            'is-error',
            isError
        );
    }

    function isRasterDataURL(dataURL) {
        return (
            typeof dataURL === 'string' &&
            dataURL.startsWith('data:image/')
        );
    }

    function drawPreviewGuides(
        canvas,
        activePers,
        product,
        canvasWidth,
        canvasHeight
    ) {
        if (
            !canvas ||
            !window.fabric ||
            !window.ProductPreview
        ) {
            return;
        }

        const config =
            ProductPreview.normalizeConfig(
                activePers || {},
                product || {}
            );

        if (
            !config.enabled ||
            !config.canvasGuides.length
        ) {
            return;
        }

        const spec =
            ProductPreview.getPrintSpec(
                activePers || {},
                product || {}
            );

        const toCanvasX = value => {
            if (
                window.PrintSpecs
                    ?.finishMmToCanvasX
            ) {
                return PrintSpecs.finishMmToCanvasX(
                    value,
                    spec,
                    canvasWidth
                );
            }

            return (
                (
                    spec.trimXmm +
                    Number(value || 0)
                ) /
                spec.exportWidthMm
            ) * canvasWidth;
        };

        const toCanvasY = value => {
            if (
                window.PrintSpecs
                    ?.finishMmToCanvasY
            ) {
                return PrintSpecs.finishMmToCanvasY(
                    value,
                    spec,
                    canvasHeight
                );
            }

            return (
                (
                    spec.trimYmm +
                    Number(value || 0)
                ) /
                spec.exportHeightMm
            ) * canvasHeight;
        };

        const widthToCanvas = value =>
            (
                Number(value || 0) /
                spec.exportWidthMm
            ) * canvasWidth;

        const heightToCanvas = value =>
            (
                Number(value || 0) /
                spec.exportHeightMm
            ) * canvasHeight;

        const fontSize = Math.max(
            10,
            Math.min(
                15,
                Math.round(
                    Math.min(
                        canvasWidth,
                        canvasHeight
                    ) / 34
                )
            )
        );

        const guideColor = '#2F6F62';
        const guideFill =
            'rgba(47, 111, 98, 0.08)';

        config.canvasGuides.forEach(guide => {
            if (guide.type === 'label') {
                addLabelGuide({
                    canvas,
                    guide,
                    left: toCanvasX(
                        guide.x_mm
                    ),
                    top: toCanvasY(
                        guide.y_mm
                    ),
                    width: Math.max(
                        1,
                        widthToCanvas(
                            guide.width_mm
                        )
                    ),
                    height: Math.max(
                        1,
                        heightToCanvas(
                            guide.height_mm
                        )
                    ),
                    fontSize,
                    guideColor,
                    guideFill,
                });

                return;
            }

            if (guide.type === 'line') {
                addLineGuide({
                    canvas,
                    guide,
                    x1: toCanvasX(
                        guide.x1_mm
                    ),
                    y1: toCanvasY(
                        guide.y1_mm
                    ),
                    x2: toCanvasX(
                        guide.x2_mm
                    ),
                    y2: toCanvasY(
                        guide.y2_mm
                    ),
                    fontSize,
                    guideColor,
                });
            }
        });

        canvas
            .getObjects()
            .filter(
                object =>
                    object?._isPreviewGuide
            )
            .forEach(object => {
                canvas.bringToFront(object);
            });

        canvas.renderAll();
    }

    function addLabelGuide({
        canvas,
        guide,
        left,
        top,
        width,
        height,
        fontSize,
        guideColor,
        guideFill,
    }) {
        const zone = new fabric.Rect({
            left,
            top,
            width,
            height,
            fill: guideFill,
            stroke: guideColor,
            strokeWidth: 1.5,
            strokeDashArray: [7, 5],
            selectable: false,
            evented: false,
            objectCaching: false,
            excludeFromExport: true,
            _isGuide: true,
            _isPreviewGuide: true,
            _previewGuideId: guide.id,
        });

        const labelText = [
            guide.label,
            guide.description,
        ]
            .filter(Boolean)
            .join('\n');

        const label =
            new fabric.Textbox(
                labelText,
                {
                    left:
                        left +
                        Math.min(
                            8,
                            width * 0.04
                        ),
                    top:
                        top +
                        Math.min(
                            8,
                            height * 0.04
                        ),
                    width: Math.max(
                        36,
                        width -
                        Math.min(
                            16,
                            width * 0.08
                        )
                    ),
                    fontSize,
                    fontFamily:
                        'DM Sans, sans-serif',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    fill: guideColor,
                    backgroundColor:
                        'rgba(255, 255, 255, 0.82)',
                    selectable: false,
                    evented: false,
                    objectCaching: false,
                    excludeFromExport: true,
                    _isGuide: true,
                    _isPreviewGuide: true,
                    _previewGuideId:
                        `${guide.id}-label`,
                }
            );

        canvas.add(zone);
        canvas.add(label);
    }

    function addLineGuide({
        canvas,
        guide,
        x1,
        y1,
        x2,
        y2,
        fontSize,
        guideColor,
    }) {
        const line =
            new fabric.Line(
                [x1, y1, x2, y2],
                {
                    stroke: guideColor,
                    strokeWidth: 2,
                    strokeDashArray:
                        [10, 6],
                    selectable: false,
                    evented: false,
                    objectCaching: false,
                    excludeFromExport: true,
                    _isGuide: true,
                    _isPreviewGuide: true,
                    _previewGuideId:
                        guide.id,
                }
            );

        const label =
            new fabric.Text(
                guide.label || 'Vouwlijn',
                {
                    left: (x1 + x2) / 2,
                    top: (y1 + y2) / 2,
                    originX: 'center',
                    originY: 'bottom',
                    fontSize,
                    fontFamily:
                        'DM Sans, sans-serif',
                    fontWeight: 700,
                    fill: guideColor,
                    backgroundColor:
                        'rgba(255, 255, 255, 0.88)',
                    selectable: false,
                    evented: false,
                    objectCaching: false,
                    excludeFromExport: true,
                    _isGuide: true,
                    _isPreviewGuide: true,
                    _previewGuideId:
                        `${guide.id}-label`,
                }
            );

        canvas.add(line);
        canvas.add(label);
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    initialize();
})();