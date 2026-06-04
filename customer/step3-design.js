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

  const persTypes = product.personalisatieTypes || [];
  const activePers = options?.persType || persTypes[0] || null;
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

            <div class="text-input-row" style="margin-bottom:6px">
              <input type="text" id="text-input" placeholder="Jouw tekst..." value="Jouw tekst...">
            </div>

            <button class="tool-btn" type="button" id="btn-text">+ Tekst toevoegen</button>
          </div>

          <div class="side-section">
  <div class="side-label">Lettertype</div>
  <select id="font-select" class="font-select">
    ${AVAILABLE_FONTS.map(f =>
    `<option value="${f.value}" style="font-family:${f.value}">${f.label}</option>`
  ).join('')}
  </select>
  <div id="font-preview" class="font-preview">Voorbeeld tekst</div>
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

            <div class="prop-row">
              <div class="prop-top">
                <label for="opacity">Transparantie</label>
                <span id="opacity-out">100%</span>
              </div>
              <input type="range" id="opacity" min="10" max="100" value="100" step="1">
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

              <span class="form-hint">
                Deze kleur wordt meegenomen in het drukbestand.
              </span>
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
    setTimeout(() => initFabricTool(product, activePers, savedState, stateKey), 50);
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

      if (toolTab) toolTab.style.display = activeDesignTab === 'tool' ? '' : 'none';
      if (uploadTab) uploadTab.style.display = activeDesignTab === 'upload' ? '' : 'none';

      persistDesignState(stateKey, { tab: activeDesignTab });

      if (activeDesignTab === 'tool' && !fabricCanvas) {
        initFabricTool(product, activePers, savedState, stateKey);
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
    if (activeDesignTab === 'upload') {
      if (!uploadedDataURL) {
        document.getElementById('design-error').style.display = 'block';
        return;
      }

      const designData = {
        dataURL: uploadedDataURL,
        fileName: uploadedFileName,
        tab: 'upload',
        source: 'upload',
      };

      Session.setDesign(designData);
      persistDesignState(stateKey, designData);
    } else if (fabricCanvas) {
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
        fabricJSON: snapshot.json,
        backgroundColor: snapshot.backgroundColor,
        tab: 'tool',
      });
    }

    document.getElementById('design-error').style.display = 'none';
    navigateTo('review');
  });
}

function bindFontSelector(canvas, stateKey) {
  const select = document.getElementById('font-select');
  const preview = document.getElementById('font-preview');

  if (!select) return;

  // Update preview on change
  select.addEventListener('change', () => {
    const fontValue = select.value;

    if (preview) {
      preview.style.fontFamily = fontValue;
    }

    // Apply to selected text object
    const object = canvas.getActiveObject();
    if (object && object.type === 'i-text') {
      object.set('fontFamily', fontValue);
      canvas.renderAll();
      fabricSaveHistory();
      autoSaveCanvasState(stateKey);
    }
  });

  // Sync selector when a text object is selected
  canvas.on('selection:created', syncFontSelector);
  canvas.on('selection:updated', syncFontSelector);

  function syncFontSelector() {
    const object = canvas.getActiveObject();
    if (object && object.type === 'i-text') {
      const currentFont = object.fontFamily || 'Georgia';
      const match = AVAILABLE_FONTS.find(f => f.value === currentFont);
      if (match) select.value = match.value;
      if (preview) preview.style.fontFamily = currentFont;
    }
  }
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
    width: Math.floor(printWidthPx * scale),
    height: Math.floor(printHeightPx * scale),
    scale,
    printWidthPx,
    printHeightPx,
  };
}

