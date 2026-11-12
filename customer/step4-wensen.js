/**
 * step4-wensen.js
 * Stap 4: Wensenformulier (alleen voor "Laat ons ontwerpen")
 *
 * - Getypte tekst blijft behouden als er een referentiebeeld wordt
 *   toegevoegd of verwijderd (het formulier wordt eerst uitgelezen).
 * - Het referentiebeeld gaat via Session naar IndexedDB, zodat grote
 *   bestanden de sessionStorage-limiet niet raken.
 */

async function renderWensenPage() {
  const el = document.getElementById('page-wensen');

  if (!el) {
    return;
  }

  if (typeof Session.hydrateWensen === 'function') {
    await Session.hydrateWensen();
  }

  const saved = Session.getWensen() || {};

  const stijlOpties = ['Speels', 'Zakelijk', 'Minimalistisch', 'Anders'];

  el.innerHTML = `
    <h1 class="page-title">Vertel ons uw wensen</h1>
    <p class="page-subtitle">Onze designers gaan voor u aan de slag — hoe meer details, hoe beter!</p>

    <div class="wensen-form">

      <div class="form-group">
        <label>Gewenste tekst of boodschap</label>
        <textarea id="w-tekst" placeholder="Bijv. 'Gefeliciteerd met jullie huwelijk! — Familie Jansen'">${escHtml(saved.tekst || '')}</textarea>
        <span class="form-hint">Voer de exacte tekst in die op het product moet komen</span>
      </div>

      <div class="form-group">
        <label>Kleurvoorkeur</label>
        <input type="text" id="w-kleur" value="${escHtml(saved.kleur || '')}" placeholder="Bijv. groen en goud, of: gebruik onze huiskleuren">
      </div>

      <div class="form-group">
        <label>Stijlvoorkeur</label>
        <div class="style-options" id="style-options">
          ${stijlOpties.map(s => `
            <div class="style-option ${saved.stijl === s ? 'selected' : ''}" data-stijl="${escHtml(s)}">${escHtml(s)}</div>
          `).join('')}
        </div>
      </div>

      <div class="form-group">
        <label>Referentieafbeelding <span style="color:var(--text-3);font-weight:400">(optioneel)</span></label>
        <div class="upload-zone" id="ref-upload-zone" style="padding:24px">
          <input type="file" id="ref-upload-input" accept="image/*,.pdf">
          <div class="upload-icon" style="font-size:24px">📎</div>
          <div class="upload-title" style="font-size:14px">Sleep of klik om een referentieafbeelding te uploaden</div>
        </div>
        <div id="ref-upload-error" role="alert" style="display:none;margin-top:8px;font-size:13px;color:var(--danger)"></div>
        ${saved.refFileName ? `
          <div style="margin-top:8px;font-size:13px;color:var(--green-dark);background:var(--green-light);padding:8px 12px;border-radius:var(--radius-sm);display:flex;justify-content:space-between">
            <span>📎 ${escHtml(saved.refFileName)}</span>
            <button type="button" onclick="clearRefUpload()" aria-label="Referentieafbeelding verwijderen" style="background:none;border:none;cursor:pointer;color:var(--danger)">×</button>
          </div>
        ` : ''}
      </div>

      <div class="form-group">
        <label>Aanvullende opmerkingen <span style="color:var(--text-3);font-weight:400">(optioneel)</span></label>
        <textarea id="w-opmerkingen" placeholder="Overige wensen, deadline, speciale verzoeken...">${escHtml(saved.opmerkingen || '')}</textarea>
      </div>

    </div>

    <div class="flow-nav">
      <button class="btn btn-outline" type="button" id="btn-wensen-back">← Terug</button>
      <button class="btn btn-green" type="button" id="btn-wensen-next">Verder →</button>
    </div>
  `;

  // Stijl opties selecteren
  el.querySelectorAll('.style-option').forEach(opt => {
    opt.addEventListener('click', () => {
      el.querySelectorAll('.style-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  // Referentie upload
  const refZone = document.getElementById('ref-upload-zone');
  const refInput = document.getElementById('ref-upload-input');

  refZone.addEventListener('click', event => {
    // Voorkom dubbele dialoog als er direct op het (verborgen) input-element geklikt wordt.
    if (event.target !== refInput) {
      refInput.click();
    }
  });

  refZone.addEventListener('dragover', e => {
    e.preventDefault();
    refZone.classList.add('dragover');
  });

  refZone.addEventListener('dragleave', () => {
    refZone.classList.remove('dragover');
  });

  refZone.addEventListener('drop', e => {
    e.preventDefault();
    refZone.classList.remove('dragover');

    const file = e.dataTransfer.files[0];

    if (file) {
      handleRefUpload(file);
    }
  });

  refInput.addEventListener('change', e => {
    if (e.target.files[0]) {
      handleRefUpload(e.target.files[0]);
    }
  });

  // Terug: bewaar eerst wat er getypt is
  document.getElementById('btn-wensen-back')?.addEventListener('click', async () => {
    await Session.setWensen(collectWensen(el));
    navigateTo('options');
  });

  // Verder
  document.getElementById('btn-wensen-next')?.addEventListener('click', async event => {
    const button = event.currentTarget;

    if (button.disabled) {
      return;
    }

    button.disabled = true;

    try {
      await Session.setWensen(collectWensen(el));
      await navigateTo('review');
    } finally {
      button.disabled = false;
    }
  });
}

/**
 * Leest het formulier uit zoals het NU op het scherm staat,
 * plus het bestaande referentiebeeld.
 */
function collectWensen(el) {
  const saved = Session.getWensen() || {};
  const selectedStijl = el?.querySelector('.style-option.selected')?.dataset.stijl || saved.stijl || '';

  return {
    tekst: document.getElementById('w-tekst')?.value.trim() || '',
    kleur: document.getElementById('w-kleur')?.value.trim() || '',
    stijl: selectedStijl,
    opmerkingen: document.getElementById('w-opmerkingen')?.value.trim() || '',
    refFileName: saved.refFileName || null,
    refDataURL: saved.refDataURL || null,
  };
}

function showRefUploadError(message) {
  const error = document.getElementById('ref-upload-error');

  if (!error) {
    return;
  }

  error.textContent = message || '';
  error.style.display = message ? 'block' : 'none';
}

function handleRefUpload(file) {
  const el = document.getElementById('page-wensen');

  // Formulier uitlezen VÓÓR het opnieuw renderen, anders gaat getypte tekst verloren.
  const current = collectWensen(el);

  showRefUploadError('');

  const reader = new FileReader();

  reader.onload = async ev => {
    await Session.setWensen({
      ...current,
      refFileName: file.name,
      refDataURL: ev.target.result,
    });

    await renderWensenPage();
  };

  reader.onerror = () => {
    console.warn('Referentiebeeld lezen mislukt', reader.error);
    showRefUploadError('Het bestand kon niet worden gelezen. Probeer het opnieuw of kies een ander bestand.');
  };

  reader.readAsDataURL(file);
}

async function clearRefUpload() {
  const el = document.getElementById('page-wensen');
  const current = collectWensen(el);

  await Session.setWensen({
    ...current,
    refFileName: null,
    refDataURL: null,
  });

  await renderWensenPage();
}

window.clearRefUpload = clearRefUpload;