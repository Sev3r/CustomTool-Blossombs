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
let activeDesignTab = 'tool';
let fabricInitToken = 0;
let fabricInitTimer = null;
let canvasZoom = 1;
const CANVAS_ZOOM_MIN = 0.5;
const CANVAS_ZOOM_MAX = 3;
const CANVAS_ZOOM_STEP = 0.1;

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
  const el = document.getElementById('page-design');
  const product = Session.getProduct();
  const options = Session.getOptions();
  const saved = Session.getDesign() || {};

  if (!product) {
    navigateTo('select');
    return;
  }

  if (!options) {
    navigateTo('options');
    return;
  }

  const persTypes = Array.isArray(product.personalisatieTypes)
    ? product.personalisatieTypes.filter(persType => persType.active !== false)
    : [];

  const activePers = persTypes.find(persType => persType.id === options?.persTypeId) ||
    options?.persType ||
    persTypes[0] ||
    null;
  const stateKey = `${DESIGN_STATE_KEY}_${product.id}_${activePers?.id || 'standaard'}`;
  const savedState = loadDesignState(stateKey);

  uploadedDataURL = saved.dataURL || savedState?.dataURL || null;
  uploadedFileName = saved.fileName || savedState?.fileName || null;
  activeDesignTab = saved.tab || savedState?.tab || 'tool';

  el.innerHTML = `
    <h1 class="page-title">Ontwerp uw verpakking</h1>
    <p class="page-subtitle">Gebruik de ontwerptool of upload een eigen bestand</p>

    <div class="design-tabs" style="margin-bottom:24px">
      <button class="design-tab ${activeDesignTab === 'tool' ? 'active' : ''}" type="button" data-tab="tool">Ontwerptool</button>
      <button class="design-tab ${activeDesignTab === 'upload' ? 'active' : ''}" type="button" data-tab="upload">Bestand uploaden</button>
    </div>

    <div id="tab-tool" style="${activeDesignTab === 'tool' ? '' : 'display:none'}">
      <div id="app">
        <aside id="sidebar">
          <div id="sidebar-header"></div>

          <div class="side-section">
            <div class="side-label">Toevoegen</div>

            <button class="tool-btn" type="button" id="btn-logo">+ Logo uploaden</button>
            <input type="file" id="file-input" accept="image/*" style="display:none">

            <button class="tool-btn" type="button" id="btn-text">+ Tekst toevoegen</button>
          </div>

          <div class="side-section">
            <div class="side-label">Lettertype</div>
            <select id="font-select" class="font-select">
              ${AVAILABLE_FONTS.map(font => `
                <option value="${font.value}" style="font-family:${font.value}">${font.label}</option>
              `).join('')}
            </select>
          </div>

          <div class="side-section">
            <div class="side-label">Lettergrootte</div>
            <select id="font-size" class="font-select">
              ${[8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 84, 96].map(size => `
                <option value="${size}" ${size === 20 ? 'selected' : ''}>${size} px</option>
              `).join('')}
            </select>
          </div>

          <div class="side-section">
            <div class="side-label">Elementkleur</div>
            <div class="color-row" id="color-swatches"></div>

            <div class="custom-color-row">
              <label for="custom-element-color">Eigen kleur</label>
              <input type="color"
                     id="custom-element-color"
                     class="custom-color-input"
                     value="${fabricActiveColor}">
            </div>
          </div>

          ${activePers?.allowBackgroundColor ? `
            <div class="side-section">
              <div class="side-label">Achtergrondkleur</div>
              <div class="color-row" id="background-color-swatches"></div>

              <div class="custom-color-row">
                <label for="custom-background-color">Eigen kleur</label>
                <input type="color"
                       id="custom-background-color"
                       class="custom-color-input"
                       value="${fabricBackgroundColor}">
              </div>
            </div>
          ` : ''}
        </aside>

        <section id="canvas-area">
          <div id="canvas-toolbar">
            <button class="tb-btn" type="button" id="btn-delete">Verwijder</button>
            <button class="tb-btn" type="button" id="btn-front">Voorgrond</button>
            <button class="tb-btn" type="button" id="btn-back">Achtergrond</button>
            <div class="tb-sep"></div>
            <button class="tb-btn" type="button" id="btn-undo">Ongedaan</button>
            <button class="tb-btn" type="button" id="btn-clear">Reset</button>
          </div>

          <div id="canvas-wrap">
            <div id="margin-warning">Object buiten marge</div>
            <canvas id="c"></canvas>

            <div class="canvas-zoom-controls" aria-label="Canvas zoom controls">
              <button class="canvas-zoom-btn" type="button" id="btn-canvas-zoom-out" aria-label="Uitzoomen">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <circle cx="7.5" cy="7.5" r="5.25" stroke="currentColor" stroke-width="1.8"/>
                  <path d="M11.5 11.5L15 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  <path d="M5.25 7.5H9.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </button>

              <button class="canvas-zoom-btn" type="button" id="btn-canvas-zoom-in" aria-label="Inzoomen">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <circle cx="7.5" cy="7.5" r="5.25" stroke="currentColor" stroke-width="1.8"/>
                  <path d="M11.5 11.5L15 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  <path d="M5.25 7.5H9.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  <path d="M7.5 5.25V9.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div id="status">Selecteer een element om te bewerken. Klik en sleep om te verplaatsen.</div>
        </section>

        <aside id="layer-panel">
          <div id="layer-header">Layers</div>
          <div id="layer-list"></div>
        </aside>
      </div>
    </div>

    <div id="tab-upload" style="${activeDesignTab === 'upload' ? '' : 'display:none'}">
      <div class="design-layout">
        <div>
          <div class="upload-zone" id="upload-zone">
            <input type="file" id="upload-input" accept=".png,.jpg,.jpeg,.pdf,.ai,.eps">
            <div class="upload-icon">📁</div>
            <div class="upload-title">Sleep uw bestand hierheen</div>
            <div class="upload-sub">of klik om te bladeren</div>
            <div class="upload-sub" style="margin-top:8px">PNG, JPG, PDF, AI, EPS. Minimaal 300 DPI aanbevolen.</div>
          </div>

          ${uploadedDataURL ? `
            <div style="margin-top:12px;padding:10px 14px;background:var(--green-light);border-radius:8px;
                        font-size:13px;color:var(--green-dark);display:flex;justify-content:space-between;align-items:center">
              <span>${escHtml(uploadedFileName || 'Bestand geüpload')}</span>
              <button onclick="clearUpload()" type="button" style="background:none;border:none;cursor:pointer;color:#C0392B;font-size:18px">×</button>
            </div>
          ` : ''}
        </div>

        <div>
          <div class="preview-box" id="preview-box">
            ${uploadedDataURL && uploadedDataURL.startsWith('data:image')
      ? `<img src="${uploadedDataURL}" alt="Preview">`
      : `<div class="preview-placeholder">${uploadedDataURL ? escHtml(uploadedFileName || 'Bestand') : 'Preview'}</div>`}
            <div class="preview-zoom" id="btn-zoom" ${!uploadedDataURL ? 'style="display:none"' : ''}>🔍</div>
          </div>
          <p style="font-size:12px;color:var(--text-3);margin-top:8px;text-align:center">Preview van uw bestand</p>
        </div>
      </div>
    </div>

    <div id="design-error" style="color:#C0392B;font-size:13px;display:none;margin-top:16px">
      Maak een ontwerp of upload een bestand om verder te gaan.
    </div>

    <div class="flow-nav">
      <button class="btn btn-outline" type="button" onclick="navigateTo('options')">← Terug</button>
      <button class="btn btn-green" type="button" id="btn-design-next">Verder →</button>
    </div>
  `;

  bindDesignTabs(product, activePers, savedState, stateKey);
  bindUploadZone(stateKey);
  bindDesignNextButton(product, activePers, stateKey);

  document.getElementById('btn-zoom')?.addEventListener('click', () => {
    if (uploadedDataURL) {
      window.open(uploadedDataURL, '_blank');
    }
  });

  if (activeDesignTab === 'tool') {
    scheduleFabricInit(product, activePers, savedState, stateKey);
  }
}

