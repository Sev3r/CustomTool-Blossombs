/**
 * step3-design.js
 * Punt 1: Export PDF knop verwijderd — ontwerp wordt automatisch opgeslagen bij bestelling
 * Punt 3: Canvas state persistent in localStorage (cot_design_state)
 * Punt 4: Canvas-afmetingen gekoppeld aan personalisatievariant
 *
 * FABRIC.JS INTEGRATIEPUNT:
 * Vereist: fabric.min.js en jspdf.umd.min.js geladen vóór dit script.
 */

const DESIGN_STATE_KEY = 'cot_design_state';

let fabricCanvas = null;
let fabricHistory = [];
let fabricActiveColor = '#1D9E75';
let uploadedDataURL = null;
let uploadedFileName = null;
let activeDesignTab = 'tool';

// ─── RENDER ───────────────────────────────────────────────────────────────────

function renderDesignPage() {
  const el = document.getElementById('page-design');
  const product = Session.getProduct();
  const options = Session.getOptions();
  const saved = Session.getDesign() || {};

  if (!product) { navigateTo('select'); return; }

  // Punt 3: herstel state uit localStorage als sessie leeg is
  const stateKey = `${DESIGN_STATE_KEY}_${product.id}`;
  const savedState = loadDesignState(stateKey);

  uploadedDataURL = saved.dataURL || savedState?.dataURL || null;
  uploadedFileName = saved.fileName || savedState?.fileName || null;
  activeDesignTab = saved.tab || savedState?.tab || 'tool';

  // Punt 4: personalisatievariant uit opties
  const persTypes = product.personalisatieTypes || [];
  const activePers = options?.persType || persTypes[0] || null;

  el.innerHTML = `
    <h1 class="page-title">Ontwerp uw verpakking</h1>
    <p class="page-subtitle">Gebruik de ontwerptool of upload een eigen bestand</p>
 
    <div class="design-tabs" style="margin-bottom:24px">
      <button class="design-tab ${activeDesignTab === 'tool' ? 'active' : ''}" data-tab="tool">Ontwerptool</button>
      <button class="design-tab ${activeDesignTab === 'upload' ? 'active' : ''}" data-tab="upload">Bestand uploaden</button>
    </div>
 
    <!-- TOOL TAB -->
    <div id="tab-tool" style="${activeDesignTab === 'tool' ? '' : 'display:none'}">
      <div id="app" style="border:0.5px solid var(--cream-border);border-radius:12px;overflow:hidden;display:flex;min-height:520px;background:#fff">
        <div id="sidebar">
          <div id="sidebar-header"></div>
          <div class="side-section">
            <div class="side-label">Toevoegen</div>
            <button class="tool-btn" id="btn-logo">+ Logo uploaden</button>
            <input type="file" id="file-input" accept="image/*" style="display:none">
            <div class="text-input-row" style="margin-bottom:6px">
              <input type="text" id="text-input" placeholder="Jouw tekst..." value="Jouw tekst...">
            </div>
            <button class="tool-btn" id="btn-text">+ Tekst toevoegen</button>
          </div>
          <div class="side-section">
            <div class="side-label">Kleur</div>
            <div class="color-row" id="color-swatches"></div>
            <div class="prop-row">
              <div class="prop-top">
                <label>Transparantie</label>
                <span id="opacity-out">100%</span>
              </div>
              <input type="range" id="opacity" min="10" max="100" value="100" step="1">
            </div>
          </div>
          <!-- Punt 1: export knop verwijderd -->
        </div>
 
        <div id="canvas-area">
          <div id="canvas-toolbar">
            <button class="tb-btn" id="btn-delete">Verwijder</button>
            <button class="tb-btn" id="btn-front">Voorgrond</button>
            <button class="tb-btn" id="btn-back">Achtergrond</button>
            <div class="tb-sep"></div>
            <button class="tb-btn" id="btn-undo">Ongedaan</button>
            <button class="tb-btn" id="btn-clear">Reset</button>
          </div>
          <div id="canvas-wrap">
            <div id="margin-warning">⚠ Object buiten marge!</div>
            <canvas id="c"></canvas>
          </div>
          <div id="status">Selecteer een element om te bewerken • Klik en sleep om te verplaatsen</div>
        </div>
 
        <div id="layer-panel">
          <div id="layer-header">Layers</div>
          <div id="layer-list"></div>
        </div>
      </div>
    </div>
 
    <!-- UPLOAD TAB -->
    <div id="tab-upload" style="${activeDesignTab === 'upload' ? '' : 'display:none'}">
      <div class="design-layout">
        <div>
          <div class="upload-zone" id="upload-zone">
            <input type="file" id="upload-input" accept=".png,.jpg,.jpeg,.pdf,.ai,.eps">
            <div class="upload-icon">📁</div>
            <div class="upload-title">Sleep uw bestand hierheen</div>
            <div class="upload-sub">of klik om te bladeren</div>
            <div class="upload-sub" style="margin-top:8px">PNG, JPG, PDF, AI, EPS — min. 300 DPI aanbevolen</div>
          </div>
          ${uploadedDataURL ? `
            <div style="margin-top:12px;padding:10px 14px;background:var(--green-light);border-radius:8px;
                        font-size:13px;color:var(--green-dark);display:flex;justify-content:space-between;align-items:center">
              <span>✅ ${escHtml(uploadedFileName || 'Bestand geüpload')}</span>
              <button onclick="clearUpload()" style="background:none;border:none;cursor:pointer;color:#C0392B;font-size:18px">×</button>
            </div>
          ` : ''}
        </div>
        <div>
          <div class="preview-box" id="preview-box">
            ${uploadedDataURL
      ? `<img src="${uploadedDataURL}" alt="Preview">`
      : `<div class="preview-placeholder">🖼️</div>`}
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
      <button class="btn btn-outline" onclick="navigateTo('options')">← Terug</button>
      <button class="btn btn-green" id="btn-design-next">Verder →</button>
    </div>
  `;

  // Tab switching
  el.querySelectorAll('.design-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeDesignTab = tab.dataset.tab;
      el.querySelectorAll('.design-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-tool').style.display = activeDesignTab === 'tool' ? '' : 'none';
      document.getElementById('tab-upload').style.display = activeDesignTab === 'upload' ? '' : 'none';
      persistDesignState(stateKey, { tab: activeDesignTab });
      if (activeDesignTab === 'tool' && !fabricCanvas) initFabricTool(product, activePers, savedState);
    });
  });

  // Upload zone
  const zone = document.getElementById('upload-zone');
  const input = document.getElementById('upload-input');
  if (zone && input) {
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0], stateKey);
    });
    input.addEventListener('change', e => {
      if (e.target.files[0]) handleUpload(e.target.files[0], stateKey);
    });
  }

  document.getElementById('btn-zoom')?.addEventListener('click', () => {
    if (uploadedDataURL) window.open(uploadedDataURL, '_blank');
  });

  // Verder
  document.getElementById('btn-design-next')?.addEventListener('click', () => {
    if (activeDesignTab === 'upload') {
      if (!uploadedDataURL) {
        document.getElementById('design-error').style.display = 'block';
        return;
      }
      const designData = { dataURL: uploadedDataURL, fileName: uploadedFileName, tab: 'upload', source: 'upload' };
      Session.setDesign(designData);
      persistDesignState(stateKey, designData);
    } else {
      if (fabricCanvas) {
        const snapshot = snapshotCanvas(fabricCanvas, product, activePers);
        Session.setDesign({ dataURL: snapshot.dataURL, tab: 'tool', source: 'fabric', fabricJSON: snapshot.json });
        persistDesignState(stateKey, { dataURL: snapshot.dataURL, fabricJSON: snapshot.json, tab: 'tool' });
      }
    }
    document.getElementById('design-error').style.display = 'none';
    navigateTo('review');
  });

  // Init Fabric
  if (activeDesignTab === 'tool') {
    setTimeout(() => initFabricTool(product, activePers, savedState), 50);
  }
}

