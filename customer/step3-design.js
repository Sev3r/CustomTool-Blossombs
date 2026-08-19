/**
 * step3-design.js
 * Stap 3: Ontwerp uploaden of maken met Fabric.js.
 * Canvas is gekoppeld aan gekozen personalisatietype.
 * Canvas blijft binnen de beschikbare viewport.
 * Export gebeurt op basis van werkelijke afmetingen van personalisatie op 300 DPI.
 */

const DESIGN_STATE_KEY = 'cot_design_state';

let fabricCanvas = null;
let fabricHistory = [];
let fabricActiveColor = '#1D9E75';
let fabricBackgroundColor = '#b7bdb8';
let uploadedDataURL = null;
let uploadedFileName = null;
let uploadedCheck = null;
let uploadedPdfDataURL = null;
let uploadedRillinesPdfDataURL = null;
let activeDesignTab = 'tool';
let fabricInitToken = 0;
let fabricInitTimer = null;
let canvasZoom = 1.1;

const CANVAS_ZOOM_MIN = 0.65;
const CANVAS_ZOOM_MAX = 2.5;
const CANVAS_ZOOM_STEP = 0.1;

const DESIGN_VIEW_ORIENTATION_VERSION = 2;
const DESIGN_VIEW_VIEWPORT_PADDING_PX = 20;
const DESIGN_VIEW_VISIBLE_MARGIN_PX = 12;
const DESIGN_VIEW_VIEWPORT_EPSILON = 0.001;
const DESIGN_VIEW_GUIDE_FLAG = '_isDesignViewGuide';

const FABRIC_SERIALIZABLE_PROPERTIES = [
  '_layerId',
  '_uploadMeta',
  '_designViewId',
  '_designViewRotation',
  '_designOrientationVersion',
];

let designViewContext = null;
let designViewResizeObserver = null;
let designViewSyncFrame = null;
let designViewCanonicalDepth = 0;

const IMAGE_DPI_RECOMMENDED = 300;
const IMAGE_DPI_MINIMUM = 150;

const CENTER_SNAP_THRESHOLD_PX = 6;
const CENTER_GUIDE_COLOR = '#5C7A5C';
const CENTER_GUIDE_STROKE_WIDTH = 1.25;
const CENTER_GUIDE_DASH = [6, 4];

const AVAILABLE_FONTS = [
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Playfair Display', value: "'Playfair Display', serif" },
  { label: 'Montserrat', value: "'Montserrat', sans-serif" },
  { label: 'Lato', value: "'Lato', sans-serif" },
  { label: 'Raleway', value: "'Raleway', sans-serif" },
  { label: 'Oswald', value: "'Oswald', sans-serif" },
  { label: 'Pacifico', value: "'Pacifico', cursive" },
  { label: 'Courier Prime', value: "'Courier Prime', monospace" },
];

function renderDesignPage() {
  const element = document.getElementById('page-design');
  const product = Session.getProduct();
  const options = Session.getOptions();
  const savedDesign = Session.getDesign() || {};

  if (!product) {
    navigateTo('select');
    return;
  }

  if (!options) {
    navigateTo('options');
    return;
  }

  const personalisationTypes = Array.isArray(product.personalisatieTypes)
    ? product.personalisatieTypes.filter(
      personalisationType => personalisationType.active !== false
    )
    : [];

  const activePersonalisation = personalisationTypes.find(
    personalisationType => personalisationType.id === options?.persTypeId
  ) ||
    options?.persType ||
    personalisationTypes[0] ||
    null;

  const stateKey =
    `${DESIGN_STATE_KEY}_${product.id}_${activePersonalisation?.id || 'standaard'}`;

  const savedState = {
    ...savedDesign,
    ...(loadDesignState(stateKey) || {}),
  };

  const previewConfig = getDesignViewConfig(
    activePersonalisation,
    product
  );

  const initialDesignViewId = resolveInitialDesignViewId(
    previewConfig,
    savedState?.editorViewId ||
      savedDesign.editorViewId ||
      savedState?.previewViewId ||
      savedDesign.previewViewId ||
      null
  );

  uploadedDataURL =
    savedDesign.dataURL ||
    savedState?.dataURL ||
    null;

  uploadedFileName =
    savedDesign.fileName ||
    savedState?.fileName ||
    null;

  uploadedCheck =
    savedDesign.uploadCheck ||
    savedState?.uploadCheck ||
    null;

  uploadedPdfDataURL =
    savedDesign.pdfDataURL ||
    savedState?.pdfDataURL ||
    null;

  uploadedRillinesPdfDataURL =
    savedDesign.rillinesPdfDataURL ||
    savedState?.rillinesPdfDataURL ||
    null;

  activeDesignTab =
    savedDesign.tab ||
    savedState?.tab ||
    'tool';

  element.innerHTML = `
    <h1 class="page-title">Ontwerp uw verpakking</h1>
    <p class="page-subtitle">
      Gebruik de ontwerptool of upload een eigen bestand
    </p>

    <div class="design-tabs">
      <button
        class="design-tab ${activeDesignTab === 'tool' ? 'active' : ''}"
        type="button"
        data-tab="tool"
      >
        Ontwerptool
      </button>

      <button
        class="design-tab ${activeDesignTab === 'upload' ? 'active' : ''}"
        type="button"
        data-tab="upload"
      >
        Bestand uploaden
      </button>
    </div>

    <div
      id="tab-tool"
      ${activeDesignTab === 'tool' ? '' : 'hidden'}
    >
      <div id="app">
        <aside id="sidebar">
          <div id="sidebar-header"></div>

          <div class="side-section">
            <div class="side-label">Toevoegen</div>

            <button
              class="tool-btn"
              type="button"
              id="btn-logo"
            >
              + Logo uploaden
            </button>

            <input
              type="file"
              id="file-input"
              accept="image/*"
              hidden
            >

            <button
              class="tool-btn"
              type="button"
              id="btn-text"
            >
              + Tekst toevoegen
            </button>
          </div>

          <div class="side-section">
            <label
              class="side-label"
              for="font-select"
            >
              Lettertype
            </label>

            <select
              id="font-select"
              class="font-select"
            >
              ${AVAILABLE_FONTS.map(font => `
                <option value="${escHtml(font.value)}">
                  ${escHtml(font.label)}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="side-section">
            <label
              class="side-label"
              for="font-size"
            >
              Lettergrootte
            </label>

            <select
              id="font-size"
              class="font-select"
            >
              ${[
                8,
                10,
                12,
                14,
                16,
                18,
                20,
                24,
                28,
                32,
                36,
                42,
                48,
                56,
                64,
                72,
                84,
                96,
              ].map(size => `
                <option
                  value="${size}"
                  ${size === 20 ? 'selected' : ''}
                >
                  ${size} px
                </option>
              `).join('')}
            </select>
          </div>

          <div class="side-section">
            <div class="side-label">Elementkleur</div>

            <div
              class="color-row"
              id="color-swatches"
            ></div>

            <div class="custom-color-row">
              <label for="custom-element-color">
                Eigen kleur
              </label>

              <input
                type="color"
                id="custom-element-color"
                class="custom-color-input"
                value="${escHtml(fabricActiveColor)}"
              >
            </div>
          </div>

          ${activePersonalisation?.allowBackgroundColor ? `
            <div class="side-section">
              <div class="side-label">
                Achtergrondkleur
              </div>

              <div
                class="color-row"
                id="background-color-swatches"
              ></div>

              <div class="custom-color-row">
                <label for="custom-background-color">
                  Eigen kleur
                </label>

                <input
                  type="color"
                  id="custom-background-color"
                  class="custom-color-input"
                  value="${escHtml(fabricBackgroundColor)}"
                >
              </div>
            </div>
          ` : ''}
        </aside>

        <section id="canvas-area">
          ${renderDesignViewToolbar(
            previewConfig,
            initialDesignViewId
          )}

          <div id="canvas-wrap">
            <div id="margin-warning">
              Object buiten marge
            </div>

            <canvas id="c"></canvas>

            <div
              class="canvas-zoom-controls"
              aria-label="Canvaszoom"
            >
              <button
                class="canvas-zoom-btn"
                type="button"
                id="btn-canvas-zoom-out"
                aria-label="Uitzoomen"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <circle
                    cx="7.5"
                    cy="7.5"
                    r="5.25"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />

                  <path
                    d="M11.5 11.5L15 15"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />

                  <path
                    d="M5.25 7.5H9.75"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                </svg>
              </button>

              <button
                class="canvas-zoom-btn"
                type="button"
                id="btn-canvas-zoom-in"
                aria-label="Inzoomen"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <circle
                    cx="7.5"
                    cy="7.5"
                    r="5.25"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />

                  <path
                    d="M11.5 11.5L15 15"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />

                  <path
                    d="M5.25 7.5H9.75"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />

                  <path
                    d="M7.5 5.25V9.75"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div id="status">
            Selecteer een element om te bewerken.
            Klik en sleep om te verplaatsen.
          </div>
        </section>

        <aside id="layer-panel">
          <div id="layer-header">Layers</div>
          <div id="layer-list"></div>
        </aside>
      </div>

      <div
        id="fabric-image-dpi-warning"
        class="fabric-image-dpi-warning"
        hidden
      ></div>
    </div>

    <div
      id="tab-upload"
      ${activeDesignTab === 'upload' ? '' : 'hidden'}
    >
      <div class="design-layout">
        <div>
          <div
            class="upload-zone"
            id="upload-zone"
          >
            <input
              type="file"
              id="upload-input"
              accept=".png,.jpg,.jpeg,.pdf,.ai,.eps"
            >

            <div class="upload-icon">📁</div>

            <div class="upload-title">
              Sleep uw bestand hierheen
            </div>

            <div class="upload-sub">
              of klik om te bladeren
            </div>

            <div class="upload-sub upload-format-hint">
              PNG, JPG, PDF, AI, EPS.
              Minimaal 300 DPI aanbevolen.
            </div>
          </div>

          ${uploadedDataURL ? `
            <div class="uploaded-file-status">
              <span>
                ${escHtml(uploadedFileName || 'Bestand geüpload')}
              </span>

              <button
                class="uploaded-file-remove"
                type="button"
                id="btn-clear-upload"
                aria-label="Upload verwijderen"
              >
                ×
              </button>
            </div>
          ` : ''}

          ${uploadedCheck ? `
            <div
              class="upload-check-message"
              data-status="${escHtml(uploadedCheck.status || 'warning')}"
            >
              ${escHtml(
                uploadedCheck.message ||
                'Upload gecontroleerd.'
              )}
            </div>
          ` : ''}
        </div>

        <div>
          <div
            class="preview-box"
            id="preview-box"
          >
            ${uploadedDataURL && uploadedDataURL.startsWith('data:image')
              ? `
                <img
                  src="${uploadedDataURL}"
                  alt="Preview van het geüploade bestand"
                >
              `
              : `
                <div class="preview-placeholder">
                  ${uploadedDataURL
                    ? escHtml(uploadedFileName || 'Bestand')
                    : 'Preview'}
                </div>
              `}

            <button
              class="preview-zoom"
              id="btn-zoom"
              type="button"
              ${!uploadedDataURL ? 'hidden' : ''}
              aria-label="Origineel bestand openen"
            >
              🔍
            </button>
          </div>

          <p class="technical-preview-caption">
            Preview van uw bestand
          </p>
        </div>
      </div>
    </div>

    <div
      id="design-error"
      class="design-error"
      hidden
    >
      Maak een ontwerp of upload een bestand om verder te gaan.
    </div>

    <div class="flow-nav">
      <button
        class="btn btn-outline"
        type="button"
        id="btn-design-back"
      >
        ← Terug
      </button>

      <button
        class="btn btn-green"
        type="button"
        id="btn-design-next"
      >
        Verder →
      </button>
    </div>
  `;

  bindDesignTabs(
    product,
    activePersonalisation,
    savedState,
    stateKey
  );

  bindUploadZone(
    stateKey,
    activePersonalisation,
    product
  );

  bindDesignNextButton(
    product,
    activePersonalisation,
    stateKey
  );

  document
    .getElementById('btn-design-back')
    ?.addEventListener(
      'click',
      () => {
        navigateTo('options');
      }
    );

  document
    .getElementById('btn-clear-upload')
    ?.addEventListener(
      'click',
      clearUpload
    );

  document
    .getElementById('btn-zoom')
    ?.addEventListener(
      'click',
      () => {
        if (uploadedDataURL) {
          window.open(
            uploadedDataURL,
            '_blank',
            'noopener'
          );
        }
      }
    );

  if (activeDesignTab === 'tool') {
    scheduleFabricInit(
      product,
      activePersonalisation,
      savedState,
      stateKey
    );
  }
}

function getDesignViewConfig(
  activePersonalisation,
  product
) {
  if (window.ProductPreview?.normalizeConfig) {
    return ProductPreview.normalizeConfig(
      activePersonalisation || {},
      product || {}
    );
  }

  const preview =
    activePersonalisation?.preview ||
    {};

  const views =
    Array.isArray(preview.views)
      ? preview.views
      : [];

  return {
    enabled:
      preview.enabled === true &&
      views.length > 0,

    type:
      preview.type ||
      'single-view',

    defaultViewId:
      preview.defaultViewId ||
      views[0]?.id ||
      null,

    views,

    canvasGuides:
      Array.isArray(preview.canvasGuides)
        ? preview.canvasGuides
        : [],
  };
}

function resolveInitialDesignViewId(
  config,
  storedViewId = null
) {
  if (
    config?.views?.some(
      view => view.id === storedViewId
    )
  ) {
    return storedViewId;
  }

  if (
    !config?.enabled ||
    !config.views?.length
  ) {
    return null;
  }

  return (
    config.defaultViewId ||
    config.views[0].id
  );
}

function renderDesignViewToolbar(
  config,
  activeViewId
) {
  const hasViews = Boolean(
    config?.enabled &&
    config.views?.length
  );

  if (!hasViews) {
    return `
      <div
        id="canvas-toolbar"
        class="canvas-toolbar-actions-only"
      >
        <button
          class="tb-btn"
          type="button"
          id="btn-undo"
        >
          Ongedaan
        </button>

        <button
          class="tb-btn"
          type="button"
          id="btn-clear"
        >
          Reset
        </button>
      </div>
    `;
  }

  return `
    <div
      id="canvas-toolbar"
      class="canvas-view-toolbar"
    >
      <div class="canvas-view-toolbar-main">
        <span class="canvas-view-toolbar-label">
          Productzijde
        </span>

        <div
          class="canvas-view-tabs"
          role="tablist"
          aria-label="Te bewerken productzijde"
        >
          ${config.views.map(view => {
            const isActive =
              view.id === activeViewId;

            return `
              <button
                class="canvas-view-tab${isActive ? ' active' : ''}"
                type="button"
                role="tab"
                aria-selected="${String(isActive)}"
                tabindex="${isActive ? '0' : '-1'}"
                data-design-view-id="${escHtml(view.id)}"
              >
                ${escHtml(view.label || 'Zijde')}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <div class="canvas-view-toolbar-actions">
        <button
          class="tb-btn"
          type="button"
          id="btn-undo"
        >
          Ongedaan
        </button>

        <button
          class="tb-btn"
          type="button"
          id="btn-clear"
        >
          Reset
        </button>
      </div>

      <p
        id="canvas-view-note"
        class="canvas-view-note"
      ></p>
    </div>
  `;
}

function initializeDesignViewContext({
  product,
  activePers,
  savedState,
  stateKey,
  margin,
}) {
  destroyDesignViewContext();

  const config =
    getDesignViewConfig(
      activePers,
      product
    );

  const spec =
    window.ProductPreview?.getPrintSpec
      ? ProductPreview.getPrintSpec(
        activePers || {},
        product || {}
      )
      : window.PrintSpecs?.normalizePrintSpec
        ? PrintSpecs.normalizePrintSpec(
          activePers || {},
          product || {}
        )
        : {
          exportWidthMm:
            Number(
              activePers?.width_mm ||
              product?.width_mm ||
              100
            ),

          exportHeightMm:
            Number(
              activePers?.height_mm ||
              product?.height_mm ||
              70
            ),

          trimXmm: 0,
          trimYmm: 0,
        };

  designViewContext = {
    product,
    activePers,
    stateKey,
    config,
    spec,
    margin,

    activeViewId:
      resolveInitialDesignViewId(
        config,
        savedState?.editorViewId ||
        savedState?.previewViewId ||
        null
      ),

    pageAbortController:
      new AbortController(),
  };
}

function destroyDesignViewContext() {
  designViewResizeObserver?.disconnect();
  designViewResizeObserver = null;

  if (designViewSyncFrame) {
    cancelAnimationFrame(
      designViewSyncFrame
    );

    designViewSyncFrame = null;
  }

  designViewContext
    ?.pageAbortController
    ?.abort();

  if (fabricCanvas) {
    removeDesignViewClip(
      fabricCanvas
    );

    removeDesignViewGuides(
      fabricCanvas
    );
  }

  designViewContext = null;
}

function bindDesignViewControls(canvas) {
  if (!designViewContext?.config.enabled) {
    return;
  }

  const signal =
    designViewContext
      .pageAbortController
      .signal;

  document
    .querySelectorAll(
      '[data-design-view-id]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          setActiveDesignView(
            button.dataset.designViewId,
            true
          );
        },
        { signal }
      );
    });

  document
    .getElementById('page-design')
    ?.addEventListener(
      'click',
      event => {
        const previewButton =
          event.target.closest(
            '[data-product-preview-view-id]'
          );

        if (!previewButton) {
          return;
        }

        const viewId =
          previewButton
            .dataset
            .productPreviewViewId;

        if (getDesignViewById(viewId)) {
          setActiveDesignView(
            viewId,
            false
          );
        }
      },
      { signal }
    );

  if (
    typeof ResizeObserver ===
    'function'
  ) {
    const canvasWrap =
      document.getElementById(
        'canvas-wrap'
      );

    if (canvasWrap) {
      designViewResizeObserver =
        new ResizeObserver(() => {
          queueActiveDesignView(
            canvas
          );
        });

      designViewResizeObserver.observe(
        canvasWrap
      );
    }
  }
}

function setActiveDesignView(
  viewId,
  synchronizePreview = false
) {
  if (
    !designViewContext ||
    !getDesignViewById(viewId)
  ) {
    return;
  }

  designViewContext.activeViewId =
    viewId;

  persistDesignState(
    designViewContext.stateKey,
    {
      editorViewId:
        viewId,

      previewViewId:
        viewId,
    }
  );

  updateDesignViewToolbarState();

  if (fabricCanvas) {
    fabricCanvas.discardActiveObject();

    applyActiveDesignView(
      fabricCanvas
    );
  }

  if (synchronizePreview) {
    const previewButton = [
      ...document.querySelectorAll(
        '[data-product-preview-view-id]'
      ),
    ].find(button => (
      button
        .dataset
        .productPreviewViewId ===
      viewId
    ));

    previewButton?.click();
  }
}