function bindDesignTabs(product, activePers, savedState, stateKey) {
  document.querySelectorAll('.design-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeDesignTab = tab.dataset.tab;

      document.querySelectorAll('.design-tab').forEach(item => item.classList.remove('active'));
      tab.classList.add('active');

      const toolTab = document.getElementById('tab-tool');
      const uploadTab = document.getElementById('tab-upload');

      if (toolTab) {
        toolTab.style.display = activeDesignTab === 'tool' ? '' : 'none';
      }

      if (uploadTab) {
        uploadTab.style.display = activeDesignTab === 'upload' ? '' : 'none';
      }

      persistDesignState(stateKey, { tab: activeDesignTab });

      if (activeDesignTab === 'tool') {
        scheduleFabricInit(product, activePers, savedState, stateKey);
      }
    });
  });
}

function bindUploadZone(stateKey) {
  const zone = document.getElementById('upload-zone');
  const input = document.getElementById('upload-input');

  if (!zone || !input) {
    return;
  }

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', event => {
    event.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', event => {
    event.preventDefault();
    zone.classList.remove('dragover');

    const file = event.dataTransfer.files?.[0];

    if (file) {
      handleUpload(file, stateKey);
    }
  });

  input.addEventListener('change', event => {
    const file = event.target.files?.[0];

    if (file) {
      handleUpload(file, stateKey);
    }
  });
}

function bindDesignNextButton(product, activePers, stateKey) {
  document.getElementById('btn-design-next')?.addEventListener('click', () => {
    const error = document.getElementById('design-error');

    if (activeDesignTab === 'upload') {
      if (!uploadedDataURL) {
        if (error) {
          error.style.display = 'block';
        }

        return;
      }

      const designData = {
        dataURL: uploadedDataURL,
        pdfDataURL: uploadedDataURL.startsWith('data:application/pdf') ? uploadedDataURL : '',
        fileName: uploadedFileName,
        tab: 'upload',
        source: 'upload',
      };

      Session.setDesign(designData);
      persistDesignState(stateKey, designData);
    } else {
      if (!fabricCanvas) {
        if (error) {
          error.textContent = 'De ontwerptool is nog niet geladen. Probeer het opnieuw.';
          error.style.display = 'block';
        }

        return;
      }

      const snapshot = snapshotCanvas(fabricCanvas, product, activePers);

      Session.setDesign({
        dataURL: snapshot.dataURL,
        pdfDataURL: snapshot.pdfDataURL,
        tab: 'tool',
        source: 'fabric',
        fabricJSON: snapshot.json,
        backgroundColor: snapshot.backgroundColor,
      });

      persistDesignState(stateKey, {
        dataURL: snapshot.dataURL,
        pdfDataURL: snapshot.pdfDataURL,
        fabricJSON: snapshot.json,
        backgroundColor: snapshot.backgroundColor,
        tab: 'tool',
      });
    }

    if (error) {
      error.style.display = 'none';
    }

    navigateTo('review');
  });
}

function bindFontSelector(canvas, stateKey) {
  const select = document.getElementById('font-select');
  const preview = document.getElementById('font-preview');

  if (!select) {
    return;
  }

  select.addEventListener('change', () => {
    const fontValue = select.value;

    if (preview) {
      preview.style.fontFamily = fontValue;
    }

    const object = canvas.getActiveObject();

    if (object && object.type === 'i-text') {
      object.set('fontFamily', fontValue);
      canvas.renderAll();
      fabricSaveHistory();
      autoSaveCanvasState(stateKey);
    }
  });

  canvas.on('selection:created', syncFontControls);
  canvas.on('selection:updated', syncFontControls);

  function syncFontControls() {
    const object = canvas.getActiveObject();

    if (object && object.type === 'i-text') {
      const currentFont = object.fontFamily || 'Georgia';
      const match = AVAILABLE_FONTS.find(font => font.value === currentFont);

      if (match) {
        select.value = match.value;
      }

      if (preview) {
        preview.style.fontFamily = currentFont;
      }

      syncFontSizeControls(object);
    }
  }
}

function bindFontSizeControl(canvas, stateKey) {
  const select = document.getElementById('font-size');

  if (!select) {
    return;
  }

  select.addEventListener('change', event => {
    const value = parseInt(event.target.value, 10);
    const object = canvas.getActiveObject();

    if (object && object.type === 'i-text' && !isGuideObject(object)) {
      object.set('fontSize', value);
      canvas.renderAll();
      fabricSaveHistory();
      updateLayerPanel();
      autoSaveCanvasState(stateKey);
    }
  });

  canvas.on('selection:created', event => syncFontSizeControls(event.selected?.[0]));
  canvas.on('selection:updated', event => syncFontSizeControls(event.selected?.[0]));
}

function syncFontSizeControls(object) {
  const select = document.getElementById('font-size');

  if (!select || !object || object.type !== 'i-text') {
    return;
  }

  const fontSize = Math.round(object.fontSize || 20);
  const availableSizes = [...select.options].map(option => Number(option.value));
  const closestSize = availableSizes.reduce((closest, size) => {
    return Math.abs(size - fontSize) < Math.abs(closest - fontSize) ? size : closest;
  }, availableSizes[0]);

  select.value = String(closestSize);
}

