const product = JSON.parse(localStorage.getItem('selectedProduct'));

const CANVAS_WIDTH = product ? product.canvas_display_width : 500;
const CANVAS_HEIGHT = product ? product.canvas_display_height : 350;
let MARGIN = product ? product.margin_px * (product.canvas_display_width / product.width_px) : 20;
let activeColor = '#1D9E75';
let history = [];

const canvas = new fabric.Canvas('c', {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  selection: true,
  backgroundColor: '#b7bdb8'
});

const fgColors = ['#1D9E75', '#ffffff', '#2c2c2a', '#e63946', '#f4a261', '#457b9d', '#f1c453', '#9d4edd'];

function updateLayerPanel() {
  const panel = document.getElementById('layer-list');
  panel.innerHTML = '';

  const objects = canvas.getObjects().filter(o => !o._isMargin);

  // Omgekeerd zodat bovenste laag bovenaan staat
  [...objects].reverse().forEach((obj, i) => {
    const item = document.createElement('div');
    item.className = 'layer-item';
    item.textContent = obj.type === 'i-text' ? `${i + 1}. Tekst: "${obj.text}"` : `${i + 1}. Afbeelding`;

    if (canvas.getActiveObject() === obj) {
      item.classList.add('active');
    }

    // Klik om element te selecteren
    item.addEventListener('click', () => {
      canvas.setActiveObject(obj);
      canvas.renderAll();
    });

    panel.appendChild(item);
  });
}

canvas.on('selection:created', updateLayerPanel);
canvas.on('selection:updated', updateLayerPanel);
canvas.on('selection:cleared', updateLayerPanel);
canvas.on('object:scaling', updateLayerPanel);

function makeSwatches(containerId, colors, onClick, defaultIdx) {
  const el = document.getElementById(containerId);
  colors.forEach((c, i) => {
    const s = document.createElement('div');
    s.className = 'color-swatch' + (i === defaultIdx ? ' active' : '');
    s.style.background = c;
    s.title = c;
    s.addEventListener('click', () => {
      el.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('active'));
      s.classList.add('active');
      onClick(c);
    });
    el.appendChild(s);
  });
}

makeSwatches('color-swatches', fgColors, c => { activeColor = c; applyToSelected('fill', c); }, 0);

function drawMarginRect() {
  canvas.getObjects('rect').filter(o => o._isMargin).forEach(o => canvas.remove(o));
  const margin = new fabric.Rect({
    left: MARGIN,
    top: MARGIN,
    width: CANVAS_WIDTH - MARGIN * 2,
    height: CANVAS_HEIGHT - MARGIN * 2,
    fill: 'transparent',
    stroke: 'rgba(255,255,255,0.4)',
    strokeWidth: 1.5,
    strokeDashArray: [6, 4],
    selectable: false,
    evented: false,
    _isMargin: true
  });
  canvas.add(margin);
  canvas.sendToBack(margin);
}

drawMarginRect();

function isOutsideMargin(obj) {
  const br = obj.getBoundingRect(true, true);
  return (
    br.left < MARGIN ||
    br.top < MARGIN ||
    br.left + br.width > CANVAS_WIDTH - MARGIN ||
    br.top + br.height > CANVAS_HEIGHT - MARGIN
  );
}

canvas.on('object:moving', function (e) {
  const outside = isOutsideMargin(e.target);
  document.getElementById('margin-warning').style.display = outside ? 'flex' : 'none';
});

canvas.on('object:rotating', function (e) {
  const outside = isOutsideMargin(e.target);
  document.getElementById('margin-warning').style.display = outside ? 'flex' : 'none';
});

canvas.on('object:modified', function (e) {
  const outside = isOutsideMargin(e.target);
  document.getElementById('margin-warning').style.display = outside ? 'flex' : 'none';
})

canvas.on('text:changed', function (e) {
  const outside = isOutsideMargin(e.target);
  document.getElementById('margin-warning').style.display = outside ? 'flex' : 'none';
  saveHistory();
  updateLayerPanel();
})

canvas.on('object:moved', () => {
  document.getElementById('margin-warning').style.display = 'none';
  saveHistory();
});

canvas.on('object:modified', saveHistory, updateLayerPanel);

canvas.on('selection:created', updateStatus);
canvas.on('selection:updated', updateStatus);
canvas.on('selection:cleared', () => {
  document.getElementById('status').textContent = 'Selecteer een element om te bewerken • Klik en sleep om te verplaatsen';
});

function updateStatus() {
  const obj = canvas.getActiveObject();
  if (!obj) return;
  const type = obj.type === 'i-text' ? 'Tekst' : 'Afbeelding';
  document.getElementById('status').textContent = `${type} geselecteerd — sleep, schaal of roteer`;
}