function updateDesignViewToolbarState() {
  if (!designViewContext) {
    return;
  }

  document
    .querySelectorAll(
      '[data-design-view-id]'
    )
    .forEach(button => {
      const isActive =
        button.dataset.designViewId ===
        designViewContext.activeViewId;

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

  const note =
    document.getElementById(
      'canvas-view-note'
    );

  if (!note) {
    return;
  }

  const view =
    getActiveDesignView();

  note.textContent =
    `Je ontwerpt ${view?.label || 'deze productzijde'} zoals deze op het eindproduct verschijnt. De technische draairichting wordt automatisch in het drukbestand verwerkt.`;
}

function getDesignViewById(viewId) {
  return (
    designViewContext
      ?.config
      ?.views
      ?.find(
        view => view.id === viewId
      ) ||
    null
  );
}

function getActiveDesignView() {
  if (!designViewContext?.config.enabled) {
    return null;
  }

  return (
    getDesignViewById(
      designViewContext.activeViewId
    ) ||
    getDesignViewById(
      designViewContext.config.defaultViewId
    ) ||
    designViewContext.config.views[0] ||
    null
  );
}

function isDesignSideViewActive() {
  return Boolean(
    getActiveDesignView()
  );
}

function getDesignViewRotation(view) {
  return normalizeDesignRotation(
    view?.sourceZone?.rotation
  );
}

function normalizeDesignRotation(value) {
  return (
    (
      Number(value || 0) %
      360
    ) +
    360
  ) %
    360;
}

function getDesignViewBounds(
  canvas,
  view = getActiveDesignView()
) {
  if (
    !canvas ||
    !view ||
    !designViewContext?.spec
  ) {
    return null;
  }

  const sourceZone =
    view.sourceZone ||
    {};

  const spec =
    designViewContext.spec;

  const exportWidthMm =
    Number(
      spec.exportWidthMm ||
      spec.finishWidthMm ||
      1
    );

  const exportHeightMm =
    Number(
      spec.exportHeightMm ||
      spec.finishHeightMm ||
      1
    );

  const left =
    window.PrintSpecs
      ?.finishMmToCanvasX
      ? PrintSpecs.finishMmToCanvasX(
        sourceZone.x_mm,
        spec,
        canvas.getWidth()
      )
      : (
        (
          Number(spec.trimXmm || 0) +
          Number(sourceZone.x_mm || 0)
        ) /
        exportWidthMm
      ) *
      canvas.getWidth();

  const top =
    window.PrintSpecs
      ?.finishMmToCanvasY
      ? PrintSpecs.finishMmToCanvasY(
        sourceZone.y_mm,
        spec,
        canvas.getHeight()
      )
      : (
        (
          Number(spec.trimYmm || 0) +
          Number(sourceZone.y_mm || 0)
        ) /
        exportHeightMm
      ) *
      canvas.getHeight();

  const width =
    (
      Number(
        sourceZone.width_mm ||
        0
      ) /
      exportWidthMm
    ) *
    canvas.getWidth();

  const height =
    (
      Number(
        sourceZone.height_mm ||
        0
      ) /
      exportHeightMm
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
      getDesignViewRotation(view),

    viewId:
      view.id,
  };
}

function createDesignViewViewport(
  canvas,
  bounds
) {
  const scale =
    Math.min(
      Math.max(
        1,
        canvas.getWidth() -
        DESIGN_VIEW_VIEWPORT_PADDING_PX * 2
      ) /
      bounds.width,

      Math.max(
        1,
        canvas.getHeight() -
        DESIGN_VIEW_VIEWPORT_PADDING_PX * 2
      ) /
      bounds.height
    );

  return [
    scale,
    0,
    0,
    scale,

    canvas.getWidth() / 2 -
      scale * bounds.centerX,

    canvas.getHeight() / 2 -
      scale * bounds.centerY,
  ];
}

function hasExpectedDesignViewport(canvas) {
  if (
    !canvas ||
    designViewCanonicalDepth > 0
  ) {
    return true;
  }

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

  const bounds =
    getDesignViewBounds(
      canvas
    );

  const expected =
    bounds
      ? createDesignViewViewport(
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
      DESIGN_VIEW_VIEWPORT_EPSILON
    )
  );
}

function queueActiveDesignView(
  canvas = fabricCanvas
) {
  if (
    !canvas ||
    designViewSyncFrame
  ) {
    return;
  }

  designViewSyncFrame =
    requestAnimationFrame(() => {
      designViewSyncFrame = null;

      if (
        canvas ===
        fabricCanvas
      ) {
        applyActiveDesignView(
          canvas
        );
      }
    });
}

function applyActiveDesignView(
  canvas,
  {
    updateLayers = true,
  } = {}
) {
  if (
    !canvas ||
    !designViewContext?.config.enabled
  ) {
    return;
  }

  removeDesignViewGuides(
    canvas
  );

  restoreTechnicalGuideVisibility(
    canvas
  );

  const view =
    getActiveDesignView();

  const bounds =
    getDesignViewBounds(
      canvas,
      view
    );

  if (
    !view ||
    !bounds
  ) {
    return;
  }

  designViewContext.activeViewId =
    view.id;

  clearCanvasContainerTransform(
    canvas
  );

  canvas.setViewportTransform(
    createDesignViewViewport(
      canvas,
      bounds
    )
  );

  canvas.calcOffset();

  hideTechnicalGuides(
    canvas
  );

  normalizeActiveDesignViewObjects(
    canvas,
    view,
    bounds
  );

  updateDesignObjectInteractivity(
    canvas
  );

  addDesignViewGuides(
    canvas,
    bounds
  );

  applyDesignViewClip(
    canvas,
    bounds
  );

  setCanvasZoomControlsVisible(
    true
  );

  applyCanvasZoom();

  if (updateLayers) {
    updateLayerPanel();
  }

  updateDesignViewToolbarState();

  canvas.requestRenderAll();
}

function clearCanvasContainerTransform(canvas) {
  const container =
    canvas.wrapperEl ||
    canvas.lowerCanvasEl?.parentElement;

  if (!container) {
    return;
  }

  container.style.transform =
    'none';

  container.style.transformOrigin =
    'center center';
}

function setCanvasZoomControlsVisible(visible) {
  const controls =
    document.querySelector(
      '.canvas-zoom-controls'
    );

  if (controls) {
    controls.hidden =
      !visible;
  }
}

function prepareNewObjectForActiveDesignView(
  canvas,
  object,
  {
    fallbackLeft =
      canvas?.getWidth?.() / 2 ||
      0,

    fallbackTop =
      canvas?.getHeight?.() / 2 ||
      0,

    maximumWidth = null,
  } = {}
) {
  if (
    !canvas ||
    !object ||
    isGuideObject(object)
  ) {
    return;
  }

  const view =
    getActiveDesignView();

  const bounds =
    getDesignViewBounds(
      canvas,
      view
    );

  if (
    view &&
    bounds
  ) {
    object.set({
      left:
        bounds.centerX,

      top:
        bounds.centerY,

      originX:
        'center',

      originY:
        'center',

      _designViewId:
        view.id,

      _designViewRotation:
        getDesignViewRotation(view),

      _designOrientationVersion:
        DESIGN_VIEW_ORIENTATION_VERSION,
    });

    if (
      maximumWidth &&
      object.type === 'image'
    ) {
      scaleFabricImageToMaximumWidth(
        object,
        Math.min(
          maximumWidth,
          bounds.width * 0.42
        )
      );
    }
  } else {
    object.set({
      left:
        fallbackLeft,

      top:
        fallbackTop,

      _designViewId:
        null,

      _designViewRotation:
        0,

      _designOrientationVersion:
        DESIGN_VIEW_ORIENTATION_VERSION,
    });
  }

  object.setCoords?.();
}

function scaleFabricImageToMaximumWidth(
  object,
  maximumWidth
) {
  const sourceWidth =
    Number(
      object?.width ||
      0
    );

  const currentWidth =
    Number(
      object?.getScaledWidth?.() ||
      sourceWidth
    );

  if (
    !sourceWidth ||
    !maximumWidth ||
    currentWidth <= maximumWidth
  ) {
    return;
  }

  object.scale(
    maximumWidth /
    sourceWidth
  );
}

function hydrateDesignObjectMetadata(canvas) {
  if (
    !canvas ||
    !designViewContext?.config.enabled
  ) {
    return false;
  }

  let migrated = false;

  canvas
    .getObjects()
    .filter(
      object =>
        !isGuideObject(object)
    )
    .forEach(object => {
      const storedView =
        getDesignViewById(
          object._designViewId
        );

      const inferredViewId =
        storedView
          ? storedView.id
          : inferDesignViewIdForObject(
            canvas,
            object
          );

      const fallbackView =
        getActiveDesignView() ||
        designViewContext
          .config
          .views[0] ||
        null;

      const view =
        getDesignViewById(
          inferredViewId
        ) ||
        fallbackView;

      if (!view) {
        return;
      }

      const bounds =
        getDesignViewBounds(
          canvas,
          view
        );

      const configuredRotation =
        getDesignViewRotation(
          view
        );

      const orientationVersion =
        Number(
          object._designOrientationVersion ||
          0
        );

      const centerBefore =
        object.getCenterPoint?.();

      const rotatedCenter =
        getRotatedPointAroundDesignBounds(
          centerBefore,
          bounds,
          configuredRotation
        );

      const shouldRecoverLegacyPlacement =
        Boolean(
          bounds &&
          configuredRotation &&
          centerBefore &&
          !isPointInsideDesignBounds(
            centerBefore,
            bounds
          ) &&
          isPointInsideDesignBounds(
            rotatedCenter,
            bounds
          )
        );

      if (
        (
          orientationVersion === 1 ||
          shouldRecoverLegacyPlacement
        ) &&
        bounds &&
        configuredRotation
      ) {
        migrateLegacyDesignObjectToVisualOrientation(
          object,
          bounds,
          configuredRotation
        );

        migrated = true;
      }

      if (
        bounds &&
        fitDesignObjectInsideBounds(
          object,
          bounds
        )
      ) {
        migrated = true;
      }

      object._designViewId =
        view.id;

      object._designViewRotation =
        configuredRotation;

      object._designOrientationVersion =
        DESIGN_VIEW_ORIENTATION_VERSION;

      object._designOriginalVisible =
        true;

      object.setCoords?.();
    });

  return migrated;
}

function assignObjectToCurrentDesignView(
  canvas,
  object
) {
  if (
    !canvas ||
    !object ||
    isGuideObject(object) ||
    !designViewContext?.config.enabled
  ) {
    return;
  }

  const activeView =
    getActiveDesignView();

  const nextViewId =
    activeView?.id ||
    inferDesignViewIdForObject(
      canvas,
      object
    );

  const view =
    getDesignViewById(
      nextViewId
    );

  object._designViewId =
    nextViewId;

  object._designViewRotation =
    getDesignViewRotation(
      view
    );

  object._designOrientationVersion =
    DESIGN_VIEW_ORIENTATION_VERSION;

  object.setCoords?.();
}

function inferDesignViewIdForObject(
  canvas,
  object
) {
  const center =
    object?.getCenterPoint?.();

  if (!center) {
    return null;
  }

  return (
    designViewContext
      ?.config
      ?.views
      ?.find(view => {
        const bounds =
          getDesignViewBounds(
            canvas,
            view
          );

        return Boolean(
          bounds &&
          center.x >= bounds.left &&
          center.x <= bounds.right &&
          center.y >= bounds.top &&
          center.y <= bounds.bottom
        );
      })
      ?.id ||
    null
  );
}

function getObjectDesignViewId(
  canvas,
  object
) {
  return getDesignViewById(
    object?._designViewId
  )
    ? object._designViewId
    : inferDesignViewIdForObject(
      canvas,
      object
    );
}

function constrainObjectToActiveDesignView(
  canvas,
  object
) {
  const bounds =
    getDesignViewBounds(
      canvas
    );

  if (
    !bounds ||
    !object ||
    isGuideObject(object)
  ) {
    return;
  }

  fitDesignObjectInsideBounds(
    object,
    bounds
  );

  object._designViewId =
    bounds.viewId;

  object._designViewRotation =
    bounds.rotation;

  object._designOrientationVersion =
    DESIGN_VIEW_ORIENTATION_VERSION;

  object.setCoords?.();
}

function fitDesignObjectInsideBounds(
  object,
  bounds,
  {
    scaleDown = true,
    padding = 2,
  } = {}
) {
  if (
    !object ||
    !bounds
  ) {
    return false;
  }

  object.setCoords?.();

  let objectBounds =
    object.getBoundingRect(
      true,
      true
    );

  const maximumWidth =
    Math.max(
      1,
      bounds.width -
      padding * 2
    );

  const maximumHeight =
    Math.max(
      1,
      bounds.height -
      padding * 2
    );

  let changed = false;

  if (
    scaleDown &&
    (
      objectBounds.width >
      maximumWidth ||
      objectBounds.height >
      maximumHeight
    )
  ) {
    const scaleFactor =
      Math.min(
        maximumWidth /
        Math.max(
          1,
          objectBounds.width
        ),

        maximumHeight /
        Math.max(
          1,
          objectBounds.height
        )
      );

    if (
      Number.isFinite(scaleFactor) &&
      scaleFactor > 0 &&
      scaleFactor < 1
    ) {
      object.scaleX =
        Number(
          object.scaleX ||
          1
        ) *
        scaleFactor;

      object.scaleY =
        Number(
          object.scaleY ||
          1
        ) *
        scaleFactor;

      object.setCoords?.();

      objectBounds =
        object.getBoundingRect(
          true,
          true
        );

      changed = true;
    }
  }

  let offsetX = 0;
  let offsetY = 0;

  const minimumLeft =
    bounds.left +
    padding;

  const minimumTop =
    bounds.top +
    padding;

  const maximumRight =
    bounds.right -
    padding;

  const maximumBottom =
    bounds.bottom -
    padding;

  if (
    objectBounds.left <
    minimumLeft
  ) {
    offsetX =
      minimumLeft -
      objectBounds.left;
  } else if (
    objectBounds.left +
    objectBounds.width >
    maximumRight
  ) {
    offsetX =
      maximumRight -
      (
        objectBounds.left +
        objectBounds.width
      );
  }

  if (
    objectBounds.top <
    minimumTop
  ) {
    offsetY =
      minimumTop -
      objectBounds.top;
  } else if (
    objectBounds.top +
    objectBounds.height >
    maximumBottom
  ) {
    offsetY =
      maximumBottom -
      (
        objectBounds.top +
        objectBounds.height
      );
  }

  if (
    offsetX ||
    offsetY
  ) {
    object.set({
      left:
        Number(
          object.left ||
          0
        ) +
        offsetX,

      top:
        Number(
          object.top ||
          0
        ) +
        offsetY,
    });

    object.setCoords?.();

    changed = true;
  }

  return changed;
}

function isPointInsideDesignBounds(
  point,
  bounds
) {
  return Boolean(
    point &&
    bounds &&
    point.x >= bounds.left &&
    point.x <= bounds.right &&
    point.y >= bounds.top &&
    point.y <= bounds.bottom
  );
}

function getRotatedPointAroundDesignBounds(
  point,
  bounds,
  rotation
) {
  if (
    !point ||
    !bounds
  ) {
    return null;
  }

  const radians =
    normalizeDesignRotation(
      rotation
    ) *
    Math.PI /
    180;

  const offsetX =
    point.x -
    bounds.centerX;

  const offsetY =
    point.y -
    bounds.centerY;

  return new fabric.Point(
    bounds.centerX +
    offsetX *
    Math.cos(radians) -
    offsetY *
    Math.sin(radians),

    bounds.centerY +
    offsetX *
    Math.sin(radians) +
    offsetY *
    Math.cos(radians)
  );
}

function migrateLegacyDesignObjectToVisualOrientation(
  object,
  bounds,
  rotation
) {
  if (
    !object ||
    !bounds
  ) {
    return;
  }

  const currentCenter =
    object.getCenterPoint?.();

  const rotatedCenter =
    getRotatedPointAroundDesignBounds(
      currentCenter,
      bounds,
      rotation
    );

  object.angle =
    normalizeDesignRotation(
      Number(object.angle || 0) +
      normalizeDesignRotation(rotation)
    );

  if (rotatedCenter) {
    object.setPositionByOrigin(
      rotatedCenter,
      'center',
      'center'
    );
  }

  object.setCoords?.();
}

function normalizeActiveDesignViewObjects(
  canvas,
  view,
  bounds
) {
  if (
    !canvas ||
    !view ||
    !bounds
  ) {
    return;
  }

  canvas
    .getObjects()
    .filter(object => (
      !isGuideObject(object) &&
      getObjectDesignViewId(
        canvas,
        object
      ) === view.id
    ))
    .forEach(object => {
      fitDesignObjectInsideBounds(
        object,
        bounds
      );
    });
}

function updateDesignObjectInteractivity(canvas) {
  const activeView =
    getActiveDesignView();

  canvas
    .getObjects()
    .filter(
      object =>
        !isGuideObject(object)
    )
    .forEach(object => {
      object._designOriginalSelectable ??=
        object.selectable !== false;

      object._designOriginalEvented ??=
        object.evented !== false;

      object._designOriginalVisible =
        true;

      const belongsToActiveView =
        getObjectDesignViewId(
          canvas,
          object
        ) === activeView?.id;

      object.visible =
        belongsToActiveView &&
        object._designOriginalVisible;

      object.selectable =
        belongsToActiveView &&
        object._designOriginalSelectable;

      object.evented =
        belongsToActiveView &&
        object._designOriginalEvented;
    });
}

function restoreAllDesignObjectsForCanonicalRender(canvas) {
  if (!canvas) {
    return;
  }

  canvas
    .getObjects()
    .filter(
      object =>
        !isGuideObject(object)
    )
    .forEach(object => {
      object.visible =
        object._designOriginalVisible !==
        false;

      object.selectable =
        object._designOriginalSelectable !==
        false;

      object.evented =
        object._designOriginalEvented !==
        false;
    });
}

function hideTechnicalGuides(canvas) {
  canvas
    .getObjects()
    .filter(object => (
      isGuideObject(object) &&
      !object[DESIGN_VIEW_GUIDE_FLAG]
    ))
    .forEach(object => {
      object.visible = false;
    });
}

function restoreTechnicalGuideVisibility(canvas) {
  canvas
    .getObjects()
    .filter(object => (
      isGuideObject(object) &&
      !object[DESIGN_VIEW_GUIDE_FLAG]
    ))
    .forEach(object => {
      object.visible = true;
    });
}

function removeDesignViewGuides(canvas) {
  canvas
    .getObjects()
    .filter(
      object =>
        object[DESIGN_VIEW_GUIDE_FLAG]
    )
    .forEach(object => {
      canvas.remove(object);
    });
}

function addDesignViewGuides(
  canvas,
  bounds
) {
  const guideColor =
    getContrastingGuideColor(
      fabricBackgroundColor
    );

  const safeMargin =
    Math.min(
      designViewContext?.margin ||
      0,

      bounds.width / 3,
      bounds.height / 3
    );

  const guides = [
    new fabric.Rect({
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
        guideColor,

      strokeWidth:
        1.75,

      strokeDashArray:
        [7, 5],
    }),

    new fabric.Rect({
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
        guideColor,

      strokeWidth:
        1.75,

      strokeDashArray:
        [6, 4],
    }),
  ];

  guides.forEach(guide => {
    guide.set({
      strokeUniform:
        true,

      selectable:
        false,

      evented:
        false,

      objectCaching:
        false,

      excludeFromExport:
        true,

      _isGuide:
        true,

      [DESIGN_VIEW_GUIDE_FLAG]:
        true,
    });

    canvas.add(guide);
    canvas.bringToFront(guide);
  });
}

function getDesignViewScreenBounds(
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
      point => point.x
    );

  const yValues =
    points.map(
      point => point.y
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

function applyDesignViewClip(
  canvas,
  bounds
) {
  const container =
    canvas.wrapperEl ||
    canvas.lowerCanvasEl?.parentElement;

  if (!container) {
    return;
  }

  const screenBounds =
    getDesignViewScreenBounds(
      canvas,
      bounds
    );

  const visibleLeft =
    Math.max(
      0,
      screenBounds.left -
      DESIGN_VIEW_VISIBLE_MARGIN_PX
    );

  const visibleTop =
    Math.max(
      0,
      screenBounds.top -
      DESIGN_VIEW_VISIBLE_MARGIN_PX
    );

  const visibleRight =
    Math.min(
      canvas.getWidth(),
      screenBounds.right +
      DESIGN_VIEW_VISIBLE_MARGIN_PX
    );

  const visibleBottom =
    Math.min(
      canvas.getHeight(),
      screenBounds.bottom +
      DESIGN_VIEW_VISIBLE_MARGIN_PX
    );

  const rightInset =
    Math.max(
      0,
      canvas.getWidth() -
      visibleRight
    );

  const bottomInset =
    Math.max(
      0,
      canvas.getHeight() -
      visibleBottom
    );

  container.classList.add(
    'canvas-editor-side-view'
  );

  container.style.clipPath =
    `inset(${visibleTop}px ${rightInset}px ${bottomInset}px ${visibleLeft}px round 10px)`;

  container.style.overflow =
    'hidden';

  document
    .getElementById('canvas-wrap')
    ?.classList
    .add('is-design-side-view');
}

function removeDesignViewClip(canvas) {
  const container =
    canvas?.wrapperEl ||
    canvas?.lowerCanvasEl?.parentElement;

  if (container) {
    container.classList.remove(
      'canvas-editor-side-view'
    );

    container.style.clipPath = '';
    container.style.overflow = '';
  }

  document
    .getElementById('canvas-wrap')
    ?.classList
    .remove('is-design-side-view');

  document
    .querySelector(
      '[data-canvas-editor-outline]'
    )
    ?.remove();
}

function isOutsideActiveDesignViewMargin(object) {
  if (
    !fabricCanvas ||
    !object ||
    !isDesignSideViewActive()
  ) {
    return null;
  }

  const view =
    getActiveDesignView();

  if (!view) {
    return null;
  }

  return isObjectOutsideDesignViewMargin(
    fabricCanvas,
    object,
    view,
    designViewContext?.margin || 0
  );
}

function isObjectOutsideDesignViewMargin(
  canvas,
  object,
  view,
  fallbackMargin = 0
) {
  if (
    !canvas ||
    !object ||
    !view
  ) {
    return false;
  }

  const bounds =
    getDesignViewBounds(
      canvas,
      view
    );

  if (!bounds) {
    return false;
  }

  const safeMargin =
    Math.min(
      designViewContext?.margin ??
      fallbackMargin,

      bounds.width / 3,
      bounds.height / 3
    );

  const objectBounds =
    object.getBoundingRect(
      true,
      true
    );

  return (
    objectBounds.left <
    bounds.left +
    safeMargin ||

    objectBounds.top <
    bounds.top +
    safeMargin ||

    objectBounds.left +
    objectBounds.width >
    bounds.right -
    safeMargin ||

    objectBounds.top +
    objectBounds.height >
    bounds.bottom -
    safeMargin
  );
}

function withCanonicalDesignCanvas(
  canvas,
  callback,
  {
    hideGuides = true,
  } = {}
) {
  if (
    !canvas ||
    typeof callback !== 'function'
  ) {
    return null;
  }

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

  const activeObject =
    canvas.getActiveObject();

  const guideStates =
    getGuideObjects(canvas).map(
      object => ({
        object,
        visible:
          object.visible,
      })
    );

  const designObjectStates =
    canvas
      .getObjects()
      .filter(
        object =>
          !isGuideObject(object)
      )
      .map(object => ({
        object,

        visible:
          object.visible,

        selectable:
          object.selectable,

        evented:
          object.evented,
      }));

  designViewCanonicalDepth += 1;

  canvas.setViewportTransform([
    1,
    0,
    0,
    1,
    0,
    0,
  ]);

  canvas.calcOffset();

  restoreAllDesignObjectsForCanonicalRender(
    canvas
  );

  if (hideGuides) {
    guideStates.forEach(
      ({ object }) => {
        object.visible = false;
      }
    );
  }

  canvas.discardActiveObject();
  canvas.renderAll();

  const restore = () => {
    guideStates.forEach(
      ({
        object,
        visible,
      }) => {
        if (
          canvas
            .getObjects()
            .includes(object)
        ) {
          object.visible =
            visible;
        }
      }
    );

    designObjectStates.forEach(
      ({
        object,
        visible,
        selectable,
        evented,
      }) => {
        if (
          canvas
            .getObjects()
            .includes(object)
        ) {
          object.visible =
            visible;

          object.selectable =
            selectable;

          object.evented =
            evented;
        }
      }
    );

    canvas.setViewportTransform(
      previousViewport
    );

    canvas.calcOffset();

    designViewCanonicalDepth =
      Math.max(
        0,
        designViewCanonicalDepth - 1
      );

    applyActiveDesignView(
      canvas,
      {
        updateLayers:
          false,
      }
    );

    if (
      activeObject &&
      canvas
        .getObjects()
        .includes(activeObject) &&
      activeObject.selectable !== false
    ) {
      canvas.setActiveObject(
        activeObject
      );
    }

    canvas.renderAll();
  };

  try {
    const result =
      callback();

    if (
      result &&
      typeof result.then ===
      'function'
    ) {
      return result.finally(
        restore
      );
    }

    restore();

    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

function bindDesignTabs(
  product,
  activePers,
  savedState,
  stateKey
) {
  document
    .querySelectorAll(
      '.design-tab'
    )
    .forEach(tab => {
      tab.addEventListener(
        'click',
        () => {
          activeDesignTab =
            tab.dataset.tab;

          document
            .querySelectorAll(
              '.design-tab'
            )
            .forEach(item => {
              item.classList.remove(
                'active'
              );
            });

          tab.classList.add(
            'active'
          );

          const toolTab =
            document.getElementById(
              'tab-tool'
            );

          const uploadTab =
            document.getElementById(
              'tab-upload'
            );

          if (toolTab) {
            toolTab.hidden =
              activeDesignTab !==
              'tool';
          }

          if (uploadTab) {
            uploadTab.hidden =
              activeDesignTab !==
              'upload';
          }

          persistDesignState(
            stateKey,
            {
              tab:
                activeDesignTab,
            }
          );

          if (
            activeDesignTab ===
            'tool'
          ) {
            scheduleFabricInit(
              product,
              activePers,
              savedState,
              stateKey
            );
          }
        }
      );
    });
}

function bindUploadZone(
  stateKey,
  activePers,
  product
) {
  const zone =
    document.getElementById(
      'upload-zone'
    );

  const input =
    document.getElementById(
      'upload-input'
    );

  if (
    !zone ||
    !input
  ) {
    return;
  }

  zone.addEventListener(
    'click',
    () => {
      input.click();
    }
  );

  zone.addEventListener(
    'dragover',
    event => {
      event.preventDefault();

      zone.classList.add(
        'dragover'
      );
    }
  );

  zone.addEventListener(
    'dragleave',
    () => {
      zone.classList.remove(
        'dragover'
      );
    }
  );

  zone.addEventListener(
    'drop',
    event => {
      event.preventDefault();

      zone.classList.remove(
        'dragover'
      );

      const file =
        event
          .dataTransfer
          .files?.[0];

      if (file) {
        handleUpload(
          file,
          stateKey,
          activePers,
          product
        );
      }
    }
  );

  input.addEventListener(
    'change',
    event => {
      const file =
        event.target.files?.[0];

      if (file) {
        handleUpload(
          file,
          stateKey,
          activePers,
          product
        );
      }
    }
  );
}

function bindDesignNextButton(
  product,
  activePers,
  stateKey
) {
  const button =
    document.getElementById(
      'btn-design-next'
    );

  if (!button) {
    return;
  }

  let isSubmitting = false;

  const setButtonBusy = busy => {
    button.disabled =
      busy;

    button.setAttribute(
      'aria-busy',
      String(busy)
    );

    button.textContent =
      busy
        ? 'Bezig…'
        : 'Verder →';
  };

  const showError = message => {
    const error =
      document.getElementById(
        'design-error'
      );

    if (!error) {
      return;
    }

    error.textContent =
      message;

    error.hidden =
      false;

    error.scrollIntoView({
      behavior:
        'smooth',

      block:
        'center',
    });
  };

  const saveDesignToSession =
    async design => {
      await Promise.resolve(
        Session.setDesign(
          design
        )
      );

      if (
        typeof Session.flushDesignStorage ===
        'function'
      ) {
        await Session.flushDesignStorage();
      }
    };

  button.addEventListener(
    'click',
    async () => {
      if (isSubmitting) {
        return;
      }

      isSubmitting = true;

      setButtonBusy(
        true
      );

      const error =
        document.getElementById(
          'design-error'
        );

      if (error) {
        error.hidden = true;
      }

      try {
        if (
          activeDesignTab ===
          'upload'
        ) {
          if (!uploadedDataURL) {
            showError(
              'Upload eerst een bestand om verder te gaan.'
            );

            return;
          }

          const designData = {
            dataURL:
              uploadedDataURL,

            pdfDataURL:
              uploadedPdfDataURL ||
              (
                uploadedDataURL.startsWith(
                  'data:application/pdf'
                )
                  ? uploadedDataURL
                  : ''
              ),

            rillinesPdfDataURL:
              uploadedRillinesPdfDataURL ||
              '',

            fileName:
              uploadedFileName,

            tab:
              'upload',

            source:
              'upload',

            uploadCheck:
              uploadedCheck,

            prepressWarnings:
              getUploadPrepressWarnings(
                uploadedCheck
              ),
          };

          await saveDesignToSession(
            designData
          );

          persistDesignState(
            stateKey,
            {
              tab:
                'upload',

              fileName:
                uploadedFileName,

              uploadCheck:
                uploadedCheck,
            }
          );
        } else {
          if (!fabricCanvas) {
            showError(
              'De ontwerptool is nog niet geladen. Probeer het opnieuw.'
            );

            return;
          }

          const snapshot =
            snapshotCanvas(
              fabricCanvas,
              product,
              activePers
            );

          const prepressWarnings =
            withCanonicalDesignCanvas(
              fabricCanvas,

              () =>
                collectCanvasPrepressWarnings(
                  fabricCanvas,
                  activePers,
                  product
                ),

              {
                hideGuides:
                  false,
              }
            );

          const editorViewId =
            designViewContext
              ?.activeViewId ||
            null;

          const designData = {
            dataURL:
              snapshot.dataURL,

            pdfDataURL:
              snapshot.pdfDataURL,

            rillinesPdfDataURL:
              snapshot.rillinesPdfDataURL,

            tab:
              'tool',

            source:
              'fabric',

            fabricJSON:
              snapshot.json,

            backgroundColor:
              snapshot.backgroundColor,

            fabricCanvasWidth:
              snapshot.fabricCanvasWidth,

            fabricCanvasHeight:
              snapshot.fabricCanvasHeight,

            editorViewId,

            ...(editorViewId
              ? {
                previewViewId:
                  editorViewId,
              }
              : {}),

            prepressWarnings,

            uploadCheck:
              null,
          };

          await saveDesignToSession(
            designData
          );

          persistDesignState(
            stateKey,
            {
              fabricJSON:
                snapshot.json,

              backgroundColor:
                snapshot.backgroundColor,

              fabricCanvasWidth:
                snapshot.fabricCanvasWidth,

              fabricCanvasHeight:
                snapshot.fabricCanvasHeight,

              editorViewId,

              ...(editorViewId
                ? {
                  previewViewId:
                    editorViewId,
                }
                : {}),

              tab:
                'tool',

              prepressWarnings,

              uploadCheck:
                null,
            }
          );
        }

        await navigateTo(
          'review'
        );
      } catch (submitError) {
        console.error(
          'Ontwerp verwerken of doorgaan naar de volgende stap is mislukt.',
          submitError
        );

        showError(
          submitError?.message ||
          'Het ontwerp kon niet worden verwerkt. Probeer het opnieuw.'
        );
      } finally {
        isSubmitting = false;

        setButtonBusy(
          false
        );
      }
    }
  );
}

function bindFontSelector(
  canvas,
  stateKey
) {
  const select =
    document.getElementById(
      'font-select'
    );

  if (!select) {
    return;
  }

  select.addEventListener(
    'change',
    () => {
      const fontValue =
        select.value;

      const object =
        canvas.getActiveObject();

      if (
        object &&
        object.type === 'i-text'
      ) {
        object.set(
          'fontFamily',
          fontValue
        );

        canvas.renderAll();
        fabricSaveHistory();

        autoSaveCanvasState(
          stateKey
        );
      }
    }
  );

  canvas.on(
    'selection:created',
    syncFontControls
  );

  canvas.on(
    'selection:updated',
    syncFontControls
  );

  function syncFontControls() {
    const object =
      canvas.getActiveObject();

    if (
      !object ||
      object.type !== 'i-text'
    ) {
      return;
    }

    const currentFont =
      object.fontFamily ||
      'Georgia';

    const match =
      AVAILABLE_FONTS.find(
        font =>
          font.value ===
          currentFont
      );

    if (match) {
      select.value =
        match.value;
    }

    syncFontSizeControls(
      object
    );
  }
}

function bindFontSizeControl(
  canvas,
  stateKey
) {
  const select =
    document.getElementById(
      'font-size'
    );

  if (!select) {
    return;
  }

  select.addEventListener(
    'change',
    event => {
      const value =
        Number.parseInt(
          event.target.value,
          10
        );

      const object =
        canvas.getActiveObject();

      if (
        object &&
        object.type === 'i-text' &&
        !isGuideObject(object)
      ) {
        object.set(
          'fontSize',
          value
        );

        canvas.renderAll();
        fabricSaveHistory();
        updateLayerPanel();

        autoSaveCanvasState(
          stateKey
        );
      }
    }
  );

  canvas.on(
    'selection:created',
    event => {
      syncFontSizeControls(
        event.selected?.[0]
      );
    }
  );

  canvas.on(
    'selection:updated',
    event => {
      syncFontSizeControls(
        event.selected?.[0]
      );
    }
  );
}

function syncFontSizeControls(object) {
  const select =
    document.getElementById(
      'font-size'
    );

  if (
    !select ||
    !object ||
    object.type !== 'i-text'
  ) {
    return;
  }

  const fontSize =
    Math.round(
      object.fontSize ||
      20
    );

  const availableSizes = [
    ...select.options,
  ].map(
    option =>
      Number(option.value)
  );

  const closestSize =
    availableSizes.reduce(
      (closest, size) => (
        Math.abs(
          size -
          fontSize
        ) <
        Math.abs(
          closest -
          fontSize
        )
          ? size
          : closest
      ),
      availableSizes[0]
    );

  select.value =
    String(closestSize);
}

function getResponsiveCanvasSize(
  activePers,
  product
) {
  const printWidthPx =
    activePers?.width_px ||
    product.width_px ||
    1181;

  const printHeightPx =
    activePers?.height_px ||
    product.height_px ||
    827;

  const canvasWrap =
    document.getElementById(
      'canvas-wrap'
    );

  const fallbackWidth =
    Math.max(
      280,
      window.innerWidth -
      560
    );

  const fallbackHeight =
    Math.max(
      240,
      window.innerHeight -
      360
    );

  const availableWidth =
    canvasWrap
      ? Math.max(
        280,
        canvasWrap.clientWidth -
        32
      )
      : fallbackWidth;

  const availableHeight =
    canvasWrap
      ? Math.max(
        240,
        canvasWrap.clientHeight -
        32
      )
      : fallbackHeight;

  const scale =
    Math.min(
      1,

      availableWidth /
      printWidthPx,

      availableHeight /
      printHeightPx
    );

  return {
    width:
      Math.max(
        1,
        Math.floor(
          printWidthPx *
          scale
        )
      ),

    height:
      Math.max(
        1,
        Math.floor(
          printHeightPx *
          scale
        )
      ),

    scale,
    printWidthPx,
    printHeightPx,
  };
}

function applyCanvasZoom() {
  const container =
    document.querySelector(
      '#canvas-wrap .canvas-container'
    );

  if (!container) {
    return;
  }

  container.style.transform =
    `scale(${canvasZoom})`;

  container.style.transformOrigin =
    'center center';

  requestAnimationFrame(() => {
    fabricCanvas?.calcOffset();
    fabricCanvas?.requestRenderAll();
  });
}

function setCanvasZoom(nextZoom) {
  const clampedZoom =
    Math.min(
      CANVAS_ZOOM_MAX,
      Math.max(
        CANVAS_ZOOM_MIN,
        nextZoom
      )
    );

  if (
    Math.abs(
      clampedZoom -
      canvasZoom
    ) <
    0.001
  ) {
    return;
  }

  canvasZoom =
    clampedZoom;

  applyCanvasZoom();
  updateCanvasZoomControls();
}

function updateCanvasZoomControls() {
  const zoomInButton =
    document.getElementById(
      'btn-canvas-zoom-in'
    );

  const zoomOutButton =
    document.getElementById(
      'btn-canvas-zoom-out'
    );

  if (zoomInButton) {
    zoomInButton.disabled =
      canvasZoom >=
      CANVAS_ZOOM_MAX -
      0.001;
  }

  if (zoomOutButton) {
    zoomOutButton.disabled =
      canvasZoom <=
      CANVAS_ZOOM_MIN +
      0.001;
  }
}

function bindCanvasZoomControls() {
  document
    .getElementById(
      'btn-canvas-zoom-in'
    )
    ?.addEventListener(
      'click',
      () => {
        setCanvasZoom(
          canvasZoom +
          CANVAS_ZOOM_STEP
        );
      }
    );

  document
    .getElementById(
      'btn-canvas-zoom-out'
    )
    ?.addEventListener(
      'click',
      () => {
        setCanvasZoom(
          canvasZoom -
          CANVAS_ZOOM_STEP
        );
      }
    );

  updateCanvasZoomControls();
}

function scheduleFabricInit(
  product,
  activePers,
  savedState,
  stateKey
) {
  fabricInitToken += 1;

  const token =
    fabricInitToken;

  if (fabricInitTimer) {
    clearTimeout(
      fabricInitTimer
    );
  }

  fabricInitTimer =
    setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (
            token !==
            fabricInitToken
          ) {
            return;
          }

          const canvasWrap =
            document.getElementById(
              'canvas-wrap'
            );

          const canvasElement =
            document.getElementById(
              'c'
            );

          if (
            !canvasWrap ||
            !canvasElement
          ) {
            return;
          }

          if (
            canvasWrap.clientWidth <= 0 ||
            canvasWrap.clientHeight <= 0
          ) {
            scheduleFabricInit(
              product,
              activePers,
              savedState,
              stateKey
            );

            return;
          }

          initFabricTool(
            product,
            activePers,
            savedState,
            stateKey,
            token
          );
        });
      });
    }, 60);
}

