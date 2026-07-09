/**
 * flow.js
 * SPA router + klikbare progress bar
 * Progressbar + sessie volledig gereset na afronding bestelling.
 * Stap 3 Ontwerp wordt geblokkeerd wanneer gekozen is voor Laat ons ontwerpen.
 * Wacht op DS.init() voordat de flow rendert, zodat producten uit Supabase beschikbaar zijn.
 */

const STEPS = [
  { hash: 'select', label: 'Product', render: renderSelectPage },
  { hash: 'options', label: 'Opties', render: renderOptionsPage },
  { hash: 'design', label: 'Ontwerp', render: renderDesignPage },
  { hash: 'wensen', label: 'Wensen', render: renderWensenPage },
  { hash: 'review', label: 'Bestellen', render: renderReviewPage },
];

let currentStep = 0;
let highestStep = 0;
let flowInitialized = false;
let isNavigating = false;

async function initCustomerFlow() {
  if (flowInitialized) {
    return;
  }

  showInitialLoadingState();

  if (typeof DS !== 'undefined' && typeof DS.init === 'function') {
    await DS.init();
  }

  if (typeof DS !== 'undefined' && typeof DS.seedDemoData === 'function') {
    DS.seedDemoData();
  }

  flowInitialized = true;
}

function showInitialLoadingState() {
  const selectPage = document.getElementById('page-select');

  if (!selectPage) {
    return;
  }

  selectPage.innerHTML = `
    <h1 class="page-title">Kies uw product</h1>
    <p class="page-subtitle">Selecteer het product dat u wilt personaliseren</p>

    <div class="empty-state">
      <div class="empty-state-icon">📦</div>
      <h3>Producten laden...</h3>
      <p>Een moment geduld.</p>
    </div>
  `;
}

function canNavigateToStep(hash) {
  const options = Session.getOptions();

  if (hash === 'design' && options?.designChoice === 'laat-ontwerpen') {
    return false;
  }

  return true;
}

function getFallbackStep(hash) {
  const options = Session.getOptions();

  if (hash === 'design' && options?.designChoice === 'laat-ontwerpen') {
    return 'wensen';
  }

  return 'select';
}

async function navigate(hash) {
  if (isNavigating) {
    return;
  }

  isNavigating = true;

  try {
    if (!flowInitialized) {
      await initCustomerFlow();
    }

    const targetHash = hash || 'select';
    const idx = STEPS.findIndex(step => step.hash === targetHash);

    if (idx === -1) {
      await navigate('select');
      return;
    }

    if (!canNavigateToStep(targetHash)) {
      const fallbackHash = getFallbackStep(targetHash);
      const fallbackIdx = STEPS.findIndex(step => step.hash === fallbackHash);

      if (fallbackIdx !== -1 && fallbackIdx <= highestStep) {
        await navigate(fallbackHash);
        return;
      }

      await navigate('options');
      return;
    }

    if (idx > highestStep) {
      return;
    }

    currentStep = idx;

    document.querySelectorAll('.flow-page').forEach(el => {
      el.classList.remove('active');
    });

    const pageEl = document.getElementById(`page-${targetHash}`);

    if (pageEl) {
      pageEl.classList.add('active');
    }

    await STEPS[idx].render();
    renderProgressBar(idx);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    history.replaceState(null, '', `#${targetHash}`);
  } finally {
    isNavigating = false;
  }
}

async function navigateTo(hash) {
  const idx = STEPS.findIndex(step => step.hash === hash);

  if (idx === -1) {
    return;
  }

  if (!canNavigateToStep(hash)) {
    const fallbackHash = getFallbackStep(hash);
    const fallbackIdx = STEPS.findIndex(step => step.hash === fallbackHash);

    if (fallbackIdx !== -1 && fallbackIdx > highestStep) {
      highestStep = fallbackIdx;
    }

    await navigate(fallbackHash);
    return;
  }

  if (idx > highestStep) {
    highestStep = idx;
  }

  await navigate(hash);
}

async function resetFlow() {
  currentStep = 0;
  highestStep = 0;

  if (typeof Session !== 'undefined') {
    Session.clear();
  }

  if (typeof fabricCanvas !== 'undefined' && fabricCanvas) {
    try {
      fabricCanvas.dispose();
    } catch {
      // Fabric opruimen mag stil falen bij reset.
    }
  }

  window.fabricCanvas = null;

  const progressWrap = document.querySelector('.progress-wrap');

  if (progressWrap) {
    progressWrap.style.display = '';
  }

  document.querySelectorAll('.flow-page').forEach(el => {
    el.classList.remove('active');
  });

  await navigateTo('select');
}

function renderProgressBar(activeIdx) {
  const bar = document.getElementById('progress-bar');

  if (!bar) {
    return;
  }

  const options = Session.getOptions();
  const showWensen = options?.designChoice === 'laat-ontwerpen';

  const visibleSteps = STEPS.filter(step => {
    if (step.hash === 'wensen') {
      return showWensen;
    }

    return true;
  });

  bar.innerHTML = visibleSteps.map((step, i) => {
    const globalIdx = STEPS.findIndex(item => item.hash === step.hash);
    const isDone = globalIdx < activeIdx;
    const isActive = globalIdx === activeIdx;
    const isVisited = globalIdx < highestStep || isDone;
    const isBlocked = !canNavigateToStep(step.hash);
    const cls = [
      isDone ? 'done' : '',
      isActive ? 'active' : '',
      isBlocked ? 'disabled' : '',
    ].filter(Boolean).join(' ');

    const clickable = isVisited && !isActive && !isBlocked;

    const line = i < visibleSteps.length - 1
      ? `<div class="step-line ${isDone ? 'done' : ''}"></div>`
      : '';

    return `
      <div class="progress-step ${cls}">
        <div class="step-wrap">
          <button class="step-circle ${clickable ? 'step-clickable' : ''}"
                  type="button"
                  data-step="${escHtml(step.hash)}"
                  ${clickable ? `title="Naar ${escHtml(step.label)}"` : ''}
                  ${isBlocked ? 'aria-disabled="true"' : ''}>
            ${isDone ? checkIcon() : i + 1}
          </button>
          <div class="step-label">${escHtml(step.label)}</div>
        </div>
      </div>${line}
    `;
  }).join('');

  bar.querySelectorAll('.step-circle[data-step]').forEach(button => {
    button.addEventListener('click', async () => {
      const step = button.dataset.step;

      if (!step || button.getAttribute('aria-disabled') === 'true') {
        return;
      }

      await navigate(step);
    });
  });
}

function checkIcon() {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 7L5.5 10.5L12 3.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

document.addEventListener('DOMContentLoaded', async () => {
  const hash = location.hash.replace('#', '') || 'select';
  await navigate(hash);
});

window.addEventListener('hashchange', async () => {
  await navigate(location.hash.replace('#', ''));
});

window.navigate = navigate;
window.navigateTo = navigateTo;
window.resetFlow = resetFlow;