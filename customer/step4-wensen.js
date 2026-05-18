/**
 * step4-wensen.js
 * Stap 4: Wensenformulier (alleen voor "Laat ons ontwerpen")
 */

function renderWensenPage() {
  const el    = document.getElementById('page-wensen');
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
            <div class="style-option ${saved.stijl === s ? 'selected' : ''}" data-stijl="${s}">${s}</div>
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
        ${saved.refFileName ? `
          <div style="margin-top:8px;font-size:13px;color:var(--green-dark);background:var(--green-light);padding:8px 12px;border-radius:var(--radius-sm);display:flex;justify-content:space-between">
            <span>📎 ${escHtml(saved.refFileName)}</span>
            <button onclick="clearRefUpload()" style="background:none;border:none;cursor:pointer;color:var(--danger)">×</button>
          </div>
        ` : ''}
      </div>

      <div class="form-group">
        <label>Aanvullende opmerkingen <span style="color:var(--text-3);font-weight:400">(optioneel)</span></label>
        <textarea id="w-opmerkingen" placeholder="Overige wensen, deadline, speciale verzoeken...">${escHtml(saved.opmerkingen || '')}</textarea>
      </div>

    </div>

    <div class="flow-nav">
      <button class="btn btn-outline" onclick="navigateTo('options')">← Terug</button>
      <button class="btn btn-green" id="btn-wensen-next">Verder →</button>
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
  const refZone  = document.getElementById('ref-upload-zone');
  const refInput = document.getElementById('ref-upload-input');

  refZone.addEventListener('click',     () => refInput.click());
  refZone.addEventListener('dragover',  e => { e.preventDefault(); refZone.classList.add('dragover'); });
  refZone.addEventListener('dragleave', () => refZone.classList.remove('dragover'));
  refZone.addEventListener('drop', e => {
    e.preventDefault();
    refZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleRefUpload(file);
  });
  refInput.addEventListener('change', e => {
    if (e.target.files[0]) handleRefUpload(e.target.files[0]);
  });

  // Verder
  document.getElementById('btn-wensen-next')?.addEventListener('click', () => {
    const wensen = collectWensen(el);
    Session.setWensen(wensen);
    navigateTo('review');
  });
}

function collectWensen(el) {
  const saved      = Session.getWensen() || {};
  const selectedStijl = el.querySelector('.style-option.selected')?.dataset.stijl || '';
  return {
    tekst:       document.getElementById('w-tekst')?.value.trim()       || '',
    kleur:       document.getElementById('w-kleur')?.value.trim()       || '',
    stijl:       selectedStijl,
    opmerkingen: document.getElementById('w-opmerkingen')?.value.trim() || '',
    refFileName: saved.refFileName || null,
    refDataURL:  saved.refDataURL  || null,
  };
}

function handleRefUpload(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    const current = Session.getWensen() || {};
    Session.setWensen({ ...current, refFileName: file.name, refDataURL: ev.target.result });
    renderWensenPage();
  };
  reader.readAsDataURL(file);
}

function clearRefUpload() {
  const current = Session.getWensen() || {};
  Session.setWensen({ ...current, refFileName: null, refDataURL: null });
  renderWensenPage();
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

window.clearRefUpload = clearRefUpload;