function getResponsiveCanvasSize(activePers, product) {
  const printWidthPx = activePers?.width_px || product.width_px || 1181;
  const printHeightPx = activePers?.height_px || product.height_px || 827;
  const canvasWrap = document.getElementById('canvas-wrap');

  const fallbackWidth = Math.max(280, window.innerWidth - 560);
  const fallbackHeight = Math.max(240, window.innerHeight - 360);

  const availableWidth = canvasWrap
    ? Math.max(280, canvasWrap.clientWidth - 32)
    : fallbackWidth;

  const availableHeight = canvasWrap
    ? Math.max(240, canvasWrap.clientHeight - 32)
    : fallbackHeight;

  const scale = Math.min(
    1,
    availableWidth / printWidthPx,
    availableHeight / printHeightPx
  );

  return {
    width: Math.max(1, Math.floor(printWidthPx * scale)),
    height: Math.max(1, Math.floor(printHeightPx * scale)),
    scale,
    printWidthPx,
    printHeightPx,
  };
}

function applyCanvasZoom() {
  const container = document.querySelector('#canvas-wrap .canvas-container');

  if (!container) {
    return;
  }

  container.style.transform = `scale(${canvasZoom})`;
  container.style.transformOrigin = 'center center';
}

function setCanvasZoom(nextZoom) {
  canvasZoom = Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, nextZoom));
  applyCanvasZoom();
}

function bindCanvasZoomControls() {
  document.getElementById('btn-canvas-zoom-in')?.addEventListener('click', () => {
    setCanvasZoom(canvasZoom + CANVAS_ZOOM_STEP);
  });

  document.getElementById('btn-canvas-zoom-out')?.addEventListener('click', () => {
    setCanvasZoom(canvasZoom - CANVAS_ZOOM_STEP);
  });
}

function scheduleFabricInit(product, activePers, savedState, stateKey) {
  fabricInitToken += 1;
  const token = fabricInitToken;

  if (fabricInitTimer) {
    clearTimeout(fabricInitTimer);
  }

  fabricInitTimer = setTimeout(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (token !== fabricInitToken) {
          return;
        }

        const canvasWrap = document.getElementById('canvas-wrap');
        const canvasElement = document.getElementById('c');

        if (!canvasWrap || !canvasElement) {
          return;
        }

        if (canvasWrap.clientWidth <= 0 || canvasWrap.clientHeight <= 0) {
          scheduleFabricInit(product, activePers, savedState, stateKey);
          return;
        }

        initFabricTool(product, activePers, savedState, stateKey, token);
      });
    });
  }, 60);
}

function destroyFabricCanvas() {
  if (fabricCanvas) {
    try {
      fabricCanvas.off();
      fabricCanvas.dispose();
    } catch (error) {
      console.warn('Fabric canvas opruimen mislukt', error);
    }

    fabricCanvas = null;
  }

  const canvasWrap = document.getElementById('canvas-wrap');

  if (!canvasWrap) {
    return;
  }

  canvasWrap.querySelectorAll('.canvas-container').forEach(container => {
    const nestedCanvas = container.querySelector('canvas#c');

    if (nestedCanvas) {
      canvasWrap.appendChild(nestedCanvas);
    }

    container.remove();
  });

  const canvas = document.getElementById('c');

  if (canvas) {
    canvas.removeAttribute('style');
    canvas.removeAttribute('width');
    canvas.removeAttribute('height');
    canvas.className = '';
  }
}

function initFabricTool(product, activePers, savedState, stateKey, token = fabricInitToken) {
  if (!window.fabric) {
    console.warn('Fabric.js niet geladen.');
    return;
  }

  const canvasElement = document.getElementById('c');
  const canvasWrap = document.getElementById('canvas-wrap');

  if (!canvasElement || !canvasWrap) {
    return;
  }

  destroyFabricCanvas();

  if (token !== fabricInitToken) {
    return;
  }

  fabricHistory = [];
  canvasZoom = 1;
  fabricActiveColor = '#1D9E75';
  fabricBackgroundColor = savedState?.backgroundColor || activePers?.backgroundColor || '#b7bdb8';

  const display = getResponsiveCanvasSize(activePers, product);
  const canvasWidth = display.width;
  const canvasHeight = display.height;
  const marginPx = activePers?.margin_px || product.margin_px || 20;
  const margin = marginPx * display.scale;
  const clipShape = activePers?.clipShape || null;

  fabricCanvas = new fabric.Canvas('c', {
    width: canvasWidth,
    height: canvasHeight,
    selection: true,
    backgroundColor: fabricBackgroundColor,
    preserveObjectStacking: true,
  });

  window._currentDesignStateKey = stateKey;

  bindFabricDocumentHandlers();
  applyCanvasClipPath(clipShape, canvasWidth, canvasHeight);
  renderColorSwatches();
  renderBackgroundColorSwatches(activePers, stateKey);

  loadBackgroundImage(fabricCanvas, activePers, product, canvasWidth, canvasHeight);

  restoreCanvasStateOrDefault(
    fabricCanvas,
    savedState,
    canvasHeight,
    margin,
    canvasWidth,
    canvasHeight,
    activePers,
    product
  );

  bindFabricEvents(fabricCanvas, margin, canvasWidth, canvasHeight, stateKey, activePers, product);
  bindFabricButtons(fabricCanvas, margin, canvasWidth, canvasHeight, stateKey, activePers, product);

  fabricSaveHistory();
  updateLayerPanel();

  bindCanvasZoomControls();
  applyCanvasZoom();

  setTimeout(() => {
    if (fabricCanvas && token === fabricInitToken) {
      redrawGuides(fabricCanvas, activePers, product, margin, canvasWidth, canvasHeight);
      applyCanvasZoom();
    }
  }, 120);
}

function bindFabricDocumentHandlers() {
  if (window._fabricMouseUpHandler) {
    document.removeEventListener('mouseup', window._fabricMouseUpHandler);
  }

  window._fabricMouseUpHandler = () => {
    if (!fabricCanvas) {
      return;
    }

    const transform = fabricCanvas._currentTransform;

    if (transform) {
      fabricCanvas._currentTransform = null;
      fabricCanvas.setCursor(fabricCanvas.defaultCursor);
      fabricCanvas.renderAll();
    }
  };

  document.addEventListener('mouseup', window._fabricMouseUpHandler);

  if (window._fabricKeyHandler) {
    document.removeEventListener('keydown', window._fabricKeyHandler);
  }

  window._fabricKeyHandler = event => {
    if (event.key !== 'Backspace' && event.key !== 'Delete') {
      return;
    }

    const object = fabricCanvas?.getActiveObject();

    if (object && !isGuideObject(object) && !(object.type === 'i-text' && object.isEditing)) {
      fabricCanvas.remove(object);
      fabricSaveHistory();
      updateLayerPanel();
      autoSaveCanvasState(window._currentDesignStateKey);
    }
  };

  document.addEventListener('keydown', window._fabricKeyHandler);
}

