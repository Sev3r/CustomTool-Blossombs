/**
 * step3-design.js
 * Stap 3: Ontwerp uploaden of maken met de geïntegreerde Fabric.js tool
 *
 * FABRIC.JS INTEGRATIEPUNT:
 * fabric.min.js en jspdf.umd.min.js moeten geladen zijn vóór dit script.
 * Voeg toe aan customer/index.html (vóór de andere scripts):
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
 *   <script src="../shared/js/fabric.min.js"></script>
 */

// ─── MODULE STATE ─────────────────────────────────────────────────────────────
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
  const saved = Session.getDesign() || {};

  if (!product) { navigateTo('select'); return; }

  uploadedDataURL = saved.dataURL || null;
  uploadedFileName = saved.fileName || null;
  activeDesignTab = saved.tab || 'tool';

  el.innerHTML = `
    <h1 class="page-title">Ontwerp uw verpakking</h1>
    <p class="page-subtitle">Gebruik de ontwerptool of upload een eigen bestand</p>

    <!-- TABS -->
    <div class="design-tabs" style="margin-bottom:24px">
      <button class="design-tab ${activeDesignTab === 'tool' ? 'active' : ''}" data-tab="tool">Ontwerptool</button>
      <button class="design-tab ${activeDesignTab === 'upload' ? 'active' : ''}" data-tab="upload">Bestand uploaden</button>
    </div>

    <!-- TOOL TAB -->
    <div id="tab-tool" style="${activeDesignTab === 'tool' ? '' : 'display:none'}">
      <div id="app" style="border:0.5px solid var(--cream-border);border-radius:12px;overflow:hidden;display:flex;min-height:520px;background:#fff">

        <!-- Sidebar -->
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

          <div class="side-section" style="margin-top:auto;border-top:0.5px solid var(--color-border-tertiary,rgba(0,0,0,.15))">
            <button class="export-btn" id="btn-export">Exporteren (PDF)</button>
          </div>
        </div>

        <!-- Canvas area -->
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

        <!-- Layer panel -->
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
            <div style="margin-top:12px;padding:10px 14px;background:var(--green-light);border-radius:8px;font-size:13px;color:var(--green-dark);display:flex;justify-content:space-between;align-items:center">
              <span>✅ ${escHtml(uploadedFileName || 'Bestand geüpload')}</span>
              <button onclick="clearUpload()" style="background:none;border:none;cursor:pointer;color:#C0392B;font-size:18px">×</button>
            </div>
          ` : ''}
        </div>
        <div>
          <div class="preview-box" id="preview-box">
            ${uploadedDataURL
      ? `<img src="${uploadedDataURL}" alt="Preview" id="preview-img">`
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
      Session.setDesign({ ...Session.getDesign(), tab: activeDesignTab });
      if (activeDesignTab === 'tool' && !fabricCanvas) initFabricTool(product);
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
      if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', e => { if (e.target.files[0]) handleUpload(e.target.files[0]); });
  }

  // Zoom
  document.getElementById('btn-zoom')?.addEventListener('click', () => {
    if (uploadedDataURL) window.open(uploadedDataURL, '_blank');
  });

  // Verder knop
  document.getElementById('btn-design-next')?.addEventListener('click', () => {
    if (activeDesignTab === 'upload') {
      if (!uploadedDataURL) {
        document.getElementById('design-error').style.display = 'block';
        return;
      }
      Session.setDesign({ dataURL: uploadedDataURL, fileName: uploadedFileName, tab: 'upload', source: 'upload' });
    } else {
      // Tool tab: sla canvas op als PNG in sessie
      if (fabricCanvas) {
        fabricCanvas.getObjects('rect').filter(o => o._isMargin).forEach(o => o.visible = false);
        fabricCanvas.renderAll();
        const multiplier = product.width_px / product.canvas_display_width;
        const dataURL = fabricCanvas.toDataURL({ format: 'png', multiplier: multiplier });
        fabricCanvas.getObjects('rect').filter(o => o._isMargin).forEach(o => o.visible = true);
        fabricCanvas.renderAll();
        Session.setDesign({ dataURL, tab: 'tool', source: 'fabric' });
      }
    }
    document.getElementById('design-error').style.display = 'none';
    navigateTo('review');
  });

  // Init Fabric als tool-tab actief is
  if (activeDesignTab === 'tool') {
    // Kleine timeout zodat de DOM klaar is
    setTimeout(() => initFabricTool(product), 50);
  }
}