function destroyFabricCanvas() {
  destroyDesignViewContext();

  if (fabricCanvas) {
    try {
      fabricCanvas.off();
      fabricCanvas.dispose();
    } catch (error) {
      console.warn(
        'Fabric canvas opruimen mislukt',
        error
      );
    }

    fabricCanvas = null;
  }

  const canvasWrap =
    document.getElementById(
      'canvas-wrap'
    );

  if (!canvasWrap) {
    return;
  }

  canvasWrap
    .querySelectorAll(
      '.canvas-container'
    )
    .forEach(container => {
      const nestedCanvas =
        container.querySelector(
          'canvas#c'
        );

      if (nestedCanvas) {
        canvasWrap.appendChild(
          nestedCanvas
        );
      }

      container.remove();
    });

  const canvas =
    document.getElementById(
      'c'
    );

  if (canvas) {
    canvas.removeAttribute(
      'style'
    );

    canvas.removeAttribute(
      'width'
    );

    canvas.removeAttribute(
      'height'
    );

    canvas.className = '';
  }
}

function initFabricTool(
  product,
  activePers,
  savedState,
  stateKey,
  token = fabricInitToken
) {
  if (!window.fabric) {
    console.warn(
      'Fabric.js niet geladen.'
    );

    return;
  }

  const canvasElement =
    document.getElementById(
      'c'
    );

  const canvasWrap =
    document.getElementById(
      'canvas-wrap'
    );

  if (
    !canvasElement ||
    !canvasWrap
  ) {
    return;
  }

  destroyFabricCanvas();

  if (
    token !==
    fabricInitToken
  ) {
    return;
  }

  fabricHistory = [];
  canvasZoom = 1.1;
  fabricActiveColor = '#1D9E75';

  fabricBackgroundColor =
    savedState?.backgroundColor ||
    activePers?.backgroundColor ||
    '#b7bdb8';

  const display =
    getResponsiveCanvasSize(
      activePers,
      product
    );

  const canvasWidth =
    display.width;

  const canvasHeight =
    display.height;

  const marginPx =
    activePers?.margin_px ||
    product.margin_px ||
    20;

  const margin =
    marginPx *
    display.scale;

  const clipShape =
    activePers?.clipShape ||
    null;

  fabricCanvas =
    new fabric.Canvas(
      'c',
      {
        width:
          canvasWidth,

        height:
          canvasHeight,

        selection:
          true,

        backgroundColor:
          fabricBackgroundColor,

        preserveObjectStacking:
          true,
      }
    );

  initializeDesignViewContext({
    product,
    activePers,
    savedState,
    stateKey,
    margin,
  });

  window._currentDesignStateKey =
    stateKey;

  bindFabricDocumentHandlers();

  bindDesignViewControls(
    fabricCanvas
  );

  applyCanvasClipPath(
    clipShape,
    canvasWidth,
    canvasHeight
  );

  renderColorSwatches();

  renderBackgroundColorSwatches(
    activePers,
    stateKey
  );

  restoreCanvasStateOrDefault(
    fabricCanvas,
    savedState,
    canvasHeight,
    margin,
    canvasWidth,
    canvasHeight,
    activePers,
    product,
    stateKey
  );

  bindFabricEvents(
    fabricCanvas,
    margin,
    canvasWidth,
    canvasHeight,
    stateKey,
    activePers,
    product
  );

  bindFabricButtons(
    fabricCanvas,
    margin,
    canvasWidth,
    canvasHeight,
    stateKey,
    activePers,
    product
  );

  updateLayerPanel();

  updateFabricImageDpiWarning(
    fabricCanvas,
    activePers,
    product
  );

  bindCanvasZoomControls();

  applyActiveDesignView(
    fabricCanvas
  );

  setTimeout(() => {
    if (
      fabricCanvas &&
      token ===
      fabricInitToken
    ) {
      redrawGuides(
        fabricCanvas,
        activePers,
        product,
        margin,
        canvasWidth,
        canvasHeight
      );

      const metadataChanged =
        hydrateDesignObjectMetadata(
          fabricCanvas
        );

      if (metadataChanged) {
        autoSaveCanvasState(
          stateKey
        );
      }

      updateFabricImageDpiWarning(
        fabricCanvas,
        activePers,
        product
      );

      applyActiveDesignView(
        fabricCanvas
      );
    }
  }, 120);
}