// ─── FABRIC.JS TOOL ───────────────────────────────────────────────────────────

function initFabricTool(product, activePers, savedState) {
  if (!window.fabric) {
    console.warn('Fabric.js niet geladen.');
    return;
  }

  if (fabricCanvas) { fabricCanvas.dispose(); fabricCanvas = null; }
  fabricHistory = [];
  fabricActiveColor = '#1D9E75';

  // Punt 4: gebruik afmetingen van personalisatievariant
  const CANVAS_W = activePers?.canvas_display_width || product.canvas_display_width || 500;
  const CANVAS_H = activePers?.canvas_display_height || product.canvas_display_height || 350;
  const marginPx = activePers?.margin_px || product.margin_px || 20;
  let MARGIN = marginPx * (CANVAS_W / (activePers?.width_px || product.width_px || 1181));

  // Punt 3: clip-shape (niet-rechthoekige producten)
  const clipShape = activePers?.clipShape || null;

  fabricCanvas = new fabric.Canvas('c', {
    width: CANVAS_W, height: CANVAS_H,
    selection: true, backgroundColor: '#b7bdb8',
  });

  if (window._fabricMouseUpHandler) {
    document.removeEventListener('mouseup', window._fabricMouseUpHandler);
  }

  window._fabricMouseUpHandler = function () {
    if (!fabricCanvas) return;
    const transform = fabricCanvas._currentTransform;
    if (transform) {
      fabricCanvas._currentTransform = null;
      fabricCanvas.setCursor(fabricCanvas.defaultCursor);
      fabricCanvas.renderAll();
    }
  };

  document.addEventListener('mouseup', window._fabricMouseUpHandler);

  // Clip-path (punt 3)
  const canvasEl = document.querySelector('#canvas-wrap canvas');
  if (clipShape && canvasEl) {
    canvasEl.style.clipPath = clipShape;
    canvasEl.style.borderRadius = clipShape.startsWith('circle') ? '50%' : '4px';
    if (clipShape.startsWith('circle')) {
      const r = Math.min(CANVAS_W, CANVAS_H) / 2;
      fabricCanvas.clipPath = new fabric.Circle({
        radius: r, left: CANVAS_W / 2 - r, top: CANVAS_H / 2 - r,
        absolutePositioned: true,
      });
    }
  }

  // Kleurswatches
  const fgColors = ['#1D9E75', '#ffffff', '#2c2c2a', '#e63946', '#f4a261', '#457b9d', '#f1c453', '#9d4edd'];
  const swatchContainer = document.getElementById('color-swatches');
  if (swatchContainer) {
    swatchContainer.innerHTML = '';
    fgColors.forEach((c, i) => {
      const s = document.createElement('div');
      s.className = 'color-swatch' + (i === 0 ? ' active' : '');
      s.style.background = c;
      s.addEventListener('click', () => {
        swatchContainer.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('active'));
        s.classList.add('active');
        fabricActiveColor = c;
        applyToSelected('fill', c);
      });
      swatchContainer.appendChild(s);
    });
  }

  // Marginlijn
  function drawMarginRect() {
    fabricCanvas.getObjects('rect').filter(o => o._isMargin).forEach(o => fabricCanvas.remove(o));
    fabricCanvas.add(new fabric.Rect({
      left: MARGIN, top: MARGIN,
      width: CANVAS_W - MARGIN * 2, height: CANVAS_H - MARGIN * 2,
      fill: 'transparent', stroke: 'rgba(255,255,255,0.4)',
      strokeWidth: 1.5, strokeDashArray: [6, 4],
      selectable: false, evented: false, _isMargin: true,
    }));
    fabricCanvas.sendToBack(fabricCanvas.getObjects('rect').find(o => o._isMargin));
  }

  drawMarginRect();

  // Achtergrond product-preview laden
  const bgImg = activePers?.previewImage || product.imageProduct || null;
  if (bgImg) {
    fabric.Image.fromURL(bgImg, img => {
      fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas), {
        scaleX: CANVAS_W / img.width, scaleY: CANVAS_H / img.height,
      });
    });
  }

  // Punt 3: herstel canvas state uit localStorage
  if (savedState?.fabricJSON) {
    try {
      fabricCanvas.loadFromJSON(savedState.fabricJSON, () => {
        drawMarginRect();
        fabricCanvas.renderAll();
        updateLayerPanel();
      });
    } catch (e) {
      console.warn('Canvas state herstellen mislukt', e);
      addDemoText(CANVAS_H);
    }
  } else {
    addDemoText(CANVAS_H);
  }

  function addDemoText(h) {
    const demo = new fabric.IText('Jouw bedrijfsnaam', {
      left: 60, top: Math.round(h * 0.65),
      fontSize: 18, fill: '#ffffff', fontFamily: 'Georgia', editable: true, opacity: 0.9,
    });
    fabricCanvas.add(demo);
    fabricCanvas.renderAll();
    fabricSaveHistory();
    updateLayerPanel();
  }

  // Margecheck
  function isOutsideMargin(obj) {
    const br = obj.getBoundingRect(true, true);
    return br.left < MARGIN || br.top < MARGIN ||
      br.left + br.width > CANVAS_W - MARGIN ||
      br.top + br.height > CANVAS_H - MARGIN;
  }

  function checkMargin(obj) {
    if (!obj) return;
    const warn = document.getElementById('margin-warning');
    if (warn) warn.style.display = isOutsideMargin(obj) ? 'flex' : 'none';
  }

  fabricCanvas.on('object:moving', e => checkMargin(e.target));
  fabricCanvas.on('object:rotating', e => checkMargin(e.target));
  fabricCanvas.on('object:modified', e => checkMargin(e.target));
  fabricCanvas.on('text:changed', e => {
    checkMargin(e.target); fabricSaveHistory(); updateLayerPanel();
    autoSaveCanvasState(stateKey);
  });
  fabricCanvas.on('object:moved', () => {
    const warn = document.getElementById('margin-warning');
    if (warn) warn.style.display = 'none';
    fabricSaveHistory(); autoSaveCanvasState(stateKey);
  });
  fabricCanvas.on('object:modified', () => { fabricSaveHistory(); autoSaveCanvasState(stateKey); });

  fabricCanvas.on('selection:created', () => { updateFabricStatus(); updateLayerPanel(); });
  fabricCanvas.on('selection:updated', () => { updateFabricStatus(); updateLayerPanel(); });
  fabricCanvas.on('selection:cleared', () => {
    const s = document.getElementById('status');
    if (s) s.textContent = 'Selecteer een element om te bewerken • Klik en sleep om te verplaatsen';
    updateLayerPanel();
  });
  fabricCanvas.on('object:scaling', updateLayerPanel);

  function updateFabricStatus() {
    const obj = fabricCanvas.getActiveObject();
    const s = document.getElementById('status');
    if (!obj || !s) return;
    s.textContent = `${obj.type === 'i-text' ? 'Tekst' : 'Afbeelding'} geselecteerd — sleep, schaal of roteer`;
  }

  function updateLayerPanel() {
    const panel = document.getElementById('layer-list');
    if (!panel) return;
    panel.innerHTML = '';
    fabricCanvas.getObjects().filter(o => !o._isMargin).reverse().forEach((obj, i) => {
      const item = document.createElement('div');
      item.className = 'layer-item';
      item.textContent = obj.type === 'i-text' ? `${i + 1}. Tekst: "${obj.text}"` : `${i + 1}. Afbeelding`;
      if (fabricCanvas.getActiveObject() === obj) item.classList.add('active');
      item.addEventListener('click', () => { fabricCanvas.setActiveObject(obj); fabricCanvas.renderAll(); });
      panel.appendChild(item);
    });
  }

  function applyToSelected(prop, value) {
    const obj = fabricCanvas.getActiveObject();
    if (obj && obj.type === 'i-text') {
      obj.set(prop, value); fabricCanvas.renderAll();
      fabricSaveHistory(); updateLayerPanel();
    }
  }

  function fabricSaveHistory() {
    const json = JSON.stringify(fabricCanvas.toJSON(['_isMargin']));
    fabricHistory.push(json);
    if (fabricHistory.length > 20) fabricHistory.shift();
  }

  // Knoppen
  document.getElementById('btn-logo')?.addEventListener('click', () => {
    document.getElementById('file-input')?.click();
  });

  document.getElementById('file-input')?.addEventListener('change', function (e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      fabric.Image.fromURL(ev.target.result, img => {
        img.scaleToWidth(120); img.set({ left: 140, top: 140 });
        fabricCanvas.add(img); fabricCanvas.setActiveObject(img);
        fabricCanvas.renderAll(); fabricSaveHistory(); updateLayerPanel();
        autoSaveCanvasState(stateKey);
      });
    };
    reader.readAsDataURL(file); this.value = '';
  });

  document.getElementById('btn-text')?.addEventListener('click', () => {
    const val = document.getElementById('text-input')?.value || 'Mijn tekst';
    const text = new fabric.IText(val, {
      left: 100, top: 160, fontSize: 20,
      fill: fabricActiveColor, fontFamily: 'Georgia', editable: true,
    });
    fabricCanvas.add(text); fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll(); fabricSaveHistory(); updateLayerPanel();
    autoSaveCanvasState(stateKey);
  });

  document.getElementById('opacity')?.addEventListener('input', function () {
    const v = parseInt(this.value);
    const out = document.getElementById('opacity-out');
    if (out) out.textContent = v + '%';
    const obj = fabricCanvas.getActiveObject();
    if (obj) { obj.set('opacity', v / 100); fabricCanvas.renderAll(); }
    fabricSaveHistory(); updateLayerPanel();
  });

  document.getElementById('btn-delete')?.addEventListener('click', () => {
    const obj = fabricCanvas.getActiveObject();
    if (obj && !obj._isMargin) { fabricCanvas.remove(obj); fabricSaveHistory(); updateLayerPanel(); autoSaveCanvasState(stateKey); }
  });

  document.getElementById('btn-front')?.addEventListener('click', () => {
    const obj = fabricCanvas.getActiveObject();
    if (obj) { fabricCanvas.bringToFront(obj); drawMarginRect(); fabricSaveHistory(); updateLayerPanel(); }
  });

  document.getElementById('btn-back')?.addEventListener('click', () => {
    const obj = fabricCanvas.getActiveObject();
    if (obj) { fabricCanvas.sendBackwards(obj); fabricSaveHistory(); updateLayerPanel(); }
  });

  document.getElementById('btn-undo')?.addEventListener('click', () => {
    if (fabricHistory.length > 1) {
      fabricHistory.pop();
      fabricCanvas.loadFromJSON(fabricHistory[fabricHistory.length - 1], () => {
        fabricCanvas.renderAll(); updateLayerPanel();
      });
    }
  });

  document.getElementById('btn-clear')?.addEventListener('click', () => {
    fabricCanvas.clear(); fabricCanvas.backgroundColor = '#b7bdb8';
    drawMarginRect(); fabricCanvas.renderAll();
    fabricSaveHistory(); updateLayerPanel();
    clearDesignState(stateKey);
  });

  // Keyboard delete
  if (window._fabricKeyHandler) document.removeEventListener('keydown', window._fabricKeyHandler);
  window._fabricKeyHandler = e => {
    if ((e.key === 'Backspace' || e.key === 'Delete')) {
      const obj = fabricCanvas?.getActiveObject();
      if (obj && !obj._isMargin && !(obj.type === 'i-text' && obj.isEditing)) {
        fabricCanvas.remove(obj); fabricSaveHistory(); updateLayerPanel(); autoSaveCanvasState(stateKey);
      }
    }
  };
  document.addEventListener('keydown', window._fabricKeyHandler);

  // Sla stateKey op voor gebruik in 'Verder' knop
  window._currentDesignStateKey = stateKey;

  // Initialiseer history
  fabricSaveHistory();
  updateLayerPanel();
}