function applyCanvasClipPath(clipShape, canvasWidth, canvasHeight) {
  const canvasEl = document.querySelector('#canvas-wrap canvas');

  if (!canvasEl) {
    return;
  }

  canvasEl.style.clipPath = '';
  canvasEl.style.borderRadius = '';

  if (!clipShape) {
    return;
  }

  canvasEl.style.clipPath = clipShape;
  canvasEl.style.borderRadius = clipShape.startsWith('circle') ? '50%' : '4px';

  if (clipShape.startsWith('circle')) {
    const radius = Math.min(canvasWidth, canvasHeight) / 2;

    fabricCanvas.clipPath = new fabric.Circle({
      radius,
      left: canvasWidth / 2 - radius,
      top: canvasHeight / 2 - radius,
      absolutePositioned: true,
    });
  }
}

function renderColorSwatches() {
  const colors = ['#1D9E75', '#ffffff', '#2c2c2a', '#e63946', '#f4a261', '#457b9d', '#f1c453', '#9d4edd'];
  const swatchContainer = document.getElementById('color-swatches');

  if (!swatchContainer) {
    return;
  }

  swatchContainer.innerHTML = '';

  colors.forEach((color, index) => {
    const swatch = document.createElement('div');
    swatch.className = `color-swatch${index === 0 ? ' active' : ''}`;
    swatch.style.background = color;

    swatch.addEventListener('click', () => {
      swatchContainer.querySelectorAll('.color-swatch').forEach(item => item.classList.remove('active'));
      swatch.classList.add('active');
      fabricActiveColor = color;
      applyToSelected('fill', color);
    });

    swatchContainer.appendChild(swatch);
  });

  const customColorInput = document.getElementById('custom-element-color');

  if (customColorInput) {
    customColorInput.value = fabricActiveColor;

    customColorInput.addEventListener('input', event => {
      const color = event.target.value;
      fabricActiveColor = color;

      swatchContainer.querySelectorAll('.color-swatch').forEach(item => {
        item.classList.remove('active');
      });

      applyToSelected('fill', color);
    });
  }
}

function renderBackgroundColorSwatches(activePers, stateKey) {
  if (!activePers?.allowBackgroundColor) {
    return;
  }

  const swatchContainer = document.getElementById('background-color-swatches');

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
    const swatch = document.createElement('div');
    swatch.className = `color-swatch${color.toLowerCase() === fabricBackgroundColor.toLowerCase() ? ' active' : ''}`;
    swatch.style.background = color;

    swatch.addEventListener('click', () => {
      setCanvasBackgroundColor(color, stateKey);

      swatchContainer.querySelectorAll('.color-swatch').forEach(item => {
        item.classList.remove('active');
      });

      swatch.classList.add('active');

      const customBackgroundInput = document.getElementById('custom-background-color');

      if (customBackgroundInput) {
        customBackgroundInput.value = color;
      }
    });

    swatchContainer.appendChild(swatch);
  });

  const customBackgroundInput = document.getElementById('custom-background-color');

  if (customBackgroundInput) {
    customBackgroundInput.value = fabricBackgroundColor;

    customBackgroundInput.addEventListener('input', event => {
      setCanvasBackgroundColor(event.target.value, stateKey);

      swatchContainer.querySelectorAll('.color-swatch').forEach(item => {
        item.classList.remove('active');
      });
    });
  }
}

function setCanvasBackgroundColor(color, stateKey) {
  fabricBackgroundColor = color;

  if (!fabricCanvas) {
    return;
  }

  if (typeof fabricCanvas.setBackgroundColor === 'function') {
    fabricCanvas.setBackgroundColor(color, fabricCanvas.renderAll.bind(fabricCanvas));
  } else {
    fabricCanvas.backgroundColor = color;
    fabricCanvas.renderAll();
  }

  redrawGuidesFromCurrentState();
  autoSaveCanvasState(stateKey);

  persistDesignState(stateKey, {
    backgroundColor: color,
  });
}

function drawMarginRect(canvas, margin, canvasWidth, canvasHeight, isWarning = false) {
  canvas.getObjects()
    .filter(object => object._isMargin && !object._isBlockedZone)
    .forEach(object => canvas.remove(object));

  const marginColor = isWarning
    ? '#C0392B'
    : getContrastingGuideColor(fabricBackgroundColor);

  const marginRect = new fabric.Rect({
    left: margin,
    top: margin,
    width: Math.max(1, canvasWidth - margin * 2),
    height: Math.max(1, canvasHeight - margin * 2),
    fill: 'transparent',
    stroke: marginColor,
    strokeWidth: isWarning ? 2.5 : 1.75,
    strokeDashArray: [6, 4],
    selectable: false,
    evented: false,
    excludeFromExport: true,
    _isMargin: true,
    _isGuide: true,
    _guideMeta: {
      margin,
      canvasWidth,
      canvasHeight,
    },
  });

  canvas.add(marginRect);
}

function drawBlockedZones(canvas, activePers, product, canvasWidth, canvasHeight) {
  const zones = Array.isArray(activePers?.blockedZones) ? activePers.blockedZones : [];

  canvas.getObjects()
    .filter(object => object._isBlockedZone)
    .forEach(object => canvas.remove(object));

  if (!zones.length) {
    canvas.renderAll();
    return;
  }

  zones.forEach(zone => {
    if (zone.type === 'circle') {
      const circleData = getBlockedCircleCanvasData(zone, activePers, product, canvasWidth, canvasHeight);

      if (!circleData) {
        return;
      }

      const safeCircle = new fabric.Circle({
        left: circleData.cx - circleData.safeRadius,
        top: circleData.cy - circleData.safeRadius,
        radius: circleData.safeRadius,
        fill: 'rgba(232, 134, 10, 0.14)',
        stroke: '#E8860A',
        strokeWidth: 2,
        strokeDashArray: [8, 5],
        selectable: false,
        evented: false,
        objectCaching: false,
        excludeFromExport: true,
        _isMargin: true,
        _isGuide: true,
        _isBlockedZone: true,
      });

      const holeCircle = new fabric.Circle({
        left: circleData.cx - circleData.holeRadius,
        top: circleData.cy - circleData.holeRadius,
        radius: circleData.holeRadius,
        fill: 'rgba(192, 57, 43, 0.24)',
        stroke: '#C0392B',
        strokeWidth: 2,
        strokeDashArray: [4, 3],
        selectable: false,
        evented: false,
        objectCaching: false,
        excludeFromExport: true,
        _isMargin: true,
        _isGuide: true,
        _isBlockedZone: true,
      });

      canvas.add(safeCircle);
      canvas.add(holeCircle);
      return;
    }

    if (zone.type === 'line') {
      const lineData = getBlockedLineCanvasData(zone, activePers, product, canvasWidth, canvasHeight);

      if (!lineData) {
        return;
      }

      const safeLine = new fabric.Line(
        [lineData.x1, lineData.y1, lineData.x2, lineData.y2],
        {
          stroke: '#E8860A',
          strokeWidth: lineData.safeWidth,
          strokeDashArray: [8, 5],
          selectable: false,
          evented: false,
          objectCaching: false,
          excludeFromExport: true,
          opacity: 0.35,
          _isMargin: true,
          _isGuide: true,
          _isBlockedZone: true,
        }
      );

      const foldLine = new fabric.Line(
        [lineData.x1, lineData.y1, lineData.x2, lineData.y2],
        {
          stroke: '#C0392B',
          strokeWidth: Math.max(1.5, lineData.lineWidth),
          strokeDashArray: [4, 3],
          selectable: false,
          evented: false,
          objectCaching: false,
          excludeFromExport: true,
          _isMargin: true,
          _isGuide: true,
          _isBlockedZone: true,
        }
      );

      canvas.add(safeLine);
      canvas.add(foldLine);
    }
  });

  bringGuidesToFront(canvas);
  canvas.renderAll();
}