function bindFabricDocumentHandlers() {
  if (window._fabricMouseUpHandler) {
    document.removeEventListener(
      'mouseup',
      window._fabricMouseUpHandler
    );
  }

  window._fabricMouseUpHandler = () => {
    if (!fabricCanvas) {
      return;
    }

    const transform =
      fabricCanvas._currentTransform;

    if (transform) {
      fabricCanvas._currentTransform =
        null;

      fabricCanvas.setCursor(
        fabricCanvas.defaultCursor
      );

      fabricCanvas.renderAll();
    }
  };

  document.addEventListener(
    'mouseup',
    window._fabricMouseUpHandler
  );

  if (window._fabricKeyHandler) {
    document.removeEventListener(
      'keydown',
      window._fabricKeyHandler
    );
  }

  window._fabricKeyHandler =
    event => {
      if (
        event.key !== 'Backspace' &&
        event.key !== 'Delete'
      ) {
        return;
      }

      const object =
        fabricCanvas?.getActiveObject();

      if (
        !object ||
        isGuideObject(object) ||
        (
          object.type === 'i-text' &&
          object.isEditing
        )
      ) {
        return;
      }

      fabricCanvas.remove(
        object
      );

      updateFabricImageDpiWarning(
        fabricCanvas,

        window
          ._currentDesignGuideState
          ?.activePers,

        window
          ._currentDesignGuideState
          ?.product
      );

      fabricSaveHistory();
      updateLayerPanel();

      autoSaveCanvasState(
        window._currentDesignStateKey
      );
    };

  document.addEventListener(
    'keydown',
    window._fabricKeyHandler
  );
}

function applyCanvasClipPath(
  clipShape,
  canvasWidth,
  canvasHeight
) {
  const canvasElement =
    document.querySelector(
      '#canvas-wrap canvas'
    );

  if (!canvasElement) {
    return;
  }

  canvasElement.style.clipPath = '';
  canvasElement.style.borderRadius = '';

  if (!clipShape) {
    return;
  }

  canvasElement.style.clipPath =
    clipShape;

  canvasElement.style.borderRadius =
    clipShape.startsWith('circle')
      ? '50%'
      : '4px';

  if (
    clipShape.startsWith('circle')
  ) {
    const radius =
      Math.min(
        canvasWidth,
        canvasHeight
      ) /
      2;

    fabricCanvas.clipPath =
      new fabric.Circle({
        radius,

        left:
          canvasWidth / 2 -
          radius,

        top:
          canvasHeight / 2 -
          radius,

        absolutePositioned:
          true,
      });
  }
}

function renderColorSwatches() {
  const colors = [
    '#1D9E75',
    '#ffffff',
    '#2c2c2a',
    '#e63946',
    '#f4a261',
    '#457b9d',
    '#f1c453',
    '#9d4edd',
  ];

  const swatchContainer =
    document.getElementById(
      'color-swatches'
    );

  if (!swatchContainer) {
    return;
  }

  swatchContainer.innerHTML = '';

  colors.forEach(
    (color, index) => {
      const swatch =
        document.createElement(
          'button'
        );

      swatch.type =
        'button';

      swatch.className =
        `color-swatch${index === 0 ? ' active' : ''}`;

      swatch.style.background =
        color;

      swatch.setAttribute(
        'aria-label',
        `Kleur ${color}`
      );

      swatch.addEventListener(
        'click',
        () => {
          swatchContainer
            .querySelectorAll(
              '.color-swatch'
            )
            .forEach(item => {
              item.classList.remove(
                'active'
              );
            });

          swatch.classList.add(
            'active'
          );

          fabricActiveColor =
            color;

          applyToSelected(
            'fill',
            color
          );
        }
      );

      swatchContainer.appendChild(
        swatch
      );
    }
  );

  const customColorInput =
    document.getElementById(
      'custom-element-color'
    );

  if (customColorInput) {
    customColorInput.value =
      fabricActiveColor;

    customColorInput.addEventListener(
      'input',
      event => {
        const color =
          event.target.value;

        fabricActiveColor =
          color;

        swatchContainer
          .querySelectorAll(
            '.color-swatch'
          )
          .forEach(item => {
            item.classList.remove(
              'active'
            );
          });

        applyToSelected(
          'fill',
          color
        );
      }
    );
  }
}

function renderBackgroundColorSwatches(
  activePers,
  stateKey
) {
  if (!activePers?.allowBackgroundColor) {
    return;
  }

  const swatchContainer =
    document.getElementById(
      'background-color-swatches'
    );

  if (!swatchContainer) {
    return;
  }

  const colors = [
    '#b7bdb8',
    '#ffffff',
    '#F7F4EE',
    '#EDF2ED',
    '#FDF4DC',
    '#5C7A5C',
    '#C9A84C',
    '#2A2A22',
  ];

  swatchContainer.innerHTML = '';

  colors.forEach(color => {
    const swatch =
      document.createElement(
        'button'
      );

    swatch.type =
      'button';

    swatch.className =
      `color-swatch${
        color.toLowerCase() ===
        fabricBackgroundColor.toLowerCase()
          ? ' active'
          : ''
      }`;

    swatch.style.background =
      color;

    swatch.setAttribute(
      'aria-label',
      `Achtergrondkleur ${color}`
    );

    swatch.addEventListener(
      'click',
      () => {
        setCanvasBackgroundColor(
          color,
          stateKey
        );

        swatchContainer
          .querySelectorAll(
            '.color-swatch'
          )
          .forEach(item => {
            item.classList.remove(
              'active'
            );
          });

        swatch.classList.add(
          'active'
        );

        const customBackgroundInput =
          document.getElementById(
            'custom-background-color'
          );

        if (customBackgroundInput) {
          customBackgroundInput.value =
            color;
        }
      }
    );

    swatchContainer.appendChild(
      swatch
    );
  });

  const customBackgroundInput =
    document.getElementById(
      'custom-background-color'
    );

  if (customBackgroundInput) {
    customBackgroundInput.value =
      fabricBackgroundColor;

    customBackgroundInput.addEventListener(
      'input',
      event => {
        setCanvasBackgroundColor(
          event.target.value,
          stateKey
        );

        swatchContainer
          .querySelectorAll(
            '.color-swatch'
          )
          .forEach(item => {
            item.classList.remove(
              'active'
            );
          });
      }
    );
  }
}

function setCanvasBackgroundColor(
  color,
  stateKey
) {
  fabricBackgroundColor =
    color;

  if (!fabricCanvas) {
    return;
  }

  if (
    typeof fabricCanvas
      .setBackgroundColor ===
    'function'
  ) {
    fabricCanvas.setBackgroundColor(
      color,
      fabricCanvas
        .renderAll
        .bind(fabricCanvas)
    );
  } else {
    fabricCanvas.backgroundColor =
      color;

    fabricCanvas.renderAll();
  }

  redrawGuidesFromCurrentState();

  autoSaveCanvasState(
    stateKey
  );

  persistDesignState(
    stateKey,
    {
      backgroundColor:
        color,
    }
  );
}

function drawMarginRect(
  canvas,
  margin,
  canvasWidth,
  canvasHeight,
  isWarning = false
) {
  canvas
    .getObjects()
    .filter(object => (
      object._isMargin &&
      !object._isBlockedZone
    ))
    .forEach(object => {
      canvas.remove(object);
    });

  const marginColor =
    isWarning
      ? '#C0392B'
      : getContrastingGuideColor(
        fabricBackgroundColor
      );

  const marginRect =
    new fabric.Rect({
      left:
        margin,

      top:
        margin,

      width:
        Math.max(
          1,
          canvasWidth -
          margin * 2
        ),

      height:
        Math.max(
          1,
          canvasHeight -
          margin * 2
        ),

      fill:
        'transparent',

      stroke:
        marginColor,

      strokeWidth:
        isWarning
          ? 2.5
          : 1.75,

      strokeDashArray:
        [6, 4],

      selectable:
        false,

      evented:
        false,

      excludeFromExport:
        true,

      _isMargin:
        true,

      _isGuide:
        true,

      _guideMeta: {
        margin,
        canvasWidth,
        canvasHeight,
      },
    });

  canvas.add(
    marginRect
  );
}

function drawBlockedZones(
  canvas,
  activePers,
  product,
  canvasWidth,
  canvasHeight
) {
  const zones =
    Array.isArray(
      activePers?.blockedZones
    )
      ? activePers.blockedZones
      : [];

  canvas
    .getObjects()
    .filter(
      object =>
        object._isBlockedZone
    )
    .forEach(object => {
      canvas.remove(object);
    });

  if (!zones.length) {
    canvas.renderAll();
    return;
  }

  zones.forEach(zone => {
    if (zone.type === 'circle') {
      const circleData =
        getBlockedCircleCanvasData(
          zone,
          activePers,
          product,
          canvasWidth,
          canvasHeight
        );

      if (!circleData) {
        return;
      }

      const safeCircle =
        new fabric.Circle({
          left:
            circleData.cx -
            circleData.safeRadius,

          top:
            circleData.cy -
            circleData.safeRadius,

          radius:
            circleData.safeRadius,

          fill:
            'rgba(232, 134, 10, 0.14)',

          stroke:
            '#E8860A',

          strokeWidth:
            2,

          strokeDashArray:
            [8, 5],

          selectable:
            false,

          evented:
            false,

          objectCaching:
            false,

          excludeFromExport:
            true,

          _isMargin:
            true,

          _isGuide:
            true,

          _isBlockedZone:
            true,
        });

      const holeCircle =
        new fabric.Circle({
          left:
            circleData.cx -
            circleData.holeRadius,

          top:
            circleData.cy -
            circleData.holeRadius,

          radius:
            circleData.holeRadius,

          fill:
            'rgba(192, 57, 43, 0.24)',

          stroke:
            '#C0392B',

          strokeWidth:
            2,

          strokeDashArray:
            [4, 3],

          selectable:
            false,

          evented:
            false,

          objectCaching:
            false,

          excludeFromExport:
            true,

          _isMargin:
            true,

          _isGuide:
            true,

          _isBlockedZone:
            true,
        });

      canvas.add(
        safeCircle
      );

      canvas.add(
        holeCircle
      );

      return;
    }

    if (zone.type === 'rect') {
      const rectData =
        getBlockedRectCanvasData(
          zone,
          activePers,
          product,
          canvasWidth,
          canvasHeight
        );

      if (!rectData) {
        return;
      }

      const safeRect =
        new fabric.Rect({
          left:
            rectData.safeLeft,

          top:
            rectData.safeTop,

          width:
            rectData.safeWidth,

          height:
            rectData.safeHeight,

          fill:
            'rgba(232, 134, 10, 0.14)',

          stroke:
            '#E8860A',

          strokeWidth:
            2,

          strokeDashArray:
            [8, 5],

          selectable:
            false,

          evented:
            false,

          objectCaching:
            false,

          excludeFromExport:
            true,

          _isMargin:
            true,

          _isGuide:
            true,

          _isBlockedZone:
            true,
        });

      const blockedRect =
        new fabric.Rect({
          left:
            rectData.left,

          top:
            rectData.top,

          width:
            rectData.width,

          height:
            rectData.height,

          fill:
            'rgba(192, 57, 43, 0.18)',

          stroke:
            '#C0392B',

          strokeWidth:
            2,

          strokeDashArray:
            [4, 3],

          selectable:
            false,

          evented:
            false,

          objectCaching:
            false,

          excludeFromExport:
            true,

          _isMargin:
            true,

          _isGuide:
            true,

          _isBlockedZone:
            true,
        });

      canvas.add(
        safeRect
      );

      canvas.add(
        blockedRect
      );

      return;
    }

    if (zone.type === 'line') {
      const lineData =
        getBlockedLineCanvasData(
          zone,
          activePers,
          product,
          canvasWidth,
          canvasHeight
        );

      if (!lineData) {
        return;
      }

      const safeZone =
        createCenteredLineSafeZone(
          lineData
        );

      if (safeZone) {
        canvas.add(
          safeZone
        );
      }

      const foldLine =
        new fabric.Line(
          [
            lineData.x1,
            lineData.y1,
            lineData.x2,
            lineData.y2,
          ],
          {
            stroke:
              '#C0392B',

            strokeWidth:
              Math.max(
                1.5,
                lineData.lineWidth
              ),

            strokeDashArray:
              [2, 1.5],

            selectable:
              false,

            evented:
              false,

            objectCaching:
              false,

            excludeFromExport:
              true,

            _isMargin:
              true,

            _isGuide:
              true,

            _isBlockedZone:
              true,
          }
        );

      canvas.add(
        foldLine
      );
    }
  });

  bringGuidesToFront(
    canvas
  );

  canvas.renderAll();
}

function drawPreviewCanvasGuides(
  canvas,
  canvasWidth,
  canvasHeight
) {
  const guides =
    Array.isArray(
      designViewContext
        ?.config
        ?.canvasGuides
    )
      ? designViewContext
        .config
        .canvasGuides
      : [];

  guides
    .filter(
      guide =>
        guide?.type === 'line'
    )
    .forEach(guide => {
      const spec =
        designViewContext?.spec;

      if (!spec) {
        return;
      }

      const x1 =
        window.PrintSpecs
          ?.finishMmToCanvasX
          ? PrintSpecs.finishMmToCanvasX(
            guide.x1_mm,
            spec,
            canvasWidth
          )
          : (
            (
              Number(spec.trimXmm || 0) +
              Number(guide.x1_mm || 0)
            ) /
            Number(spec.exportWidthMm || 1)
          ) *
          canvasWidth;

      const y1 =
        window.PrintSpecs
          ?.finishMmToCanvasY
          ? PrintSpecs.finishMmToCanvasY(
            guide.y1_mm,
            spec,
            canvasHeight
          )
          : (
            (
              Number(spec.trimYmm || 0) +
              Number(guide.y1_mm || 0)
            ) /
            Number(spec.exportHeightMm || 1)
          ) *
          canvasHeight;

      const x2 =
        window.PrintSpecs
          ?.finishMmToCanvasX
          ? PrintSpecs.finishMmToCanvasX(
            guide.x2_mm,
            spec,
            canvasWidth
          )
          : (
            (
              Number(spec.trimXmm || 0) +
              Number(guide.x2_mm || 0)
            ) /
            Number(spec.exportWidthMm || 1)
          ) *
          canvasWidth;

      const y2 =
        window.PrintSpecs
          ?.finishMmToCanvasY
          ? PrintSpecs.finishMmToCanvasY(
            guide.y2_mm,
            spec,
            canvasHeight
          )
          : (
            (
              Number(spec.trimYmm || 0) +
              Number(guide.y2_mm || 0)
            ) /
            Number(spec.exportHeightMm || 1)
          ) *
          canvasHeight;

      canvas.add(
        new fabric.Line(
          [
            x1,
            y1,
            x2,
            y2,
          ],
          {
            stroke:
              getContrastingGuideColor(
                fabricBackgroundColor
              ),

            strokeWidth:
              1.75,

            strokeDashArray:
              [4, 3],

            selectable:
              false,

            evented:
              false,

            objectCaching:
              false,

            excludeFromExport:
              true,

            _isGuide:
              true,

            _isPreviewGuide:
              true,
          }
        )
      );
    });
}