// ─── CANVAS SNAPSHOT ─────────────────────────────────────────────────────────
// Wordt aangeroepen bij 'Verder' — geeft dataURL + JSON terug

function snapshotCanvas(canvas, product, activePers) {
  canvas.getObjects('rect').filter(o => o._isMargin).forEach(o => o.visible = false);
  canvas.renderAll();
  const multiplier = (activePers?.width_px || product.width_px) /
    (activePers?.canvas_display_width || product.canvas_display_width);
  const dataURL = canvas.toDataURL({ format: 'png', multiplier: multiplier || 2 });
  canvas.getObjects('rect').filter(o => o._isMargin).forEach(o => o.visible = true);
  canvas.renderAll();
  const json = JSON.stringify(canvas.toJSON(['_isMargin']));
  return { dataURL, json };
}

// ─── DESIGN STATE PERSISTENTIE (punt 3) ──────────────────────────────────────

function autoSaveCanvasState(stateKey) {
  if (!fabricCanvas) return;
  const json = JSON.stringify(fabricCanvas.toJSON(['_isMargin']));
  persistDesignState(stateKey, { fabricJSON: json });
}

function persistDesignState(stateKey, data) {
  try {
    const current = JSON.parse(localStorage.getItem(stateKey) || '{}');
    localStorage.setItem(stateKey, JSON.stringify({ ...current, ...data, savedAt: Date.now() }));
  } catch (e) { console.warn('Design state opslaan mislukt', e); }
}

function loadDesignState(stateKey) {
  try {
    const raw = localStorage.getItem(stateKey);
    if (!raw) return null;
    const state = JSON.parse(raw);
    // Verlopen na 24 uur
    if (Date.now() - (state.savedAt || 0) > 86400000) {
      localStorage.removeItem(stateKey);
      return null;
    }
    return state;
  } catch (e) { return null; }
}

function clearDesignState(stateKey) {
  localStorage.removeItem(stateKey);
}

// ─── UPLOAD HELPERS ───────────────────────────────────────────────────────────

function handleUpload(file, stateKey) {
  const reader = new FileReader();
  reader.onload = ev => {
    uploadedDataURL = ev.target.result;
    uploadedFileName = file.name;
    const data = { dataURL: uploadedDataURL, fileName: uploadedFileName, tab: 'upload', source: 'upload' };
    Session.setDesign(data);
    persistDesignState(stateKey, data);
    renderDesignPage();
  };
  reader.readAsDataURL(file);
}

function clearUpload() {
  uploadedDataURL = null; uploadedFileName = null;
  Session.setDesign({ dataURL: null, fileName: null, tab: 'upload', source: null });
  renderDesignPage();
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.clearUpload = clearUpload;