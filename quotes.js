// ============================================================
// quotes.js — Devis : pipeline, modal, catalogue, calcul, PDF
// ============================================================

let quotesData = [];
let catalogueData = [];

// ============================================================
// RENDER PRINCIPAL
// ============================================================

async function renderQuotes() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <div>
        <h1 style="margin:0;font-family:var(--font-head);font-size:24px;font-weight:600;">Devis</h1>
        <p style="margin:4px 0 0;font-size:13px;color:var(--muted);" id="quotes-subtitle">Chargement…</p>
      </div>
      <div style="display:flex;gap:8px;">
        <select id="quotes-filter-status" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:var(--font-body);background:var(--surface);">
          <option value="">Tous les statuts</option>
          ${CONFIG.QUOTE_STATUSES.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <button id="btn-add-quote" class="btn-primary" style="padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;">
          <i class="fas fa-plus"></i> Nouveau devis
        </button>
      </div>
    </div>
    <div id="quotes-pipeline" style="display:flex;gap:16px;overflow-x:auto;padding-bottom:16px;min-height:400px;"></div>
  `;

  document.getElementById('btn-add-quote')?.addEventListener('click', () => openQuoteModal());
  document.getElementById('quotes-filter-status')?.addEventListener('change', renderQuotesPipeline);

  await loadQuotesData();
}

async function loadQuotesData() {
  Loader.show();
  try {
    [quotesData, catalogueData] = await Promise.all([
      CRM.getQuotes(),
      CRM.getCatalogue(),
    ]);
    const sub = document.getElementById('quotes-subtitle');
    if (sub) sub.textContent = `${quotesData.length} devis`;
    renderQuotesPipeline();
  } catch (err) {
    console.error('[Quotes] Erreur:', err);
    Toast.error('Erreur de chargement des devis');
  } finally {
    Loader.hide();
  }
}

// ============================================================
// PIPELINE DEVIS (colonnes)
// ============================================================

function renderQuotesPipeline() {
  const container = document.getElementById('quotes-pipeline');
  if (!container) return;
  container.innerHTML = '';

  const filterStatus = document.getElementById('quotes-filter-status')?.value || '';

  const statusColors = {
    'Brouillon':   { header: 'var(--muted)',    bg: 'var(--surface2)' },
    'Envoyé':      { header: 'var(--progress)', bg: 'var(--progress-soft)' },
    'Négociation': { header: 'var(--warning)',  bg: 'var(--warning-soft)' },
    'Signé':       { header: 'var(--won)',      bg: 'var(--won-soft)' },
    'Refusé':      { header: 'var(--urgent)',   bg: 'var(--urgent-soft)' },
  };

  const statuses = filterStatus ? [filterStatus] : CONFIG.QUOTE_STATUSES;

  statuses.forEach(status => {
    const col = statusColors[status] || { header: 'var(--muted)', bg: 'var(--surface2)' };
    const quotes = quotesData.filter(q => q.status === status);
    const total = quotes.reduce((s, q) => s + (q.total_ttc || 0), 0);

    const column = document.createElement('div');
    column.style.cssText = `
      min-width:260px;width:260px;flex-shrink:0;
      background:var(--surface2);border-radius:var(--radius);
      display:flex;flex-direction:column;max-height:calc(100vh - 240px);
    `;

    column.innerHTML = `
      <div style="padding:14px 16px 10px;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid ${col.header};">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:600;font-size:14px;">${status}</span>
          <span style="background:${col.bg};color:${col.header};font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;">${quotes.length}</span>
        </div>
        <span style="font-size:12px;color:var(--muted);font-weight:500;">${Fmt.currency(total)}</span>
      </div>
      <div style="flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px;">
        ${quotes.length ? quotes.map(q => quoteCardHtml(q)).join('') : `<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px;">Aucun devis</div>`}
      </div>
    `;

    container.appendChild(column);
  });

  // Bind cards
  container.querySelectorAll('.quote-card').forEach(card => {
    card.addEventListener('click', () => {
      const qId = card.dataset.quoteId;
      const quote = quotesData.find(q => q.id === qId);
      if (quote) openQuoteModal(quote);
    });
  });
}

function quoteCardHtml(q) {
  // Relance alerts
  let relanceAlert = '';
  if (q.status === 'Envoyé' && q.sent_at) {
    const daysSinceSent = Math.round((new Date() - new Date(q.sent_at)) / (1000 * 60 * 60 * 24));
    if (daysSinceSent >= 14) relanceAlert = `<div style="font-size:11px;color:var(--urgent);margin-top:4px;"><i class="fas fa-exclamation-triangle"></i> J+${daysSinceSent} — relance urgente</div>`;
    else if (daysSinceSent >= 7) relanceAlert = `<div style="font-size:11px;color:var(--warning);margin-top:4px;"><i class="fas fa-clock"></i> J+${daysSinceSent} — relancer</div>`;
    else if (daysSinceSent >= 3) relanceAlert = `<div style="font-size:11px;color:var(--muted);margin-top:4px;"><i class="fas fa-clock"></i> J+${daysSinceSent}</div>`;
  }

  return `
    <div class="quote-card" data-quote-id="${q.id}" style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;cursor:pointer;transition:box-shadow 0.15s;">
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div style="font-weight:600;font-size:13px;color:var(--accent);">${q.quote_number}</div>
        <div style="font-weight:600;font-size:14px;">${Fmt.currency(q.total_ttc)}</div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px;">${Fmt.date(q.created_at)}</div>
      ${q.valid_until ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;">Valide jusqu'au ${Fmt.date(q.valid_until)}</div>` : ''}
      ${relanceAlert}
    </div>
  `;
}

// ============================================================
// MODAL CRÉATION / ÉDITION DEVIS
// ============================================================

async function openQuoteModal(quote = null) {
  const isEdit = !!quote;
  const companies = await CRM.getCompanies();
  const catalogue = catalogueData.length ? catalogueData : await CRM.getCatalogue();
  let quoteNumber = quote?.quote_number || await CRM.getNextQuoteNumber();

  // Lignes existantes ou vide
  let lines = [];
  if (quote?.lines) {
    lines = typeof quote.lines === 'string' ? JSON.parse(quote.lines) : quote.lines;
  }

  const companyOptions = companies.map(c =>
    `<option value="${c.id}" ${quote?.company_id === c.id ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  const statusOptions = CONFIG.QUOTE_STATUSES.map(s =>
    `<option value="${s}" ${quote?.status === s ? 'selected' : ''}>${s}</option>`
  ).join('');

  const catalogueOptions = catalogue.map(item =>
    `<option value="${item.id}" data-price="${item.price_ht}" data-name="${item.name}">${item.name} — ${Fmt.currency(item.price_ht)} HT</option>`
  ).join('');

  const validUntil = quote?.valid_until || new Date(Date.now() + CONFIG.QUOTE_VALIDITY_DAYS * 86400000).toISOString().split('T')[0];

  const content = `
    <div style="display:grid;gap:16px;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">N° Devis</label>
          <input type="text" id="q-number" class="form-input" value="${quoteNumber}" readonly style="background:var(--surface2);">
        </div>
        <div>
          <label class="form-label">Entreprise</label>
          <select id="q-company" class="form-input">
            <option value="">— Sélectionner —</option>
            ${companyOptions}
          </select>
        </div>
        <div>
          <label class="form-label">Statut</label>
          <select id="q-status" class="form-input">${statusOptions}</select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Validité jusqu'au</label>
          <input type="date" id="q-valid" class="form-input" value="${Fmt.dateInput(validUntil)}">
        </div>
        <div>
          <label class="form-label">Remise globale (%)</label>
          <input type="number" id="q-discount" class="form-input" value="${quote?.discount_global || 0}" min="0" max="100" step="1">
        </div>
      </div>

      <!-- Lignes du devis -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <label class="form-label" style="margin:0;">Lignes du devis</label>
          <div style="display:flex;gap:8px;">
            <select id="q-catalogue-select" class="form-input" style="font-size:12px;padding:6px 10px;">
              <option value="">Ajouter depuis le catalogue…</option>
              ${catalogueOptions}
            </select>
            <button type="button" class="btn-secondary" style="padding:6px 12px;font-size:12px;border-radius:6px;cursor:pointer;" id="btn-add-catalogue-line">
              <i class="fas fa-plus"></i>
            </button>
            <button type="button" class="btn-secondary" style="padding:6px 12px;font-size:12px;border-radius:6px;cursor:pointer;" id="btn-add-custom-line">
              <i class="fas fa-pen"></i> Ligne libre
            </button>
          </div>
        </div>
        <div id="q-lines" style="display:grid;gap:8px;"></div>
      </div>

      <!-- Totaux -->
      <div style="background:var(--surface2);border-radius:var(--radius);padding:16px;">
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px;">
          <span>Total HT</span>
          <span id="q-total-ht" style="font-weight:600;">0,00 €</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-bottom:8px;">
          <span>Remise</span>
          <span id="q-discount-display">- 0,00 €</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-bottom:8px;">
          <span>TVA (<span id="q-tva-rate">${CONFIG.TVA_DEFAULT}</span>%)</span>
          <span id="q-tva-amount">0,00 €</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700;color:var(--accent);border-top:2px solid var(--border);padding-top:10px;">
          <span>Total TTC</span>
          <span id="q-total-ttc">0,00 €</span>
        </div>
      </div>

      <div>
        <label class="form-label">Notes / Conditions</label>
        <textarea id="q-notes" class="form-input" rows="2" placeholder="Conditions particulières…">${quote?.notes || ''}</textarea>
      </div>
    </div>
  `;

  const actions = [
    { label: 'Annuler', class: 'btn-secondary', onClick: (o) => Modal.close(o) },
  ];

  if (isEdit) {
    actions.push({
      label: '📄 Générer PDF',
      class: 'btn-secondary',
      onClick: () => generateQuotePDF(quote),
    });
    actions.push({
      label: 'Supprimer', class: 'btn-danger',
      onClick: async (overlay) => {
        const ok = await Modal.confirm({ title: 'Supprimer ce devis ?', danger: true });
        if (!ok) return;
        try {
          await DB.remove('quotes', quote.id);
          Modal.close(overlay);
          Toast.success('Devis supprimé');
          await loadQuotesData();
        } catch { Toast.error('Erreur'); }
      }
    });
  }

  actions.push({
    label: isEdit ? 'Enregistrer' : 'Créer le devis',
    class: 'btn-primary',
    onClick: async (overlay) => await saveQuote(overlay, quote),
  });

  Modal.open({ title: isEdit ? `Modifier ${quoteNumber}` : 'Nouveau devis', content, size: 'xl', actions, id: 'modal-quote' });

  // Render existing lines
  setTimeout(() => {
    lines.forEach(line => addQuoteLine(line));
    recalcQuoteTotals();

    // Bind buttons
    document.getElementById('btn-add-catalogue-line')?.addEventListener('click', () => {
      const select = document.getElementById('q-catalogue-select');
      const opt = select?.selectedOptions[0];
      if (!opt?.value) return;
      addQuoteLine({
        description: opt.dataset.name,
        quantity: 1,
        unit_price: parseFloat(opt.dataset.price) || 0,
      });
      select.value = '';
      recalcQuoteTotals();
    });

    document.getElementById('btn-add-custom-line')?.addEventListener('click', () => {
      addQuoteLine({ description: '', quantity: 1, unit_price: 0 });
      recalcQuoteTotals();
    });

    document.getElementById('q-discount')?.addEventListener('input', recalcQuoteTotals);
  }, 50);
}

// ============================================================
// LIGNES DE DEVIS
// ============================================================

let quoteLineCounter = 0;

function addQuoteLine(line = {}) {
  const linesContainer = document.getElementById('q-lines');
  if (!linesContainer) return;

  const lineId = `ql-${quoteLineCounter++}`;
  const row = document.createElement('div');
  row.className = 'quote-line';
  row.dataset.lineId = lineId;
  row.style.cssText = 'display:grid;grid-template-columns:1fr 80px 110px 100px 36px;gap:8px;align-items:center;';

  row.innerHTML = `
    <input type="text" class="form-input ql-desc" value="${line.description || ''}" placeholder="Description" style="font-size:13px;padding:8px;">
    <input type="number" class="form-input ql-qty" value="${line.quantity || 1}" min="1" style="font-size:13px;padding:8px;text-align:center;">
    <input type="number" class="form-input ql-price" value="${line.unit_price || 0}" min="0" step="0.01" style="font-size:13px;padding:8px;text-align:right;">
    <div class="ql-line-total" style="font-size:13px;font-weight:600;text-align:right;padding-right:4px;">${Fmt.currency((line.quantity || 1) * (line.unit_price || 0))}</div>
    <button type="button" style="background:none;border:none;cursor:pointer;color:var(--urgent);font-size:13px;padding:4px;" class="ql-remove">
      <i class="fas fa-trash"></i>
    </button>
  `;

  // Bind events
  row.querySelector('.ql-qty')?.addEventListener('input', recalcQuoteTotals);
  row.querySelector('.ql-price')?.addEventListener('input', recalcQuoteTotals);
  row.querySelector('.ql-remove')?.addEventListener('click', () => {
    row.remove();
    recalcQuoteTotals();
  });

  linesContainer.appendChild(row);
}

function recalcQuoteTotals() {
  const lines = document.querySelectorAll('.quote-line');
  let totalHT = 0;

  lines.forEach(row => {
    const qty = parseFloat(row.querySelector('.ql-qty')?.value) || 0;
    const price = parseFloat(row.querySelector('.ql-price')?.value) || 0;
    const lineTotal = qty * price;
    totalHT += lineTotal;
    const display = row.querySelector('.ql-line-total');
    if (display) display.textContent = Fmt.currency(lineTotal);
  });

  const discountPct = parseFloat(document.getElementById('q-discount')?.value) || 0;
  const discountAmount = totalHT * (discountPct / 100);
  const afterDiscount = totalHT - discountAmount;
  const tvaRate = CONFIG.TVA_DEFAULT;
  const tvaAmount = afterDiscount * (tvaRate / 100);
  const totalTTC = afterDiscount + tvaAmount;

  document.getElementById('q-total-ht').textContent = Fmt.currency(totalHT);
  document.getElementById('q-discount-display').textContent = `- ${Fmt.currency(discountAmount)}`;
  document.getElementById('q-tva-rate').textContent = tvaRate;
  document.getElementById('q-tva-amount').textContent = Fmt.currency(tvaAmount);
  document.getElementById('q-total-ttc').textContent = Fmt.currency(totalTTC);
}

function getQuoteLines() {
  const lines = [];
  document.querySelectorAll('.quote-line').forEach(row => {
    lines.push({
      description: row.querySelector('.ql-desc')?.value || '',
      quantity: parseFloat(row.querySelector('.ql-qty')?.value) || 0,
      unit_price: parseFloat(row.querySelector('.ql-price')?.value) || 0,
    });
  });
  return lines;
}

// ============================================================
// SAUVEGARDE DEVIS
// ============================================================

async function saveQuote(overlay, existingQuote) {
  const lines = getQuoteLines();
  const discountPct = parseFloat(document.getElementById('q-discount')?.value) || 0;
  const subtotalHT = lines.reduce((s, l) => s + (l.quantity * l.unit_price), 0);
  const discountAmount = subtotalHT * (discountPct / 100);
  const afterDiscount = subtotalHT - discountAmount;
  const tvaAmount = afterDiscount * (CONFIG.TVA_DEFAULT / 100);
  const totalTTC = afterDiscount + tvaAmount;

  const status = document.getElementById('q-status')?.value || 'Brouillon';

  const data = {
    quote_number: document.getElementById('q-number')?.value,
    company_id: document.getElementById('q-company')?.value || null,
    status,
    lines: JSON.stringify(lines),
    subtotal_ht: subtotalHT,
    discount_global: discountPct,
    tva_rate: CONFIG.TVA_DEFAULT,
    total_ttc: totalTTC,
    notes: document.getElementById('q-notes')?.value || null,
    valid_until: document.getElementById('q-valid')?.value || null,
  };

  // Si envoyé pour la première fois
  if (status === 'Envoyé' && !existingQuote?.sent_at) {
    data.sent_at = new Date().toISOString();
  }
  if (status === 'Signé' && !existingQuote?.signed_at) {
    data.signed_at = new Date().toISOString();
  }

  try {
    if (existingQuote) {
      await DB.update('quotes', existingQuote.id, data);
      Toast.success('Devis mis à jour');
    } else {
      const newQuote = await DB.insert('quotes', data);
      await CRM.logActivity({
        company_id: data.company_id,
        type: 'quote_created',
        title: `Devis créé : ${data.quote_number}`,
      });
      Toast.success('Devis créé');
    }
    Modal.close(overlay);
    await loadQuotesData();
  } catch (err) {
    console.error('[Quotes] Save error:', err);
    Toast.error('Erreur lors de la sauvegarde');
  }
}

// ============================================================
// GÉNÉRATION PDF (jsPDF)
// ============================================================

async function generateQuotePDF(quote) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const lines = typeof quote.lines === 'string' ? JSON.parse(quote.lines) : (quote.lines || []);
    const settings = await Settings.getAll();

    // En-tête
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(91, 76, 240); // accent
    doc.text('DEVIS', 14, 25);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(quote.quote_number, 14, 32);

    // Infos entreprise
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(settings.business_name || CONFIG.BUSINESS.name || 'Quiz Room Amiens', 14, 45);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    let y = 50;
    if (settings.business_address || CONFIG.BUSINESS.address) {
      doc.text(settings.business_address || CONFIG.BUSINESS.address, 14, y); y += 5;
    }
    if (settings.business_siret || CONFIG.BUSINESS.siret) {
      doc.text(`SIRET : ${settings.business_siret || CONFIG.BUSINESS.siret}`, 14, y); y += 5;
    }

    // Client
    if (quote.company_id) {
      try {
        const comp = await CRM.getCompany(quote.company_id);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30);
        doc.text('Client :', 120, 45);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(comp.name, 120, 51);
        if (comp.address) doc.text(comp.address, 120, 56);
        if (comp.city) doc.text(comp.city, 120, 61);
      } catch {}
    }

    // Dates
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Date : ${Fmt.date(quote.created_at)}`, 120, 72);
    if (quote.valid_until) doc.text(`Validité : ${Fmt.date(quote.valid_until)}`, 120, 77);

    // Table header
    y = 90;
    doc.setFillColor(240, 238, 255);
    doc.rect(14, y - 4, 182, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(91, 76, 240);
    doc.text('Description', 16, y + 2);
    doc.text('Qté', 120, y + 2, { align: 'center' });
    doc.text('P.U. HT', 150, y + 2, { align: 'right' });
    doc.text('Total HT', 192, y + 2, { align: 'right' });

    // Lignes
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30);
    lines.forEach(line => {
      const lineTotal = (line.quantity || 0) * (line.unit_price || 0);
      doc.text(Fmt.truncate(line.description, 55), 16, y);
      doc.text(String(line.quantity || 0), 120, y, { align: 'center' });
      doc.text(Fmt.currency(line.unit_price || 0), 150, y, { align: 'right' });
      doc.text(Fmt.currency(lineTotal), 192, y, { align: 'right' });
      y += 7;
    });

    // Totaux
    y += 8;
    doc.setDrawColor(200);
    doc.line(120, y - 4, 196, y - 4);

    doc.setFontSize(9);
    doc.text('Total HT', 150, y, { align: 'right' });
    doc.text(Fmt.currency(quote.subtotal_ht || 0), 192, y, { align: 'right' });
    y += 6;

    if (quote.discount_global > 0) {
      doc.text(`Remise (${quote.discount_global}%)`, 150, y, { align: 'right' });
      const discAmt = (quote.subtotal_ht || 0) * (quote.discount_global / 100);
      doc.text(`- ${Fmt.currency(discAmt)}`, 192, y, { align: 'right' });
      y += 6;
    }

    doc.text(`TVA (${CONFIG.TVA_DEFAULT}%)`, 150, y, { align: 'right' });
    const afterDisc = (quote.subtotal_ht || 0) * (1 - (quote.discount_global || 0) / 100);
    doc.text(Fmt.currency(afterDisc * CONFIG.TVA_DEFAULT / 100), 192, y, { align: 'right' });
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(91, 76, 240);
    doc.text('Total TTC', 150, y, { align: 'right' });
    doc.text(Fmt.currency(quote.total_ttc || 0), 192, y, { align: 'right' });

    // Notes
    if (quote.notes) {
      y += 16;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text('Notes :', 14, y);
      y += 5;
      const splitNotes = doc.splitTextToSize(quote.notes, 170);
      doc.text(splitNotes, 14, y);
    }

    // Mentions légales
    const mentions = settings.mentions_legales || CONFIG.BUSINESS.mentions_legales;
    if (mentions) {
      doc.setFontSize(7);
      doc.setTextColor(150);
      const splitMentions = doc.splitTextToSize(mentions, 180);
      doc.text(splitMentions, 14, 275);
    }

    // Sauvegarder
    doc.save(`${quote.quote_number}.pdf`);
    Toast.success('PDF généré et téléchargé');

  } catch (err) {
    console.error('[Quotes] PDF error:', err);
    Toast.error('Erreur lors de la génération PDF');
  }
}