function createCenteredLineSafeZone(lineData) {
  const deltaX =
    lineData.x2 -
    lineData.x1;

  const deltaY =
    lineData.y2 -
    lineData.y1;

  const lineLength =
    Math.sqrt(
      deltaX * deltaX +
      deltaY * deltaY
    );

  if (!lineLength) {
    return null;
  }

  const centerX =
    (
      lineData.x1 +
      lineData.x2
    ) /
    2;

  const centerY =
    (
      lineData.y1 +
      lineData.y2
    ) /
    2;

  const angle =
    Math.atan2(
      deltaY,
      deltaX
    ) *
    180 /
    Math.PI;

  return new fabric.Rect({
    left:
      centerX,

    top:
      centerY,

    width:
      lineLength,

    height:
      lineData.safeWidth,

    originX:
      'center',

    originY:
      'center',

    angle,

    fill:
      'rgba(232, 134, 10, 0.18)',

    stroke:
      '#E8860A',

    strokeWidth:
      1,

    strokeDashArray:
      [8, 5],

    selectable:
      false,

    evented:
      false,

    objectCaching:
      false,

    excludeFromExport:
      true,

    opacity:
      0.75,

    _isMargin:
      true,

    _isGuide:
      true,

    _isBlockedZone:
      true,
  });
}

function redrawGuides(
  canvas,
  activePers,
  product,
  margin,
  canvasWidth,
  canvasHeight,
  isWarning = false
) {
  if (!canvas) {
    return;
  }

  removeGuideObjects(
    canvas
  );

  drawMarginRect(
    canvas,
    margin,
    canvasWidth,
    canvasHeight,
    isWarning
  );

  drawBlockedZones(
    canvas,
    activePers,
    product,
    canvasWidth,
    canvasHeight
  );

  drawPreviewCanvasGuides(
    canvas,
    canvasWidth,
    canvasHeight
  );

  bringGuidesToFront(
    canvas
  );

  canvas.renderAll();

  window._currentDesignGuideState = {
    activePers,
    product,
    margin,
    canvasWidth,
    canvasHeight,
  };

  if (
    designViewContext?.config.enabled
  ) {
    applyActiveDesignView(
      canvas,
      {
        updateLayers:
          false,
      }
    );
  }
}

function redrawGuidesFromCurrentState(
  isWarning = false
) {
  const state =
    window._currentDesignGuideState;

  if (
    !fabricCanvas ||
    !state
  ) {
    return;
  }

  redrawGuides(
    fabricCanvas,
    state.activePers,
    state.product,
    state.margin,
    state.canvasWidth,
    state.canvasHeight,
    isWarning
  );
}

function bringGuidesToFront(canvas) {
  canvas
    .getObjects()
    .filter(
      object =>
        isGuideObject(object)
    )
    .forEach(object => {
      object.selectable = false;
      object.evented = false;
      object.hoverCursor = 'default';

      canvas.bringToFront(
        object
      );
    });
}

function removeGuideObjects(canvas) {
  canvas
    .getObjects()
    .filter(
      object =>
        isGuideObject(object)
    )
    .forEach(object => {
      canvas.remove(object);
    });
}

function isGuideObject(object) {
  return Boolean(
    object?._isGuide ||
    object?._isBlockedZone ||
    object?._isMargin ||
    object?._isPreviewGuide ||
    object?._isCenterGuide ||
    object?.[DESIGN_VIEW_GUIDE_FLAG]
  );
}

function getContrastingGuideColor(backgroundColor) {
  const hex =
    normalizeHexColor(
      backgroundColor
    );

  if (!hex) {
    return '#2A2A22';
  }

  const red =
    Number.parseInt(
      hex.slice(1, 3),
      16
    );

  const green =
    Number.parseInt(
      hex.slice(3, 5),
      16
    );

  const blue =
    Number.parseInt(
      hex.slice(5, 7),
      16
    );

  const brightness =
    (
      red * 299 +
      green * 587 +
      blue * 114
    ) /
    1000;

  return brightness > 170
    ? '#2A2A22'
    : '#FFFFFF';
}

function normalizeHexColor(value) {
  if (
    !value ||
    typeof value !== 'string'
  ) {
    return '';
  }

  if (
    /^#[0-9A-Fa-f]{6}$/.test(value)
  ) {
    return value;
  }

  if (
    /^#[0-9A-Fa-f]{3}$/.test(value)
  ) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }

  return '';
}

function getBlockedCircleCanvasData(
  zone,
  activePers,
  product,
  canvasWidth,
  canvasHeight
) {
  const widthMm =
    Number(
      activePers?.width_mm ||
      product?.width_mm ||
      0
    );

  const heightMm =
    Number(
      activePers?.height_mm ||
      product?.height_mm ||
      0
    );

  if (
    !widthMm ||
    !heightMm
  ) {
    return null;
  }

  const xMm =
    Number(
      zone.x_mm ||
      0
    );

  const yMm =
    Number(
      zone.y_mm ||
      0
    );

  const diameterMm =
    Number(
      zone.diameter_mm ||
      0
    );

  const marginMm =
    Number(
      zone.margin_mm ||
      0
    );

  if (!diameterMm) {
    return null;
  }

  const pxPerMmX =
    canvasWidth /
    widthMm;

  const pxPerMmY =
    canvasHeight /
    heightMm;

  const averagePxPerMm =
    (
      pxPerMmX +
      pxPerMmY
    ) /
    2;

  const holeRadius =
    diameterMm /
    2 *
    averagePxPerMm;

  const safeRadius =
    holeRadius +
    marginMm *
    averagePxPerMm;

  return {
    cx:
      xMm *
      pxPerMmX,

    cy:
      yMm *
      pxPerMmY,

    holeRadius,
    safeRadius,
  };
}

function getBlockedRectCanvasData(
  zone,
  activePers,
  product,
  canvasWidth,
  canvasHeight
) {
  const widthMm =
    Number(
      activePers?.width_mm ||
      product?.width_mm ||
      0
    );

  const heightMm =
    Number(
      activePers?.height_mm ||
      product?.height_mm ||
      0
    );

  if (
    !widthMm ||
    !heightMm
  ) {
    return null;
  }

  const xMm =
    Number(
      zone.x_mm ||
      0
    );

  const yMm =
    Number(
      zone.y_mm ||
      0
    );

  const rectWidthMm =
    Number(
      zone.width_mm ||
      0
    );

  const rectHeightMm =
    Number(
      zone.height_mm ||
      0
    );

  const marginMm =
    Number(
      zone.margin_mm ||
      0
    );

  if (
    !rectWidthMm ||
    !rectHeightMm
  ) {
    return null;
  }

  const pxPerMmX =
    canvasWidth /
    widthMm;

  const pxPerMmY =
    canvasHeight /
    heightMm;

  const left =
    xMm *
    pxPerMmX;

  const top =
    yMm *
    pxPerMmY;

  const width =
    rectWidthMm *
    pxPerMmX;

  const height =
    rectHeightMm *
    pxPerMmY;

  const marginX =
    marginMm *
    pxPerMmX;

  const marginY =
    marginMm *
    pxPerMmY;

  return {
    left,
    top,
    width,
    height,

    safeLeft:
      left -
      marginX,

    safeTop:
      top -
      marginY,

    safeWidth:
      width +
      marginX * 2,

    safeHeight:
      height +
      marginY * 2,
  };
}

function getBlockedLineCanvasData(
  zone,
  activePers,
  product,
  canvasWidth,
  canvasHeight
) {
  const widthMm =
    Number(
      activePers?.width_mm ||
      product?.width_mm ||
      0
    );

  const heightMm =
    Number(
      activePers?.height_mm ||
      product?.height_mm ||
      0
    );

  if (
    !widthMm ||
    !heightMm
  ) {
    return null;
  }

  let x1Mm =
    Number(
      zone.x1_mm ||
      0
    );

  let y1Mm =
    Number(
      zone.y1_mm ||
      0
    );

  let x2Mm =
    Number(
      zone.x2_mm ||
      0
    );

  let y2Mm =
    Number(
      zone.y2_mm ||
      0
    );

  const lineWidthMm =
    Number(
      zone.line_width_mm ||
      0.3
    );

  const marginMm =
    Number(
      zone.margin_mm ||
      0
    );

  if (
    x1Mm === x2Mm &&
    y1Mm === y2Mm
  ) {
    return null;
  }

  const deltaXmm =
    Math.abs(
      x2Mm -
      x1Mm
    );

  const deltaYmm =
    Math.abs(
      y2Mm -
      y1Mm
    );

  if (
    deltaYmm <= 0.01
  ) {
    const centerYmm =
      (
        y1Mm +
        y2Mm
      ) /
      2;

    x1Mm = 0;
    x2Mm = widthMm;
    y1Mm = centerYmm;
    y2Mm = centerYmm;
  } else if (
    deltaXmm <= 0.01
  ) {
    const centerXmm =
      (
        x1Mm +
        x2Mm
      ) /
      2;

    x1Mm = centerXmm;
    x2Mm = centerXmm;
    y1Mm = 0;
    y2Mm = heightMm;
  }

  const pxPerMmX =
    canvasWidth /
    widthMm;

  const pxPerMmY =
    canvasHeight /
    heightMm;

  const averagePxPerMm =
    (
      pxPerMmX +
      pxPerMmY
    ) /
    2;

  return {
    x1:
      x1Mm *
      pxPerMmX,

    y1:
      y1Mm *
      pxPerMmY,

    x2:
      x2Mm *
      pxPerMmX,

    y2:
      y2Mm *
      pxPerMmY,

    lineWidth:
      Math.max(
        1,
        lineWidthMm *
        averagePxPerMm
      ),

    safeWidth:
      Math.max(
        3,
        (
          lineWidthMm +
          marginMm * 2
        ) *
        averagePxPerMm
      ),

    safeRadius:
      Math.max(
        1.5,
        (
          lineWidthMm / 2 +
          marginMm
        ) *
        averagePxPerMm
      ),
  };
}

function restoreCanvasStateOrDefault(
  canvas,
  savedState,
  canvasHeight,
  margin,
  canvasWidth,
  canvasHeightValue,
  activePers,
  product,
  stateKey
) {
  const redrawAfterRestore = () => {
    const metadataChanged =
      hydrateDesignObjectMetadata(
        canvas
      );

    redrawGuides(
      canvas,
      activePers,
      product,
      margin,
      canvasWidth,
      canvasHeightValue
    );

    restoreFabricImageUploadMeta(
      canvas
    );

    updateFabricImageDpiWarning(
      canvas,
      activePers,
      product
    );

    applyActiveDesignView(
      canvas
    );

    updateLayerPanel();

    fabricHistory = [];

    fabricSaveHistory();

    if (metadataChanged) {
      autoSaveCanvasState(
        stateKey
      );
    }
  };

  if (savedState?.fabricJSON) {
    try {
      canvas.loadFromJSON(
        savedState.fabricJSON,
        () => {
          removeGuideObjects(
            canvas
          );

          redrawAfterRestore();
        }
      );

      return;
    } catch (error) {
      console.warn(
        'Canvas state herstellen mislukt',
        error
      );
    }
  }

  addDefaultText(
    canvas,
    canvasHeight
  );

  redrawAfterRestore();
}

function addDefaultText(
  canvas,
  canvasHeight
) {
  const selectedFont =
    document
      .getElementById(
        'font-select'
      )
      ?.value ||
    'Georgia';

  const demo =
    new fabric.IText(
      'Jouw bedrijfsnaam',
      {
        fontSize:
          18,

        fill:
          '#ffffff',

        fontFamily:
          selectedFont,

        editable:
          true,

        opacity:
          0.9,
      }
    );

  prepareNewObjectForActiveDesignView(
    canvas,
    demo,
    {
      fallbackLeft:
        60,

      fallbackTop:
        Math.round(
          canvasHeight *
          0.65
        ),
    }
  );

  canvas.add(
    demo
  );

  canvas.renderAll();

  updateLayerPanel();
}

function isCenterSnappableObject(object) {
  return Boolean(
    object &&
    !isGuideObject(object) &&
    object.visible !== false &&
    object.selectable !== false &&
    !(
      object.type === 'i-text' &&
      object.isEditing
    )
  );
}

function getCanvasCenterPoint(canvas) {
  const bounds =
    getDesignViewBounds(
      canvas
    );

  return new fabric.Point(
    bounds?.centerX ??
    canvas.getWidth() / 2,

    bounds?.centerY ??
    canvas.getHeight() / 2
  );
}

function getCenterSnapThreshold(canvas) {
  const viewportZoom =
    typeof canvas.getZoom ===
    'function'
      ? canvas.getZoom() ||
        1
      : 1;

  const presentationZoom =
    Number.isFinite(
      Number(canvasZoom)
    ) &&
    Number(canvasZoom) > 0
      ? Number(canvasZoom)
      : 1;

  return (
    CENTER_SNAP_THRESHOLD_PX /
    (
      viewportZoom *
      presentationZoom
    )
  );
}

function applyCenterSnap(
  canvas,
  object
) {
  if (
    !canvas ||
    !isCenterSnappableObject(object)
  ) {
    removeCenterSnapGuides(
      canvas
    );

    return;
  }

  const canvasCenter =
    getCanvasCenterPoint(
      canvas
    );

  const objectCenter =
    object.getCenterPoint();

  const threshold =
    getCenterSnapThreshold(
      canvas
    );

  const shouldSnapX =
    Math.abs(
      objectCenter.x -
      canvasCenter.x
    ) <=
    threshold;

  const shouldSnapY =
    Math.abs(
      objectCenter.y -
      canvasCenter.y
    ) <=
    threshold;

  if (
    !shouldSnapX &&
    !shouldSnapY
  ) {
    removeCenterSnapGuides(
      canvas
    );

    return;
  }

  const snappedCenter =
    new fabric.Point(
      shouldSnapX
        ? canvasCenter.x
        : objectCenter.x,

      shouldSnapY
        ? canvasCenter.y
        : objectCenter.y
    );

  object.setPositionByOrigin(
    snappedCenter,
    'center',
    'center'
  );

  object.setCoords();

  renderCenterSnapGuides(
    canvas,
    {
      showVertical:
        shouldSnapX,

      showHorizontal:
        shouldSnapY,
    }
  );
}

function renderCenterSnapGuides(
  canvas,
  {
    showVertical,
    showHorizontal,
  }
) {
  if (!canvas) {
    return;
  }

  removeCenterSnapGuides(
    canvas
  );

  const bounds =
    getDesignViewBounds(
      canvas
    );

  const centerX =
    bounds?.centerX ??
    canvas.getWidth() / 2;

  const centerY =
    bounds?.centerY ??
    canvas.getHeight() / 2;

  const left =
    bounds?.left ??
    0;

  const top =
    bounds?.top ??
    0;

  const right =
    bounds?.right ??
    canvas.getWidth();

  const bottom =
    bounds?.bottom ??
    canvas.getHeight();

  const guideObjects = [];

  if (showVertical) {
    guideObjects.push(
      new fabric.Line(
        [
          centerX,
          top,
          centerX,
          bottom,
        ],
        getCenterGuideObjectOptions()
      )
    );
  }

  if (showHorizontal) {
    guideObjects.push(
      new fabric.Line(
        [
          left,
          centerY,
          right,
          centerY,
        ],
        getCenterGuideObjectOptions()
      )
    );
  }

  guideObjects.forEach(
    guide => {
      canvas.add(guide);
      guide.bringToFront();
    }
  );

  canvas._centerSnapGuides =
    guideObjects;

  canvas.requestRenderAll();
}

function getCenterGuideObjectOptions() {
  return {
    stroke:
      CENTER_GUIDE_COLOR,

    strokeWidth:
      CENTER_GUIDE_STROKE_WIDTH,

    strokeDashArray:
      CENTER_GUIDE_DASH,

    selectable:
      false,

    evented:
      false,

    objectCaching:
      false,

    strokeUniform:
      true,

    excludeFromExport:
      true,

    _isGuide:
      true,

    _isCenterGuide:
      true,
  };
}

function removeCenterSnapGuides(canvas) {
  if (
    !canvas ||
    !Array.isArray(
      canvas._centerSnapGuides
    )
  ) {
    return;
  }

  canvas._centerSnapGuides.forEach(
    guide => {
      if (
        canvas
          .getObjects()
          .includes(guide)
      ) {
        canvas.remove(guide);
      }
    }
  );

  canvas._centerSnapGuides = [];

  canvas.requestRenderAll();
}

