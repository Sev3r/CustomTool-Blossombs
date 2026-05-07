const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 300;
const MARGIN = 20;
let activeColor = '#1D9E75';
let history = [];

const canvas = new fabric.Canvas('c', {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  selection: true,
  backgroundColor: '#b7bdb8'
});

// const bgColors = ['#7bc67e', '#f4a261', '#e76f51', '#457b9d', '#f1c453', '#ffffff', '#2c2c2a', '#d4a5a5'];
const fgColors = ['#1D9E75', '#ffffff', '#2c2c2a', '#e63946', '#f4a261', '#457b9d', '#f1c453', '#9d4edd'];

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
// makeSwatches('bg-swatches', bgColors, c => { canvas.backgroundColor = c; canvas.renderAll(); saveHistory(); }, 0);

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
})

canvas.on('object:moved', () => {
  document.getElementById('margin-warning').style.display = 'none';
  saveHistory();
});

canvas.on('object:modified', saveHistory);

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
    });
  };
  reader.readAsDataURL(file);
  this.value = '';
});

document.getElementById('btn-text').addEventListener('click', () => {
  const val = document.getElementById('text-input').value || 'Mijn tekst';
  const text = new fabric.IText(val, {
    left: 100,
    top: 160,
    fontSize: parseInt(document.getElementById('font-size').value),
    fill: activeColor,
    fontFamily: 'Georgia',
    editable: true
  });
  canvas.add(text);
  canvas.setActiveObject(text);
  canvas.renderAll();
  saveHistory();
});

document.getElementById('font-size').addEventListener('input', function () {
  const v = parseInt(this.value);
  document.getElementById('font-size-out').textContent = v;
  const obj = canvas.getActiveObject();
  if (obj && obj.type === 'i-text') { obj.set('fontSize', v); canvas.renderAll(); }
});

document.getElementById('opacity').addEventListener('input', function () {
  const v = parseInt(this.value);
  document.getElementById('opacity-out').textContent = v + '%';
  const obj = canvas.getActiveObject();
  if (obj) { obj.set('opacity', v / 100); canvas.renderAll(); }
  saveHistory();
});

document.getElementById('btn-delete').addEventListener('click', () => {
  const obj = canvas.getActiveObject();
  if (obj && !obj._isMargin) { canvas.remove(obj); saveHistory(); }
});

document.getElementById('btn-front').addEventListener('click', () => {
  const obj = canvas.getActiveObject();
  if (obj) { canvas.bringToFront(obj); drawMarginRect(); saveHistory(); }
});

document.getElementById('btn-back').addEventListener('click', () => {
  const obj = canvas.getActiveObject();
  if (obj) { canvas.sendBackwards(obj); saveHistory(); }
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
  canvas.backgroundColor = '#7bc67e';
  drawMarginRect();
  canvas.renderAll();
  saveHistory();
});

document.getElementById('btn-export').addEventListener('click', () => {
  // Verberg margelijn
  canvas.getObjects('rect').filter(o => o._isMargin).forEach(o => o.visible = false);
  canvas.renderAll();

  const dataURL = canvas.toDataURL({ format: 'png', multiplier: 5 });

  // Zet margelijn terug
  canvas.getObjects('rect').filter(o => o._isMargin).forEach(o => o.visible = true);
  canvas.renderAll();
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = 'blossombs-ontwerp.png';
  a.click();
});

function saveHistory() {
  const json = JSON.stringify(canvas.toJSON(['_isMargin']));
  history.push(json);
  if (history.length > 20) history.shift();
}

saveHistory();

const demo = new fabric.IText('Jouw bedrijfsnaam', {
  left: 60, top: 220, fontSize: 18, fill: '#ffffff',
  fontFamily: 'Georgia', editable: true, opacity: 0.9
});
canvas.add(demo);
canvas.renderAll();
saveHistory();

document.addEventListener('keydown', (e) => {
  if (e.key === 'Backspace' || e.key === 'Delete') {
    const obj = canvas.getActiveObject();
    if (obj && !obj._isMargin && !(obj.type === 'i-text' && obj.isEditing)) {
      canvas.remove(obj);
      saveHistory();
    }
  }
});