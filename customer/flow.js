/**
 * flow.js
 * SPA router + klikbare progress bar
 * Punt 1: bezochte stappen zijn klikbaar, vooruit navigeren geblokkeerd
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

function navigate(hash) {
  const idx = STEPS.findIndex(s => s.hash === hash);
  if (idx === -1) return navigate('select');
  if (idx > highestStep) return; // blokkeer vooruit navigeren

  currentStep = idx;

  document.querySelectorAll('.flow-page').forEach(el => el.classList.remove('active'));
  const pageEl = document.getElementById('page-' + hash);
  if (pageEl) pageEl.classList.add('active');

  STEPS[idx].render();
  renderProgressBar(idx);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  history.replaceState(null, '', '#' + hash);
}

function navigateTo(hash) {
  const idx = STEPS.findIndex(s => s.hash === hash);
  if (idx !== -1 && idx > highestStep) highestStep = idx;
  navigate(hash);
}

function renderProgressBar(activeIdx) {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;

  const options = Session.getOptions();
  const showWensen = options?.designChoice === 'laat-ontwerpen';

  const visibleSteps = STEPS.filter(s => s.hash !== 'wensen' || showWensen);

  bar.innerHTML = visibleSteps.map((step, i) => {
    const globalIdx = STEPS.findIndex(s => s.hash === step.hash);
    const isDone = globalIdx < activeIdx;
    const isActive = globalIdx === activeIdx;
    const isVisited = globalIdx < highestStep || isDone;
    const cls = isDone ? 'done' : isActive ? 'active' : '';
    const clickable = isVisited && !isActive;
    const line = i < visibleSteps.length - 1
      ? `<div class="step-line ${isDone ? 'done' : ''}"></div>`
      : '';

    return `
      <div class="progress-step ${cls}">
        <div class="step-wrap">
          <div class="step-circle ${clickable ? 'step-clickable' : ''}"
               ${clickable ? `onclick="navigate('${step.hash}')" title="Naar ${step.label}"` : ''}>
            ${isDone ? '✓' : i + 1}
          </div>
          <div class="step-label">${step.label}</div>
        </div>
      </div>${line}
    `;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof DS !== 'undefined') DS.seedDemoData();
  const hash = location.hash.replace('#', '') || 'select';
  navigate(hash);
});

window.addEventListener('hashchange', () => navigate(location.hash.replace('#', '')));
window.navigate = navigate;
window.navigateTo = navigateTo;