function bindFabricEvents(
  canvas,
  margin,
  canvasWidth,
  canvasHeight,
  stateKey,
  activePers,
  product
) {
  const checkMargin = (
    object,
    {
      redraw = true,
    } = {}
  ) => {
    if (
      !object ||
      isGuideObject(object)
    ) {
      return;
    }

    const warning =
      document.getElementById(
        'margin-warning'
      );

    if (!warning) {
      return;
    }

    const activeViewWarning =
      isOutsideActiveDesignViewMargin(
        object
      );

    const outsideOuterMargin =
      activeViewWarning === null
        ? isOutsideMargin(
          object,
          margin,
          canvasWidth,
          canvasHeight
        )
        : activeViewWarning;

    const overlapsBlockedZone =
      isObjectOverlappingBlockedZones(
        object,
        activePers,
        product,
        canvasWidth,
        canvasHeight
      );

    const hasWarning =
      outsideOuterMargin ||
      overlapsBlockedZone;

    warning.textContent =
      overlapsBlockedZone
        ? 'Object valt over uitsparing'
        : 'Object buiten marge';

    warning.style.display =
      hasWarning
        ? 'flex'
        : 'none';

    if (redraw) {
      redrawGuides(
        canvas,
        activePers,
        product,
        margin,
        canvasWidth,
        canvasHeight,
        hasWarning
      );
    }
  };

  canvas.on(
    'object:added',
    event => {
      const object =
        event.target;

      if (
        !object ||
        isGuideObject(object)
      ) {
        return;
      }

      if (
        !Number.isFinite(
          Number(
            object._designOrientationVersion
          )
        )
      ) {
        assignObjectToCurrentDesignView(
          canvas,
          object
        );
      }
    }
  );

  canvas.on(
    'object:moving',
    event => {
      constrainObjectToActiveDesignView(
        canvas,
        event.target
      );

      checkMargin(
        event.target
      );

      applyCenterSnap(
        canvas,
        event.target
      );

      bringGuidesToFront(
        canvas
      );
    }
  );

  canvas.on(
    'object:rotating',
    event => {
      checkMargin(
        event.target
      );

      removeCenterSnapGuides(
        canvas
      );

      bringGuidesToFront(
        canvas
      );
    }
  );

  canvas.on(
    'object:scaling',
    event => {
      constrainObjectToActiveDesignView(
        canvas,
        event.target
      );

      checkMargin(
        event.target
      );

      applyCenterSnap(
        canvas,
        event.target
      );

      updateFabricImageDpiWarning(
        canvas,
        activePers,
        product
      );

      bringGuidesToFront(
        canvas
      );

      updateLayerPanel();
    }
  );

  canvas.on(
    'object:modified',
    event => {
      removeCenterSnapGuides(
        canvas
      );

      assignObjectToCurrentDesignView(
        canvas,
        event.target
      );

      checkMargin(
        event.target
      );

      updateFabricImageDpiWarning(
        canvas,
        activePers,
        product
      );

      redrawGuides(
        canvas,
        activePers,
        product,
        margin,
        canvasWidth,
        canvasHeight
      );

      fabricSaveHistory();
      updateLayerPanel();

      autoSaveCanvasState(
        stateKey
      );
    }
  );

  canvas.on(
    'text:changed',
    event => {
      assignObjectToCurrentDesignView(
        canvas,
        event.target
      );

      checkMargin(
        event.target,
        {
          redraw:
            false,
        }
      );

      updateLayerPanel();

      canvas.requestRenderAll();
    }
  );

  canvas.on(
    'text:editing:exited',
    event => {
      assignObjectToCurrentDesignView(
        canvas,
        event.target
      );

      checkMargin(
        event.target
      );

      fabricSaveHistory();
      updateLayerPanel();

      autoSaveCanvasState(
        stateKey
      );
    }
  );

  canvas.on(
    'selection:created',
    () => {
      updateFabricStatus();
      updateLayerPanel();

      updateFabricImageDpiWarning(
        canvas,
        activePers,
        product
      );
    }
  );

  canvas.on(
    'selection:updated',
    () => {
      updateFabricStatus();
      updateLayerPanel();

      updateFabricImageDpiWarning(
        canvas,
        activePers,
        product
      );
    }
  );

  canvas.on(
    'selection:cleared',
    () => {
      removeCenterSnapGuides(
        canvas
      );

      const status =
        document.getElementById(
          'status'
        );

      if (status) {
        status.textContent =
          'Selecteer een element om te bewerken. Klik en sleep om te verplaatsen.';
      }

      updateLayerPanel();

      updateFabricImageDpiWarning(
        canvas,
        activePers,
        product
      );
    }
  );

  canvas.on(
    'mouse:up',
    () => {
      removeCenterSnapGuides(
        canvas
      );
    }
  );

  canvas.on(
    'after:render',
    () => {
      if (
        !hasExpectedDesignViewport(
          canvas
        )
      ) {
        queueActiveDesignView(
          canvas
        );
      }
    }
  );
}

function bindFabricButtons(
  canvas,
  margin,
  canvasWidth,
  canvasHeight,
  stateKey,
  activePers,
  product
) {
  document
    .getElementById('btn-logo')
    ?.addEventListener(
      'click',
      () => {
        document
          .getElementById(
            'file-input'
          )
          ?.click();
      }
    );

  document
    .getElementById(
      'file-input'
    )
    ?.addEventListener(
      'change',
      event => {
        const file =
          event.target.files?.[0];

        if (!file) {
          return;
        }

        const reader =
          new FileReader();

        reader.onload =
          readerEvent => {
            fabric.Image.fromURL(
              readerEvent.target.result,
              image => {
                const uploadMeta =
                  createFabricImageUploadMeta(
                    file,
                    image
                  );

                image.scaleToWidth(
                  120
                );

                image.set({
                  _uploadMeta:
                    uploadMeta,
                });

                prepareNewObjectForActiveDesignView(
                  canvas,
                  image,
                  {
                    fallbackLeft:
                      140,

                    fallbackTop:
                      140,

                    maximumWidth:
                      120,
                  }
                );

                canvas.add(
                  image
                );

                canvas.setActiveObject(
                  image
                );

                canvas.renderAll();

                updateFabricImageDpiWarning(
                  canvas,
                  activePers,
                  product,
                  image
                );

                fabricSaveHistory();
                updateLayerPanel();

                autoSaveCanvasState(
                  stateKey
                );
              }
            );
          };

        reader.readAsDataURL(
          file
        );

        event.target.value = '';
      }
    );

  document
    .getElementById(
      'btn-text'
    )
    ?.addEventListener(
      'click',
      () => {
        const text =
          new fabric.IText(
            'Dubbelklik om tekst te bewerken',
            {
              fontSize:
                20,

              fill:
                fabricActiveColor,

              fontFamily:
                document
                  .getElementById(
                    'font-select'
                  )
                  ?.value ||
                'Georgia',

              editable:
                true,
            }
          );

        prepareNewObjectForActiveDesignView(
          canvas,
          text,
          {
            fallbackLeft:
              100,

            fallbackTop:
              160,
          }
        );

        canvas.add(
          text
        );

        canvas.setActiveObject(
          text
        );

        canvas.renderAll();

        syncFontSizeControls(
          text
        );

        fabricSaveHistory();
        updateLayerPanel();

        autoSaveCanvasState(
          stateKey
        );
      }
    );

  document
    .getElementById(
      'btn-undo'
    )
    ?.addEventListener(
      'click',
      () => {
        if (
          fabricHistory.length <= 1
        ) {
          return;
        }

        fabricHistory.pop();

        canvas.loadFromJSON(
          fabricHistory[
            fabricHistory.length -
            1
          ],
          () => {
            removeGuideObjects(
              canvas
            );

            hydrateDesignObjectMetadata(
              canvas
            );

            restoreFabricImageUploadMeta(
              canvas
            );

            redrawGuides(
              canvas,
              activePers,
              product,
              margin,
              canvasWidth,
              canvasHeight
            );

            updateFabricImageDpiWarning(
              canvas,
              activePers,
              product
            );

            applyActiveDesignView(
              canvas
            );

            updateLayerPanel();

            autoSaveCanvasState(
              stateKey
            );
          }
        );
      }
    );

  document
    .getElementById(
      'btn-clear'
    )
    ?.addEventListener(
      'click',
      () => {
        canvas.clear();

        canvas.backgroundColor =
          fabricBackgroundColor;

        redrawGuides(
          canvas,
          activePers,
          product,
          margin,
          canvasWidth,
          canvasHeight
        );

        updateFabricImageDpiWarning(
          canvas,
          activePers,
          product
        );

        applyActiveDesignView(
          canvas
        );

        fabricSaveHistory();
        updateLayerPanel();

        clearDesignState(
          stateKey
        );

        const editorViewId =
          designViewContext
            ?.activeViewId ||
          null;

        persistDesignState(
          stateKey,
          {
            editorViewId,

            ...(editorViewId
              ? {
                previewViewId:
                  editorViewId,
              }
              : {}),
          }
        );
      }
    );

  bindFontSelector(
    canvas,
    stateKey
  );

  bindFontSizeControl(
    canvas,
    stateKey
  );

  bindLayerDragAndDrop(
    canvas,
    stateKey
  );
}

function createFabricImageUploadMeta(
  file,
  image
) {
  return {
    fileName:
      file?.name ||
      'Afbeelding',

    fileType:
      file?.type ||
      getFileTypeFromName(
        file?.name ||
        ''
      ),

    widthPx:
      Number(
        image?.width ||
        image
          ?._element
          ?.naturalWidth ||
        0
      ),

    heightPx:
      Number(
        image?.height ||
        image
          ?._element
          ?.naturalHeight ||
        0
      ),
  };
}

function restoreFabricImageUploadMeta(canvas) {
  canvas
    .getObjects()
    .filter(object => (
      object.type === 'image' &&
      object._uploadMeta
    ))
    .forEach(object => {
      object._uploadMeta = {
        fileName:
          object
            ._uploadMeta
            .fileName ||
          'Afbeelding',

        fileType:
          object
            ._uploadMeta
            .fileType ||
          '',

        widthPx:
          Number(
            object
              ._uploadMeta
              .widthPx ||
            object.width ||
            0
          ),

        heightPx:
          Number(
            object
              ._uploadMeta
              .heightPx ||
            object.height ||
            0
          ),
      };
    });
}

function updateFabricImageDpiWarning(
  canvas,
  activePers,
  product,
  preferredObject = null
) {
  const warningElement =
    document.getElementById(
      'fabric-image-dpi-warning'
    );

  if (
    !warningElement ||
    !canvas
  ) {
    return;
  }

  const imageObject =
    getSelectedFabricImageForDpiWarning(
      canvas,
      preferredObject
    );

  if (!imageObject) {
    warningElement.hidden = true;
    warningElement.textContent = '';

    return;
  }

  const warning =
    getFabricImageDpiWarningForCanvas(
      imageObject,
      canvas,
      activePers,
      product
    );

  if (!warning) {
    warningElement.hidden = true;
    warningElement.textContent = '';

    return;
  }

  warningElement.hidden = false;

  warningElement.dataset.level =
    warning.level;

  warningElement.textContent =
    warning.message;
}

function getSelectedFabricImageForDpiWarning(
  canvas,
  preferredObject = null
) {
  if (
    preferredObject?.type === 'image' &&
    preferredObject._uploadMeta &&
    !isGuideObject(preferredObject)
  ) {
    return preferredObject;
  }

  const activeObject =
    canvas.getActiveObject();

  if (
    !activeObject ||
    isGuideObject(activeObject)
  ) {
    return null;
  }

  if (
    activeObject.type === 'image' &&
    activeObject._uploadMeta
  ) {
    return activeObject;
  }

  if (
    activeObject.type === 'activeSelection' &&
    typeof activeObject.getObjects ===
    'function'
  ) {
    return (
      activeObject
        .getObjects()
        .find(object => (
          object.type === 'image' &&
          object._uploadMeta &&
          !isGuideObject(object)
        )) ||
      null
    );
  }

  return null;
}

function getFabricImageDpiWarnings(
  canvas,
  activePers,
  product
) {
  if (!canvas) {
    return [];
  }

  return canvas
    .getObjects()
    .filter(object => (
      object.type === 'image' &&
      !isGuideObject(object) &&
      object._uploadMeta
    ))
    .map(object => (
      getFabricImageDpiWarningForCanvas(
        object,
        canvas,
        activePers,
        product
      )
    ))
    .filter(Boolean);
}

function getFabricImageDpiWarningForCanvas(
  object,
  canvas,
  activePers,
  product
) {
  const canvasWidth =
    canvas.getWidth();

  const canvasHeight =
    canvas.getHeight();

  const widthMm =
    Number(
      activePers?.width_mm ||
      product?.width_mm ||
      0
    );

  const heightMm =
    Number(
      activePers?.height_mm ||
      product?.height_mm ||
      0
    );

  if (
    !canvasWidth ||
    !canvasHeight ||
    !widthMm ||
    !heightMm
  ) {
    return null;
  }

  return getFabricImageDpiWarning(
    object,
    canvasWidth,
    canvasHeight,
    widthMm,
    heightMm
  );
}

function getFabricImageDpiWarning(
  object,
  canvasWidth,
  canvasHeight,
  widthMm,
  heightMm
) {
  const metadata =
    object._uploadMeta ||
    {};

  const sourceWidthPx =
    Number(
      metadata.widthPx ||
      0
    );

  const sourceHeightPx =
    Number(
      metadata.heightPx ||
      0
    );

  if (
    !sourceWidthPx ||
    !sourceHeightPx
  ) {
    return null;
  }

  const bounds =
    object.getBoundingRect(
      true,
      true
    );

  const placedWidthMm =
    bounds.width /
    canvasWidth *
    widthMm;

  const placedHeightMm =
    bounds.height /
    canvasHeight *
    heightMm;

  if (
    !placedWidthMm ||
    !placedHeightMm
  ) {
    return null;
  }

  const dpiX =
    Math.round(
      sourceWidthPx /
      placedWidthMm *
      25.4
    );

  const dpiY =
    Math.round(
      sourceHeightPx /
      placedHeightMm *
      25.4
    );

  const dpi =
    Math.min(
      dpiX,
      dpiY
    );

  const fileName =
    metadata.fileName ||
    'afbeelding';

  if (
    dpi <
    IMAGE_DPI_MINIMUM
  ) {
    return {
      type:
        'fabric-image-resolution-low',

      level:
        'error',

      fileName,
      dpi,

      message:
        `Waarschuwing: "${fileName}" lijkt te laag in resolutie voor drukwerk (${dpi} DPI). Gebruik een groter bestand of verklein de afbeelding in het ontwerp.`,
    };
  }

  if (
    dpi <
    IMAGE_DPI_RECOMMENDED
  ) {
    return {
      type:
        'fabric-image-resolution-warning',

      level:
        'warning',

      fileName,
      dpi,

      message:
        `Let op: "${fileName}" is lager dan de aanbevolen 300 DPI (${dpi} DPI). Gebruik bij voorkeur een hogere resolutie of maak de afbeelding kleiner.`,
    };
  }

  return null;
}

function isOutsideMargin(
  object,
  margin,
  canvasWidth,
  canvasHeight
) {
  const bounds =
    object.getBoundingRect(
      true,
      true
    );

  return (
    bounds.left < margin ||
    bounds.top < margin ||

    bounds.left +
    bounds.width >
    canvasWidth -
    margin ||

    bounds.top +
    bounds.height >
    canvasHeight -
    margin
  );
}

function isObjectOverlappingBlockedZones(
  object,
  activePers,
  product,
  canvasWidth,
  canvasHeight
) {
  if (
    !object ||
    isGuideObject(object)
  ) {
    return false;
  }

  const zones =
    Array.isArray(
      activePers?.blockedZones
    )
      ? activePers.blockedZones
      : [];

  if (!zones.length) {
    return false;
  }

  const bounds =
    object.getBoundingRect(
      true,
      true
    );

  return zones.some(zone => {
    if (zone.type === 'circle') {
      const circleData =
        getBlockedCircleCanvasData(
          zone,
          activePers,
          product,
          canvasWidth,
          canvasHeight
        );

      if (!circleData) {
        return false;
      }

      return isRectOverlappingCircle(
        bounds,
        circleData.cx,
        circleData.cy,
        circleData.safeRadius
      );
    }

    if (zone.type === 'rect') {
      const rectData =
        getBlockedRectCanvasData(
          zone,
          activePers,
          product,
          canvasWidth,
          canvasHeight
        );

      if (!rectData) {
        return false;
      }

      return isRectOverlappingRect(
        bounds,
        {
          left:
            rectData.safeLeft,

          top:
            rectData.safeTop,

          width:
            rectData.safeWidth,

          height:
            rectData.safeHeight,
        }
      );
    }

    if (zone.type === 'line') {
      const lineData =
        getBlockedLineCanvasData(
          zone,
          activePers,
          product,
          canvasWidth,
          canvasHeight
        );

      if (!lineData) {
        return false;
      }

      return isRectNearLine(
        bounds,
        lineData.x1,
        lineData.y1,
        lineData.x2,
        lineData.y2,
        lineData.safeRadius
      );
    }

    return false;
  });
}

function isRectOverlappingCircle(
  rect,
  circleX,
  circleY,
  radius
) {
  const closestX =
    clamp(
      circleX,
      rect.left,
      rect.left +
      rect.width
    );

  const closestY =
    clamp(
      circleY,
      rect.top,
      rect.top +
      rect.height
    );

  const distanceX =
    circleX -
    closestX;

  const distanceY =
    circleY -
    closestY;

  return (
    distanceX * distanceX +
    distanceY * distanceY
  ) <=
    radius * radius;
}

function isRectOverlappingRect(
  rectA,
  rectB
) {
  return (
    rectA.left <
    rectB.left +
    rectB.width &&

    rectA.left +
    rectA.width >
    rectB.left &&

    rectA.top <
    rectB.top +
    rectB.height &&

    rectA.top +
    rectA.height >
    rectB.top
  );
}

function isRectNearLine(
  rect,
  x1,
  y1,
  x2,
  y2,
  radius
) {
  const expandedRect = {
    left:
      rect.left -
      radius,

    top:
      rect.top -
      radius,

    right:
      rect.left +
      rect.width +
      radius,

    bottom:
      rect.top +
      rect.height +
      radius,
  };

  if (
    (
      x1 >= expandedRect.left &&
      x1 <= expandedRect.right &&
      y1 >= expandedRect.top &&
      y1 <= expandedRect.bottom
    ) ||
    (
      x2 >= expandedRect.left &&
      x2 <= expandedRect.right &&
      y2 >= expandedRect.top &&
      y2 <= expandedRect.bottom
    )
  ) {
    return true;
  }

  const rectangleLines = [
    [
      expandedRect.left,
      expandedRect.top,
      expandedRect.right,
      expandedRect.top,
    ],

    [
      expandedRect.right,
      expandedRect.top,
      expandedRect.right,
      expandedRect.bottom,
    ],

    [
      expandedRect.right,
      expandedRect.bottom,
      expandedRect.left,
      expandedRect.bottom,
    ],

    [
      expandedRect.left,
      expandedRect.bottom,
      expandedRect.left,
      expandedRect.top,
    ],
  ];

  return rectangleLines.some(
    ([
      rectX1,
      rectY1,
      rectX2,
      rectY2,
    ]) => (
      doLineSegmentsIntersect(
        x1,
        y1,
        x2,
        y2,
        rectX1,
        rectY1,
        rectX2,
        rectY2
      )
    )
  );
}

function doLineSegmentsIntersect(
  x1,
  y1,
  x2,
  y2,
  x3,
  y3,
  x4,
  y4
) {
  const direction = (
    pointAX,
    pointAY,
    pointBX,
    pointBY,
    pointCX,
    pointCY
  ) => (
    (
      pointCX -
      pointAX
    ) *
    (
      pointBY -
      pointAY
    ) -
    (
      pointCY -
      pointAY
    ) *
    (
      pointBX -
      pointAX
    )
  );

  const directionOne =
    direction(
      x3,
      y3,
      x4,
      y4,
      x1,
      y1
    );

  const directionTwo =
    direction(
      x3,
      y3,
      x4,
      y4,
      x2,
      y2
    );

  const directionThree =
    direction(
      x1,
      y1,
      x2,
      y2,
      x3,
      y3
    );

  const directionFour =
    direction(
      x1,
      y1,
      x2,
      y2,
      x4,
      y4
    );

  return (
    (
      directionOne > 0 &&
      directionTwo < 0
    ) ||
    (
      directionOne < 0 &&
      directionTwo > 0
    )
  ) &&
    (
      (
        directionThree > 0 &&
        directionFour < 0
      ) ||
      (
        directionThree < 0 &&
        directionFour > 0
      )
    );
}

function clamp(
  value,
  min,
  max
) {
  return Math.min(
    Math.max(
      value,
      min
    ),
    max
  );
}

