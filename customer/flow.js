/**
 * flow.js
 * SPA router + progress bar voor de klantflow.
 */

const STEPS = [
  { hash: 'select', label: 'Product',  render: renderSelectPage  },
  { hash: 'options',label: 'Opties',   render: renderOptionsPage  },
  { hash: 'design', label: 'Ontwerp',  render: renderDesignPage   },
  { hash: 'wensen', label: 'Wensen',   render: renderWensenPage   },
  { hash: 'review', label: 'Bestellen',render: renderReviewPage   },
];

let currentStep = 0;

function navigate(hash) {
  const idx = STEPS.findIndex(s => s.hash === hash);
  if (idx === -1) return navigate('select');
  currentStep = idx;

  // Verberg alle pagina's
  document.querySelectorAll('.flow-page').forEach(el => el.classList.remove('active'));

  // Activeer de juiste pagina
  const pageId = hash === 'confirm' ? 'page-confirm' : `page-${hash}`;
  const pageEl = document.getElementById(pageId);
  if (pageEl) pageEl.classList.add('active');

  // Render inhoud
  STEPS[idx].render();

  // Update progress bar
  renderProgressBar(idx);

  // Scroll naar top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Update hash zonder history entry te pushen
  history.replaceState(null, '', `#${hash}`);
}

function navigateTo(hash) {
  navigate(hash);
}

function renderProgressBar(activeIdx) {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;

  // Stap 3 (wensen) is conditioneel — toon alleen als "Laat ons ontwerpen"
  const options = Session.getOptions();
  const showWensen = options?.designChoice === 'laat-ontwerpen';

  const visibleSteps = STEPS.filter((s, i) => {
    if (s.hash === 'wensen') return showWensen;
    return true;
  });

  bar.innerHTML = visibleSteps.map((step, i) => {
    const globalIdx = STEPS.findIndex(s => s.hash === step.hash);
    let cls = globalIdx < activeIdx ? 'done' : globalIdx === activeIdx ? 'active' : '';
    const line = i < visibleSteps.length - 1
      ? `<div class="step-line ${globalIdx < activeIdx ? 'done' : ''}"></div>`
      : '';

    return `
      <div class="progress-step ${cls}">
        <div class="step-wrap">
          <div class="step-circle">${globalIdx < activeIdx ? '✓' : i + 1}</div>
          <div class="step-label">${step.label}</div>
        </div>
      </div>
      ${line}
    `;
  }).join('');
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  // SHOPIFY INTEGRATIEPUNT: laad demo-data als er nog geen products zijn
  if (typeof DS !== 'undefined') DS.seedDemoData();

  const hash = location.hash.replace('#', '') || 'select';
  navigate(hash);
});

window.addEventListener('hashchange', () => {
  const hash = location.hash.replace('#', '');
  navigate(hash);
});

window.navigateTo = navigateTo;
