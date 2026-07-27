/**
 * customer/canvasEditorViews.js
 *
 * Gebruiksvriendelijke zijdeweergaven voor gevouwen drukwerk.
 *
 * Eén Fabric-canvas blijft de technische bron voor opslag en productie-export.
 * Een zijde wordt uitsluitend via de Fabric-viewport rechtop weergegeven.
 * Nieuwe objecten worden vóór canvas.add() naar de technische oriëntatie
 * omgerekend, zodat editor, productpreview en drukbestand dezelfde bron delen.
 */

(() => {
  'use strict';

  const DESIGN_STATE_KEY = 'cot_design_state';
  const SHEET_VIEW_ID = 'sheet';

  const VIEW_ID_PROPERTY = '_designViewId';
  const VIEW_ROTATION_PROPERTY = '_designViewRotation';
  const ORIENTATION_VERSION_PROPERTY = '_designOrientationVersion';
  const TECHNICAL_ORIENTATION_VERSION = 3;
  const EDITOR_GUIDE_PROPERTY = '_isCanvasEditorGuide';

  const CONNECT_RETRY_MS = 80;
  const CONNECT_MAX_ATTEMPTS = 75;
  const VIEWPORT_PADDING_PX = 20;
  const VIEWPORT_EPSILON = 0.001;
  const ANGLE_EPSILON = 0.5;

  let editorState = null;
  let activeViewId = SHEET_VIEW_ID;
  let connectedCanvas = null;
  let connectTimer = null;
  let connectAttempts = 0;
  let pageAbortController = null;
  let resizeObserver = null;
  let syncAnimationFrame = null;

  initialise();

  function initialise() {
    if (
      !window.fabric ||
      !window.ProductPreview ||
      !window.Session ||
      typeof window.renderDesignPage !== 'function'
    ) {
      console.error(
        'Canvasweergaven niet gestart: Fabric, ProductPreview, Session of renderDesignPage ontbreekt.'
      );

      return;
    }

    patchFabricObjectSerialization();
    patchFabricCanvasAdd();
    patchFabricCanvasLoadFromJSON();
    patchFabricCanvasExport();
    decorateDesignPageRenderer();
    decorateLayerPanelRenderer();
  }

  /**
   * Zorgt dat de zijde- en rotatiemetadata altijd in Fabric JSON wordt bewaard.
   */
  function patchFabricObjectSerialization() {
    const prototype = window.fabric?.Object?.prototype;

    if (
      !prototype ||
      typeof prototype.toObject !== 'function' ||
      prototype.toObject._canvasEditorViewsPatched
    ) {
      return;
    }

    const originalToObject = prototype.toObject;

    function toObjectWithEditorMetadata(propertiesToInclude = []) {
      const properties = Array.isArray(propertiesToInclude)
        ? propertiesToInclude
        : [];

      return originalToObject.call(
        this,
        [
          ...new Set([
            ...properties,
            VIEW_ID_PROPERTY,
            VIEW_ROTATION_PROPERTY,
            ORIENTATION_VERSION_PROPERTY,
          ]),
        ]
      );
    }

    toObjectWithEditorMetadata._canvasEditorViewsPatched = true;
    prototype.toObject = toObjectWithEditorMetadata;
  }

  /**
   * Dit is de belangrijkste productiefix.
   *
   * De technische positie en rotatie worden toegepast voordat Fabric het
   * object toevoegt. Daardoor bevatten history, localStorage, live preview,
   * PNG-export en PDF-export allemaal dezelfde productieklare objectdata.
   */
  function patchFabricCanvasAdd() {
    const prototype = window.fabric?.Canvas?.prototype;

    if (
      !prototype ||
      typeof prototype.add !== 'function' ||
      prototype.add._canvasEditorViewsPatched
    ) {
      return;
    }

    const originalAdd = prototype.add;

    function addWithTechnicalOrientation(...objects) {
      if (
        isDesignCanvas(this) &&
        !this._canvasEditorRestoring
      ) {
        objects.forEach(object => {
          prepareNewObjectForTechnicalCanvas(
            this,
            object
          );
        });
      }

      return originalAdd.apply(
        this,
        objects
      );
    }

    addWithTechnicalOrientation._canvasEditorViewsPatched = true;
    prototype.add = addWithTechnicalOrientation;
  }

  /**
   * Voorkomt dat objecten tijdens loadFromJSON ten onrechte als nieuwe
   * objecten worden behandeld. Na het herstellen worden oude objecten veilig
   * naar de nieuwe technische oriëntatie gemigreerd.
   */
  function patchFabricCanvasLoadFromJSON() {
    const prototype = window.fabric?.Canvas?.prototype;

    if (
      !prototype ||
      typeof prototype.loadFromJSON !== 'function' ||
      prototype.loadFromJSON._canvasEditorViewsPatched
    ) {
      return;
    }

    const originalLoadFromJSON = prototype.loadFromJSON;

    function loadFromJSONWithMigration(
      json,
      callback,
      reviver
    ) {
      this._canvasEditorRestoring = true;

      const finishRestore = (...callbackArgs) => {
        this._canvasEditorRestoring = false;

        if (isDesignCanvas(this)) {
          migrateCanvasObjects(this);
        }

        if (typeof callback === 'function') {
          callback(...callbackArgs);
        }
      };

      try {
        return originalLoadFromJSON.call(
          this,
          json,
          finishRestore,
          reviver
        );
      } catch (error) {
        this._canvasEditorRestoring = false;
        throw error;
      }
    }

    loadFromJSONWithMigration._canvasEditorViewsPatched = true;
    prototype.loadFromJSON = loadFromJSONWithMigration;
  }

  /**
   * De editor mag een gedraaide viewport gebruiken, maar de export moet altijd
   * het volledige technische drukvel renderen.
   */
  function patchFabricCanvasExport() {
    const prototype = window.fabric?.Canvas?.prototype;

    if (
      !prototype ||
      typeof prototype.toDataURL !== 'function' ||
      prototype.toDataURL._canvasEditorViewsPatched
    ) {
      return;
    }

    const originalToDataURL = prototype.toDataURL;

    function toDataURLFromTechnicalCanvas(...args) {
      if (!isDesignCanvas(this)) {
        return originalToDataURL.apply(
          this,
          args
        );
      }

      migrateCanvasObjects(this);

      return withCanonicalViewport(
        this,
        () => originalToDataURL.apply(
          this,
          args
        )
      );
    }

    toDataURLFromTechnicalCanvas._canvasEditorViewsPatched = true;
    prototype.toDataURL = toDataURLFromTechnicalCanvas;
  }

  function decorateDesignPageRenderer() {
    if (window.renderDesignPage._canvasEditorViewsDecorated) {
      return;
    }

    const originalRenderDesignPage = window.renderDesignPage;

    function renderDesignPageWithEditorViews(...args) {
      const result = originalRenderDesignPage.apply(
        this,
        args
      );

      mount();

      return result;
    }

    renderDesignPageWithEditorViews._canvasEditorViewsDecorated = true;
    window.renderDesignPage = renderDesignPageWithEditorViews;
  }

  function decorateLayerPanelRenderer() {
    const originalUpdateLayerPanel = window.updateLayerPanel;

    if (
      typeof originalUpdateLayerPanel !== 'function' ||
      originalUpdateLayerPanel._canvasEditorViewsDecorated
    ) {
      return;
    }

    function updateLayerPanelForActiveView(...args) {
      const result = originalUpdateLayerPanel.apply(
        this,
        args
      );

      filterLayerPanel();

      return result;
    }

    updateLayerPanelForActiveView._canvasEditorViewsDecorated = true;
    window.updateLayerPanel = updateLayerPanelForActiveView;
  }

  function mount() {
    cleanupPageBindings();

    editorState = resolveEditorState();

    if (
      !editorState?.config.enabled ||
      !editorState.config.views.length
    ) {
      activeViewId = SHEET_VIEW_ID;

      document
        .getElementById('canvas-toolbar')
        ?.remove();

      return;
    }

    activeViewId = resolveInitialViewId();

    renderEditorToolbar();
    bindPageEvents();
    connectFabricCanvas();
  }

  function cleanupPageBindings() {
    pageAbortController?.abort();
    resizeObserver?.disconnect();

    if (connectTimer) {
      clearTimeout(connectTimer);
    }

    if (syncAnimationFrame) {
      cancelAnimationFrame(syncAnimationFrame);
    }

    if (
      connectedCanvas &&
      connectedCanvas.lowerCanvasEl?.isConnected
    ) {
      restoreCanvasPresentation(
        connectedCanvas
      );
    }

    pageAbortController = null;
    resizeObserver = null;
    connectTimer = null;
    connectAttempts = 0;
    syncAnimationFrame = null;
    connectedCanvas = null;
  }

  function resolveEditorState() {
    const product = window.Session.getProduct();
    const options = window.Session.getOptions();

    if (!product || !options) {
      return null;
    }

    const personalisationTypes = Array.isArray(
      product.personalisatieTypes
    )
      ? product.personalisatieTypes.filter(
        type => type.active !== false
      )
      : [];

    const personalisationType = personalisationTypes.find(
      type => type.id === options.persTypeId
    ) ||
      options.persType ||
      personalisationTypes[0] ||
      null;

    const config = window.ProductPreview.normalizeConfig(
      personalisationType || {},
      product
    );

    return {
      product,
      personalisationType,
      config,

      spec: window.ProductPreview.getPrintSpec(
        personalisationType || {},
        product
      ),

      stateKey:
        `${DESIGN_STATE_KEY}_${product.id}_${personalisationType?.id || 'standaard'}`,
    };
  }

  function resolveInitialViewId() {
    const storedViewId =
      readLocalDesignState().editorViewId;

    if (
      storedViewId === SHEET_VIEW_ID ||
      getViewById(storedViewId)
    ) {
      return storedViewId;
    }

    return (
      editorState.config.defaultViewId ||
      editorState.config.views[0]?.id ||
      SHEET_VIEW_ID
    );
  }

  function readLocalDesignState() {
    if (!editorState?.stateKey) {
      return {};
    }

    try {
      const parsed = JSON.parse(
        localStorage.getItem(
          editorState.stateKey
        ) ||
        '{}'
      );

      return (
        parsed &&
        typeof parsed === 'object'
      )
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  function persistActiveView() {
    if (!editorState?.stateKey) {
      return;
    }

    try {
      localStorage.setItem(
        editorState.stateKey,

        JSON.stringify({
          ...readLocalDesignState(),

          editorViewId:
            activeViewId,

          savedAt:
            Date.now(),
        })
      );
    } catch (error) {
      console.warn(
        'Bewerkingsweergave opslaan mislukt',
        error
      );
    }
  }

  function renderEditorToolbar() {
    const canvasArea = document.getElementById(
      'canvas-area'
    );

    const canvasWrap = document.getElementById(
      'canvas-wrap'
    );

    if (!canvasArea || !canvasWrap) {
      return;
    }

    document
      .getElementById('canvas-toolbar')
      ?.remove();

    const toolbar = document.createElement('div');

    const buttons = [
      ...editorState.config.views.map(view => ({
        id: view.id,
        label: view.label,
      })),

      {
        id: SHEET_VIEW_ID,
        label: 'Volledig drukvel',
      },
    ];

    toolbar.id = 'canvas-toolbar';
    toolbar.className = 'canvas-view-toolbar';

    toolbar.innerHTML = `
      <div class="canvas-view-toolbar-main">
        <span class="canvas-view-toolbar-label">
          Bewerkingsweergave
        </span>

        <div
          class="canvas-view-tabs"
          role="tablist"
          aria-label="Te bewerken productzijde"
        >
          ${buttons.map(button => {
            const isActive =
              button.id === activeViewId;

            return `
              <button
                class="canvas-view-tab${isActive ? ' active' : ''}"
                type="button"
                role="tab"
                aria-selected="${String(isActive)}"
                tabindex="${isActive ? '0' : '-1'}"
                data-canvas-editor-view-id="${escapeHtml(button.id)}"
              >
                ${escapeHtml(button.label)}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <p
        id="canvas-view-note"
        class="canvas-view-note"
      ></p>
    `;

    canvasArea.insertBefore(
      toolbar,
      canvasWrap
    );

    updateToolbarState();
  }

  function bindPageEvents() {
    const page = document.getElementById(
      'page-design'
    );

    if (!page) {
      return;
    }

    pageAbortController = new AbortController();

    const { signal } =
      pageAbortController;

    page
      .querySelectorAll(
        '[data-canvas-editor-view-id]'
      )
      .forEach(button => {
        button.addEventListener(
          'click',
          () => {
            setActiveView(
              button.dataset.canvasEditorViewId,
              true
            );
          },
          { signal }
        );
      });

    page.addEventListener(
      'click',
      event => {
        const button =
          event.target.closest(
            'button'
          );

        if (
          button?.dataset?.tab ===
          'tool'
        ) {
          window.setTimeout(
            connectFabricCanvas,
            CONNECT_RETRY_MS
          );
        }

        if (
          button
            ?.dataset
            ?.productPreviewViewId
        ) {
          setActiveView(
            button
              .dataset
              .productPreviewViewId,
            false
          );
        }
      },
      {
        capture: true,
        signal,
      }
    );
  }

  function setActiveView(
    viewId,
    synchronizeProductPreview
  ) {
    const isValid =
      viewId === SHEET_VIEW_ID ||
      Boolean(getViewById(viewId));

    if (!isValid) {
      return;
    }

    activeViewId = viewId;

    persistActiveView();
    updateToolbarState();

    if (connectedCanvas) {
      connectedCanvas.discardActiveObject();

      synchronizeCanvasView(
        connectedCanvas
      );
    }

    if (
      synchronizeProductPreview &&
      viewId !== SHEET_VIEW_ID
    ) {
      [
        ...document.querySelectorAll(
          '[data-product-preview-view-id]'
        ),
      ]
        .find(button => (
          button
            .dataset
            .productPreviewViewId ===
          viewId
        ))
        ?.click();
    }
  }

  function updateToolbarState() {
    document
      .querySelectorAll(
        '[data-canvas-editor-view-id]'
      )
      .forEach(button => {
        const isActive =
          button
            .dataset
            .canvasEditorViewId ===
          activeViewId;

        button.classList.toggle(
          'active',
          isActive
        );

        button.setAttribute(
          'aria-selected',
          String(isActive)
        );

        button.tabIndex =
          isActive
            ? 0
            : -1;
      });

    const note = document.getElementById(
      'canvas-view-note'
    );

    if (!note) {
      return;
    }

    if (
      activeViewId ===
      SHEET_VIEW_ID
    ) {
      note.textContent =
        'Technische controleweergave. Gedraaide zijden staan zoals ze worden gedrukt.';

      return;
    }

    const view = getActiveView();
    const rotation = getViewRotation(view);

    note.textContent = rotation
      ? `Je bewerkt nu: ${view.label}. Deze zijde wordt alleen in de editor rechtop getoond.`
      : `Je bewerkt nu: ${view.label}. Alleen dit ontwerpgebied is zichtbaar en actief.`;
  }

  function connectFabricCanvas() {
    const canvas = getFabricCanvas();

    if (!canvas) {
      if (
        connectAttempts >=
        CONNECT_MAX_ATTEMPTS
      ) {
        console.warn(
          'Canvasweergaven konden niet met Fabric worden gekoppeld.'
        );

        return;
      }

      connectAttempts += 1;

      connectTimer =
        window.setTimeout(
          connectFabricCanvas,
          CONNECT_RETRY_MS
        );

      return;
    }

    connectAttempts = 0;
    connectTimer = null;

    if (
      connectedCanvas !==
      canvas
    ) {
      connectedCanvas = canvas;

      connectedCanvas
        ._canvasEditorViewsActive =
        true;

      bindFabricEvents(canvas);
      migrateCanvasObjects(canvas);
      observeCanvasWrap(canvas);
    }

    synchronizeCanvasView(canvas);

    [
      0,
      100,
      250,
    ].forEach(delay => {
      window.setTimeout(() => {
        if (
          canvas ===
          getFabricCanvas()
        ) {
          migrateCanvasObjects(canvas);
          synchronizeCanvasView(canvas);
        }
      }, delay);
    });
  }

  function getFabricCanvas() {
    try {
      const canvas =
        typeof window.fabricCanvas !==
        'undefined'
          ? window.fabricCanvas
          : typeof fabricCanvas !==
            'undefined'
            ? fabricCanvas
            : null;

      if (
        !canvas ||
        !canvas
          .lowerCanvasEl
          ?.isConnected ||
        canvas.lowerCanvasEl.id !==
          'c'
      ) {
        return null;
      }

      return canvas;
    } catch {
      return null;
    }
  }

  function isDesignCanvas(canvas) {
    return Boolean(
      editorState?.config?.enabled &&
      canvas?.lowerCanvasEl?.id === 'c'
    );
  }

  function observeCanvasWrap(canvas) {
    if (
      typeof ResizeObserver !==
      'function'
    ) {
      return;
    }

    const canvasWrap =
      document.getElementById(
        'canvas-wrap'
      );

    if (!canvasWrap) {
      return;
    }

    resizeObserver?.disconnect();

    resizeObserver =
      new ResizeObserver(() => {
        queueCanvasSynchronization(
          canvas
        );
      });

    resizeObserver.observe(
      canvasWrap
    );
  }

  function bindFabricEvents(canvas) {
    if (
      canvas
        ._canvasEditorViewsEventsBound
    ) {
      return;
    }

    canvas.on(
      'object:added',
      event => {
        const object =
          event.target;

        if (
          !object ||
          isGuideObject(object) ||
          canvas
            ._canvasEditorRestoring
        ) {
          return;
        }

        /*
         * Canvas.add() heeft het object normaal al voorbereid.
         * Deze tweede controle vangt andere Fabric-invoerroutes veilig af.
         */
        prepareNewObjectForTechnicalCanvas(
          canvas,
          object
        );

        queueCanvasSynchronization(
          canvas
        );
      }
    );

    canvas.on(
      'object:moving',
      event => {
        constrainObjectToActiveView(
          canvas,
          event.target
        );
      }
    );

    canvas.on(
      'object:modified',
      event => {
        updateObjectViewAssignment(
          canvas,
          event.target
        );

        queueCanvasSynchronization(
          canvas
        );
      }
    );

    canvas.on(
      'object:removed',
      event => {
        if (
          !event
            .target
            ?.[EDITOR_GUIDE_PROPERTY]
        ) {
          queueCanvasSynchronization(
            canvas
          );
        }
      }
    );

    canvas.on(
      'selection:cleared',
      () => {
        queueCanvasSynchronization(
          canvas
        );
      }
    );

    canvas.on(
      'after:render',
      () => {
        if (
          canvas
            ._canvasEditorCanonicalDepth >
          0
        ) {
          return;
        }

        if (
          !hasExpectedViewport(
            canvas
          )
        ) {
          queueCanvasSynchronization(
            canvas
          );
        }
      }
    );

    canvas
      ._canvasEditorViewsEventsBound =
      true;
  }

  function queueCanvasSynchronization(canvas) {
    if (syncAnimationFrame) {
      return;
    }

    syncAnimationFrame =
      requestAnimationFrame(() => {
        syncAnimationFrame = null;

        if (
          canvas ===
          getFabricCanvas()
        ) {
          synchronizeCanvasView(
            canvas
          );
        }
      });
  }

  function synchronizeCanvasView(canvas) {
    removeEditorGuides(canvas);
    restoreTechnicalGuides(canvas);
    resetLegacyCssZoom(canvas);

    if (
      activeViewId ===
      SHEET_VIEW_ID
    ) {
      canvas.setViewportTransform([
        1,
        0,
        0,
        1,
        0,
        0,
      ]);

      canvas.calcOffset();

      removeCanvasClip(canvas);
      restoreObjectInteractivity(
        canvas
      );

      setZoomControlsVisible(true);
      updateLayerPanelSafely();
      canvas.requestRenderAll();

      return;
    }

    const view = getActiveView();

    const bounds = getViewBounds(
      canvas,
      view
    );

    if (!view || !bounds) {
      return;
    }

    canvas.setViewportTransform(
      createEditorViewport(
        canvas,
        bounds
      )
    );

    canvas.calcOffset();

    hideTechnicalGuides(canvas);
    updateObjectInteractivity(
      canvas
    );

    addEditorGuides(
      canvas,
      bounds
    );

    applyCanvasClip(
      canvas,
      bounds
    );

    setZoomControlsVisible(false);
    updateLayerPanelSafely();
    canvas.requestRenderAll();
  }

  function resetLegacyCssZoom(canvas) {
    try {
      if (
        typeof window.canvasZoom ===
        'number'
      ) {
        window.canvasZoom = 1;
      } else if (
        typeof canvasZoom !==
        'undefined'
      ) {
        canvasZoom = 1;
      }
    } catch {
      /*
       * De oudere ontwerptool kan canvasZoom alleen in de eigen
       * globale lexicale scope bewaren.
       */
    }

    const container =
      canvas.wrapperEl ||
      canvas
        .lowerCanvasEl
        ?.parentElement;

    if (container) {
      container.style.transform =
        'none';

      container
        .style
        .transformOrigin =
        'center center';
    }
  }

  function setZoomControlsVisible(
    visible
  ) {
    const controls =
      document.querySelector(
        '.canvas-zoom-controls'
      );

    if (controls) {
      controls.hidden =
        !visible;
    }
  }

  function getActiveView() {
    return (
      activeViewId ===
      SHEET_VIEW_ID
    )
      ? null
      : getViewById(
        activeViewId
      );
  }

  function getViewById(viewId) {
    return (
      editorState
        ?.config
        ?.views
        ?.find(
          view =>
            view.id ===
            viewId
        ) ||
      null
    );
  }

  function getViewRotation(view) {
    return normalizeRotation(
      view
        ?.sourceZone
        ?.rotation
    );
  }

  function getViewBounds(
    canvas,
    view
  ) {
    if (
      !canvas ||
      !view ||
      !editorState?.spec
    ) {
      return null;
    }

    const sourceZone =
      view.sourceZone ||
      {};

    const spec =
      editorState.spec;

    const left =
      window.PrintSpecs
        ?.finishMmToCanvasX
        ? window.PrintSpecs.finishMmToCanvasX(
          sourceZone.x_mm,
          spec,
          canvas.getWidth()
        )
        : (
          (
            Number(
              spec.trimXmm ||
              0
            ) +
            Number(
              sourceZone.x_mm ||
              0
            )
          ) /
          Number(
            spec.exportWidthMm ||
            1
          )
        ) *
        canvas.getWidth();

    const top =
      window.PrintSpecs
        ?.finishMmToCanvasY
        ? window.PrintSpecs.finishMmToCanvasY(
          sourceZone.y_mm,
          spec,
          canvas.getHeight()
        )
        : (
          (
            Number(
              spec.trimYmm ||
              0
            ) +
            Number(
              sourceZone.y_mm ||
              0
            )
          ) /
          Number(
            spec.exportHeightMm ||
            1
          )
        ) *
        canvas.getHeight();

    const width =
      (
        Number(
          sourceZone.width_mm ||
          0
        ) /
        Number(
          spec.exportWidthMm ||
          1
        )
      ) *
      canvas.getWidth();

    const height =
      (
        Number(
          sourceZone.height_mm ||
          0
        ) /
        Number(
          spec.exportHeightMm ||
          1
        )
      ) *
      canvas.getHeight();

    if (
      width <= 0 ||
      height <= 0
    ) {
      return null;
    }

    return {
      left,
      top,
      width,
      height,

      right:
        left +
        width,

      bottom:
        top +
        height,

      centerX:
        left +
        width / 2,

      centerY:
        top +
        height / 2,

      rotation:
        getViewRotation(view),

      viewId:
        view.id,
    };
  }

  function createEditorViewport(
    canvas,
    bounds
  ) {
    const radians =
      bounds.rotation *
      Math.PI /
      180;

    const swapsDimensions =
      bounds.rotation === 90 ||
      bounds.rotation === 270;

    const visibleWidth =
      swapsDimensions
        ? bounds.height
        : bounds.width;

    const visibleHeight =
      swapsDimensions
        ? bounds.width
        : bounds.height;

    const scale =
      Math.min(
        Math.max(
          1,
          canvas.getWidth() -
          VIEWPORT_PADDING_PX * 2
        ) /
        visibleWidth,

        Math.max(
          1,
          canvas.getHeight() -
          VIEWPORT_PADDING_PX * 2
        ) /
        visibleHeight
      );

    const cosine =
      Math.cos(radians);

    const sine =
      Math.sin(radians);

    const a =
      scale *
      cosine;

    const b =
      scale *
      sine;

    const c =
      -scale *
      sine;

    const d =
      scale *
      cosine;

    const e =
      canvas.getWidth() / 2 -
      (
        a * bounds.centerX +
        c * bounds.centerY
      );

    const f =
      canvas.getHeight() / 2 -
      (
        b * bounds.centerX +
        d * bounds.centerY
      );

    return [
      a,
      b,
      c,
      d,
      e,
      f,
    ];
  }

  function hasExpectedViewport(canvas) {
    const current =
      Array.isArray(
        canvas.viewportTransform
      )
        ? canvas.viewportTransform
        : [
          1,
          0,
          0,
          1,
          0,
          0,
        ];

    const view = getActiveView();

    const bounds = getViewBounds(
      canvas,
      view
    );

    const expected =
      bounds
        ? createEditorViewport(
          canvas,
          bounds
        )
        : [
          1,
          0,
          0,
          1,
          0,
          0,
        ];

    return current.every(
      (value, index) => (
        Math.abs(
          value -
          expected[index]
        ) <
        VIEWPORT_EPSILON
      )
    );
  }

  /**
   * Een object dat voor de gebruiker rechtop is, moet op een technisch
   * 180°-gedraaide achterzijde met angle 180 worden opgeslagen.
   *
   * Voorbeeld:
   * - visuele hoek in editor: 0°
   * - bronrotatie achterkant: 180°
   * - technische objecthoek: 0° - 180° = 180°
   */
  function prepareNewObjectForTechnicalCanvas(
    canvas,
    object
  ) {
    if (
      !isDesignCanvas(canvas) ||
      !object ||
      isGuideObject(object) ||
      Number(
        object[ORIENTATION_VERSION_PROPERTY]
      ) >=
        TECHNICAL_ORIENTATION_VERSION
    ) {
      return;
    }

    const view = getActiveView();

    if (!view) {
      const inferredViewId =
        inferObjectViewId(
          canvas,
          object
        );

      object[VIEW_ID_PROPERTY] =
        inferredViewId;

      object[VIEW_ROTATION_PROPERTY] =
        getViewRotation(
          getViewById(
            inferredViewId
          )
        );

      object[ORIENTATION_VERSION_PROPERTY] =
        TECHNICAL_ORIENTATION_VERSION;

      return;
    }

    const bounds = getViewBounds(
      canvas,
      view
    );

    if (!bounds) {
      return;
    }

    const originalAngle =
      normalizeRotation(
        object.angle
      );

    object.set({
      left:
        bounds.centerX,

      top:
        bounds.centerY,

      originX:
        'center',

      originY:
        'center',

      angle:
        normalizeRotation(
          originalAngle -
          bounds.rotation
        ),

      [VIEW_ID_PROPERTY]:
        view.id,

      [VIEW_ROTATION_PROPERTY]:
        bounds.rotation,

      [ORIENTATION_VERSION_PROPERTY]:
        TECHNICAL_ORIENTATION_VERSION,
    });

    if (
      object.type ===
      'image'
    ) {
      constrainNewImageSize(
        object,
        bounds
      );
    }

    object.setCoords?.();
  }

  function constrainNewImageSize(
    object,
    bounds
  ) {
    const objectWidth =
      Number(
        object.width ||
        0
      );

    if (
      objectWidth <= 0
    ) {
      return;
    }

    const currentWidth =
      Number(
        object
          .getScaledWidth
          ?.() ||
        objectWidth
      );

    const maximumWidth =
      Math.max(
        24,
        bounds.width *
        0.42
      );

    if (
      currentWidth <=
      maximumWidth
    ) {
      return;
    }

    object.scale(
      maximumWidth /
      objectWidth
    );
  }

  function migrateCanvasObjects(canvas) {
    if (!isDesignCanvas(canvas)) {
      return;
    }

    canvas
      .getObjects()
      .filter(
        object =>
          !isGuideObject(object)
      )
      .forEach(object => {
        migrateObjectToTechnicalOrientation(
          canvas,
          object
        );
      });
  }

  function migrateObjectToTechnicalOrientation(
    canvas,
    object
  ) {
    const storedViewId =
      getViewById(
        object[VIEW_ID_PROPERTY]
      )
        ? object[VIEW_ID_PROPERTY]
        : null;

    const viewId =
      storedViewId ||
      inferObjectViewId(
        canvas,
        object
      );

    const view =
      getViewById(
        viewId
      );

    const nextRotation =
      getViewRotation(
        view
      );

    const version =
      Number(
        object[ORIENTATION_VERSION_PROPERTY] ||
        0
      );

    if (
      version >=
      TECHNICAL_ORIENTATION_VERSION
    ) {
      const previousRotation =
        normalizeRotation(
          object[VIEW_ROTATION_PROPERTY]
        );

      /*
       * De adminconfiguratie kan later van 0° naar 180° worden aangepast.
       * In dat geval blijft de visuele oriëntatie van het bestaande object
       * behouden, terwijl de technische hoek wordt bijgewerkt.
       */
      if (
        storedViewId &&
        previousRotation !==
          nextRotation
      ) {
        object.angle =
          normalizeRotation(
            Number(
              object.angle ||
              0
            ) +
            previousRotation -
            nextRotation
          );
      }

      object[VIEW_ID_PROPERTY] =
        viewId;

      object[VIEW_ROTATION_PROPERTY] =
        nextRotation;

      object[ORIENTATION_VERSION_PROPERTY] =
        TECHNICAL_ORIENTATION_VERSION;

      object.setCoords?.();

      return;
    }

    const currentAngle =
      normalizeRotation(
        object.angle
      );

    /*
     * Oudere ontwerpen bevatten geen betrouwbare visuele hoek.
     * Het normale foutgeval is een rechtop opgeslagen achterzijde op 0°.
     *
     * Alleen hoek 0° wordt daarom automatisch gecorrigeerd.
     * Een object dat al technisch op 180° staat, wordt niet dubbel gedraaid.
     */
    if (
      nextRotation !== 0 &&
      isAngleNear(
        currentAngle,
        0
      )
    ) {
      object.angle =
        normalizeRotation(
          currentAngle -
          nextRotation
        );
    }

    object[VIEW_ID_PROPERTY] =
      viewId;

    object[VIEW_ROTATION_PROPERTY] =
      nextRotation;

    object[ORIENTATION_VERSION_PROPERTY] =
      TECHNICAL_ORIENTATION_VERSION;

    object.setCoords?.();
  }

  function updateObjectViewAssignment(
    canvas,
    object
  ) {
    if (
      !object ||
      isGuideObject(object)
    ) {
      return;
    }

    const activeView =
      getActiveView();

    const nextViewId =
      activeView?.id ||
      inferObjectViewId(
        canvas,
        object
      );

    const previousViewId =
      getViewById(
        object[VIEW_ID_PROPERTY]
      )
        ? object[VIEW_ID_PROPERTY]
        : null;

    const previousRotation =
      normalizeRotation(
        object[VIEW_ROTATION_PROPERTY] ??
        getViewRotation(
          getViewById(
            previousViewId
          )
        )
      );

    const nextRotation =
      getViewRotation(
        getViewById(
          nextViewId
        )
      );

    if (
      previousViewId &&
      nextViewId &&
      previousViewId !==
        nextViewId
    ) {
      object.angle =
        normalizeRotation(
          Number(
            object.angle ||
            0
          ) +
          previousRotation -
          nextRotation
        );
    }

    object[VIEW_ID_PROPERTY] =
      nextViewId;

    object[VIEW_ROTATION_PROPERTY] =
      nextRotation;

    object[ORIENTATION_VERSION_PROPERTY] =
      TECHNICAL_ORIENTATION_VERSION;

    object.setCoords?.();
  }

  function inferObjectViewId(
    canvas,
    object
  ) {
    const center =
      object
        ?.getCenterPoint
        ?.();

    if (!center) {
      return null;
    }

    return (
      editorState
        ?.config
        ?.views
        ?.find(view => {
          const bounds =
            getViewBounds(
              canvas,
              view
            );

          return Boolean(
            bounds &&
            center.x >=
              bounds.left &&
            center.x <=
              bounds.right &&
            center.y >=
              bounds.top &&
            center.y <=
              bounds.bottom
          );
        })
        ?.id ||
      null
    );
  }

  function getObjectViewId(
    canvas,
    object
  ) {
    return getViewById(
      object?.[VIEW_ID_PROPERTY]
    )
      ? object[VIEW_ID_PROPERTY]
      : inferObjectViewId(
        canvas,
        object
      );
  }

  function constrainObjectToActiveView(
    canvas,
    object
  ) {
    const view =
      getActiveView();

    const bounds =
      getViewBounds(
        canvas,
        view
      );

    const center =
      object
        ?.getCenterPoint
        ?.();

    if (
      !object ||
      !view ||
      !bounds ||
      !center ||
      isGuideObject(object)
    ) {
      return;
    }

    object.setPositionByOrigin(
      new window.fabric.Point(
        clamp(
          center.x,
          bounds.left,
          bounds.right
        ),

        clamp(
          center.y,
          bounds.top,
          bounds.bottom
        )
      ),
      'center',
      'center'
    );

    object[VIEW_ID_PROPERTY] =
      view.id;

    object[VIEW_ROTATION_PROPERTY] =
      bounds.rotation;

    object[ORIENTATION_VERSION_PROPERTY] =
      TECHNICAL_ORIENTATION_VERSION;

    object.setCoords?.();
  }

  function updateObjectInteractivity(canvas) {
    const activeView =
      getActiveView();

    canvas
      .getObjects()
      .filter(
        object =>
          !isGuideObject(object)
      )
      .forEach(object => {
        object
          ._canvasEditorOriginalSelectable ??=
          object.selectable !== false;

        object
          ._canvasEditorOriginalEvented ??=
          object.evented !== false;

        const belongsToActiveView =
          getObjectViewId(
            canvas,
            object
          ) === activeView?.id;

        object.selectable =
          belongsToActiveView &&
          object
            ._canvasEditorOriginalSelectable;

        object.evented =
          belongsToActiveView &&
          object
            ._canvasEditorOriginalEvented;
      });
  }

  function restoreObjectInteractivity(canvas) {
    canvas
      .getObjects()
      .filter(
        object =>
          !isGuideObject(object)
      )
      .forEach(object => {
        object.selectable =
          object
            ._canvasEditorOriginalSelectable !==
          false;

        object.evented =
          object
            ._canvasEditorOriginalEvented !==
          false;
      });
  }

  function hideTechnicalGuides(canvas) {
    canvas
      .getObjects()
      .filter(
        object =>
          isGuideObject(object) &&
          !object[EDITOR_GUIDE_PROPERTY]
      )
      .forEach(object => {
        object.visible = false;
      });
  }

  function restoreTechnicalGuides(canvas) {
    canvas
      .getObjects()
      .filter(
        object =>
          isGuideObject(object) &&
          !object[EDITOR_GUIDE_PROPERTY]
      )
      .forEach(object => {
        object.visible = true;
      });
  }

  function removeEditorGuides(canvas) {
    canvas
      .getObjects()
      .filter(
        object =>
          object[EDITOR_GUIDE_PROPERTY]
      )
      .forEach(object => {
        canvas.remove(object);
      });
  }

  function addEditorGuides(
    canvas,
    bounds
  ) {
    const palette =
      getGuidePalette(
        canvas.backgroundColor ||
        '#b7bdb8'
      );

    const safeMargin =
      getSafeMarginPx(
        canvas
      );

    const guides = [
      new window.fabric.Rect({
        left:
          bounds.left,

        top:
          bounds.top,

        width:
          bounds.width,

        height:
          bounds.height,

        fill:
          'transparent',

        stroke:
          palette.zone,

        strokeWidth:
          1.75,

        strokeDashArray:
          [7, 5],
      }),

      new window.fabric.Rect({
        left:
          bounds.left +
          safeMargin,

        top:
          bounds.top +
          safeMargin,

        width:
          Math.max(
            1,
            bounds.width -
            safeMargin * 2
          ),

        height:
          Math.max(
            1,
            bounds.height -
            safeMargin * 2
          ),

        fill:
          'transparent',

        stroke:
          palette.margin,

        strokeWidth:
          1.75,

        strokeDashArray:
          [6, 4],
      }),
    ];

    guides.forEach(guide => {
      guide.set({
        strokeUniform: true,
        selectable: false,
        evented: false,
        objectCaching: false,
        excludeFromExport: true,
        _isGuide: true,

        [EDITOR_GUIDE_PROPERTY]:
          true,
      });

      canvas.add(guide);
      canvas.bringToFront(guide);
    });
  }

  function getSafeMarginPx(canvas) {
    const marginPx =
      Number(
        editorState
          ?.personalisationType
          ?.margin_px ||
        editorState
          ?.product
          ?.margin_px ||
        20
      );

    const sourceWidthPx =
      Number(
        editorState
          ?.personalisationType
          ?.width_px ||
        editorState
          ?.product
          ?.width_px ||
        1181
      );

    return sourceWidthPx > 0
      ? marginPx *
        (
          canvas.getWidth() /
          sourceWidthPx
        )
      : marginPx;
  }

  function applyCanvasClip(
    canvas,
    bounds
  ) {
    const container =
      canvas.wrapperEl ||
      canvas
        .lowerCanvasEl
        ?.parentElement;

    if (!container) {
      return;
    }

    const screenBounds =
      getScreenBounds(
        canvas,
        bounds
      );

    const rightInset =
      Math.max(
        0,
        canvas.getWidth() -
        screenBounds.right
      );

    const bottomInset =
      Math.max(
        0,
        canvas.getHeight() -
        screenBounds.bottom
      );

    container.classList.add(
      'canvas-editor-side-view'
    );

    container.style.clipPath =
      `inset(${screenBounds.top}px ${rightInset}px ${bottomInset}px ${screenBounds.left}px round 10px)`;

    updateCanvasOutline(
      canvas,
      screenBounds
    );
  }

  function removeCanvasClip(canvas) {
    const container =
      canvas.wrapperEl ||
      canvas
        .lowerCanvasEl
        ?.parentElement;

    if (container) {
      container.classList.remove(
        'canvas-editor-side-view'
      );

      container.style.clipPath = '';
    }

    document
      .querySelector(
        '[data-canvas-editor-outline]'
      )
      ?.remove();
  }

  function getScreenBounds(
    canvas,
    bounds
  ) {
    const transform =
      Array.isArray(
        canvas.viewportTransform
      )
        ? canvas.viewportTransform
        : [
          1,
          0,
          0,
          1,
          0,
          0,
        ];

    const points = [
      [
        bounds.left,
        bounds.top,
      ],

      [
        bounds.right,
        bounds.top,
      ],

      [
        bounds.right,
        bounds.bottom,
      ],

      [
        bounds.left,
        bounds.bottom,
      ],
    ].map(([x, y]) => ({
      x:
        transform[0] * x +
        transform[2] * y +
        transform[4],

      y:
        transform[1] * x +
        transform[3] * y +
        transform[5],
    }));

    const xValues =
      points.map(
        point =>
          point.x
      );

    const yValues =
      points.map(
        point =>
          point.y
      );

    const left =
      Math.max(
        0,
        Math.min(...xValues)
      );

    const top =
      Math.max(
        0,
        Math.min(...yValues)
      );

    const right =
      Math.min(
        canvas.getWidth(),
        Math.max(...xValues)
      );

    const bottom =
      Math.min(
        canvas.getHeight(),
        Math.max(...yValues)
      );

    return {
      left,
      top,
      right,
      bottom,

      width:
        Math.max(
          1,
          right - left
        ),

      height:
        Math.max(
          1,
          bottom - top
        ),
    };
  }

  function updateCanvasOutline(
    canvas,
    screenBounds
  ) {
    const canvasWrap =
      document.getElementById(
        'canvas-wrap'
      );

    const container =
      canvas.wrapperEl ||
      canvas
        .lowerCanvasEl
        ?.parentElement;

    if (
      !canvasWrap ||
      !container
    ) {
      return;
    }

    let outline =
      canvasWrap.querySelector(
        '[data-canvas-editor-outline]'
      );

    if (!outline) {
      outline =
        document.createElement(
          'div'
        );

      outline.className =
        'canvas-editor-outline';

      outline
        .dataset
        .canvasEditorOutline =
        'true';

      canvasWrap.appendChild(
        outline
      );
    }

    Object.assign(
      outline.style,
      {
        left:
          `${container.offsetLeft + screenBounds.left}px`,

        top:
          `${container.offsetTop + screenBounds.top}px`,

        width:
          `${screenBounds.width}px`,

        height:
          `${screenBounds.height}px`,
      }
    );
  }

  function filterLayerPanel() {
    const activeView =
      getActiveView();

    const canvas =
      connectedCanvas;

    const panel =
      document.getElementById(
        'layer-list'
      );

    if (
      !activeView ||
      !canvas ||
      !panel
    ) {
      return;
    }

    panel
      .querySelectorAll(
        '.layer-item'
      )
      .forEach(item => {
        const object =
          canvas
            .getObjects()
            .find(
              candidate =>
                candidate._layerId ===
                item.dataset.objectId
            );

        if (
          !object ||
          getObjectViewId(
            canvas,
            object
          ) !== activeView.id
        ) {
          item.remove();
        }
      });

    panel
      .querySelectorAll(
        '.layer-item'
      )
      .forEach(
        (item, index) => {
          item.textContent =
            `${index + 1}. ${item.textContent.replace(/^\d+\.\s*/, '')}`;
        }
      );
  }

  function updateLayerPanelSafely() {
    if (
      typeof window.updateLayerPanel ===
      'function'
    ) {
      window.updateLayerPanel();
    }
  }

  function restoreCanvasPresentation(canvas) {
    removeEditorGuides(canvas);
    restoreTechnicalGuides(canvas);
    removeCanvasClip(canvas);
    restoreObjectInteractivity(canvas);
    setZoomControlsVisible(true);

    canvas.setViewportTransform([
      1,
      0,
      0,
      1,
      0,
      0,
    ]);

    canvas.calcOffset();
    canvas.requestRenderAll();
  }

  function withCanonicalViewport(
    canvas,
    callback
  ) {
    const previousViewport = [
      ...(
        canvas.viewportTransform ||
        [
          1,
          0,
          0,
          1,
          0,
          0,
        ]
      ),
    ];

    canvas
      ._canvasEditorCanonicalDepth =
      Number(
        canvas
          ._canvasEditorCanonicalDepth ||
        0
      ) +
      1;

    canvas.setViewportTransform([
      1,
      0,
      0,
      1,
      0,
      0,
    ]);

    canvas.calcOffset();
    canvas.renderAll();

    try {
      return callback();
    } finally {
      canvas.setViewportTransform(
        previousViewport
      );

      canvas.calcOffset();
      canvas.renderAll();

      canvas
        ._canvasEditorCanonicalDepth =
        Math.max(
          0,
          Number(
            canvas
              ._canvasEditorCanonicalDepth ||
            1
          ) -
          1
        );
    }
  }

  function isGuideObject(object) {
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
      object?._isCenterGuide ||
      object?.[EDITOR_GUIDE_PROPERTY]
    );
  }

  function getGuidePalette(
    backgroundColor
  ) {
    const {
      r,
      g,
      b,
    } = parseColor(
      backgroundColor
    );

    const luminance =
      getRelativeLuminance(
        r,
        g,
        b
      );

    return luminance < 0.38
      ? {
        zone:
          '#8DE5D5',

        margin:
          '#FFFFFF',
      }
      : {
        zone:
          '#075E54',

        margin:
          '#18231D',
      };
  }

  function parseColor(value) {
    const fallback = {
      r: 183,
      g: 189,
      b: 184,
    };

    const match =
      String(value || '')
        .trim()
        .match(
          /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
        );

    if (!match) {
      return fallback;
    }

    const hex =
      match[1].length === 3
        ? [...match[1]]
          .map(
            character =>
              character.repeat(2)
          )
          .join('')
        : match[1];

    return {
      r:
        parseInt(
          hex.slice(0, 2),
          16
        ),

      g:
        parseInt(
          hex.slice(2, 4),
          16
        ),

      b:
        parseInt(
          hex.slice(4, 6),
          16
        ),
    };
  }

  function getRelativeLuminance(
    r,
    g,
    b
  ) {
    const [
      red,
      green,
      blue,
    ] = [r, g, b].map(
      value => {
        const channel =
          value / 255;

        return channel <= 0.04045
          ? channel / 12.92
          : Math.pow(
            (
              channel +
              0.055
            ) /
            1.055,
            2.4
          );
      }
    );

    return (
      red * 0.2126 +
      green * 0.7152 +
      blue * 0.0722
    );
  }

  function normalizeRotation(value) {
    return (
      (
        Number(value || 0) %
        360
      ) +
      360
    ) %
      360;
  }

  function isAngleNear(
    angle,
    target
  ) {
    const difference =
      Math.abs(
        normalizeRotation(angle) -
        normalizeRotation(target)
      );

    return Math.min(
      difference,
      360 - difference
    ) <= ANGLE_EPSILON;
  }

  function clamp(
    value,
    minimum,
    maximum
  ) {
    return Math.min(
      maximum,
      Math.max(
        minimum,
        value
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