function initFabricTool(product, activePers, savedState, stateKey) {
  if (!window.fabric) {
    console.warn('Fabric.js niet geladen.');
    return;
  }

  if (fabricCanvas) {
    fabricCanvas.dispose();
    fabricCanvas = null;
  }

  fabricHistory = [];
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
  });

  bindFabricDocumentHandlers();
  applyCanvasClipPath(clipShape, canvasWidth, canvasHeight);
  renderColorSwatches();
  renderBackgroundColorSwatches(activePers, stateKey);
  loadBackgroundImage(fabricCanvas, activePers, product, canvasWidth, canvasHeight);
  restoreCanvasStateOrDefault(fabricCanvas, savedState, canvasHeight, margin, canvasWidth, canvasHeight, activePers, product);
  bindFabricEvents(fabricCanvas, margin, canvasWidth, canvasHeight, stateKey, activePers, product);
  bindFabricButtons(fabricCanvas, margin, canvasWidth, canvasHeight, stateKey, activePers, product);

  window._currentDesignStateKey = stateKey;

  fabricSaveHistory();
  updateLayerPanel();
}

function bindFabricDocumentHandlers() {
  if (window._fabricMouseUpHandler) {
    document.removeEventListener('mouseup', window._fabricMouseUpHandler);
  }

  window._fabricMouseUpHandler = () => {
    if (!fabricCanvas) return;

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

    if (object && !object._isMargin && !(object.type === 'i-text' && object.isEditing)) {
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

  if (!clipShape || !canvasEl) {
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

  autoSaveCanvasState(stateKey);

  persistDesignState(stateKey, {
    backgroundColor: color,
  });
}

function drawMarginRect(canvas, margin, canvasWidth, canvasHeight) {
  canvas.getObjects('rect')
    .filter(object => object._isMargin)
    .forEach(object => canvas.remove(object));

  const marginRect = new fabric.Rect({
    left: margin,
    top: margin,
    width: canvasWidth - margin * 2,
    height: canvasHeight - margin * 2,
    fill: 'transparent',
    stroke: 'rgba(255,255,255,0.4)',
    strokeWidth: 1.5,
    strokeDashArray: [6, 4],
    selectable: false,
    evented: false,
    _isMargin: true,
  });

  canvas.add(marginRect);
  canvas.sendToBack(marginRect);
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
    if (zone.type !== 'circle') {
      return;
    }

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
  });

  bringGuidesToFront(canvas);
  canvas.renderAll();
}

function bringGuidesToFront(canvas) {
  canvas.getObjects()
    .filter(object => object._isGuide || object._isBlockedZone || object._isMargin)
    .forEach(object => {
      canvas.bringToFront(object);
    });
}

function removeGuideObjects(canvas) {
  canvas.getObjects()
    .filter(object => object._isGuide || object._isBlockedZone || object._isMargin)
    .forEach(object => canvas.remove(object));
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

    canvas.setBackgroundImage(image, canvas.renderAll.bind(canvas));
  }, {
    crossOrigin: 'anonymous',
  });
}

function restoreCanvasStateOrDefault(canvas, savedState, canvasHeight, margin, canvasWidth, canvasHeightValue, activePers, product) {
  const redrawGuides = () => {
    removeGuideObjects(canvas);
    drawMarginRect(canvas, margin, canvasWidth, canvasHeightValue);
    drawBlockedZones(canvas, activePers, product, canvasWidth, canvasHeightValue);
    bringGuidesToFront(canvas);
    canvas.renderAll();
    updateLayerPanel();
  };

  if (savedState?.fabricJSON) {
    try {
      canvas.loadFromJSON(savedState.fabricJSON, () => {
        redrawGuides();
      });
      return;
    } catch (error) {
      console.warn('Canvas state herstellen mislukt', error);
    }
  }

  addDefaultText(canvas, canvasHeight);
  redrawGuides();
}

