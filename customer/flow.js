/**
 * flow.js
 * SPA-router met klikbare voortgangsbalk.
 * Wacht op databronnen en opgeslagen ontwerpdata voordat een stap wordt gerenderd.
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
let pendingNavigationHash = null;

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

  if (
    typeof Session !== 'undefined' &&
    typeof Session.hydrateDesign === 'function'
  ) {
    await Session.hydrateDesign();
  }

  synchronizeHighestStepFromSession();

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

function synchronizeHighestStepFromSession() {
  if (typeof Session === 'undefined') {
    highestStep = Math.max(
      highestStep,
      0
    );

    return;
  }

  const product = Session.getProduct();
  const options = Session.getOptions();
  const design = Session.getDesign();
  const wensen = Session.getWensen();

  let derivedHighestStep = 0;

  if (product) {
    derivedHighestStep = 1;
  }

  if (product && options) {
    derivedHighestStep =
      options.designChoice === 'laat-ontwerpen'
        ? 3
        : 2;
  }

  if (
    product &&
    options?.designChoice !== 'laat-ontwerpen' &&
    design
  ) {
    derivedHighestStep = 4;
  }

  if (
    product &&
    options?.designChoice === 'laat-ontwerpen' &&
    wensen
  ) {
    derivedHighestStep = 4;
  }

  highestStep = Math.max(
    highestStep,
    derivedHighestStep
  );
}

function canNavigateToStep(hash) {
  const options = Session.getOptions();

  if (
    hash === 'design' &&
    options?.designChoice === 'laat-ontwerpen'
  ) {
    return false;
  }

  return true;
}

function getFallbackStep(hash) {
  const options = Session.getOptions();

  if (
    hash === 'design' &&
    options?.designChoice === 'laat-ontwerpen'
  ) {
    return 'wensen';
  }

  return 'select';
}

function normalizeNavigationTarget(hash) {
  const requestedHash = hash || 'select';

  const requestedIndex = STEPS.findIndex(
    step => step.hash === requestedHash
  );

  if (requestedIndex === -1) {
    return {
      hash: 'select',
      index: 0,
    };
  }

  if (!canNavigateToStep(requestedHash)) {
    const fallbackHash = getFallbackStep(requestedHash);

    const fallbackIndex = STEPS.findIndex(
      step => step.hash === fallbackHash
    );

    if (
      fallbackIndex !== -1 &&
      fallbackIndex <= highestStep
    ) {
      return {
        hash: fallbackHash,
        index: fallbackIndex,
      };
    }

    return {
      hash: 'options',
      index: 1,
    };
  }

  return {
    hash: requestedHash,
    index: requestedIndex,
  };
}

async function renderNavigationTarget(hash) {
  if (!flowInitialized) {
    await initCustomerFlow();
  }

  if (
    typeof Session !== 'undefined' &&
    typeof Session.hydrateDesign === 'function'
  ) {
    await Session.hydrateDesign();
  }

  synchronizeHighestStepFromSession();

  const target = normalizeNavigationTarget(hash);

  if (target.index > highestStep) {
    return;
  }

  currentStep = target.index;

  document
    .querySelectorAll('.flow-page')
    .forEach(element => {
      element.classList.remove('active');
    });

  const pageElement = document.getElementById(
    `page-${target.hash}`
  );

  if (pageElement) {
    pageElement.classList.add('active');
  }

  await STEPS[target.index].render();

  renderProgressBar(
    target.index
  );

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });

  history.replaceState(
    null,
    '',
    `#${target.hash}`
  );
}

async function navigate(hash) {
  const targetHash = hash || 'select';

  if (isNavigating) {
    pendingNavigationHash = targetHash;
    return;
  }

  isNavigating = true;

  try {
    let nextHash = targetHash;

    while (nextHash) {
      pendingNavigationHash = null;

      await renderNavigationTarget(
        nextHash
      );

      nextHash = pendingNavigationHash;
    }
  } finally {
    isNavigating = false;
  }
}

async function navigateTo(hash) {
  const index = STEPS.findIndex(
    step => step.hash === hash
  );

  if (index === -1) {
    return;
  }

  if (!canNavigateToStep(hash)) {
    const fallbackHash = getFallbackStep(hash);

    const fallbackIndex = STEPS.findIndex(
      step => step.hash === fallbackHash
    );

    if (
      fallbackIndex !== -1 &&
      fallbackIndex > highestStep
    ) {
      highestStep = fallbackIndex;
    }

    await navigate(
      fallbackHash
    );

    return;
  }

  if (index > highestStep) {
    highestStep = index;
  }

  await navigate(
    hash
  );
}

async function resetFlow() {
  currentStep = 0;
  highestStep = 0;
  pendingNavigationHash = null;

  if (typeof Session !== 'undefined') {
    await Promise.resolve(
      Session.clear()
    );
  }

  if (
    typeof fabricCanvas !== 'undefined' &&
    fabricCanvas
  ) {
    try {
      fabricCanvas.dispose();
    } catch {
      // Een reeds opgeruimd Fabric-canvas mag een flowreset niet blokkeren.
    }
  }

  window.fabricCanvas = null;

  const progressWrap = document.querySelector(
    '.progress-wrap'
  );

  if (progressWrap) {
    progressWrap.style.display = '';
  }

  document
    .querySelectorAll('.flow-page')
    .forEach(element => {
      element.classList.remove('active');
    });

  await navigateTo(
    'select'
  );
}

function renderProgressBar(activeIndex) {
  const bar = document.getElementById(
    'progress-bar'
  );

  if (!bar) {
    return;
  }

  const options = Session.getOptions();

  const showWensen =
    options?.designChoice === 'laat-ontwerpen';

  const visibleSteps = STEPS.filter(step => {
    if (step.hash === 'wensen') {
      return showWensen;
    }

    return true;
  });

  bar.innerHTML = visibleSteps
    .map((step, visibleIndex) => {
      const globalIndex = STEPS.findIndex(
        item => item.hash === step.hash
      );

      const isDone =
        globalIndex < activeIndex;

      const isActive =
        globalIndex === activeIndex;

      const isVisited =
        globalIndex < highestStep ||
        isDone;

      const isBlocked =
        !canNavigateToStep(step.hash);

      const className = [
        isDone ? 'done' : '',
        isActive ? 'active' : '',
        isBlocked ? 'disabled' : '',
      ]
        .filter(Boolean)
        .join(' ');

      const clickable =
        isVisited &&
        !isActive &&
        !isBlocked;

      const line =
        visibleIndex < visibleSteps.length - 1
          ? `<div class="step-line ${isDone ? 'done' : ''}"></div>`
          : '';

      return `
        <div class="progress-step ${className}">
          <div class="step-wrap">
            <button
              class="step-circle ${clickable ? 'step-clickable' : ''}"
              type="button"
              data-step="${escHtml(step.hash)}"
              ${clickable ? `title="Naar ${escHtml(step.label)}"` : ''}
              ${isBlocked ? 'aria-disabled="true"' : ''}
            >
              ${isDone ? checkIcon() : visibleIndex + 1}
            </button>

            <div class="step-label">
              ${escHtml(step.label)}
            </div>
          </div>
        </div>

        ${line}
      `;
    })
    .join('');

  bar
    .querySelectorAll('.step-circle[data-step]')
    .forEach(button => {
      button.addEventListener(
        'click',
        async () => {
          const step = button.dataset.step;

          if (
            !step ||
            button.getAttribute('aria-disabled') === 'true'
          ) {
            return;
          }

          await navigate(
            step
          );
        }
      );
    });
}

function checkIcon() {
  return `
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2 7L5.5 10.5L12 3.5"
        stroke="white"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `;
}

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

document.addEventListener(
  'DOMContentLoaded',
  async () => {
    const hash =
      location.hash.replace('#', '') ||
      'select';

    await navigate(
      hash
    );
  }
);

window.addEventListener(
  'hashchange',
  async () => {
    await navigate(
      location.hash.replace('#', '')
    );
  }
);

window.navigate = navigate;
window.navigateTo = navigateTo;
window.resetFlow = resetFlow;