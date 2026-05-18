/**
 * step3-design.js
 * Stap 3: Ontwerp uploaden of maken met de Fabric.js tool
 *
 * FABRIC.JS INTEGRATIEPUNT:
 * De Fabric.js canvas wordt gemount in #fabric-mount.
 * Uncomment en pas de code aan in initFabric() als tool.js beschikbaar is.
 * De canvas leest het geselecteerde product uit Session.getProduct()
 * en de gekozen personalisatieafbeelding via Session.getOptions().activeImageIdx.
 */

let uploadedFile     = null;
let uploadedDataURL  = null;
let activeDesignTab  = 'upload'; // 'upload' | 'tool'

function renderDesignPage() {
  const el      = document.getElementById('page-design');
  const product = Session.getProduct();
  const options = Session.getOptions();
  const saved   = Session.getDesign() || {};

  if (!product) { navigateTo('select'); return; }

  uploadedDataURL = saved.dataURL || null;
  activeDesignTab = saved.tab    || 'upload';

  el.innerHTML = `
    <h1 class="page-title">Upload uw ontwerp</h1>
    <p class="page-subtitle">Laad uw eigen bestand up of gebruik onze ontwerptool</p>

    <div class="design-tabs">
      <button class="design-tab ${activeDesignTab === 'upload' ? 'active' : ''}" data-tab="upload">
        Bestand uploaden
      </button>
      <button class="design-tab ${activeDesignTab === 'tool' ? 'active' : ''}" data-tab="tool">
        Ontwerptool
      </button>
    </div>

    <!-- UPLOAD TAB -->
    <div id="tab-upload" style="${activeDesignTab === 'upload' ? '' : 'display:none'}">
      <div class="design-layout">
        <!-- Upload zone -->
        <div>
          <div class="upload-zone" id="upload-zone">
            <input type="file" id="upload-input" accept=".png,.jpg,.jpeg,.pdf,.ai,.eps">
            <div class="upload-icon">📁</div>
            <div class="upload-title">Sleep uw bestand hierheen</div>
            <div class="upload-sub">of klik om te bladeren</div>
            <div class="upload-sub" style="margin-top:8px">PNG, JPG, PDF, AI, EPS — min. 300 DPI aanbevolen</div>
          </div>

          ${uploadedDataURL ? `
            <div style="margin-top:12px;padding:10px 14px;background:var(--green-light);border-radius:var(--radius-sm);font-size:13px;color:var(--green-dark);display:flex;justify-content:space-between;align-items:center">
              <span>✅ ${escHtml(saved.fileName || 'Bestand geüpload')}</span>
              <button onclick="clearUpload()" style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:18px">×</button>
            </div>
          ` : ''}
        </div>

        <!-- Preview -->
        <div>
          <div class="preview-box" id="preview-box">
            ${uploadedDataURL
              ? `<img src="${uploadedDataURL}" alt="Preview" id="preview-img">`
              : `<div class="preview-placeholder">🖼️</div>`}
            <div class="preview-zoom" id="btn-zoom" title="Vergroot" ${!uploadedDataURL ? 'style="display:none"' : ''}>🔍</div>
          </div>
          <p style="font-size:12px;color:var(--text-3);margin-top:8px;text-align:center">
            Preview van uw ontwerp
          </p>
        </div>
      </div>
    </div>

    <!-- TOOL TAB -->
    <div id="tab-tool" style="${activeDesignTab === 'tool' ? '' : 'display:none'}">
      <!--
        FABRIC.JS INTEGRATIEPUNT:
        De Fabric.js canvas wordt hier gemount.
        1. Zorg dat fabric.min.js geladen is vóór dit script.
        2. Roep initFabric() aan na het renderen van deze pagina.
        3. Het product en de gekozen afbeelding zijn beschikbaar via:
             Session.getProduct()  → productdata incl. canvas_display_width/height, margin_px
             Session.getOptions().activeImageIdx → welke afbeelding als achtergrond
        4. Bij "Verder" sla je de canvas op via:
             canvas.toDataURL({ format: 'png', multiplier: exportMultiplier })
             en schrijf je naar Session.setDesign({ dataURL, tab: 'tool', source: 'fabric' })
      -->
      <div class="fabric-container" id="fabric-mount">
        <div style="text-align:center;color:var(--text-3);padding:40px">
          <div style="font-size:48px;margin-bottom:12px">🎨</div>
          <p style="font-size:15px">Ontwerptool wordt hier geladen.</p>
          <p style="font-size:13px;margin-top:8px">
            Koppel <code>tool.js</code> en <code>fabric.min.js</code> aan dit bestand
            om de ontwerptool te activeren.
          </p>
        </div>
      </div>
    </div>

    <div id="design-error" style="color:var(--danger);font-size:13px;display:none;margin-top:16px">
      Upload een bestand of maak een ontwerp om verder te gaan.
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
      document.getElementById('tab-upload').style.display = activeDesignTab === 'upload' ? '' : 'none';
      document.getElementById('tab-tool').style.display   = activeDesignTab === 'tool'   ? '' : 'none';
      Session.setDesign({ ...Session.getDesign(), tab: activeDesignTab });

      // FABRIC.JS INTEGRATIEPUNT: activeer tool bij switchen naar tool-tab
      // if (activeDesignTab === 'tool') initFabric();
    });
  });

  // Upload zone
  const zone  = document.getElementById('upload-zone');
  const input = document.getElementById('upload-input');

  zone.addEventListener('click',      () => input.click());
  zone.addEventListener('dragover',   e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave',  () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  });

  input.addEventListener('change', e => {
    if (e.target.files[0]) handleUpload(e.target.files[0]);
  });

  // Zoom
  document.getElementById('btn-zoom')?.addEventListener('click', () => {
    if (!uploadedDataURL) return;
    window.open(uploadedDataURL, '_blank');
  });

  // Verder
  document.getElementById('btn-design-next')?.addEventListener('click', () => {
    const hasUpload = activeDesignTab === 'upload' && uploadedDataURL;
    const hasTool   = activeDesignTab === 'tool'; // FABRIC.JS: check of canvas inhoud heeft

    if (!hasUpload && !hasTool) {
      document.getElementById('design-error').style.display = 'block';
      return;
    }

    document.getElementById('design-error').style.display = 'none';
    Session.setDesign({ dataURL: uploadedDataURL, tab: activeDesignTab, source: activeDesignTab });
    navigateTo('review');
  });

  // FABRIC.JS INTEGRATIEPUNT: initialiseer tool als tab al actief is
  // if (activeDesignTab === 'tool') initFabric();
}

function handleUpload(file) {
  uploadedFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    uploadedDataURL = ev.target.result;
    Session.setDesign({ dataURL: uploadedDataURL, fileName: file.name, tab: 'upload', source: 'upload' });
    // Herrender de pagina om de preview te tonen
    renderDesignPage();
  };
  reader.readAsDataURL(file);
}

function clearUpload() {
  uploadedFile    = null;
  uploadedDataURL = null;
  Session.setDesign({ dataURL: null, fileName: null, tab: 'upload', source: null });
  renderDesignPage();
}

/*
 * FABRIC.JS INTEGRATIEPUNT — initFabric()
 * Uncomment en pas aan als fabric.min.js en tool.js beschikbaar zijn:
 *
function initFabric() {
  const product = Session.getProduct();
  const options = Session.getOptions();
  const mount   = document.getElementById('fabric-mount');
  if (!mount || !product) return;

  mount.innerHTML = '<canvas id="c"></canvas>';

  const CANVAS_W = product.canvas_display_width  || 500;
  const CANVAS_H = product.canvas_display_height || 350;
  let   MARGIN   = product.margin_px * (CANVAS_W / product.width_px);

  const canvas = new fabric.Canvas('c', {
    width: CANVAS_W,
    height: CANVAS_H,
    backgroundColor: '#ffffff'
  });

  // Laad personalisatieafbeelding als achtergrond
  const images = [product.imageProduct, product.imagePersonalize1, product.imagePersonalize2].filter(Boolean);
  const bgImg  = images[options?.activeImageIdx || 0];
  if (bgImg) {
    fabric.Image.fromURL(bgImg, img => {
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
        scaleX: CANVAS_W / img.width,
        scaleY: CANVAS_H / img.height,
      });
    });
  }

  // Exportmultiplier voor 300 DPI
  const exportMultiplier = product.width_px / CANVAS_W;

  // Sla canvas op in sessie bij "Verder"
  document.getElementById('btn-design-next').addEventListener('click', () => {
    const dataURL = canvas.toDataURL({ format: 'png', multiplier: exportMultiplier });
    Session.setDesign({ dataURL, tab: 'tool', source: 'fabric' });
  }, { once: true });
}
*/

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

window.clearUpload = clearUpload;
