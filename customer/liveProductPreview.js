/**
 * customer/liveProductPreview.js
 *
 * Koppelt de gedeelde ProductPreview-engine veilig aan de bestaande Fabric-tool.
 * De controller wijzigt het actieve Fabric-canvas niet. De preview wordt
 * bijgewerkt na inhoudswijzigingen, afgeronde transformaties en zodra een
 * element wordt gedeselecteerd.
 */

(() => {
    'use strict';

    const DESIGN_STATE_KEY = 'cot_design_state';
    const RENDER_DELAY_MS = 120;
    const FABRIC_CONNECT_RETRY_MS = 100;
    const FABRIC_CONNECT_MAX_ATTEMPTS = 50;
    const MAX_RENDER_WIDTH = 720;

    let state = null;
    let activeViewId = null;
    let mountedFabricCanvas = null;
    let fabricConnectTimer = null;
    let fabricConnectAttempts = 0;
    let resizeObserver = null;
    let pageAbortController = null;

    const renderTimers = {
        tool: null,
        upload: null,
    };

    const renderTokens = {
        tool: 0,
        upload: 0,
    };

    initialize();

    function initialize() {
        if (
            !window.ProductPreview ||
            !window.Session
        ) {
            console.error(
                'Live productpreview niet gestart: ProductPreview of Session ontbreekt.'
            );

            return;
        }

        if (
            typeof window.renderDesignPage !==
            'function'
        ) {
            console.error(
                'Live productpreview niet gestart: renderDesignPage ontbreekt.'
            );

            return;
        }

        decorateDesignPageRenderer();
    }

    function decorateDesignPageRenderer() {
        if (
            window.renderDesignPage
                ._productPreviewDecorated
        ) {
            return;
        }

        const originalRenderDesignPage =
            window.renderDesignPage;

        function decoratedRenderDesignPage(
            ...args
        ) {
            const result =
                originalRenderDesignPage.apply(
                    this,
                    args
                );

            mount();

            return result;
        }

        decoratedRenderDesignPage
            ._productPreviewDecorated =
            true;

        window.renderDesignPage =
            decoratedRenderDesignPage;
    }

    function mount() {
        cleanup();

        state = resolveState();

        if (!state?.config.enabled) {
            activeViewId = null;
            return;
        }

        activeViewId =
            resolveActiveViewId(state);

        injectToolPreview();
        injectUploadPreview();
        bindViewControls();
        bindPageControls();
        observePreviewStages();
        syncPanels();
        connectFabricCanvas();

        scheduleRender(
            'upload',
            true
        );
    }

    function cleanup() {
        pageAbortController?.abort();
        pageAbortController = null;

        resizeObserver?.disconnect();
        resizeObserver = null;

        if (fabricConnectTimer) {
            clearTimeout(
                fabricConnectTimer
            );

            fabricConnectTimer = null;
        }

        fabricConnectAttempts = 0;
        mountedFabricCanvas = null;

        Object
            .keys(renderTimers)
            .forEach(context => {
                if (renderTimers[context]) {
                    clearTimeout(
                        renderTimers[context]
                    );

                    renderTimers[context] =
                        null;
                }

                renderTokens[context] += 1;
            });
    }

    function resolveState() {
        const product =
            Session.getProduct();

        const options =
            Session.getOptions();

        if (!product || !options) {
            return null;
        }

        const personalisationTypes =
            Array.isArray(
                product.personalisatieTypes
            )
                ? product
                    .personalisatieTypes
                    .filter(
                        type =>
                            type.active !== false
                    )
                : [];

        const personalisationType =
            personalisationTypes.find(
                type =>
                    type.id ===
                    options.persTypeId
            ) ||
            options.persType ||
            personalisationTypes[0] ||
            null;

        const config =
            ProductPreview.normalizeConfig(
                personalisationType || {},
                product
            );

        return {
            product,
            personalisationType,
            config,

            stateKey:
                `${DESIGN_STATE_KEY}_${product.id}_${personalisationType?.id || 'standaard'}`,
        };
    }

    function resolveActiveViewId(
        resolvedState
    ) {
        const design =
            Session.getDesign() ||
            {};

        const savedState =
            readSavedDesignState(
                resolvedState.stateKey
            );

        const storedViewId =
            design.previewViewId ||
            savedState.previewViewId ||
            null;

        if (
            resolvedState
                .config
                .views
                .some(
                    view =>
                        view.id ===
                        storedViewId
                )
        ) {
            return storedViewId;
        }

        return resolvedState
            .config
            .defaultViewId ||
            resolvedState
                .config
                .views[0]
                ?.id ||
            null;
    }

    function readSavedDesignState(
        stateKey
    ) {
        try {
            const parsed =
                JSON.parse(
                    localStorage.getItem(
                        stateKey
                    ) ||
                    '{}'
                );

            return (
                parsed &&
                typeof parsed ===
                'object'
            )
                ? parsed
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
            const current =
                readSavedDesignState(
                    state.stateKey
                );

            localStorage.setItem(
                state.stateKey,

                JSON.stringify({
                    ...current,

                    previewViewId:
                        activeViewId,

                    savedAt:
                        Date.now(),
                })
            );
        } catch (error) {
            console.warn(
                'Previewzijde opslaan mislukt',
                error
            );
        }
    }

    function injectToolPreview() {
        const layerPanel =
            document.getElementById(
                'layer-panel'
            );

        if (!layerPanel) {
            return;
        }

        const layerHeader =
            layerPanel.querySelector(
                '#layer-header'
            );

        const layerList =
            layerPanel.querySelector(
                '#layer-list'
            );

        if (
            layerHeader &&
            layerList &&
            !layerPanel.querySelector(
                '.design-layer-section'
            )
        ) {
            const layerSection =
                document.createElement(
                    'section'
                );

            layerSection.className =
                'design-layer-section';

            layerSection.setAttribute(
                'aria-labelledby',
                'layer-header'
            );

            layerPanel.insertBefore(
                layerSection,
                layerHeader
            );

            layerSection.append(
                layerHeader,
                layerList
            );
        }

        layerPanel.insertAdjacentHTML(
            'afterbegin',
            renderPanel(
                'tool',
                'Live weergave'
            )
        );
    }

    function injectUploadPreview() {
        const uploadColumn =
            document.querySelector(
                '#tab-upload .design-layout > div:last-child'
            );

        if (!uploadColumn) {
            return;
        }

        uploadColumn.classList.add(
            'upload-preview-column'
        );

        const legacyPreviewBox =
            uploadColumn.querySelector(
                '.preview-box'
            );

        const legacyCaption =
            legacyPreviewBox
                ?.nextElementSibling;

        if (legacyPreviewBox) {
            legacyPreviewBox.hidden =
                true;
        }

        if (
            legacyCaption?.tagName ===
            'P'
        ) {
            legacyCaption.hidden =
                true;
        }

        uploadColumn.insertAdjacentHTML(
            'afterbegin',

            renderPanel(
                'upload',
                'Weergave op het product'
            )
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

    function renderPanel(
        context,
        title
    ) {
        const activeView =
            ProductPreview.getView(
                state.config,
                activeViewId
            );

        const canvasId =
            `${context}-product-preview-canvas`;

        const titleId =
            `${context}-product-preview-title`;

        return `
      <section
        class="product-preview-panel"
        data-product-preview-context="${context}"
        aria-labelledby="${titleId}"
      >
        <div class="product-preview-header">
          <div>
            <div class="product-preview-eyebrow">
              Productvoorbeeld
            </div>

            <strong id="${titleId}">
              ${escapeHtml(title)}
            </strong>
          </div>

          <span
            class="product-preview-live-indicator"
            aria-hidden="true"
          ></span>
        </div>

        ${state.config.views.length > 1
                ? `
            <div
              class="product-preview-tabs"
              role="tablist"
              aria-label="Productzijde kiezen"
            >
              ${state.config.views.map(view => {
                    const isActive =
                        view.id ===
                        activeView?.id;

                    return `
                  <button
                    class="product-preview-tab${isActive ? ' active' : ''}"
                    type="button"
                    role="tab"
                    aria-selected="${isActive ? 'true' : 'false'}"
                    aria-controls="${canvasId}"
                    tabindex="${isActive ? '0' : '-1'}"
                    data-product-preview-view-id="${escapeHtml(view.id)}"
                  >
                    ${escapeHtml(view.label)}
                  </button>
                `;
                }).join('')}
            </div>
          `
                : ''}

        <div
          class="product-preview-stage"
          id="${context}-product-preview-stage"
        >
          <canvas
            id="${canvasId}"
            class="product-preview-canvas"
            role="img"
            aria-label="${escapeHtml(activeView?.label || 'Productvoorbeeld')}"
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
                    activeView?.helpText ||
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

    function bindViewControls() {
        document
            .querySelectorAll(
                '[data-product-preview-view-id]'
            )
            .forEach(button => {
                button.addEventListener(
                    'click',
                    () => {
                        const viewId =
                            button.dataset
                                .productPreviewViewId;

                        if (
                            !state
                                .config
                                .views
                                .some(
                                    view =>
                                        view.id ===
                                        viewId
                                )
                        ) {
                            return;
                        }

                        activeViewId = viewId;

                        persistActiveView();
                        syncPanels();

                        scheduleRender(
                            'tool',
                            true
                        );

                        scheduleRender(
                            'upload',
                            true
                        );
                    }
                );
            });
    }

    function bindPageControls() {
        const page =
            document.getElementById(
                'page-design'
            );

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
                    event.target.matches(
                        '#font-select, #font-size, #custom-element-color, #custom-background-color'
                    )
                ) {
                    scheduleRender(
                        'tool'
                    );
                }
            },
            { signal }
        );

        page.addEventListener(
            'change',
            event => {
                if (
                    event.target.matches(
                        '#font-select, #font-size, #custom-element-color, #custom-background-color'
                    )
                ) {
                    scheduleRender(
                        'tool'
                    );
                }
            },
            { signal }
        );

        page.addEventListener(
            'click',
            event => {
                const button =
                    event.target.closest(
                        'button'
                    );

                if (!button) {
                    return;
                }

                if (
                    button.id ===
                    'btn-product-preview-source'
                ) {
                    const dataURL =
                        getUploadedDataURL();

                    if (dataURL) {
                        window.open(
                            dataURL,
                            '_blank',
                            'noopener'
                        );
                    }

                    return;
                }

                if ([
                    'btn-text',
                    'btn-delete',
                    'btn-front',
                    'btn-back',
                    'btn-undo',
                    'btn-clear',
                ].includes(button.id)) {
                    window.setTimeout(
                        () => {
                            scheduleRender(
                                'tool',
                                true
                            );
                        },
                        0
                    );
                }
            },
            { signal }
        );
    }

    function observePreviewStages() {
        if (
            typeof ResizeObserver !==
            'function'
        ) {
            return;
        }

        resizeObserver =
            new ResizeObserver(
                entries => {
                    entries.forEach(
                        entry => {
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
                                scheduleRender(
                                    context
                                );
                            }
                        }
                    );
                }
            );

        document
            .querySelectorAll(
                '.product-preview-stage'
            )
            .forEach(stage => {
                resizeObserver.observe(
                    stage
                );
            });
    }

    function connectFabricCanvas() {
        const canvas =
            ensureFabricConnection();

        if (canvas) {
            if (fabricConnectTimer) {
                clearTimeout(
                    fabricConnectTimer
                );

                fabricConnectTimer = null;
            }

            fabricConnectAttempts = 0;

            scheduleRender(
                'tool',
                true
            );

            return;
        }

        if (
            fabricConnectAttempts >=
            FABRIC_CONNECT_MAX_ATTEMPTS
        ) {
            setStatus(
                'tool',
                'De ontwerptool kon niet worden gekoppeld.',
                true
            );

            return;
        }

        if (fabricConnectTimer) {
            return;
        }

        fabricConnectAttempts += 1;

        fabricConnectTimer =
            window.setTimeout(
                () => {
                    fabricConnectTimer = null;
                    connectFabricCanvas();
                },
                FABRIC_CONNECT_RETRY_MS
            );
    }

    function ensureFabricConnection() {
        const canvas =
            getFabricCanvas();

        if (!canvas) {
            mountedFabricCanvas = null;
            return null;
        }

        if (
            mountedFabricCanvas !==
            canvas
        ) {
            mountedFabricCanvas =
                canvas;

            bindFabricEvents(
                canvas
            );
        }

        return canvas;
    }

    function bindFabricEvents(
        canvas
    ) {
        if (
            canvas
                ._productPreviewEventsBound
        ) {
            return;
        }

        const schedule = () => {
            scheduleRender(
                'tool'
            );
        };

        const scheduleImmediate = () => {
            scheduleRender(
                'tool',
                true
            );
        };

        canvas.on(
            'object:modified',
            scheduleImmediate
        );

        canvas.on(
            'text:changed',
            schedule
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

        canvas.on(
            'selection:cleared',
            scheduleImmediate
        );

        canvas._productPreviewEventsBound =
            true;
    }

    function getFabricCanvas() {
        try {
            const canvas =
                typeof fabricCanvas !==
                    'undefined'
                    ? fabricCanvas
                    : null;

            if (
                !canvas ||
                !canvas.lowerCanvasEl ||
                !canvas.lowerCanvasEl.isConnected ||
                canvas.lowerCanvasEl.id !== 'c'
            ) {
                return null;
            }

            return canvas;
        } catch {
            return null;
        }
    }

    function getUploadedDataURL() {
        try {
            if (
                typeof uploadedDataURL !==
                'undefined' &&
                uploadedDataURL
            ) {
                return uploadedDataURL;
            }
        } catch {
            // Gebruik de sessiefallback.
        }

        const design =
            Session.getDesign();

        return (
            design?.source ===
            'upload'
        )
            ? design.dataURL ||
            null
            : null;
    }

    function isTechnicalGuide(
        object
    ) {
        if (
            typeof window.isGuideObject ===
            'function'
        ) {
            return window.isGuideObject(
                object
            );
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
        }

        renderTimers[context] =
            window.setTimeout(
                () => {
                    renderTimers[context] =
                        null;

                    if (
                        context === 'tool'
                    ) {
                        const canvas =
                            ensureFabricConnection();

                        if (!canvas) {
                            connectFabricCanvas();
                            return;
                        }

                        if (
                            canvas._currentTransform
                        ) {
                            scheduleRender(
                                'tool'
                            );

                            return;
                        }
                    }

                    requestAnimationFrame(
                        () => {
                            renderTarget(
                                context
                            );
                        }
                    );
                },

                immediate
                    ? 0
                    : RENDER_DELAY_MS
            );
    }

    async function renderTarget(
        context
    ) {
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
            document.createElement(
                'canvas'
            );

        const width =
            getRenderWidth(context);

        setLoading(
            context,
            true
        );

        try {
            let result;

            if (context === 'tool') {
                const canvas =
                    ensureFabricConnection();

                if (!canvas) {
                    setStatus(
                        context,
                        'De ontwerptool wordt geladen.'
                    );

                    return;
                }

                result =
                    await ProductPreview
                        .renderFromFabric({
                            fabricCanvas:
                                canvas,

                            targetCanvas:
                                stagingCanvas,

                            product:
                                state.product,

                            personalisationType:
                                state.personalisationType,

                            viewId:
                                activeViewId,

                            width,

                            isGuideObject:
                                isTechnicalGuide,
                        });
            } else {
                const sourceDataURL =
                    getUploadedDataURL();

                result =
                    isRasterDataURL(
                        sourceDataURL
                    )
                        ? await ProductPreview
                            .renderFromDataURL({
                                sourceDataURL,

                                targetCanvas:
                                    stagingCanvas,

                                product:
                                    state.product,

                                personalisationType:
                                    state.personalisationType,

                                viewId:
                                    activeViewId,

                                width,
                            })
                        : await ProductPreview
                            .renderFromCanvas({
                                sourceCanvas:
                                    null,

                                targetCanvas:
                                    stagingCanvas,

                                product:
                                    state.product,

                                personalisationType:
                                    state.personalisationType,

                                viewId:
                                    activeViewId,

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

            if (!result.hasBaseImage) {
                setStatus(
                    context,

                    'Voor deze zijde ontbreekt een productfoto / onderlaag.',

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

                result.hasArtwork
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

    function getRenderWidth(
        context
    ) {
        const stage =
            document.getElementById(
                `${context}-product-preview-stage`
            );

        const cssWidth =
            Math.max(
                240,
                stage?.clientWidth ||
                320
            );

        const pixelRatio =
            Math.min(
                2,

                Math.max(
                    1,
                    window.devicePixelRatio ||
                    1
                )
            );

        return Math.min(
            MAX_RENDER_WIDTH,

            Math.round(
                cssWidth *
                pixelRatio
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
            targetCanvas.getContext(
                '2d'
            );

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
        const activeView =
            ProductPreview.getView(
                state.config,
                activeViewId
            );

        if (!activeView) {
            return;
        }

        activeViewId =
            activeView.id;

        document
            .querySelectorAll(
                '[data-product-preview-view-id]'
            )
            .forEach(button => {
                const isActive =
                    button.dataset
                        .productPreviewViewId ===
                    activeView.id;

                button.classList.toggle(
                    'active',
                    isActive
                );

                button.setAttribute(
                    'aria-selected',
                    isActive
                        ? 'true'
                        : 'false'
                );

                button.setAttribute(
                    'tabindex',
                    isActive
                        ? '0'
                        : '-1'
                );
            });

        [
            'tool',
            'upload',
        ].forEach(context => {
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

                activeView.label ||
                'Productvoorbeeld'
            );

            if (help) {
                help.textContent =
                    activeView.helpText ||
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

        const loadingElement =
            document.getElementById(
                `${context}-product-preview-loading`
            );

        panel?.classList.toggle(
            'is-loading',
            loading
        );

        if (loadingElement) {
            loadingElement.hidden =
                !loading;
        }
    }

    function setStatus(
        context,
        message,
        isError = false
    ) {
        const status =
            document.getElementById(
                `${context}-product-preview-status`
            );

        if (!status) {
            return;
        }

        status.textContent =
            message ||
            '';

        status.classList.toggle(
            'is-error',
            isError
        );
    }

    function isRasterDataURL(
        dataURL
    ) {
        return (
            typeof dataURL ===
            'string' &&
            dataURL.startsWith(
                'data:image/'
            )
        );
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
})();