function collectCanvasPrepressWarnings(
  canvas,
  activePers,
  product
) {
  if (!canvas) {
    return [];
  }

  const state =
    window._currentDesignGuideState ||
    {};

  const canvasWidth =
    state.canvasWidth ||
    canvas.getWidth();

  const canvasHeight =
    state.canvasHeight ||
    canvas.getHeight();

  const margin =
    state.margin !== undefined
      ? state.margin
      : getFallbackCanvasMargin(
        activePers,
        product,
        canvasWidth
      );

  const warnings = [];

  const editableObjects =
    canvas
      .getObjects()
      .filter(
        object =>
          !isGuideObject(object)
      );

  const outsideMarginCount =
    editableObjects.filter(object => {
      if (
        designViewContext?.config.enabled
      ) {
        const view =
          getDesignViewById(
            getObjectDesignViewId(
              canvas,
              object
            )
          );

        if (view) {
          return isObjectOutsideDesignViewMargin(
            canvas,
            object,
            view,
            margin
          );
        }
      }

      return isOutsideMargin(
        object,
        margin,
        canvasWidth,
        canvasHeight
      );
    }).length;

  const blockedZoneCount =
    editableObjects.filter(
      object =>
        isObjectOverlappingBlockedZones(
          object,
          activePers,
          product,
          canvasWidth,
          canvasHeight
        )
    ).length;

  const imageDpiWarnings =
    getFabricImageDpiWarnings(
      canvas,
      activePers,
      product
    );

  if (
    outsideMarginCount > 0
  ) {
    warnings.push({
      type:
        'safe-margin',

      level:
        'warning',

      message:
        outsideMarginCount === 1
          ? 'Een element staat buiten de veilige marge.'
          : `${outsideMarginCount} elementen staan buiten de veilige marge.`,
    });
  }

  if (
    blockedZoneCount > 0
  ) {
    warnings.push({
      type:
        'blocked-zone',

      level:
        'warning',

      message:
        blockedZoneCount === 1
          ? 'Een element raakt een rillijn of no-print zone.'
          : `${blockedZoneCount} elementen raken een rillijn of no-print zone.`,
    });
  }

  imageDpiWarnings.forEach(
    warning => {
      warnings.push({
        type:
          warning.type,

        level:
          warning.level === 'error'
            ? 'warning'
            : warning.level,

        message:
          warning.message,

        fileName:
          warning.fileName,

        dpi:
          warning.dpi,
      });
    }
  );

  return warnings;
}

function getFallbackCanvasMargin(
  activePers,
  product,
  canvasWidth
) {
  const sourceMarginPx =
    Number(
      activePers?.margin_px ||
      product?.margin_px ||
      20
    );

  const sourceWidthPx =
    Number(
      activePers?.width_px ||
      product?.width_px ||
      1181
    );

  if (!sourceWidthPx) {
    return sourceMarginPx;
  }

  return (
    sourceMarginPx *
    (
      canvasWidth /
      sourceWidthPx
    )
  );
}

function updateFabricStatus() {
  const object =
    fabricCanvas?.getActiveObject();

  const status =
    document.getElementById(
      'status'
    );

  if (
    !object ||
    !status
  ) {
    return;
  }

  status.textContent =
    `${object.type === 'i-text' ? 'Tekst' : 'Afbeelding'} geselecteerd. Sleep, schaal of roteer.`;
}

function updateLayerPanel() {
  const panel =
    document.getElementById(
      'layer-list'
    );

  if (
    !panel ||
    !fabricCanvas
  ) {
    return;
  }

  panel.innerHTML = '';

  const activeView =
    getActiveDesignView();

  fabricCanvas
    .getObjects()
    .filter(
      object =>
        !isGuideObject(object)
    )
    .filter(object => (
      !activeView ||
      getObjectDesignViewId(
        fabricCanvas,
        object
      ) === activeView.id
    ))
    .reverse()
    .forEach(
      (object, index) => {
        const item =
          document.createElement(
            'div'
          );

        item.className =
          'layer-item';

        item.draggable =
          true;

        item.dataset.objectId =
          getFabricObjectId(
            object
          );

        item.textContent =
          object.type === 'i-text'
            ? `${index + 1}. Tekst: "${object.text}"`
            : `${index + 1}. Afbeelding`;

        if (
          fabricCanvas
            .getActiveObject() ===
          object
        ) {
          item.classList.add(
            'active'
          );
        }

        item.addEventListener(
          'click',
          () => {
            if (
              object.selectable === false ||
              object.evented === false
            ) {
              return;
            }

            fabricCanvas.setActiveObject(
              object
            );

            fabricCanvas.renderAll();

            updateFabricImageDpiWarning(
              fabricCanvas,

              window
                ._currentDesignGuideState
                ?.activePers,

              window
                ._currentDesignGuideState
                ?.product,

              object
            );
          }
        );

        panel.appendChild(
          item
        );
      }
    );
}

function bindLayerDragAndDrop(
  canvas,
  stateKey
) {
  const panel =
    document.getElementById(
      'layer-list'
    );

  if (!panel) {
    return;
  }

  panel.addEventListener(
    'dragstart',
    event => {
      const item =
        event.target.closest(
          '.layer-item'
        );

      if (!item) {
        return;
      }

      event.dataTransfer.setData(
        'text/plain',
        item.dataset.objectId
      );

      item.classList.add(
        'dragging'
      );
    }
  );

  panel.addEventListener(
    'dragend',
    event => {
      event.target
        .closest('.layer-item')
        ?.classList
        .remove('dragging');
    }
  );

  panel.addEventListener(
    'dragover',
    event => {
      event.preventDefault();
    }
  );

  panel.addEventListener(
    'drop',
    event => {
      event.preventDefault();

      const draggedId =
        event.dataTransfer.getData(
          'text/plain'
        );

      const targetItem =
        event.target.closest(
          '.layer-item'
        );

      if (
        !draggedId ||
        !targetItem
      ) {
        return;
      }

      const targetId =
        targetItem.dataset.objectId;

      if (
        draggedId ===
        targetId
      ) {
        return;
      }

      reorderCanvasObjectsFromLayerDrop(
        canvas,
        draggedId,
        targetId
      );

      fabricSaveHistory();

      autoSaveCanvasState(
        stateKey
      );

      updateLayerPanel();
    }
  );
}

function reorderCanvasObjectsFromLayerDrop(
  canvas,
  draggedId,
  targetId
) {
  const editableObjects =
    canvas
      .getObjects()
      .filter(
        object =>
          !isGuideObject(object)
      );

  const draggedObject =
    editableObjects.find(
      object =>
        getFabricObjectId(object) ===
        draggedId
    );

  const targetObject =
    editableObjects.find(
      object =>
        getFabricObjectId(object) ===
        targetId
    );

  if (
    !draggedObject ||
    !targetObject
  ) {
    return;
  }

  const fromIndex =
    editableObjects.indexOf(
      draggedObject
    );

  const toIndex =
    editableObjects.indexOf(
      targetObject
    );

  if (
    fromIndex === -1 ||
    toIndex === -1
  ) {
    return;
  }

  editableObjects.splice(
    fromIndex,
    1
  );

  editableObjects.splice(
    toIndex,
    0,
    draggedObject
  );

  const activeObject =
    canvas.getActiveObject();

  const backgroundColor =
    canvas.backgroundColor;

  const backgroundImage =
    canvas.backgroundImage ||
    null;

  editableObjects.forEach(
    (object, index) => {
      if (
        typeof canvas.moveTo ===
        'function'
      ) {
        canvas.moveTo(
          object,
          index
        );

        return;
      }

      if (
        typeof object.moveTo ===
        'function'
      ) {
        object.moveTo(
          index
        );
      }
    }
  );

  canvas.backgroundColor =
    backgroundColor;

  canvas.backgroundImage =
    backgroundImage;

  bringGuidesToFront(
    canvas
  );

  if (
    activeObject &&
    !isGuideObject(activeObject)
  ) {
    canvas.setActiveObject(
      activeObject
    );
  }

  canvas.renderAll();
}