// ─── FABRIC.JS TOOL ───────────────────────────────────────────────────────────

function initFabricTool(product) {
  if (!window.fabric) {
    console.warn('Fabric.js niet geladen. Voeg fabric.min.js toe aan index.html.');
    return;
  }

  // Vernietig vorige instantie als die bestaat
  if (fabricCanvas) {
    fabricCanvas.dispose();
    fabricCanvas = null;
  }

  fabricHistory = [];
  fabricActiveColor = '#1D9E75';

  const CANVAS_W = product.canvas_display_width || 500;
  const CANVAS_H = product.canvas_display_height || 350;
  let MARGIN = product.margin_px
    ? product.margin_px * (product.canvas_display_width / product.width_px)
    : 20;

  fabricCanvas = new fabric.Canvas('c', {
    width: CANVAS_W,
    height: CANVAS_H,
    selection: true,
    backgroundColor: '#b7bdb8',
  });

  const persType = Session.getOptions()?.persType || null;
  const clipShape = persType?.clipShape || null;
  const canvasWrap = document.getElementById('canvas-wrap');
  const canvasEl = document.querySelector('#canvas-wrap canvas');

  if (clipShape && canvasWrap) {
    // Pas clip-path toe op de zichtbare canvas — puur visueel voor de gebruiker
    canvasWrap.style.setProperty('--clip-shape', clipShape);
    if (canvasEl) {
      canvasEl.style.clipPath = clipShape;
      canvasEl.style.borderRadius = clipShape.startsWith('circle') ? '50%' : '4px';
    }

    // Fabric.js intern clipPath voor de export — snijdt ook de export bij
    if (clipShape.startsWith('circle')) {
      // Cirkel: gebruik fabric.Circle als clipPath
      const r = Math.min(CANVAS_W, CANVAS_H) / 2;
      fabricCanvas.clipPath = new fabric.Circle({
        radius: r, left: CANVAS_W / 2 - r, top: CANVAS_H / 2 - r,
        absolutePositioned: true,
      });
    }
    // Voor custom SVG paths: uitbreiden met fabric.Path(clipShape, { absolutePositioned: true })
  }

  // ── Kleurswatches ────────────────────────────────────────────────────────
  const fgColors = ['#1D9E75', '#ffffff', '#2c2c2a', '#e63946', '#f4a261', '#457b9d', '#f1c453', '#9d4edd'];
  const swatchContainer = document.getElementById('color-swatches');
  if (swatchContainer) {
    swatchContainer.innerHTML = '';
    fgColors.forEach((c, i) => {
      const s = document.createElement('div');
      s.className = 'color-swatch' + (i === 0 ? ' active' : '');
      s.style.background = c;
      s.title = c;
      s.addEventListener('click', () => {
        swatchContainer.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('active'));
        s.classList.add('active');
        fabricActiveColor = c;
        applyToSelected('fill', c);
      });
      swatchContainer.appendChild(s);
    });
  }

  // ── Margelijn ────────────────────────────────────────────────────────────
  function drawMarginRect() {
    fabricCanvas.getObjects('rect').filter(o => o._isMargin).forEach(o => fabricCanvas.remove(o));
    const margin = new fabric.Rect({
      left: MARGIN, top: MARGIN,
      width: CANVAS_W - MARGIN * 2,
      height: CANVAS_H - MARGIN * 2,
      fill: 'transparent',
      stroke: 'rgba(255,255,255,0.4)',
      strokeWidth: 1.5,
      strokeDashArray: [6, 4],
      selectable: false, evented: false, _isMargin: true,
    });
    fabricCanvas.add(margin);
    fabricCanvas.sendToBack(margin);
  }

  drawMarginRect();

  // ── Margecheck ───────────────────────────────────────────────────────────
  function isOutsideMargin(obj) {
    const br = obj.getBoundingRect(true, true);
    return br.left < MARGIN || br.top < MARGIN ||
      br.left + br.width > CANVAS_W - MARGIN ||
      br.top + br.height > CANVAS_H - MARGIN;
  }

  function checkMargin(obj) {
    if (!obj) return;
    const outside = isOutsideMargin(obj);
    const warn = document.getElementById('margin-warning');
    if (warn) warn.style.display = outside ? 'flex' : 'none';
  }

  fabricCanvas.on('object:moving', e => checkMargin(e.target));
  fabricCanvas.on('object:rotating', e => checkMargin(e.target));
  fabricCanvas.on('object:modified', e => checkMargin(e.target));
  fabricCanvas.on('text:changed', e => { checkMargin(e.target); fabricSaveHistory(); updateLayerPanel(); });
  fabricCanvas.on('object:moved', () => {
    const warn = document.getElementById('margin-warning');
    if (warn) warn.style.display = 'none';
    fabricSaveHistory();
  });
  fabricCanvas.on('object:modified', fabricSaveHistory);

  // ── Status & layers ──────────────────────────────────────────────────────
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

  // ── Layer panel ──────────────────────────────────────────────────────────
  function updateLayerPanel() {
    const panel = document.getElementById('layer-list');
    if (!panel) return;
    panel.innerHTML = '';
    const objects = fabricCanvas.getObjects().filter(o => !o._isMargin);
    [...objects].reverse().forEach((obj, i) => {
      const item = document.createElement('div');
      item.className = 'layer-item';
      item.textContent = obj.type === 'i-text' ? `${i + 1}. Tekst: "${obj.text}"` : `${i + 1}. Afbeelding`;
      if (fabricCanvas.getActiveObject() === obj) item.classList.add('active');
      item.addEventListener('click', () => { fabricCanvas.setActiveObject(obj); fabricCanvas.renderAll(); });
      panel.appendChild(item);
    });
  }

  // ── applyToSelected ──────────────────────────────────────────────────────
  function applyToSelected(prop, value) {
    const obj = fabricCanvas.getActiveObject();
    if (obj && obj.type === 'i-text') {
      obj.set(prop, value); fabricCanvas.renderAll();
      fabricSaveHistory(); updateLayerPanel();
    }
  }

  // Maak applyToSelected beschikbaar voor kleurswatches buiten closure
  window._fabricApplyToSelected = applyToSelected;

  // ── History ──────────────────────────────────────────────────────────────
  function fabricSaveHistory() {
    const json = JSON.stringify(fabricCanvas.toJSON(['_isMargin']));
    fabricHistory.push(json);
    if (fabricHistory.length > 20) fabricHistory.shift();
  }

  fabricSaveHistory();

  // ── Knoppen ──────────────────────────────────────────────────────────────
  document.getElementById('btn-logo')?.addEventListener('click', () => {
    document.getElementById('file-input')?.click();
  });

  document.getElementById('file-input')?.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      fabric.Image.fromURL(ev.target.result, img => {
        img.scaleToWidth(120);
        img.set({ left: 140, top: 140 });
        fabricCanvas.add(img);
        fabricCanvas.setActiveObject(img);
        fabricCanvas.renderAll();
        fabricSaveHistory(); updateLayerPanel();
      });
    };
    reader.readAsDataURL(file);
    this.value = '';
  });

  document.getElementById('btn-text')?.addEventListener('click', () => {
    const val = document.getElementById('text-input')?.value || 'Mijn tekst';
    const text = new fabric.IText(val, {
      left: 100, top: 160,
      fontSize: 20, fill: fabricActiveColor,
      fontFamily: 'Georgia', editable: true,
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();
    fabricSaveHistory(); updateLayerPanel();
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
    if (obj && !obj._isMargin) { fabricCanvas.remove(obj); fabricSaveHistory(); updateLayerPanel(); }
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
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = '#b7bdb8';
    drawMarginRect(); fabricCanvas.renderAll();
    fabricSaveHistory(); updateLayerPanel();
  });

  // ── Export PDF ────────────────────────────────────────────────────────────
  document.getElementById('btn-export')?.addEventListener('click', async () => {
    if (!window.jspdf) { alert('jsPDF niet geladen.'); return; }

    fabricCanvas.getObjects('rect').filter(o => o._isMargin).forEach(o => o.visible = false);
    fabricCanvas.renderAll();

    const multiplier = product.width_px / product.canvas_display_width;
    const dataURL = fabricCanvas.toDataURL({ format: 'png', multiplier });
    const exportWidthPx = product.width_px;
    const exportHeightPx = product.height_px || Math.round(product.canvas_display_height * multiplier);

    fabricCanvas.getObjects('rect').filter(o => o._isMargin).forEach(o => o.visible = true);
    fabricCanvas.renderAll();

    const DPI = 300, MM_PER_INCH = 25.4, BLEED_MM = 3, MARK_MM = 5, GAP_MM = 2.117;
    const docW = (exportWidthPx / DPI) * MM_PER_INCH;
    const docH = (exportHeightPx / DPI) * MM_PER_INCH;
    const pageW = docW + BLEED_MM * 2;
    const pageH = docH + BLEED_MM * 2;

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: pageW > pageH ? 'landscape' : 'portrait',
      unit: 'mm', format: [pageW, pageH], compress: true,
    });
    pdf.setProperties({ title: 'Blossombs Ontwerp', creator: 'Blossombs Design Tool' });
    pdf.addImage(dataURL, 'PNG', 0, 0, pageW, pageH);

    // Snijlijnen
    pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(0.088);
    const x1 = BLEED_MM, x2 = BLEED_MM + docW, y1 = BLEED_MM, y2 = BLEED_MM + docH;
    [[x1 - GAP_MM - MARK_MM, y1, x1 - GAP_MM, y1], [x2 + GAP_MM, y1, x2 + GAP_MM + MARK_MM, y1],
    [x1 - GAP_MM - MARK_MM, y2, x1 - GAP_MM, y2], [x2 + GAP_MM, y2, x2 + GAP_MM + MARK_MM, y2],
    [x1, y1 - GAP_MM - MARK_MM, x1, y1 - GAP_MM], [x1, y2 + GAP_MM, x1, y2 + GAP_MM + MARK_MM],
    [x2, y1 - GAP_MM - MARK_MM, x2, y1 - GAP_MM], [x2, y2 + GAP_MM, x2, y2 + GAP_MM + MARK_MM],
    ].forEach(([x1l, y1l, x2l, y2l]) => pdf.line(x1l, y1l, x2l, y2l));

    pdf.save('blossombs-ontwerp.pdf');
  });

  // ── Keyboard delete ───────────────────────────────────────────────────────
  // Verwijder oude listener als die er al is en voeg nieuwe toe
  if (window._fabricKeyHandler) {
    document.removeEventListener('keydown', window._fabricKeyHandler);
  }
  window._fabricKeyHandler = (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const obj = fabricCanvas?.getActiveObject();
      if (obj && !obj._isMargin && !(obj.type === 'i-text' && obj.isEditing)) {
        fabricCanvas.remove(obj); fabricSaveHistory(); updateLayerPanel();
      }
    }
  };
  document.addEventListener('keydown', window._fabricKeyHandler);

  // ── Demo tekst ────────────────────────────────────────────────────────────
  const demo = new fabric.IText('Jouw bedrijfsnaam', {
    left: 60, top: Math.round(CANVAS_H * 0.65),
    fontSize: 18, fill: '#ffffff', fontFamily: 'Georgia', editable: true, opacity: 0.9,
  });
  fabricCanvas.add(demo);
  fabricCanvas.renderAll();
  fabricSaveHistory(); updateLayerPanel();
}

// ─── UPLOAD HELPERS ───────────────────────────────────────────────────────────

function handleUpload(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    uploadedDataURL = ev.target.result;
    uploadedFileName = file.name;
    Session.setDesign({ dataURL: uploadedDataURL, fileName: uploadedFileName, tab: 'upload', source: 'upload' });
    renderDesignPage();
  };
  reader.readAsDataURL(file);
}

function clearUpload() {
  uploadedDataURL = null;
  uploadedFileName = null;
  Session.setDesign({ dataURL: null, fileName: null, tab: 'upload', source: null });
  renderDesignPage();
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.clearUpload = clearUpload;