function redrawGuides(canvas, activePers, product, margin, canvasWidth, canvasHeight, isWarning = false) {
  if (!canvas) {
    return;
  }

  removeGuideObjects(canvas);
  drawMarginRect(canvas, margin, canvasWidth, canvasHeight, isWarning);
  drawBlockedZones(canvas, activePers, product, canvasWidth, canvasHeight);
  bringGuidesToFront(canvas);
  canvas.renderAll();

  window._currentDesignGuideState = {
    activePers,
    product,
    margin,
    canvasWidth,
    canvasHeight,
  };
}

function redrawGuidesFromCurrentState(isWarning = false) {
  const state = window._currentDesignGuideState;

  if (!fabricCanvas || !state) {
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
  canvas.getObjects()
    .filter(object => isGuideObject(object))
    .forEach(object => {
      object.selectable = false;
      object.evented = false;
      object.hoverCursor = 'default';
      canvas.bringToFront(object);
    });
}

function removeGuideObjects(canvas) {
  canvas.getObjects()
    .filter(object => isGuideObject(object))
    .forEach(object => canvas.remove(object));
}

function isGuideObject(object) {
  return Boolean(object?._isGuide || object?._isBlockedZone || object?._isMargin);
}

function getContrastingGuideColor(backgroundColor) {
  const hex = normalizeHexColor(backgroundColor);

  if (!hex) {
    return '#2A2A22';
  }

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  return brightness > 170 ? '#2A2A22' : '#FFFFFF';
}

function normalizeHexColor(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
    return value;
  }

  if (/^#[0-9A-Fa-f]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }

  return '';
}

function getBlockedCircleCanvasData(zone, activePers, product, canvasWidth, canvasHeight) {
  const widthMm = Number(activePers?.width_mm || product?.width_mm || 0);
  const heightMm = Number(activePers?.height_mm || product?.height_mm || 0);

  if (!widthMm || !heightMm) {
    return null;
  }

  const xMm = Number(zone.x_mm || 0);
  const yMm = Number(zone.y_mm || 0);
  const diameterMm = Number(zone.diameter_mm || 0);
  const marginMm = Number(zone.margin_mm || 0);

  if (!diameterMm) {
    return null;
  }

  const pxPerMmX = canvasWidth / widthMm;
  const pxPerMmY = canvasHeight / heightMm;
  const averagePxPerMm = (pxPerMmX + pxPerMmY) / 2;

  const holeRadius = (diameterMm / 2) * averagePxPerMm;
  const safeRadius = holeRadius + marginMm * averagePxPerMm;

  return {
    cx: xMm * pxPerMmX,
    cy: yMm * pxPerMmY,
    holeRadius,
    safeRadius,
  };
}

function getBlockedLineCanvasData(zone, activePers, product, canvasWidth, canvasHeight) {
  const widthMm = Number(activePers?.width_mm || product?.width_mm || 0);
  const heightMm = Number(activePers?.height_mm || product?.height_mm || 0);

  if (!widthMm || !heightMm) {
    return null;
  }

  const x1Mm = Number(zone.x1_mm || 0);
  const y1Mm = Number(zone.y1_mm || 0);
  const x2Mm = Number(zone.x2_mm || 0);
  const y2Mm = Number(zone.y2_mm || 0);
  const lineWidthMm = Number(zone.line_width_mm || 0.3);
  const marginMm = Number(zone.margin_mm || 0);

  if (x1Mm === x2Mm && y1Mm === y2Mm) {
    return null;
  }

  const pxPerMmX = canvasWidth / widthMm;
  const pxPerMmY = canvasHeight / heightMm;
  const averagePxPerMm = (pxPerMmX + pxPerMmY) / 2;

  return {
    x1: x1Mm * pxPerMmX,
    y1: y1Mm * pxPerMmY,
    x2: x2Mm * pxPerMmX,
    y2: y2Mm * pxPerMmY,
    lineWidth: Math.max(1, lineWidthMm * averagePxPerMm),
    safeWidth: Math.max(3, (lineWidthMm + marginMm * 2) * averagePxPerMm),
    safeRadius: Math.max(1.5, ((lineWidthMm / 2) + marginMm) * averagePxPerMm),
  };
}

function loadBackgroundImage(canvas, activePers, product, canvasWidth, canvasHeight) {
  if (activePers?.allowBackgroundColor) {
    return;
  }

  const bgImg = getPersonalisationImageSrc(activePers, product);

  if (!bgImg) {
    return;
  }

  fabric.Image.fromURL(bgImg, image => {
    const scale = Math.min(
      canvasWidth / image.width,
      canvasHeight / image.height
    );

    image.set({
      originX: 'center',
      originY: 'center',
      left: canvasWidth / 2,
      top: canvasHeight / 2,
      scaleX: scale,
      scaleY: scale,
    });

    canvas.setBackgroundImage(image, () => {
      canvas.renderAll();
    });
  }, {
    crossOrigin: 'anonymous',
  });
}

function restoreCanvasStateOrDefault(canvas, savedState, canvasHeight, margin, canvasWidth, canvasHeightValue, activePers, product) {
  const redrawAfterRestore = () => {
    redrawGuides(canvas, activePers, product, margin, canvasWidth, canvasHeightValue);
    updateLayerPanel();
  };

  if (savedState?.fabricJSON) {
    try {
      canvas.loadFromJSON(savedState.fabricJSON, () => {
        removeGuideObjects(canvas);
        redrawAfterRestore();
      });
      return;
    } catch (error) {
      console.warn('Canvas state herstellen mislukt', error);
    }
  }

  addDefaultText(canvas, canvasHeight);
  redrawAfterRestore();
}

function addDefaultText(canvas, canvasHeight) {
  const selectedFont = document.getElementById('font-select')?.value || 'Georgia';

  const demo = new fabric.IText('Jouw bedrijfsnaam', {
    left: 60,
    top: Math.round(canvasHeight * 0.65),
    fontSize: 18,
    fill: '#ffffff',
    fontFamily: selectedFont,
    editable: true,
    opacity: 0.9,
  });

  canvas.add(demo);
  canvas.renderAll();
  fabricSaveHistory();
  updateLayerPanel();
}

function bindFabricEvents(canvas, margin, canvasWidth, canvasHeight, stateKey, activePers, product) {
  const checkMargin = object => {
    if (!object || isGuideObject(object)) {
      return;
    }

    const warning = document.getElementById('margin-warning');

    if (!warning) {
      return;
    }

    const outsideOuterMargin = isOutsideMargin(object, margin, canvasWidth, canvasHeight);
    const overlapsBlockedZone = isObjectOverlappingBlockedZones(object, activePers, product, canvasWidth, canvasHeight);
    const hasWarning = outsideOuterMargin || overlapsBlockedZone;

    warning.textContent = overlapsBlockedZone
      ? 'Object valt over uitsparing'
      : 'Object buiten marge';

    warning.style.display = hasWarning ? 'flex' : 'none';
    redrawGuides(canvas, activePers, product, margin, canvasWidth, canvasHeight, hasWarning);
  };

  canvas.on('object:moving', event => {
    checkMargin(event.target);
    bringGuidesToFront(canvas);
  });

  canvas.on('object:rotating', event => {
    checkMargin(event.target);
    bringGuidesToFront(canvas);
  });

  canvas.on('object:scaling', event => {
    checkMargin(event.target);
    bringGuidesToFront(canvas);
  });

  canvas.on('object:modified', event => {
    checkMargin(event.target);
    bringGuidesToFront(canvas);
  });

  canvas.on('text:changed', event => {
    checkMargin(event.target);
    fabricSaveHistory();
    updateLayerPanel();
    autoSaveCanvasState(stateKey);
  });

  canvas.on('object:moved', () => {
    const warning = document.getElementById('margin-warning');

    if (warning) {
      warning.style.display = 'none';
    }

    redrawGuides(canvas, activePers, product, margin, canvasWidth, canvasHeight);
    fabricSaveHistory();
    autoSaveCanvasState(stateKey);
  });

  canvas.on('object:modified', () => {
    redrawGuides(canvas, activePers, product, margin, canvasWidth, canvasHeight);
    fabricSaveHistory();
    autoSaveCanvasState(stateKey);
  });

  canvas.on('selection:created', () => {
    updateFabricStatus();
    updateLayerPanel();
  });

  canvas.on('selection:updated', () => {
    updateFabricStatus();
    updateLayerPanel();
  });

  canvas.on('selection:cleared', () => {
    const status = document.getElementById('status');

    if (status) {
      status.textContent = 'Selecteer een element om te bewerken. Klik en sleep om te verplaatsen.';
    }

    updateLayerPanel();
  });

  canvas.on('object:scaling', updateLayerPanel);
}

function bindFabricButtons(canvas, margin, canvasWidth, canvasHeight, stateKey, activePers, product) {
  document.getElementById('btn-logo')?.addEventListener('click', () => {
    document.getElementById('file-input')?.click();
  });

  document.getElementById('file-input')?.addEventListener('change', event => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = readerEvent => {
      fabric.Image.fromURL(readerEvent.target.result, image => {
        image.scaleToWidth(120);
        image.set({ left: 140, top: 140 });

        canvas.add(image);
        canvas.setActiveObject(image);
        canvas.renderAll();

        fabricSaveHistory();
        updateLayerPanel();
        autoSaveCanvasState(stateKey);
      });
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  });

  document.getElementById('btn-text')?.addEventListener('click', () => {
    const text = new fabric.IText('Dubbelklik om tekst te bewerken', {
      left: 100,
      top: 160,
      fontSize: 20,
      fill: fabricActiveColor,
      fontFamily: document.getElementById('font-select')?.value || 'Georgia',
      editable: true,
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();

    syncFontSizeControls(text);
    fabricSaveHistory();
    updateLayerPanel();
    autoSaveCanvasState(stateKey);
  });

  document.getElementById('btn-delete')?.addEventListener('click', () => {
    const object = canvas.getActiveObject();

    if (object && !isGuideObject(object)) {
      canvas.remove(object);
      fabricSaveHistory();
      updateLayerPanel();
      autoSaveCanvasState(stateKey);
    }
  });

  document.getElementById('btn-front')?.addEventListener('click', () => {
    const object = canvas.getActiveObject();

    if (object && !isGuideObject(object)) {
      canvas.bringToFront(object);
      redrawGuides(canvas, activePers, product, margin, canvasWidth, canvasHeight);
      fabricSaveHistory();
      updateLayerPanel();
      autoSaveCanvasState(stateKey);
    }
  });

  document.getElementById('btn-back')?.addEventListener('click', () => {
    const object = canvas.getActiveObject();

    if (object && !isGuideObject(object)) {
      canvas.sendBackwards(object);
      redrawGuides(canvas, activePers, product, margin, canvasWidth, canvasHeight);
      fabricSaveHistory();
      updateLayerPanel();
      autoSaveCanvasState(stateKey);
    }
  });

  document.getElementById('btn-undo')?.addEventListener('click', () => {
    if (fabricHistory.length <= 1) {
      return;
    }

    fabricHistory.pop();

    canvas.loadFromJSON(fabricHistory[fabricHistory.length - 1], () => {
      redrawGuides(canvas, activePers, product, margin, canvasWidth, canvasHeight);
      updateLayerPanel();
      autoSaveCanvasState(stateKey);
    });
  });

  document.getElementById('btn-clear')?.addEventListener('click', () => {
    canvas.clear();
    canvas.backgroundColor = fabricBackgroundColor;

    loadBackgroundImage(canvas, activePers, product, canvasWidth, canvasHeight);
    redrawGuides(canvas, activePers, product, margin, canvasWidth, canvasHeight);

    fabricSaveHistory();
    updateLayerPanel();
    clearDesignState(stateKey);
  });

  bindFontSelector(canvas, stateKey);
  bindFontSizeControl(canvas, stateKey);
  bindLayerDragAndDrop(canvas, stateKey);
}

function isOutsideMargin(object, margin, canvasWidth, canvasHeight) {
  const bounds = object.getBoundingRect(true, true);

  return bounds.left < margin ||
    bounds.top < margin ||
    bounds.left + bounds.width > canvasWidth - margin ||
    bounds.top + bounds.height > canvasHeight - margin;
}

function isObjectOverlappingBlockedZones(object, activePers, product, canvasWidth, canvasHeight) {
  if (!object || isGuideObject(object)) {
    return false;
  }

  const zones = Array.isArray(activePers?.blockedZones) ? activePers.blockedZones : [];

  if (!zones.length) {
    return false;
  }

  const bounds = object.getBoundingRect(true, true);

  return zones.some(zone => {
    if (zone.type === 'circle') {
      const circleData = getBlockedCircleCanvasData(zone, activePers, product, canvasWidth, canvasHeight);

      if (!circleData) {
        return false;
      }

      return isRectOverlappingCircle(bounds, circleData.cx, circleData.cy, circleData.safeRadius);
    }

    if (zone.type === 'line') {
      const lineData = getBlockedLineCanvasData(zone, activePers, product, canvasWidth, canvasHeight);

      if (!lineData) {
        return false;
      }

      return isRectNearLine(bounds, lineData.x1, lineData.y1, lineData.x2, lineData.y2, lineData.safeRadius);
    }

    return false;
  });
}

function isRectOverlappingCircle(rect, circleX, circleY, radius) {
  const closestX = clamp(circleX, rect.left, rect.left + rect.width);
  const closestY = clamp(circleY, rect.top, rect.top + rect.height);

  const distanceX = circleX - closestX;
  const distanceY = circleY - closestY;

  return (distanceX * distanceX + distanceY * distanceY) <= radius * radius;
}

function isRectNearLine(rect, x1, y1, x2, y2, radius) {
  const expandedRect = {
    left: rect.left - radius,
    top: rect.top - radius,
    right: rect.left + rect.width + radius,
    bottom: rect.top + rect.height + radius,
  };

  if (
    (x1 >= expandedRect.left && x1 <= expandedRect.right && y1 >= expandedRect.top && y1 <= expandedRect.bottom) ||
    (x2 >= expandedRect.left && x2 <= expandedRect.right && y2 >= expandedRect.top && y2 <= expandedRect.bottom)
  ) {
    return true;
  }

  const rectLines = [
    [expandedRect.left, expandedRect.top, expandedRect.right, expandedRect.top],
    [expandedRect.right, expandedRect.top, expandedRect.right, expandedRect.bottom],
    [expandedRect.right, expandedRect.bottom, expandedRect.left, expandedRect.bottom],
    [expandedRect.left, expandedRect.bottom, expandedRect.left, expandedRect.top],
  ];

  return rectLines.some(([rx1, ry1, rx2, ry2]) =>
    doLineSegmentsIntersect(x1, y1, x2, y2, rx1, ry1, rx2, ry2)
  );
}

function doLineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const direction = (ax, ay, bx, by, cx, cy) => {
    return (cx - ax) * (by - ay) - (cy - ay) * (bx - ax);
  };

  const d1 = direction(x3, y3, x4, y4, x1, y1);
  const d2 = direction(x3, y3, x4, y4, x2, y2);
  const d3 = direction(x1, y1, x2, y2, x3, y3);
  const d4 = direction(x1, y1, x2, y2, x4, y4);

  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateFabricStatus() {
  const object = fabricCanvas?.getActiveObject();
  const status = document.getElementById('status');

  if (!object || !status) {
    return;
  }

  status.textContent = `${object.type === 'i-text' ? 'Tekst' : 'Afbeelding'} geselecteerd. Sleep, schaal of roteer.`;
}

function updateLayerPanel() {
  const panel = document.getElementById('layer-list');

  if (!panel || !fabricCanvas) {
    return;
  }

  panel.innerHTML = '';

  fabricCanvas.getObjects()
    .filter(object => !isGuideObject(object))
    .reverse()
    .forEach((object, index) => {
      const item = document.createElement('div');
      item.className = 'layer-item';
      item.draggable = true;
      item.dataset.objectId = getFabricObjectId(object);
      item.textContent = object.type === 'i-text'
        ? `${index + 1}. Tekst: "${object.text}"`
        : `${index + 1}. Afbeelding`;

      if (fabricCanvas.getActiveObject() === object) {
        item.classList.add('active');
      }

      item.addEventListener('click', () => {
        fabricCanvas.setActiveObject(object);
        fabricCanvas.renderAll();
      });

      panel.appendChild(item);
    });
}

function bindLayerDragAndDrop(canvas, stateKey) {
  const panel = document.getElementById('layer-list');

  if (!panel) {
    return;
  }

  panel.addEventListener('dragstart', event => {
    const item = event.target.closest('.layer-item');

    if (!item) {
      return;
    }

    event.dataTransfer.setData('text/plain', item.dataset.objectId);
    item.classList.add('dragging');
  });

  panel.addEventListener('dragend', event => {
    event.target.closest('.layer-item')?.classList.remove('dragging');
  });

  panel.addEventListener('dragover', event => {
    event.preventDefault();
  });

  panel.addEventListener('drop', event => {
    event.preventDefault();

    const draggedId = event.dataTransfer.getData('text/plain');
    const targetItem = event.target.closest('.layer-item');

    if (!draggedId || !targetItem) {
      return;
    }

    const targetId = targetItem.dataset.objectId;

    if (draggedId === targetId) {
      return;
    }

    reorderCanvasObjectsFromLayerDrop(canvas, draggedId, targetId);
    fabricSaveHistory();
    autoSaveCanvasState(stateKey);
    updateLayerPanel();
  });
}

function reorderCanvasObjectsFromLayerDrop(canvas, draggedId, targetId) {
  const editableObjects = canvas.getObjects().filter(object => !isGuideObject(object));
  const draggedObject = editableObjects.find(object => getFabricObjectId(object) === draggedId);
  const targetObject = editableObjects.find(object => getFabricObjectId(object) === targetId);

  if (!draggedObject || !targetObject) {
    return;
  }

  const fromIndex = editableObjects.indexOf(draggedObject);
  const toIndex = editableObjects.indexOf(targetObject);

  if (fromIndex === -1 || toIndex === -1) {
    return;
  }

  editableObjects.splice(fromIndex, 1);
  editableObjects.splice(toIndex, 0, draggedObject);

  const activeObject = canvas.getActiveObject();
  const backgroundColor = canvas.backgroundColor;
  const backgroundImage = canvas.backgroundImage || null;

  editableObjects.forEach((object, index) => {
    if (typeof canvas.moveTo === 'function') {
      canvas.moveTo(object, index);
      return;
    }

    if (typeof object.moveTo === 'function') {
      object.moveTo(index);
    }
  });

  canvas.backgroundColor = backgroundColor;
  canvas.backgroundImage = backgroundImage;

  bringGuidesToFront(canvas);

  if (activeObject && !isGuideObject(activeObject)) {
    canvas.setActiveObject(activeObject);
  }

  canvas.renderAll();
}

function getFabricObjectId(object) {
  if (!object._layerId) {
    object._layerId = `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  return object._layerId;
}

function applyToSelected(property, value) {
  const object = fabricCanvas?.getActiveObject();

  if (object && object.type === 'i-text' && !isGuideObject(object)) {
    object.set(property, value);
    fabricCanvas.renderAll();
    fabricSaveHistory();
    updateLayerPanel();
    autoSaveCanvasState(window._currentDesignStateKey);
  }
}

function fabricSaveHistory() {
  if (!fabricCanvas) {
    return;
  }

  const guideObjects = getGuideObjects(fabricCanvas);

  guideObjects.forEach(object => {
    object.visible = false;
  });

  const json = JSON.stringify(fabricCanvas.toJSON(['_layerId']));

  guideObjects.forEach(object => {
    object.visible = true;
  });

  fabricHistory.push(json);

  if (fabricHistory.length > 20) {
    fabricHistory.shift();
  }

  fabricCanvas.renderAll();
}

function snapshotCanvas(canvas, product, activePers) {
  const guideObjects = getGuideObjects(canvas);

  guideObjects.forEach(object => {
    object.visible = false;
  });

  canvas.discardActiveObject();
  canvas.renderAll();

  const printWidthPx = activePers?.width_px || product.width_px || 1181;
  const displayWidthPx = canvas.getWidth();
  const multiplier = printWidthPx / displayWidthPx;

  const dataURL = canvas.toDataURL({
    format: 'png',
    multiplier,
    enableRetinaScaling: false,
  });

  guideObjects.forEach(object => {
    object.visible = true;
  });

  canvas.renderAll();

  const json = JSON.stringify(canvas.toJSON(['_layerId']));
  const backgroundColor = canvas.backgroundColor || fabricBackgroundColor;

  const pdfDataURL = generatePrintPDF(
    dataURL,
    activePers?.width_mm || product.width_mm || 100,
    activePers?.height_mm || product.height_mm || 70
  );

  return {
    dataURL,
    json,
    backgroundColor,
    pdfDataURL,
  };
}

function generatePrintPDF(pngDataURL, widthMm, heightMm) {
  if (!window.jspdf) {
    console.warn('jsPDF niet geladen');
    return null;
  }

  const { jsPDF } = window.jspdf;

  const BLEED_MM = 3;
  const MARK_MM = 5;
  const GAP_MM = 2.117;

  const pageW = widthMm + BLEED_MM * 2;
  const pageH = heightMm + BLEED_MM * 2;

  const pdf = new jsPDF({
    orientation: pageW > pageH ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pageW, pageH],
    compress: true,
  });

  pdf.addImage(pngDataURL, 'PNG', 0, 0, pageW, pageH, '', 'FAST');

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.088);

  const x1 = BLEED_MM;
  const x2 = BLEED_MM + widthMm;
  const y1 = BLEED_MM;
  const y2 = BLEED_MM + heightMm;

  pdf.line(x1 - GAP_MM - MARK_MM, y1, x1 - GAP_MM, y1);
  pdf.line(x1, y1 - GAP_MM - MARK_MM, x1, y1 - GAP_MM);

  pdf.line(x2 + GAP_MM, y1, x2 + GAP_MM + MARK_MM, y1);
  pdf.line(x2, y1 - GAP_MM - MARK_MM, x2, y1 - GAP_MM);

  pdf.line(x1 - GAP_MM - MARK_MM, y2, x1 - GAP_MM, y2);
  pdf.line(x1, y2 + GAP_MM, x1, y2 + GAP_MM + MARK_MM);

  pdf.line(x2 + GAP_MM, y2, x2 + GAP_MM + MARK_MM, y2);
  pdf.line(x2, y2 + GAP_MM, x2, y2 + GAP_MM + MARK_MM);

  return pdf.output('datauristring');
}

function autoSaveCanvasState(stateKey) {
  if (!fabricCanvas || !stateKey) {
    return;
  }

  const guideObjects = getGuideObjects(fabricCanvas);

  guideObjects.forEach(object => {
    object.visible = false;
  });

  const json = JSON.stringify(fabricCanvas.toJSON(['_layerId']));

  guideObjects.forEach(object => {
    object.visible = true;
  });

  persistDesignState(stateKey, {
    fabricJSON: json,
    backgroundColor: fabricCanvas.backgroundColor || fabricBackgroundColor,
  });

  fabricCanvas.renderAll();
}

function getGuideObjects(canvas) {
  return canvas.getObjects().filter(object => isGuideObject(object));
}

function persistDesignState(stateKey, data) {
  if (!stateKey) {
    return;
  }

  try {
    const current = JSON.parse(localStorage.getItem(stateKey) || '{}');

    localStorage.setItem(stateKey, JSON.stringify({
      ...current,
      ...data,
      savedAt: Date.now(),
    }));
  } catch (error) {
    console.warn('Design state opslaan mislukt', error);
  }
}

function loadDesignState(stateKey) {
  try {
    const raw = localStorage.getItem(stateKey);

    if (!raw) {
      return null;
    }

    const state = JSON.parse(raw);

    if (Date.now() - (state.savedAt || 0) > 86400000) {
      localStorage.removeItem(stateKey);
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

  localStorage.removeItem(stateKey);
}

function handleUpload(file, stateKey) {
  const reader = new FileReader();

  reader.onload = event => {
    uploadedDataURL = event.target.result;
    uploadedFileName = file.name;

    const data = {
      dataURL: uploadedDataURL,
      pdfDataURL: uploadedDataURL.startsWith('data:application/pdf') ? uploadedDataURL : '',
      fileName: uploadedFileName,
      tab: 'upload',
      source: 'upload',
    };

    Session.setDesign(data);
    persistDesignState(stateKey, data);
    renderDesignPage();
  };

  reader.readAsDataURL(file);
}

function clearUpload() {
  uploadedDataURL = null;
  uploadedFileName = null;

  Session.setDesign({
    dataURL: null,
    pdfDataURL: null,
    fileName: null,
    tab: 'upload',
    source: null,
  });

  renderDesignPage();
}

function getPersonalisationImageSrc(persType, product) {
  return persType?.previewImageFile?.dataURL ||
    persType?.previewImage ||
    product?.imageProductFile?.dataURL ||
    product?.imageProduct ||
    '';
}

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

window.clearUpload = clearUpload;