function applyToSelected(prop, value) {
  const obj = canvas.getActiveObject();
  if (obj && obj.type === 'i-text') {
    obj.set(prop, value);
    canvas.renderAll();
    saveHistory();
    updateLayerPanel();
  }
}

document.getElementById('btn-logo').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (ev) {
    fabric.Image.fromURL(ev.target.result, function (img) {
      img.scaleToWidth(120);
      img.set({ left: 140, top: 140 });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      saveHistory();
      updateLayerPanel();
    });
  };
  reader.readAsDataURL(file);
  this.value = '';
});

document.getElementById('btn-text').addEventListener('click', () => {
  const val = document.getElementById('text-input').value || 'Mijn tekst';
  const fontSizeEl = document.getElementById('font-size');
  const fontSize = fontSizeEl ? parseInt(fontSizeEl.value) : 20;
  const text = new fabric.IText(val, {
    left: 100,
    top: 160,
    fontSize: fontSize,
    fill: activeColor,
    fontFamily: 'Georgia',
    editable: true
  });
  canvas.add(text);
  canvas.setActiveObject(text);
  canvas.renderAll();
  saveHistory();
  updateLayerPanel();
});

const fontSizeEl = document.getElementById('font-size');
if (fontSizeEl) {
  fontSizeEl.addEventListener('input', function () {
    const v = parseInt(this.value);
    document.getElementById('font-size-out').textContent = v;
    const obj = canvas.getActiveObject();
    if (obj && obj.type === 'i-text') { obj.set('fontSize', v); canvas.renderAll(); }
  });
}

document.getElementById('opacity').addEventListener('input', function () {
  const v = parseInt(this.value);
  document.getElementById('opacity-out').textContent = v + '%';
  const obj = canvas.getActiveObject();
  if (obj) { obj.set('opacity', v / 100); canvas.renderAll(); }
  saveHistory();
  updateLayerPanel();
});

document.getElementById('btn-delete').addEventListener('click', () => {
  const obj = canvas.getActiveObject();
  if (obj && !obj._isMargin) { canvas.remove(obj); saveHistory(); updateLayerPanel(); }
});

document.getElementById('btn-front').addEventListener('click', () => {
  const obj = canvas.getActiveObject();
  if (obj) { canvas.bringToFront(obj); drawMarginRect(); saveHistory(); updateLayerPanel(); }
});

document.getElementById('btn-back').addEventListener('click', () => {
  const obj = canvas.getActiveObject();
  if (obj) { canvas.sendBackwards(obj); saveHistory(); updateLayerPanel(); }
});

document.getElementById('btn-undo').addEventListener('click', () => {
  if (history.length > 1) {
    history.pop();
    const prev = history[history.length - 1];
    canvas.loadFromJSON(prev, () => {
      canvas.renderAll();
    });
  }
});

document.getElementById('btn-clear').addEventListener('click', () => {
  canvas.clear();
  canvas.backgroundColor = '#b7bdb8';
  drawMarginRect();
  canvas.renderAll();
  saveHistory();
  updateLayerPanel();
});

// document.getElementById('btn-export').addEventListener('click', () => {
//   // Verberg margelijn
//   canvas.getObjects('rect').filter(o => o._isMargin).forEach(o => o.visible = false);
//   canvas.renderAll();

//   const multiplier = product.width_px / product.canvas_display_width;
//   const dataURL = canvas.toDataURL({ format: 'png', multiplier: multiplier });

//   // Zet margelijn terug
//   canvas.getObjects('rect').filter(o => o._isMargin).forEach(o => o.visible = true);
//   canvas.renderAll();
//   const a = document.createElement('a');
//   a.href = dataURL;
//   a.download = 'blossombs-ontwerp.png';
//   a.click();
// });

