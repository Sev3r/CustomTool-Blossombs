const CANVAS_SIZE = 400;
const MARGIN = 30;
let activeColor = '#1D9E75';
let history = [];

const canvas = new fabric.Canvas('c', {
  width: CANVAS_SIZE,
  height: CANVAS_SIZE,
  selection: true,
  backgroundColor: '#7bc67e'
});

const bgColors = ['#7bc67e','#f4a261','#e76f51','#457b9d','#f1c453','#ffffff','#2c2c2a','#d4a5a5'];
const fgColors = ['#1D9E75','#ffffff','#2c2c2a','#e63946','#f4a261','#457b9d','#f1c453','#9d4edd'];

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
makeSwatches('bg-swatches', bgColors, c => { canvas.backgroundColor = c; canvas.renderAll(); saveHistory(); }, 0);

function drawMarginCircle() {
  canvas.getObjects('circle').filter(o => o._isMargin).forEach(o => canvas.remove(o));
  const margin = new fabric.Circle({
    radius: CANVAS_SIZE/2 - MARGIN,
    left: MARGIN,
    top: MARGIN,
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

function drawBombShape() {
  const clip = new fabric.Circle({
    radius: CANVAS_SIZE/2,
    left: 0,
    top: 0,
    absolutePositioned: true
  });
  canvas.clipPath = clip;
}

drawMarginCircle();
drawBombShape();

function isOutsideMargin(obj) {
  const br = obj.getBoundingRect();
  const cx = CANVAS_SIZE/2, cy = CANVAS_SIZE/2;
  const r = CANVAS_SIZE/2 - MARGIN;
  const corners = [
    [br.left, br.top], [br.left+br.width, br.top],
    [br.left, br.top+br.height], [br.left+br.width, br.top+br.height]
  ];
  return corners.some(([x,y]) => Math.sqrt((x-cx)**2+(y-cy)**2) > r);
}

canvas.on('object:moving', function(e) {
  const outside = isOutsideMargin(e.target);
  document.getElementById('margin-warning').style.display = outside ? 'flex' : 'none';
});

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

document.getElementById('file-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    fabric.Image.fromURL(ev.target.result, function(img) {
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

document.getElementById('font-size').addEventListener('input', function() {
  const v = parseInt(this.value);
  document.getElementById('font-size-out').textContent = v;
  const obj = canvas.getActiveObject();
  if (obj && obj.type === 'i-text') { obj.set('fontSize', v); canvas.renderAll(); }
});

document.getElementById('opacity').addEventListener('input', function() {
  const v = parseInt(this.value);
  document.getElementById('opacity-out').textContent = v + '%';
  const obj = canvas.getActiveObject();
  if (obj) { obj.set('opacity', v/100); canvas.renderAll(); }
  saveHistory();
});

document.getElementById('btn-delete').addEventListener('click', () => {
  const obj = canvas.getActiveObject();
  if (obj && !obj._isMargin) { canvas.remove(obj); saveHistory(); }
});

document.getElementById('btn-front').addEventListener('click', () => {
  const obj = canvas.getActiveObject();
  if (obj) { canvas.bringToFront(obj); drawMarginCircle(); saveHistory(); }
});

document.getElementById('btn-back').addEventListener('click', () => {
  const obj = canvas.getActiveObject();
  if (obj) { canvas.sendBackwards(obj); saveHistory(); }
});

document.getElementById('btn-undo').addEventListener('click', () => {
  if (history.length > 1) {
    history.pop();
    const prev = history[history.length-1];
    canvas.loadFromJSON(prev, () => {
      canvas.clipPath = new fabric.Circle({ radius: CANVAS_SIZE/2, left: 0, top: 0, absolutePositioned: true });
      canvas.renderAll();
    });
  }
});

document.getElementById('btn-clear').addEventListener('click', () => {
  canvas.clear();
  canvas.backgroundColor = '#7bc67e';
  drawMarginCircle();
  drawBombShape();
  canvas.renderAll();
  saveHistory();
});

document.getElementById('btn-export').addEventListener('click', () => {
  const dataURL = canvas.toDataURL({ format: 'png', multiplier: 2 });
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
  left: 60, top: 310, fontSize: 18, fill: '#ffffff',
  fontFamily: 'Georgia', editable: true, opacity: 0.9
});
canvas.add(demo);
canvas.renderAll();
saveHistory();