function getFabricObjectId(object) {
  if (!object._layerId) {
    object._layerId =
      `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  return object._layerId;
}

function applyToSelected(
  property,
  value
) {
  const object =
    fabricCanvas?.getActiveObject();

  if (
    object &&
    object.type === 'i-text' &&
    !isGuideObject(object)
  ) {
    object.set(
      property,
      value
    );

    fabricCanvas.renderAll();
    fabricSaveHistory();
    updateLayerPanel();

    autoSaveCanvasState(
      window._currentDesignStateKey
    );
  }
}

function fabricSaveHistory() {
  if (!fabricCanvas) {
    return;
  }

  const json =
    withCanonicalDesignCanvas(
      fabricCanvas,

      () => JSON.stringify(
        fabricCanvas.toJSON(
          FABRIC_SERIALIZABLE_PROPERTIES
        )
      )
    );

  if (!json) {
    return;
  }

  fabricHistory.push(
    json
  );

  if (
    fabricHistory.length > 20
  ) {
    fabricHistory.shift();
  }
}

function createTechnicalDesignCanvas(
  canvas = fabricCanvas
) {
  if (!canvas) {
    return null;
  }

  const sourceCanvas =
    captureCanonicalDesignSourceCanvas(
      canvas
    );

  return composeTechnicalDesignCanvas(
    sourceCanvas,
    designViewContext?.config,
    designViewContext?.spec
  );
}

function captureCanonicalDesignSourceCanvas(canvas) {
  return withCanonicalDesignCanvas(
    canvas,
    () => {
      const sourceCanvas =
        document.createElement(
          'canvas'
        );

      sourceCanvas.width =
        canvas.getWidth();

      sourceCanvas.height =
        canvas.getHeight();

      const sourceContext =
        sourceCanvas.getContext(
          '2d'
        );

      sourceContext.imageSmoothingEnabled =
        true;

      sourceContext.imageSmoothingQuality =
        'high';

      sourceContext.drawImage(
        canvas.lowerCanvasEl,
        0,
        0,
        sourceCanvas.width,
        sourceCanvas.height
      );

      return sourceCanvas;
    }
  );
}

function composeTechnicalDesignCanvas(
  sourceCanvas,
  config,
  spec
) {
  if (!sourceCanvas) {
    return null;
  }

  const outputCanvas =
    document.createElement(
      'canvas'
    );

  outputCanvas.width =
    sourceCanvas.width;

  outputCanvas.height =
    sourceCanvas.height;

  const outputContext =
    outputCanvas.getContext(
      '2d'
    );

  outputContext.imageSmoothingEnabled =
    true;

  outputContext.imageSmoothingQuality =
    'high';

  outputContext.drawImage(
    sourceCanvas,
    0,
    0
  );

  if (
    !config?.enabled ||
    !Array.isArray(config.views) ||
    !spec
  ) {
    return outputCanvas;
  }

  config.views.forEach(view => {
    const bounds =
      getDesignViewPixelBounds(
        view,
        spec,
        sourceCanvas.width,
        sourceCanvas.height
      );

    if (!bounds) {
      return;
    }

    const sourceZone =
      view.sourceZone ||
      {};

    const rotation =
      normalizeDesignRotation(
        sourceZone.rotation
      );

    const flipX =
      Boolean(
        sourceZone.flipX
      );

    const flipY =
      Boolean(
        sourceZone.flipY
      );

    if (
      rotation === 0 &&
      !flipX &&
      !flipY
    ) {
      return;
    }

    const artworkCanvas =
      document.createElement(
        'canvas'
      );

    artworkCanvas.width =
      bounds.width;

    artworkCanvas.height =
      bounds.height;

    const artworkContext =
      artworkCanvas.getContext(
        '2d'
      );

    artworkContext.imageSmoothingEnabled =
      true;

    artworkContext.imageSmoothingQuality =
      'high';

    artworkContext.drawImage(
      sourceCanvas,
      bounds.left,
      bounds.top,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height
    );

    const transformedCanvas =
      applyInverseDesignViewTransform(
        artworkCanvas,
        {
          rotation,
          flipX,
          flipY,
        }
      );

    outputContext.clearRect(
      bounds.left,
      bounds.top,
      bounds.width,
      bounds.height
    );

    outputContext.drawImage(
      transformedCanvas,
      0,
      0,
      transformedCanvas.width,
      transformedCanvas.height,
      bounds.left,
      bounds.top,
      bounds.width,
      bounds.height
    );
  });

  return outputCanvas;
}

function getDesignViewPixelBounds(
  view,
  spec,
  canvasWidth,
  canvasHeight
) {
  if (
    !view?.sourceZone ||
    !spec ||
    !canvasWidth ||
    !canvasHeight
  ) {
    return null;
  }

  const sourceZone =
    view.sourceZone;

  const exportWidthMm =
    Number(
      spec.exportWidthMm ||
      spec.finishWidthMm ||
      0
    );

  const exportHeightMm =
    Number(
      spec.exportHeightMm ||
      spec.finishHeightMm ||
      0
    );

  if (
    !exportWidthMm ||
    !exportHeightMm
  ) {
    return null;
  }

  const rawLeft =
    (
      (
        Number(spec.trimXmm || 0) +
        Number(sourceZone.x_mm || 0)
      ) /
      exportWidthMm
    ) *
    canvasWidth;

  const rawTop =
    (
      (
        Number(spec.trimYmm || 0) +
        Number(sourceZone.y_mm || 0)
      ) /
      exportHeightMm
    ) *
    canvasHeight;

  const rawWidth =
    (
      Number(
        sourceZone.width_mm ||
        0
      ) /
      exportWidthMm
    ) *
    canvasWidth;

  const rawHeight =
    (
      Number(
        sourceZone.height_mm ||
        0
      ) /
      exportHeightMm
    ) *
    canvasHeight;

  const left =
    clamp(
      Math.round(rawLeft),
      0,
      canvasWidth
    );

  const top =
    clamp(
      Math.round(rawTop),
      0,
      canvasHeight
    );

  const right =
    clamp(
      Math.round(
        rawLeft +
        rawWidth
      ),
      0,
      canvasWidth
    );

  const bottom =
    clamp(
      Math.round(
        rawTop +
        rawHeight
      ),
      0,
      canvasHeight
    );

  if (
    right <= left ||
    bottom <= top
  ) {
    return null;
  }

  return {
    left,
    top,

    width:
      right -
      left,

    height:
      bottom -
      top,
  };
}

function applyInverseDesignViewTransform(
  sourceCanvas,
  {
    rotation = 0,
    flipX = false,
    flipY = false,
  } = {}
) {
  const normalizedRotation =
    normalizeDesignRotation(
      rotation
    );

  const swapsDimensions =
    normalizedRotation === 90 ||
    normalizedRotation === 270;

  const transformedCanvas =
    document.createElement(
      'canvas'
    );

  transformedCanvas.width =
    swapsDimensions
      ? sourceCanvas.height
      : sourceCanvas.width;

  transformedCanvas.height =
    swapsDimensions
      ? sourceCanvas.width
      : sourceCanvas.height;

  const context =
    transformedCanvas.getContext(
      '2d'
    );

  context.imageSmoothingEnabled =
    true;

  context.imageSmoothingQuality =
    'high';

  context.save();

  context.translate(
    transformedCanvas.width / 2,
    transformedCanvas.height / 2
  );

  context.scale(
    flipX
      ? -1
      : 1,

    flipY
      ? -1
      : 1
  );

  context.rotate(
    -normalizedRotation *
    Math.PI /
    180
  );

  context.drawImage(
    sourceCanvas,
    -sourceCanvas.width / 2,
    -sourceCanvas.height / 2
  );

  context.restore();

  return transformedCanvas;
}

function snapshotCanvas(
  canvas,
  product,
  activePers
) {
  const technicalCanvas =
    createTechnicalDesignCanvas(
      canvas
    );

  if (!technicalCanvas) {
    throw new Error(
      'Het technische drukbestand kon niet worden opgebouwd.'
    );
  }

  const spec =
    designViewContext?.spec ||
    window.ProductPreview?.getPrintSpec?.(
      activePers || {},
      product || {}
    ) ||
    null;

  const printWidthPx =
    Number(
      spec?.exportWidthPx ||
      activePers?.width_px ||
      product.width_px ||
      technicalCanvas.width
    );

  const printHeightPx =
    Number(
      spec?.exportHeightPx ||
      activePers?.height_px ||
      product.height_px ||
      Math.round(
        printWidthPx *
        technicalCanvas.height /
        technicalCanvas.width
      )
    );

  const exportCanvas =
    document.createElement(
      'canvas'
    );

  exportCanvas.width =
    Math.max(
      1,
      Math.round(
        printWidthPx
      )
    );

  exportCanvas.height =
    Math.max(
      1,
      Math.round(
        printHeightPx
      )
    );

  const exportContext =
    exportCanvas.getContext(
      '2d'
    );

  exportContext.imageSmoothingEnabled =
    true;

  exportContext.imageSmoothingQuality =
    'high';

  exportContext.drawImage(
    technicalCanvas,
    0,
    0,
    exportCanvas.width,
    exportCanvas.height
  );

  const dataURL =
    exportCanvas.toDataURL(
      'image/png'
    );

  const json =
    withCanonicalDesignCanvas(
      canvas,

      () => JSON.stringify(
        canvas.toJSON(
          FABRIC_SERIALIZABLE_PROPERTIES
        )
      )
    );

  const backgroundColor =
    canvas.backgroundColor ||
    fabricBackgroundColor;

  const finishWidthMm =
    activePers?.width_mm ||
    product.width_mm ||
    100;

  const finishHeightMm =
    activePers?.height_mm ||
    product.height_mm ||
    70;

  const pdfDataURL =
    generatePrintPDF(
      dataURL,
      finishWidthMm,
      finishHeightMm
    );

  const rillinesPdfDataURL =
    generatePrintPDFWithRillines(
      dataURL,
      finishWidthMm,
      finishHeightMm,
      activePers,
      product
    );

  return {
    dataURL,
    json,
    backgroundColor,

    fabricCanvasWidth:
      canvas.getWidth(),

    fabricCanvasHeight:
      canvas.getHeight(),

    pdfDataURL,
    rillinesPdfDataURL,
  };
}

function generatePrintPDF(
  pngDataURL,
  widthMm,
  heightMm
) {
  if (!window.jspdf) {
    console.warn(
      'jsPDF niet geladen'
    );

    return null;
  }

  const { jsPDF } =
    window.jspdf;

  const pdfGeometry =
    getPrintPdfGeometry(
      widthMm,
      heightMm
    );

  const pdf =
    new jsPDF({
      orientation:
        pdfGeometry.pageW >
        pdfGeometry.pageH
          ? 'landscape'
          : 'portrait',

      unit:
        'mm',

      format: [
        pdfGeometry.pageW,
        pdfGeometry.pageH,
      ],

      compress:
        true,
    });

  pdf.addImage(
    pngDataURL,
    'PNG',
    0,
    0,
    pdfGeometry.pageW,
    pdfGeometry.pageH,
    '',
    'FAST'
  );

  drawCropMarks(
    pdf,
    pdfGeometry
  );

  return pdf.output(
    'datauristring'
  );
}

function generatePrintPDFWithRillines(
  pngDataURL,
  widthMm,
  heightMm,
  activePers,
  product
) {
  if (!window.jspdf) {
    console.warn(
      'jsPDF niet geladen'
    );

    return null;
  }

  const { jsPDF } =
    window.jspdf;

  const pdfGeometry =
    getPrintPdfGeometry(
      widthMm,
      heightMm
    );

  const pdf =
    new jsPDF({
      orientation:
        pdfGeometry.pageW >
        pdfGeometry.pageH
          ? 'landscape'
          : 'portrait',

      unit:
        'mm',

      format: [
        pdfGeometry.pageW,
        pdfGeometry.pageH,
      ],

      compress:
        true,
    });

  pdf.addImage(
    pngDataURL,
    'PNG',
    0,
    0,
    pdfGeometry.pageW,
    pdfGeometry.pageH,
    '',
    'FAST'
  );

  drawCropMarks(
    pdf,
    pdfGeometry
  );

  drawRillinesOnPdf(
    pdf,
    pdfGeometry,
    activePers,
    product
  );

  return pdf.output(
    'datauristring'
  );
}

function getPrintPdfGeometry(
  widthMm,
  heightMm
) {
  const bleedMm = 3;
  const markMm = 5;
  const gapMm = 2.117;

  const pageWidth =
    Number(widthMm || 100) +
    bleedMm * 2;

  const pageHeight =
    Number(heightMm || 70) +
    bleedMm * 2;

  return {
    bleedMm,
    markMm,
    gapMm,

    pageW:
      pageWidth,

    pageH:
      pageHeight,

    trimX1:
      bleedMm,

    trimY1:
      bleedMm,

    trimX2:
      bleedMm +
      Number(widthMm || 100),

    trimY2:
      bleedMm +
      Number(heightMm || 70),
  };
}

function drawCropMarks(
  pdf,
  geometry
) {
  pdf.setDrawColor(
    0,
    0,
    0
  );

  pdf.setLineWidth(
    0.088
  );

  pdf.line(
    geometry.trimX1 -
    geometry.gapMm -
    geometry.markMm,

    geometry.trimY1,

    geometry.trimX1 -
    geometry.gapMm,

    geometry.trimY1
  );

  pdf.line(
    geometry.trimX1,

    geometry.trimY1 -
    geometry.gapMm -
    geometry.markMm,

    geometry.trimX1,

    geometry.trimY1 -
    geometry.gapMm
  );

  pdf.line(
    geometry.trimX2 +
    geometry.gapMm,

    geometry.trimY1,

    geometry.trimX2 +
    geometry.gapMm +
    geometry.markMm,

    geometry.trimY1
  );

  pdf.line(
    geometry.trimX2,

    geometry.trimY1 -
    geometry.gapMm -
    geometry.markMm,

    geometry.trimX2,

    geometry.trimY1 -
    geometry.gapMm
  );

  pdf.line(
    geometry.trimX1 -
    geometry.gapMm -
    geometry.markMm,

    geometry.trimY2,

    geometry.trimX1 -
    geometry.gapMm,

    geometry.trimY2
  );

  pdf.line(
    geometry.trimX1,

    geometry.trimY2 +
    geometry.gapMm,

    geometry.trimX1,

    geometry.trimY2 +
    geometry.gapMm +
    geometry.markMm
  );

  pdf.line(
    geometry.trimX2 +
    geometry.gapMm,

    geometry.trimY2,

    geometry.trimX2 +
    geometry.gapMm +
    geometry.markMm,

    geometry.trimY2
  );

  pdf.line(
    geometry.trimX2,

    geometry.trimY2 +
    geometry.gapMm,

    geometry.trimX2,

    geometry.trimY2 +
    geometry.gapMm +
    geometry.markMm
  );
}

function drawRillinesOnPdf(
  pdf,
  geometry,
  activePers,
  product
) {
  const zones =
    Array.isArray(
      activePers?.blockedZones
    )
      ? activePers.blockedZones
      : [];

  const sourceWidthMm =
    Number(
      activePers?.width_mm ||
      product?.width_mm ||
      0
    );

  const sourceHeightMm =
    Number(
      activePers?.height_mm ||
      product?.height_mm ||
      0
    );

  if (
    !zones.length ||
    !sourceWidthMm ||
    !sourceHeightMm
  ) {
    return;
  }

  pdf.setDrawColor(
    0,
    255,
    255
  );

  pdf.setLineWidth(
    0.25
  );

  zones
    .filter(
      zone =>
        zone.type === 'line'
    )
    .forEach(zone => {
      let x1Mm =
        Number(
          zone.x1_mm ||
          0
        );

      let y1Mm =
        Number(
          zone.y1_mm ||
          0
        );

      let x2Mm =
        Number(
          zone.x2_mm ||
          0
        );

      let y2Mm =
        Number(
          zone.y2_mm ||
          0
        );

      const deltaXmm =
        Math.abs(
          x2Mm -
          x1Mm
        );

      const deltaYmm =
        Math.abs(
          y2Mm -
          y1Mm
        );

      if (
        deltaYmm <= 0.01
      ) {
        const centerYmm =
          (
            y1Mm +
            y2Mm
          ) /
          2;

        x1Mm = 0;
        x2Mm = sourceWidthMm;
        y1Mm = centerYmm;
        y2Mm = centerYmm;
      } else if (
        deltaXmm <= 0.01
      ) {
        const centerXmm =
          (
            x1Mm +
            x2Mm
          ) /
          2;

        x1Mm = centerXmm;
        x2Mm = centerXmm;
        y1Mm = 0;
        y2Mm = sourceHeightMm;
      }

      const x1 =
        geometry.trimX1 +
        (
          x1Mm /
          sourceWidthMm
        ) *
        (
          geometry.trimX2 -
          geometry.trimX1
        );

      const y1 =
        geometry.trimY1 +
        (
          y1Mm /
          sourceHeightMm
        ) *
        (
          geometry.trimY2 -
          geometry.trimY1
        );

      const x2 =
        geometry.trimX1 +
        (
          x2Mm /
          sourceWidthMm
        ) *
        (
          geometry.trimX2 -
          geometry.trimX1
        );

      const y2 =
        geometry.trimY1 +
        (
          y2Mm /
          sourceHeightMm
        ) *
        (
          geometry.trimY2 -
          geometry.trimY1
        );

      if (
        typeof pdf
          .setLineDashPattern ===
        'function'
      ) {
        pdf.setLineDashPattern(
          [1, 0.75],
          0
        );
      }

      pdf.line(
        x1,
        y1,
        x2,
        y2
      );

      if (
        typeof pdf
          .setLineDashPattern ===
        'function'
      ) {
        pdf.setLineDashPattern(
          [],
          0
        );
      }
    });
}

function autoSaveCanvasState(stateKey) {
  if (
    !fabricCanvas ||
    !stateKey
  ) {
    return;
  }

  const json =
    withCanonicalDesignCanvas(
      fabricCanvas,

      () => JSON.stringify(
        fabricCanvas.toJSON(
          FABRIC_SERIALIZABLE_PROPERTIES
        )
      )
    );

  const editorViewId =
    designViewContext
      ?.activeViewId ||
    null;

  persistDesignState(
    stateKey,
    {
      fabricJSON:
        json,

      backgroundColor:
        fabricCanvas.backgroundColor ||
        fabricBackgroundColor,

      fabricCanvasWidth:
        fabricCanvas.getWidth(),

      fabricCanvasHeight:
        fabricCanvas.getHeight(),

      editorViewId,

      ...(editorViewId
        ? {
          previewViewId:
            editorViewId,
        }
        : {}),
    }
  );
}

function getGuideObjects(canvas) {
  return canvas
    .getObjects()
    .filter(
      object =>
        isGuideObject(object)
    );
}

function persistDesignState(
  stateKey,
  data
) {
  if (!stateKey) {
    return;
  }

  try {
    const current =
      JSON.parse(
        localStorage.getItem(
          stateKey
        ) ||
        '{}'
      );

    const lightCurrent = {
      ...current,
    };

    const lightData = {
      ...(data || {}),
    };

    [
      'dataURL',
      'pdfDataURL',
      'rillinesPdfDataURL',
    ].forEach(field => {
      delete lightCurrent[field];
      delete lightData[field];
    });

    localStorage.setItem(
      stateKey,
      JSON.stringify({
        ...lightCurrent,
        ...lightData,

        savedAt:
          Date.now(),
      })
    );
  } catch (error) {
    console.warn(
      'Design state opslaan mislukt',
      error
    );
  }
}

function loadDesignState(stateKey) {
  try {
    const raw =
      localStorage.getItem(
        stateKey
      );

    if (!raw) {
      return null;
    }

    const state =
      JSON.parse(
        raw
      );

    if (
      Date.now() -
      (
        state.savedAt ||
        0
      ) >
      86400000
    ) {
      localStorage.removeItem(
        stateKey
      );

      return null;
    }

    return state;
  } catch {
    return null;
  }
}

function clearDesignState(stateKey) {
  if (!stateKey) {
    return;
  }

  localStorage.removeItem(
    stateKey
  );
}

async function handleUpload(
  file,
  stateKey,
  activePers,
  product
) {
  const uploadCheckResult =
    await buildUploadCheck(
      file,
      activePers,
      product
    );

  const dataURL =
    await new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.onload =
          event => {
            resolve(
              event.target.result
            );
          };

        reader.onerror =
          () => {
            reject(
              reader.error ||
              new Error(
                'Het bestand kon niet worden gelezen.'
              )
            );
          };

        reader.readAsDataURL(
          file
        );
      }
    );

  uploadedDataURL =
    dataURL;

  uploadedFileName =
    file.name;

  uploadedCheck =
    uploadCheckResult;

  const generatedUploadPdfs =
    buildUploadPdfData(
      uploadedDataURL,
      activePers,
      product
    );

  uploadedPdfDataURL =
    generatedUploadPdfs.pdfDataURL;

  uploadedRillinesPdfDataURL =
    generatedUploadPdfs.rillinesPdfDataURL;

  const designData = {
    dataURL:
      uploadedDataURL,

    pdfDataURL:
      uploadedPdfDataURL,

    rillinesPdfDataURL:
      uploadedRillinesPdfDataURL,

    fileName:
      uploadedFileName,

    tab:
      'upload',

    source:
      'upload',

    uploadCheck:
      uploadedCheck,

    prepressWarnings:
      getUploadPrepressWarnings(
        uploadedCheck
      ),
  };

  await Promise.resolve(
    Session.setDesign(
      designData
    )
  );

  persistDesignState(
    stateKey,
    {
      fileName:
        uploadedFileName,

      tab:
        'upload',

      source:
        'upload',

      uploadCheck:
        uploadedCheck,

      prepressWarnings:
        designData.prepressWarnings,
    }
  );

  renderDesignPage();
}

function buildUploadPdfData(
  dataURL,
  activePers,
  product
) {
  const finishWidthMm =
    activePers?.width_mm ||
    product?.width_mm ||
    100;

  const finishHeightMm =
    activePers?.height_mm ||
    product?.height_mm ||
    70;

  if (
    dataURL?.startsWith(
      'data:application/pdf'
    )
  ) {
    return {
      pdfDataURL:
        dataURL,

      rillinesPdfDataURL:
        '',
    };
  }

  if (
    !dataURL?.startsWith(
      'data:image'
    )
  ) {
    return {
      pdfDataURL:
        '',

      rillinesPdfDataURL:
        '',
    };
  }

  return {
    pdfDataURL:
      generatePrintPDF(
        dataURL,
        finishWidthMm,
        finishHeightMm
      ) ||
      '',

    rillinesPdfDataURL:
      generatePrintPDFWithRillines(
        dataURL,
        finishWidthMm,
        finishHeightMm,
        activePers,
        product
      ) ||
      '',
  };
}

function buildUploadCheck(
  file,
  activePers,
  product
) {
  const fileName =
    file?.name ||
    '';

  const fileType =
    file?.type ||
    getFileTypeFromName(
      fileName
    );

  const extension =
    getFileExtension(
      fileName
    );

  const printSpec =
    getUploadPrintSpec(
      activePers,
      product
    );

  const requiredWidthPx =
    printSpec.requiredWidthPx;

  const requiredHeightPx =
    printSpec.requiredHeightPx;

  if (!file) {
    return Promise.resolve(
      null
    );
  }

  if (
    [
      'pdf',
      'ai',
      'eps',
    ].includes(extension)
  ) {
    return Promise.resolve({
      fileName,
      fileType,

      widthPx:
        null,

      heightPx:
        null,

      requiredWidthPx,
      requiredHeightPx,

      estimatedDpiX:
        null,

      estimatedDpiY:
        null,

      status:
        'manual-check',

      message:
        'Dit bestand wordt technisch gecontroleerd in Adobe.',
    });
  }

  if (
    !fileType.startsWith(
      'image/'
    ) &&
    ![
      'png',
      'jpg',
      'jpeg',
    ].includes(extension)
  ) {
    return Promise.resolve({
      fileName,
      fileType,

      widthPx:
        null,

      heightPx:
        null,

      requiredWidthPx,
      requiredHeightPx,

      estimatedDpiX:
        null,

      estimatedDpiY:
        null,

      status:
        'warning',

      message:
        'Dit bestandstype kan niet automatisch op resolutie worden gecontroleerd.',
    });
  }

  return getUploadedImageDimensions(
    file
  )
    .then(dimensions => {
      const estimatedDpiX =
        printSpec.exportWidthMm
          ? Math.round(
            dimensions.widthPx /
            printSpec.exportWidthMm *
            25.4
          )
          : null;

      const estimatedDpiY =
        printSpec.exportHeightMm
          ? Math.round(
            dimensions.heightPx /
            printSpec.exportHeightMm *
            25.4
          )
          : null;

      const minimumDpi =
        Math.min(
          estimatedDpiX ||
          0,

          estimatedDpiY ||
          0
        );

      let status =
        'good';

      let message =
        'De afbeelding heeft voldoende resolutie voor drukwerk op 300 DPI.';

      if (
        minimumDpi <
        150
      ) {
        status =
          'error';

        message =
          `De afbeelding lijkt te laag in resolutie. Advies: minimaal ${requiredWidthPx} × ${requiredHeightPx}px voor 300 DPI.`;
      } else if (
        minimumDpi <
        300
      ) {
        status =
          'warning';

        message =
          `De afbeelding is bruikbaar, maar lager dan de aanbevolen 300 DPI. Advies: ${requiredWidthPx} × ${requiredHeightPx}px.`;
      }

      return {
        fileName,
        fileType,

        widthPx:
          dimensions.widthPx,

        heightPx:
          dimensions.heightPx,

        requiredWidthPx,
        requiredHeightPx,
        estimatedDpiX,
        estimatedDpiY,
        status,
        message,
      };
    })
    .catch(() => ({
      fileName,
      fileType,

      widthPx:
        null,

      heightPx:
        null,

      requiredWidthPx,
      requiredHeightPx,

      estimatedDpiX:
        null,

      estimatedDpiY:
        null,

      status:
        'warning',

      message:
        'De resolutie van dit bestand kon niet automatisch worden gecontroleerd.',
    }));
}

function getUploadPrintSpec(
  activePers,
  product
) {
  if (
    window.PrintSpecs
      ?.normalizePrintSpec
  ) {
    const spec =
      PrintSpecs.normalizePrintSpec(
        activePers || {},
        product || {}
      );

    return {
      exportWidthMm:
        spec.exportWidthMm,

      exportHeightMm:
        spec.exportHeightMm,

      requiredWidthPx:
        spec.requiredImageWidthPx300 ||
        spec.exportWidthPx,

      requiredHeightPx:
        spec.requiredImageHeightPx300 ||
        spec.exportHeightPx,
    };
  }

  const widthMm =
    Number(
      activePers?.width_mm ||
      product?.width_mm ||
      100
    );

  const heightMm =
    Number(
      activePers?.height_mm ||
      product?.height_mm ||
      70
    );

  return {
    exportWidthMm:
      widthMm,

    exportHeightMm:
      heightMm,

    requiredWidthPx:
      Math.round(
        widthMm /
        25.4 *
        300
      ),

    requiredHeightPx:
      Math.round(
        heightMm /
        25.4 *
        300
      ),
  };
}

function getUploadedImageDimensions(file) {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image();

      const url =
        URL.createObjectURL(
          file
        );

      image.onload = () => {
        URL.revokeObjectURL(
          url
        );

        resolve({
          widthPx:
            image.naturalWidth,

          heightPx:
            image.naturalHeight,
        });
      };

      image.onerror = () => {
        URL.revokeObjectURL(
          url
        );

        reject(
          new Error(
            'Afbeelding kon niet worden gelezen.'
          )
        );
      };

      image.src =
        url;
    }
  );
}

function getUploadPrepressWarnings(uploadCheck) {
  if (!uploadCheck) {
    return [];
  }

  if (
    uploadCheck.status ===
    'manual-check'
  ) {
    return [{
      type:
        'upload-vector-check',

      level:
        'info',

      message:
        'Dit bestand moet technisch worden gecontroleerd in Adobe.',
    }];
  }

  if (
    uploadCheck.status ===
    'warning'
  ) {
    return [{
      type:
        'upload-resolution-warning',

      level:
        'warning',

      message:
        uploadCheck.message ||
        'De upload heeft mogelijk een te lage resolutie.',
    }];
  }

  if (
    uploadCheck.status ===
    'error'
  ) {
    return [{
      type:
        'upload-resolution-error',

      level:
        'warning',

      message:
        uploadCheck.message ||
        'De upload heeft waarschijnlijk een te lage resolutie.',
    }];
  }

  return [];
}

function getUploadCheckBackground(status) {
  if (status === 'good') {
    return '#EDF2ED';
  }

  if (status === 'error') {
    return '#FCE8E3';
  }

  return '#FFF3D8';
}

function getUploadCheckTextColor(status) {
  if (status === 'good') {
    return '#3E5A3E';
  }

  if (status === 'error') {
    return '#C0392B';
  }

  return '#8A681E';
}

function getFileExtension(fileName) {
  return String(
    fileName ||
    ''
  )
    .split('.')
    .pop()
    .toLowerCase();
}

function getFileTypeFromName(fileName) {
  const extension =
    getFileExtension(
      fileName
    );

  const map = {
    pdf:
      'application/pdf',

    ai:
      'application/postscript',

    eps:
      'application/postscript',

    png:
      'image/png',

    jpg:
      'image/jpeg',

    jpeg:
      'image/jpeg',
  };

  return map[extension] || '';
}

async function clearUpload() {
  uploadedDataURL = null;
  uploadedFileName = null;
  uploadedCheck = null;
  uploadedPdfDataURL = null;
  uploadedRillinesPdfDataURL = null;

  if (
    typeof Session.clearDesign ===
    'function'
  ) {
    await Session.clearDesign();
  } else {
    await Promise.resolve(
      Session.setDesign(
        null
      )
    );
  }

  if (
    window._currentDesignStateKey
  ) {
    clearDesignState(
      window._currentDesignStateKey
    );
  }

  renderDesignPage();
}

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.clearUpload =
  clearUpload;