function addDefaultText(canvas, canvasHeight) {
  const selectedFont = document.getElementById('font-select')?.value || 'Georgia';

  const demo = new fabric.IText('Jouw bedrijfsnaam', {
    left: 60,
    top: Math.round(canvasHeight * 0.65),
    fontSize: 18,
    fill: '#ffffff',
    fontFamily: selectedFont,  // ← gebruik gekozen font
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
    if (!object) return;

    const warning = document.getElementById('margin-warning');

    if (!warning) {
      return;
    }

    const outsideOuterMargin = isOutsideMargin(object, margin, canvasWidth, canvasHeight);
    const overlapsBlockedZone = isObjectOverlappingBlockedZones(object, activePers, product, canvasWidth, canvasHeight);

    warning.textContent = overlapsBlockedZone
      ? 'Object valt over uitsparing'
      : 'Object buiten marge';

    warning.style.display = outsideOuterMargin || overlapsBlockedZone ? 'flex' : 'none';
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

    fabricSaveHistory();
    autoSaveCanvasState(stateKey);
  });

  canvas.on('object:modified', () => {
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
    const value = document.getElementById('text-input')?.value || 'Mijn tekst';

    const text = new fabric.IText(value, {
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

    fabricSaveHistory();
    updateLayerPanel();
    autoSaveCanvasState(stateKey);
  });

  document.getElementById('opacity')?.addEventListener('input', event => {
    const value = parseInt(event.target.value, 10);
    const output = document.getElementById('opacity-out');

    if (output) {
      output.textContent = `${value}%`;
    }

    const object = canvas.getActiveObject();

    if (object) {
      object.set('opacity', value / 100);
      canvas.renderAll();
    }

    fabricSaveHistory();
    updateLayerPanel();
    autoSaveCanvasState(stateKey);
  });

  document.getElementById('btn-delete')?.addEventListener('click', () => {
    const object = canvas.getActiveObject();

    if (object && !object._isMargin) {
      canvas.remove(object);
      fabricSaveHistory();
      updateLayerPanel();
      autoSaveCanvasState(stateKey);
    }
  });

  document.getElementById('btn-front')?.addEventListener('click', () => {
    const object = canvas.getActiveObject();

    if (object) {
      canvas.bringToFront(object);
      drawMarginRect(canvas, margin, canvasWidth, canvasHeight);
      fabricSaveHistory();
      updateLayerPanel();
      autoSaveCanvasState(stateKey);
    }
  });

  document.getElementById('btn-back')?.addEventListener('click', () => {
    const object = canvas.getActiveObject();

    if (object) {
      canvas.sendBackwards(object);
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
      canvas.renderAll();
      updateLayerPanel();
      autoSaveCanvasState(stateKey);
    });
  });

  document.getElementById('btn-clear')?.addEventListener('click', () => {
    canvas.clear();
    canvas.backgroundColor = '#b7bdb8';

    drawMarginRect(canvas, margin, canvasWidth, canvasHeight);
    drawBlockedZones(canvas, activePers, product, canvasWidth, canvasHeight);
    canvas.renderAll();

    fabricSaveHistory();
    updateLayerPanel();
    clearDesignState(stateKey);
  });

  bindFontSelector(canvas, stateKey);
}

function isOutsideMargin(object, margin, canvasWidth, canvasHeight) {
  const bounds = object.getBoundingRect(true, true);

  return bounds.left < margin ||
    bounds.top < margin ||
    bounds.left + bounds.width > canvasWidth - margin ||
    bounds.top + bounds.height > canvasHeight - margin;
}

function isObjectOverlappingBlockedZones(object, activePers, product, canvasWidth, canvasHeight) {
  if (!object || object._isGuide || object._isBlockedZone || object._isMargin) {
    return false;
  }

  const zones = Array.isArray(activePers?.blockedZones) ? activePers.blockedZones : [];

  if (!zones.length) {
    return false;
  }

  const bounds = object.getBoundingRect(true, true);

  return zones.some(zone => {
    if (zone.type !== 'circle') {
      return false;
    }

    const circleData = getBlockedCircleCanvasData(zone, activePers, product, canvasWidth, canvasHeight);

    if (!circleData) {
      return false;
    }

    return isRectOverlappingCircle(bounds, circleData.cx, circleData.cy, circleData.safeRadius);
  });
}

function isRectOverlappingCircle(rect, circleX, circleY, radius) {
  const closestX = clamp(circleX, rect.left, rect.left + rect.width);
  const closestY = clamp(circleY, rect.top, rect.top + rect.height);

  const distanceX = circleX - closestX;
  const distanceY = circleY - closestY;

  return (distanceX * distanceX + distanceY * distanceY) <= radius * radius;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateFabricStatus() {
  const object = fabricCanvas.getActiveObject();
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
    .filter(object => !object._isMargin)
    .reverse()
    .forEach((object, index) => {
      const item = document.createElement('div');
      item.className = 'layer-item';
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

function applyToSelected(property, value) {
  const object = fabricCanvas?.getActiveObject();

  if (object && object.type === 'i-text') {
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

  const json = JSON.stringify(fabricCanvas.toJSON(['_isMargin']));
  fabricHistory.push(json);

  if (fabricHistory.length > 20) {
    fabricHistory.shift();
  }
}

function snapshotCanvas(canvas, product, activePers) {
  const marginObjects = canvas.getObjects().filter(object =>
    object._isMargin || object._isGuide || object._isBlockedZone
  );

  marginObjects.forEach(object => {
    object.visible = false;
  });
  canvas.discardActiveObject();
  canvas.renderAll();

  const printWidthPx = activePers?.width_px || product.width_px || 1181;
  const printHeightPx = activePers?.height_px || product.height_px || 827;
  const displayWidthPx = canvas.getWidth();
  const multiplier = printWidthPx / displayWidthPx;

  const dataURL = canvas.toDataURL({
    format: 'png',
    multiplier,
    enableRetinaScaling: false,
  });

  marginObjects.forEach(object => object.visible = true);
  canvas.renderAll();

  const json = JSON.stringify(canvas.toJSON(['_isMargin']));
  const backgroundColor = canvas.backgroundColor || fabricBackgroundColor;

  // Genereer drukklare PDF met snijlijnen
  const pdfDataURL = generatePrintPDF(
    dataURL,
    activePers?.width_mm || product.width_mm || 100,
    activePers?.height_mm || product.height_mm || 70
  );

  return { dataURL, json, backgroundColor, pdfDataURL };
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

  // PNG op ware grootte ingeplakt (vult volledige pagina incl. bleed)
  pdf.addImage(pngDataURL, 'PNG', 0, 0, pageW, pageH, '', 'FAST');

  // Snijlijnen
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.088);

  const x1 = BLEED_MM, x2 = BLEED_MM + widthMm;
  const y1 = BLEED_MM, y2 = BLEED_MM + heightMm;

  // Linksboven
  pdf.line(x1 - GAP_MM - MARK_MM, y1, x1 - GAP_MM, y1);
  pdf.line(x1, y1 - GAP_MM - MARK_MM, x1, y1 - GAP_MM);
  // Rechtsboven
  pdf.line(x2 + GAP_MM, y1, x2 + GAP_MM + MARK_MM, y1);
  pdf.line(x2, y1 - GAP_MM - MARK_MM, x2, y1 - GAP_MM);
  // Linksonder
  pdf.line(x1 - GAP_MM - MARK_MM, y2, x1 - GAP_MM, y2);
  pdf.line(x1, y2 + GAP_MM, x1, y2 + GAP_MM + MARK_MM);
  // Rechtsonder
  pdf.line(x2 + GAP_MM, y2, x2 + GAP_MM + MARK_MM, y2);
  pdf.line(x2, y2 + GAP_MM, x2, y2 + GAP_MM + MARK_MM);

  return pdf.output('datauristring');
}

function autoSaveCanvasState(stateKey) {
  if (!fabricCanvas || !stateKey) {
    return;
  }

  const json = JSON.stringify(fabricCanvas.toJSON(['_isMargin']));
  persistDesignState(stateKey, {
    fabricJSON: json,
    backgroundColor: fabricCanvas.backgroundColor || fabricBackgroundColor,
  });
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