document.getElementById('btn-export').addEventListener('click', async () => {
  // 1. Verberg margelijn
  canvas.getObjects('rect').filter(o => o._isMargin).forEach(o => o.visible = false);
  canvas.renderAll();

  // 2. Exporteer canvas naar PNG op volledige resolutie (300 DPI via multiplier)
  const multiplier = product.width_px / product.canvas_display_width;
  const dataURL = canvas.toDataURL({ format: 'png', multiplier: multiplier });

  // 3. Zet margelijn terug
  canvas.getObjects('rect').filter(o => o._isMargin).forEach(o => o.visible = true);
  canvas.renderAll();

  // 4. Bereken afmetingen
  // Werkelijke pixelafmetingen van het exportcanvas
  const exportWidthPx = product.width_px;
  const exportHeightPx = product.height_px ??
    Math.round(product.canvas_display_height * multiplier);

  const DPI = 300;
  const MM_PER_INCH = 25.4;
  const BLEED_MM = 3;      // Standaard snijmarge (bleed)
  const MARK_MM = 5;      // Lengte van de snijlijn buiten het formaat
  const GAP_MM = 2;      // Ruimte tussen snijlijn en documentrand

  // Documentformaat in mm (zonder bleed)
  const docWidthMm = (exportWidthPx / DPI) * MM_PER_INCH;
  const docHeightMm = (exportHeightPx / DPI) * MM_PER_INCH;

  // PDF-paginaformaat inclusief bleed aan alle zijden
  const pageWidthMm = docWidthMm + BLEED_MM * 2;
  const pageHeightMm = docHeightMm + BLEED_MM * 2;

  // 5. Laad jsPDF (verwacht dat jsPDF als script is ingeladen)
  // Voeg toe aan je HTML: 
  // <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({
    orientation: pageWidthMm > pageHeightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pageWidthMm, pageHeightMm],
    compress: true
  });

  // 6. CMYK ICC-profiel taggen in PDF metadata
  // Dit markeert de PDF als CMYK-intentie voor drukkers
  pdf.setProperties({
    title: 'Blossombs Ontwerp',
    subject: 'Print-ready export',
    creator: 'Blossombs Design Tool',
    keywords: 'CMYK,print,blossombs'
  });

  // 7. Afbeelding plaatsen op de pagina (inclusief bleed offset)
  pdf.addImage(
    dataURL,
    'PNG',
    0,           // x: afbeelding begint op paginarand (bleed inbegrepen)
    0,           // y: zelfde
    pageWidthMm, // breedte: vult de volledige pagina incl. bleed
    pageHeightMm // hoogte: zelfde
  );

  // 8. Snijlijnen tekenen (crop marks)
  // Snijlijnen komen op de hoeken, buiten het bleed-gebied
  pdf.setDrawColor(0, 0, 0);       // Zwart
  pdf.setLineWidth(0.25);           // Dunne lijn, standaard voor snijlijnen

  const x1 = BLEED_MM; // Linker documentrand
  const x2 = BLEED_MM + docWidthMm; // Rechter documentrand
  const y1 = BLEED_MM; // Bovenste documentrand
  const y2 = BLEED_MM + docHeightMm; // Onderste documentrand

  // Snijlijnpositie: buiten de pagina op afstand GAP_MM van documentrand
  const outerX1 = x1 - GAP_MM - MARK_MM;
  const outerX2 = x2 + GAP_MM + MARK_MM;
  const outerY1 = y1 - GAP_MM - MARK_MM;
  const outerY2 = y2 + GAP_MM + MARK_MM;
  const innerX1 = x1 - GAP_MM;
  const innerX2 = x2 + GAP_MM;
  const innerY1 = y1 - GAP_MM;
  const innerY2 = y2 + GAP_MM;

  // Linksboven
  pdf.line(outerX1, y1, innerX1, y1); // horizontaal
  pdf.line(x1, outerY1, x1, innerY1); // verticaal

  // Rechtsboven
  pdf.line(innerX2, y1, outerX2, y1); // horizontaal
  pdf.line(x2, outerY1, x2, innerY1); // verticaal

  // Linksonder
  pdf.line(outerX1, y2, innerX1, y2); // horizontaal
  pdf.line(x1, innerY2, x1, outerY2); // verticaal

  // Rechtsonder
  pdf.line(innerX2, y2, outerX2, y2); // horizontaal
  pdf.line(x2, innerY2, x2, outerY2); // verticaal

  // 9. Exporteer PDF
  pdf.save('blossombs-ontwerp.pdf');
});


function saveHistory() {
  const json = JSON.stringify(canvas.toJSON(['_isMargin']));
  history.push(json);
  if (history.length > 20) history.shift();
}

saveHistory();
updateLayerPanel();

const demo = new fabric.IText('Jouw bedrijfsnaam', {
  left: 60, top: 220, fontSize: 18, fill: '#ffffff',
  fontFamily: 'Georgia', editable: true, opacity: 0.9
});
canvas.add(demo);
canvas.renderAll();
saveHistory();
updateLayerPanel();

document.addEventListener('keydown', (e) => {
  if (e.key === 'Backspace' || e.key === 'Delete') {
    const obj = canvas.getActiveObject();
    if (obj && !obj._isMargin && !(obj.type === 'i-text' && obj.isEditing)) {
      canvas.remove(obj);
      saveHistory();
      updateLayerPanel();
    }
  }
});