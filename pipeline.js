// ============================================================
// pipeline.js — Kanban Pipeline, Drag & Drop, Lead Scoring, Relances
// ============================================================

let pipelineDeals = [];
let pipelineCompanies = [];
let sortableInstances = [];
let currentRelanceId = null;
let relanceMoyen = null;

const TODAY = new Date().toISOString().split('T')[0];

// ============================================================
// CALCUL AUTOMATIQUE DE LA PROCHAINE RELANCE
// ============================================================

/**
 * Calcule la prochaine date de relance :
 * - Si événement dans < 30 jours : jalons à rebours [-21j, -14j, -7j, -3j]
 * - Sinon : jalons depuis la création [J+3, J+7, J+14, J+30, puis mensuel]
 */
function computeNextRelance(deal) {
  const dateC = deal.date_created || deal.created_at || TODAY;
  const dateE = deal.date_event || null;
  const n = deal.nb_relances || 0;
  const today = new Date(TODAY);
  const created = new Date(dateC);

  // --- Mode rebours (événement dans < 30j) ---
  if (dateE) {
    const event = new Date(dateE + 'T12:00:00');
    const daysToEvent = Math.ceil((event - today) / 86400000);
    const MIN_BEFORE = 3;

    if (daysToEvent <= 30 && daysToEvent > MIN_BEFORE) {
      const jalons = [21, 14, 7, 3];
      for (const j of jalons) {
        if (j <= MIN_BEFORE) break;
        const jalDate = new Date(dateE + 'T12:00:00');
        jalDate.setDate(jalDate.getDate() - j);
        const jalStr = jalDate.toISOString().split('T')[0];
        if (jalStr > TODAY) return jalStr;
      }
      return null;
    }
  }

  // --- Mode création (événement lointain ou absent) ---
  const jalons = [3, 7, 14, 30];
  for (let i = 0; i < jalons.length; i++) {
    if (i >= n) {
      const target = new Date(created);
      target.setDate(target.getDate() + jalons[i]);
      const targetStr = target.toISOString().split('T')[0];
      if (targetStr > TODAY) return targetStr;
    }
  }
  // Au-delà : mensuel
  const base = new Date(created);
  base.setDate(base.getDate() + 30);
  const extra = n - jalons.length + 1;
  if (extra > 0) base.setMonth(base.getMonth() + extra);
  if (dateE) {
    const diff = Math.ceil((new Date(dateE + 'T12:00:00') - base) / 86400000);
    if (diff <= 3) return null;
  }
  const str = base.toISOString().split('T')[0];
  return str > TODAY ? str : null;
}

/** Label de relance pour les cartes */
function relanceLabel(deal) {
  if (!deal.date_relance) return null;
  const diff = Math.round((new Date(deal.date_relance) - new Date(TODAY)) / 86400000);
  if (diff < 0)  return { text: `Retard ${Math.abs(diff)}j`, cls: 'overdue' };
  if (diff === 0) return { text: "Aujourd'hui", cls: 'today' };
  if (diff === 1) return { text: 'Demain', cls: 'soon' };
  if (diff <= 3)  return { text: `Dans ${diff}j`, cls: 'soon' };
  return { text: `Dans ${diff}j`, cls: '' };
}

/** Score de priorité "À relancer" (plus bas = plus urgent) */
function relancePriorityScore(deal) {
  const relances = deal.nb_relances || 0;
  const daysToEvent = deal.date_event ? Math.round((new Date(deal.date_event) - new Date(TODAY)) / 86400000) : 9999;
  const daysLate = deal.date_relance ? Math.max(0, Math.round((new Date(TODAY) - new Date(deal.date_relance)) / 86400000)) : 0;
  const eventBonus = daysToEvent <= 14 ? (14 - daysToEvent) * 10 : 0;
  return relances * 3 - eventBonus - daysLate * 2;
}

/** Vérifie si un deal devrait être dans "À relancer" (date relance atteinte) */
function isOverdue(deal) {
  return deal.date_relance && deal.date_relance <= TODAY && !['Gagné', 'Perdu'].includes(deal.status);
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================

async function renderPipeline() {
  const main = document.getElementById('main-content');
  if (!main) return;

  // Grouper les salles par type pour l'affichage
  const roomGroups = {};
  Object.entries(ROOMS).forEach(([k, v]) => {
    const type = ROOM_COLORS[v.type]?.label || v.type;
    if (!roomGroups[type]) roomGroups[type] = [];
    roomGroups[type].push({ key: k, ...v });
  });
  const roomOptionsHtml = Object.entries(roomGroups).map(([group, rooms]) =>
    `<optgroup label="${group}">${rooms.map(r => `<option value="${r.key}">${r.label}${r.capacity ? ` (max ${r.capacity})` : ''}</option>`).join('')}</optgroup>`
  ).join('');

  main.innerHTML = `
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
      <div>
        <h1 style="margin:0;font-family:var(--font-head);font-size:24px;font-weight:600;">Pipeline</h1>
        <p style="margin:4px 0 0;font-size:13px;color:var(--muted);" id="pipeline-subtitle">Chargement…</p>
      </div>
      <button id="btn-add-deal" class="btn-primary" style="padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;">
        <i class="fas fa-plus"></i> Nouveau deal
      </button>
    </div>

    <!-- Barre de filtres -->
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:20px;padding:14px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);">
      <div style="position:relative;flex:1;min-width:180px;">
        <input type="text" id="pipeline-search" placeholder="Rechercher un deal, entreprise…" 
          style="width:100%;padding:8px 12px 8px 34px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:var(--font-body);background:var(--surface);">
        <i class="fas fa-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;"></i>
      </div>
      <select id="pipeline-filter-room" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:var(--font-body);background:var(--surface);">
        <option value="">Toutes les salles</option>
        ${roomOptionsHtml}
      </select>
      <select id="pipeline-filter-source" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:var(--font-body);background:var(--surface);">
        <option value="">Toutes sources</option>
        ${LEAD_SOURCES.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <div style="display:flex;align-items:center;gap:4px;">
        <span style="font-size:12px;color:var(--muted);white-space:nowrap;">Événement :</span>
        <input type="date" id="pipeline-filter-date-from" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--font-body);">
        <span style="font-size:12px;color:var(--muted);">→</span>
        <input type="date" id="pipeline-filter-date-to" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--font-body);">
      </div>
      <select id="pipeline-filter-amount" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:var(--font-body);background:var(--surface);">
        <option value="">Tous montants</option>
        <option value="0-300">0 – 300 €</option>
        <option value="300-700">300 – 700 €</option>
        <option value="700-1500">700 – 1 500 €</option>
        <option value="1500+">1 500 € +</option>
      </select>
      <button id="pipeline-clear-filters" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:12px;font-family:var(--font-body);background:var(--surface);cursor:pointer;color:var(--muted);display:flex;align-items:center;gap:4px;" title="Réinitialiser les filtres">
        <i class="fas fa-times"></i> Reset
      </button>
    </div>

    <div id="kanban-board" style="display:flex;gap:16px;overflow-x:auto;padding-bottom:16px;min-height:500px;"></div>
  `;

  // Bind events
  document.getElementById('btn-add-deal')?.addEventListener('click', () => openDealModal());
  document.getElementById('pipeline-search')?.addEventListener('input', debounce(filterPipeline, 250));
  document.getElementById('pipeline-filter-room')?.addEventListener('change', filterPipeline);
  document.getElementById('pipeline-filter-source')?.addEventListener('change', filterPipeline);
  document.getElementById('pipeline-filter-date-from')?.addEventListener('change', filterPipeline);
  document.getElementById('pipeline-filter-date-to')?.addEventListener('change', filterPipeline);
  document.getElementById('pipeline-filter-amount')?.addEventListener('change', filterPipeline);
  document.getElementById('pipeline-clear-filters')?.addEventListener('click', () => {
    document.getElementById('pipeline-search').value = '';
    document.getElementById('pipeline-filter-room').value = '';
    document.getElementById('pipeline-filter-source').value = '';
    document.getElementById('pipeline-filter-date-from').value = '';
    document.getElementById('pipeline-filter-date-to').value = '';
    document.getElementById('pipeline-filter-amount').value = '';
    filterPipeline();
  });

  await loadPipelineData();
}

// ============================================================
// CHARGEMENT DES DONNÉES
// ============================================================

async function loadPipelineData() {
  Loader.show();
  try {
    const [deals, companies] = await Promise.allSettled([
      CRM.getDeals(),
      CRM.getCompanies(),
    ]);
    pipelineDeals = deals.status === 'fulfilled' ? deals.value : [];
    pipelineCompanies = companies.status === 'fulfilled' ? companies.value : [];
    if (deals.status === 'rejected') console.warn('[Pipeline] Deals:', deals.reason?.message);
    if (companies.status === 'rejected') console.warn('[Pipeline] Companies:', companies.reason?.message);
    renderKanban(pipelineDeals);
    updatePipelineSubtitle();
  } catch (err) {
    console.error('[Pipeline] Erreur chargement:', err);
    Toast.error(`Pipeline : ${err.message || err}`);
  } finally {
    Loader.hide();
  }
}

function updatePipelineSubtitle() {
  const active = pipelineDeals.filter(d => !['Gagné', 'Perdu'].includes(d.status));
  const total = active.reduce((s, d) => s + (d.amount || 0), 0);
  const sub = document.getElementById('pipeline-subtitle');
  if (sub) sub.textContent = `${active.length} deal${active.length > 1 ? 's' : ''} actif${active.length > 1 ? 's' : ''} · ${Fmt.currency(total)}`;
}

// ============================================================
// RENDU KANBAN
// ============================================================

function renderKanban(deals) {
  const board = document.getElementById('kanban-board');
  if (!board) return;
  board.innerHTML = '';

  // Détruire les instances Sortable existantes
  sortableInstances.forEach(s => s.destroy());
  sortableInstances = [];

  const statusColors = {
    'Nouveau':    { header: 'var(--accent)',   bg: 'var(--accent-soft)' },
    'En cours':   { header: 'var(--progress)', bg: 'var(--progress-soft)' },
    'À relancer': { header: 'var(--warning)',  bg: 'var(--warning-soft)' },
    'Gagné':      { header: 'var(--won)',      bg: 'var(--won-soft)' },
    'Perdu':      { header: 'var(--urgent)',   bg: 'var(--urgent-soft)' },
  };

  CONFIG.PIPELINE_STATUSES.forEach(status => {
    const col = statusColors[status] || { header: 'var(--muted)', bg: 'var(--surface2)' };

    // Auto-assignation : les deals en retard de relance vont dans "À relancer"
    let statusDeals;
    if (status === 'À relancer') {
      statusDeals = deals.filter(d => d.status === 'À relancer' || isOverdue(d));
      // Trier par priorité (plus urgent en haut)
      statusDeals.sort((a, b) => relancePriorityScore(a) - relancePriorityScore(b));
    } else if (status === 'Nouveau' || status === 'En cours') {
      // Exclure les deals en retard de relance (ils sont dans "À relancer")
      statusDeals = deals.filter(d => d.status === status && !isOverdue(d));
    } else {
      statusDeals = deals.filter(d => d.status === status);
    }

    const totalAmount = statusDeals.reduce((s, d) => s + (d.amount || 0), 0);

    const column = document.createElement('div');
    column.className = 'kanban-column';
    column.style.cssText = `
      min-width: 280px; width: 280px; flex-shrink: 0;
      background: var(--surface2); border-radius: var(--radius);
      display: flex; flex-direction: column; max-height: calc(100vh - 200px);
    `;

    column.innerHTML = `
      <div style="padding:14px 16px 10px;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid ${col.header};">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:600;font-size:14px;color:var(--text);">${status}</span>
          <span style="background:${col.bg};color:${col.header};font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;">${statusDeals.length}</span>
        </div>
        <span style="font-size:12px;color:var(--muted);font-weight:500;">${Fmt.currency(totalAmount)}</span>
      </div>
      <div class="kanban-cards" data-status="${status}" style="flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px;min-height:60px;"></div>
    `;

    const cardsContainer = column.querySelector('.kanban-cards');

    statusDeals.forEach(deal => {
      cardsContainer.appendChild(createDealCard(deal));
    });

    // Initialiser SortableJS
    const sortable = new Sortable(cardsContainer, {
      group: 'pipeline',
      animation: 180,
      ghostClass: 'kanban-ghost',
      dragClass: 'kanban-drag',
      handle: '.deal-card',
      onEnd: handleDragEnd,
    });
    sortableInstances.push(sortable);

    board.appendChild(column);
  });
}

// ============================================================
// CARD DEAL
// ============================================================

function createDealCard(deal) {
  const company = pipelineCompanies.find(c => c.id === deal.company_id);
  const room = ROOMS[deal.room_type];
  const roomColor = room ? ROOM_COLORS[room.type] : null;
  const isClosed = ['Gagné', 'Perdu'].includes(deal.status);
  const overdue = isOverdue(deal);
  const lbl = (!isClosed) ? relanceLabel(deal) : null;

  // Alerte capacité
  let capacityWarning = '';
  if (room && room.capacity && deal.nb_guests > room.capacity) {
    capacityWarning = `
      <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--urgent);margin-top:6px;">
        <i class="fas fa-exclamation-triangle"></i> ${deal.nb_guests}/${room.capacity} — capacité dépassée
      </div>
    `;
  }

  // Badge relance
  let relanceBadgeHtml = '';
  if (lbl) {
    const colors = { overdue: 'var(--urgent)', today: 'var(--warning)', soon: 'var(--progress)' };
    const color = colors[lbl.cls] || 'var(--muted)';
    relanceBadgeHtml = `
      <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:${color};margin-top:4px;">
        <i class="fas fa-clock" style="font-size:10px;"></i>
        <span>${lbl.text}</span>
        <span style="color:var(--muted);">· ${deal.nb_relances || 0} relance${(deal.nb_relances || 0) > 1 ? 's' : ''}</span>
      </div>
    `;
  }

  const card = document.createElement('div');
  card.className = 'deal-card';
  card.dataset.dealId = deal.id;
  card.style.cssText = `
    background: var(--surface); border-radius: 10px; padding: 14px;
    cursor: grab; border: 1px solid ${overdue ? 'var(--warning)' : 'var(--border)'};
    transition: box-shadow 0.15s, transform 0.15s;
    ${overdue ? 'border-left: 3px solid var(--warning);' : ''}
  `;
  card.onmouseenter = () => { card.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; card.style.transform = 'translateY(-1px)'; };
  card.onmouseleave = () => { card.style.boxShadow = 'none'; card.style.transform = 'none'; };

  card.innerHTML = `
    <div style="display:flex;align-items:start;justify-content:space-between;gap:8px;">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${deal.title || 'Sans titre'}</div>
        ${company ? `<div style="font-size:12px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><i class="fas fa-building" style="font-size:10px;margin-right:3px;"></i>${company.name}</div>` : ''}
      </div>
      <div style="font-weight:600;font-size:14px;color:var(--accent);white-space:nowrap;">${Fmt.currency(deal.amount || 0)}</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-top:10px;flex-wrap:wrap;">
      ${roomColor ? `<span style="font-size:11px;padding:2px 7px;border-radius:12px;background:${roomColor.bg};color:${roomColor.text};font-weight:500;">${room.label}</span>` : ''}
      ${deal.nb_guests ? `<span style="font-size:11px;color:var(--muted);"><i class="fas fa-users" style="font-size:10px;margin-right:2px;"></i>${deal.nb_guests}</span>` : ''}
      ${deal.date_event ? `<span style="font-size:11px;color:var(--muted);"><i class="fas fa-calendar" style="font-size:10px;margin-right:2px;"></i>${Fmt.date(deal.date_event)}</span>` : ''}
    </div>
    ${relanceBadgeHtml}
    ${capacityWarning}
    ${!isClosed ? `
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="deal-relance-btn" data-deal-id="${deal.id}" style="flex:1;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);font-size:11px;font-weight:500;cursor:pointer;font-family:var(--font-body);color:var(--accent);display:flex;align-items:center;justify-content:center;gap:4px;transition:all 0.15s;"
          onmouseenter="this.style.background='var(--accent-soft)'" onmouseleave="this.style.background='var(--surface)'">
          <i class="fas fa-phone-flip" style="font-size:10px;"></i> Relancé
        </button>
        <button class="deal-edit-btn" data-deal-id="${deal.id}" style="padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);font-size:11px;cursor:pointer;color:var(--muted);transition:all 0.15s;"
          onmouseenter="this.style.background='var(--surface2)'" onmouseleave="this.style.background='var(--surface)'" title="Modifier">
          <i class="fas fa-pen" style="font-size:10px;"></i>
        </button>
      </div>
    ` : ''}
  `;

  // Bind buttons (stop propagation pour ne pas ouvrir la modal edit)
  card.querySelector('.deal-relance-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openRelanceModal(deal.id);
  });
  card.querySelector('.deal-edit-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openDealModal(deal);
  });

  // Click sur la card = éditer
  card.addEventListener('click', () => openDealModal(deal));

  return card;
}

// ============================================================
// DRAG & DROP HANDLER
// ============================================================

async function handleDragEnd(evt) {
  const dealId = evt.item.dataset.dealId;
  const newStatus = evt.to.dataset.status;

  if (!dealId || !newStatus) return;

  try {
    const updates = { status: newStatus };

    // Si gagné → date de closing
    if (newStatus === 'Gagné') {
      updates.updated_at = new Date().toISOString();
    }

    // Si perdu → demander raison
    if (newStatus === 'Perdu') {
      const reason = prompt('Raison de la perte (optionnel) :');
      if (reason !== null) updates.lost_reason = reason;
    }

    await DB.update('deals', dealId, updates);

    // MAJ locale
    const deal = pipelineDeals.find(d => d.id === dealId);
    if (deal) {
      deal.status = newStatus;
      Object.assign(deal, updates);
    }

    // Logger l'activité
    await CRM.logActivity({
      deal_id: dealId,
      company_id: pipelineDeals.find(d => d.id === dealId)?.company_id,
      type: 'status_change',
      title: `Deal passé en "${newStatus}"`,
      body: newStatus === 'Perdu' && updates.lost_reason ? `Raison : ${updates.lost_reason}` : '',
    });

    updatePipelineSubtitle();
    Toast.success(`Deal déplacé → ${newStatus}`);
  } catch (err) {
    console.error('[Pipeline] Erreur drag:', err);
    Toast.error('Erreur lors du déplacement');
    // Recharger pour remettre en état cohérent
    await loadPipelineData();
  }
}

// ============================================================
// FILTRAGE
// ============================================================

function filterPipeline() {
  const search = (document.getElementById('pipeline-search')?.value || '').toLowerCase().trim();
  const roomFilter = document.getElementById('pipeline-filter-room')?.value || '';
  const sourceFilter = document.getElementById('pipeline-filter-source')?.value || '';
  const dateFrom = document.getElementById('pipeline-filter-date-from')?.value || '';
  const dateTo = document.getElementById('pipeline-filter-date-to')?.value || '';
  const amountFilter = document.getElementById('pipeline-filter-amount')?.value || '';

  let filtered = [...pipelineDeals];

  // Recherche texte (deal, entreprise, contact, notes)
  if (search) {
    filtered = filtered.filter(d => {
      const company = pipelineCompanies.find(c => c.id === d.company_id);
      const haystack = [d.title, company?.name, company?.email, company?.phone, d.infos, d.source].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }

  // Filtre salle
  if (roomFilter) {
    filtered = filtered.filter(d => d.room_type === roomFilter);
  }

  // Filtre source
  if (sourceFilter) {
    filtered = filtered.filter(d => d.source === sourceFilter);
  }

  // Filtre date événement
  if (dateFrom) {
    filtered = filtered.filter(d => d.date_event && d.date_event >= dateFrom);
  }
  if (dateTo) {
    filtered = filtered.filter(d => d.date_event && d.date_event <= dateTo);
  }

  // Filtre montant
  if (amountFilter) {
    const [min, max] = amountFilter.includes('+')
      ? [parseFloat(amountFilter), Infinity]
      : amountFilter.split('-').map(Number);
    filtered = filtered.filter(d => {
      const amt = d.amount || 0;
      return amt >= min && amt <= (max || Infinity);
    });
  }

  renderKanban(filtered);

  // Compteur de filtres actifs
  const activeFilters = [search, roomFilter, sourceFilter, dateFrom, dateTo, amountFilter].filter(Boolean).length;
  const subtitle = document.getElementById('pipeline-subtitle');
  if (subtitle) {
    const active = filtered.filter(d => !['Gagné', 'Perdu'].includes(d.status));
    const total = active.reduce((s, d) => s + (d.amount || 0), 0);
    subtitle.textContent = `${filtered.length} deal${filtered.length > 1 ? 's' : ''} affiché${filtered.length > 1 ? 's' : ''} · ${Fmt.currency(total)}${activeFilters ? ` · ${activeFilters} filtre${activeFilters > 1 ? 's' : ''} actif${activeFilters > 1 ? 's' : ''}` : ''}`;
  }
}

// ============================================================
// MODAL AJOUT / ÉDITION DEAL
// ============================================================

async function openDealModal(deal = null) {
  const isEdit = !!deal;
  const companies = pipelineCompanies.length ? pipelineCompanies : await CRM.getCompanies();

  const companyOptions = companies.map(c =>
    `<option value="${c.id}" ${deal && deal.company_id === c.id ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  // Grouper les salles par type pour optgroup
  const roomGroupsDeal = {};
  Object.entries(ROOMS).forEach(([k, v]) => {
    const type = ROOM_COLORS[v.type]?.label || v.type;
    if (!roomGroupsDeal[type]) roomGroupsDeal[type] = [];
    roomGroupsDeal[type].push({ key: k, ...v, selected: deal && deal.room_type === k });
  });
  const roomOptions = Object.entries(roomGroupsDeal).map(([group, rooms]) =>
    `<optgroup label="${group}">${rooms.map(r => `<option value="${r.key}" ${r.selected ? 'selected' : ''}>${r.label}${r.capacity ? ` (max ${r.capacity})` : ''}</option>`).join('')}</optgroup>`
  ).join('');

  const statusOptions = CONFIG.PIPELINE_STATUSES.map(s =>
    `<option value="${s}" ${deal && deal.status === s ? 'selected' : ''}>${s}</option>`
  ).join('');

  // Déterminer si le deal existant est lié à un particulier
  const existingCompany = deal?.company_id ? companies.find(c => c.id === deal.company_id) : null;
  const isParticulier = existingCompany?.sector === 'Particulier';

  const content = `
    <div style="display:grid;gap:16px;">

      <!-- Section Client -->
      <input type="hidden" id="deal-client-type-value" value="${isParticulier ? 'particulier' : 'entreprise'}">
      <div style="background:var(--surface2);border-radius:var(--radius);padding:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <label class="form-label" style="margin:0;">Client</label>
          <div style="display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;" id="deal-client-toggle">
            <button type="button" class="deal-toggle-btn ${!isParticulier ? 'active' : ''}" data-type="entreprise" style="padding:6px 14px;border:none;font-size:12px;font-weight:500;cursor:pointer;font-family:var(--font-body);background:${!isParticulier ? 'var(--accent)' : 'var(--surface)'};color:${!isParticulier ? '#fff' : 'var(--text)'};">
              <i class="fas fa-building" style="margin-right:4px;"></i>Entreprise
            </button>
            <button type="button" class="deal-toggle-btn ${isParticulier ? 'active' : ''}" data-type="particulier" style="padding:6px 14px;border:none;font-size:12px;font-weight:500;cursor:pointer;font-family:var(--font-body);background:${isParticulier ? 'var(--accent)' : 'var(--surface)'};color:${isParticulier ? '#fff' : 'var(--text)'};">
              <i class="fas fa-user" style="margin-right:4px;"></i>Particulier
            </button>
          </div>
        </div>

        <!-- Mode Entreprise -->
        <div id="deal-client-entreprise" style="${isParticulier ? 'display:none;' : ''}">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
            <select id="deal-client-mode" class="form-input" style="width:auto;font-size:13px;">
              <option value="existing" ${isEdit && deal?.company_id ? 'selected' : ''}>Client existant</option>
              <option value="new" ${!isEdit ? '' : ''}>Nouveau client</option>
            </select>
          </div>
          <div id="deal-existing-company" ${!isEdit && !deal?.company_id ? '' : ''}>
            <select id="deal-company" class="form-input">
              <option value="">— Sélectionner —</option>
              ${companyOptions}
            </select>
          </div>
          <div id="deal-new-company" style="display:none;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <input type="text" id="deal-new-company-name" class="form-input" placeholder="Nom de l'entreprise *" style="font-size:13px;">
              <select id="deal-new-company-sector" class="form-input" style="font-size:13px;">
                <option value="">Secteur…</option>
                ${SECTORS.filter(s => s !== 'Particulier').map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Mode Particulier -->
        <div id="deal-client-particulier" style="${!isParticulier ? 'display:none;' : ''}">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <input type="text" id="deal-part-prenom" class="form-input" placeholder="Prénom *" style="font-size:13px;">
            <input type="text" id="deal-part-nom" class="form-input" placeholder="Nom *" style="font-size:13px;">
          </div>
        </div>

        <!-- Contact (commun) -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
          <input type="email" id="deal-contact-email" class="form-input" placeholder="Email" style="font-size:13px;" value="${existingCompany?.email || ''}">
          <input type="tel" id="deal-contact-phone" class="form-input" placeholder="Téléphone" style="font-size:13px;" value="${existingCompany?.phone || ''}">
        </div>
      </div>

      <!-- Titre + Montant -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Titre du deal *</label>
          <input type="text" id="deal-title" class="form-input" value="${deal?.title || ''}" placeholder="Ex: Soirée CSE Décembre">
        </div>
        <div>
          <label class="form-label">Montant (€)</label>
          <input type="number" id="deal-amount" class="form-input" value="${deal?.amount || ''}" placeholder="0" min="0" step="0.01">
        </div>
      </div>

      <!-- Statut + Salle -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Statut</label>
          <select id="deal-status" class="form-input">
            ${statusOptions}
          </select>
        </div>
        <div>
          <label class="form-label">Salle / Formule</label>
          <select id="deal-room" class="form-input">
            <option value="">— Sélectionner —</option>
            ${roomOptions}
          </select>
        </div>
      </div>

      <!-- Participants + Dates -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Nb participants</label>
          <input type="number" id="deal-guests" class="form-input" value="${deal?.nb_guests || ''}" placeholder="0" min="1">
        </div>
        <div>
          <label class="form-label">Date événement</label>
          <input type="date" id="deal-date-event" class="form-input" value="${Fmt.dateInput(deal?.date_event)}">
        </div>
        <div>
          <label class="form-label">Date relance</label>
          <input type="date" id="deal-date-relance" class="form-input" value="${Fmt.dateInput(deal?.date_relance)}">
        </div>
      </div>

      <!-- Source -->
      <div>
        <label class="form-label">Source</label>
        <select id="deal-source" class="form-input">
          <option value="">— Sélectionner —</option>
          ${LEAD_SOURCES.map(s => `<option value="${s}" ${deal?.source === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>

      <!-- Notes -->
      <div>
        <label class="form-label">Notes / Infos complémentaires</label>
        <textarea id="deal-infos" class="form-input" rows="3" placeholder="Détails, besoins spécifiques…">${deal?.infos || ''}</textarea>
      </div>

      <div id="deal-capacity-alert" style="display:none;padding:10px 12px;background:var(--urgent-soft);border-radius:8px;font-size:13px;color:var(--urgent);"></div>
    </div>
  `;

  const modalActions = [
    {
      label: 'Annuler',
      class: 'btn-secondary',
      onClick: (overlay) => Modal.close(overlay),
    },
  ];

  if (isEdit) {
    modalActions.push({
      label: 'Supprimer',
      class: 'btn-danger',
      onClick: async (overlay) => {
        const ok = await Modal.confirm({ title: 'Supprimer ce deal ?', message: 'Cette action est irréversible.', danger: true });
        if (!ok) return;
        try {
          await DB.remove('deals', deal.id);
          Modal.close(overlay);
          Toast.success('Deal supprimé');
          await loadPipelineData();
        } catch (err) {
          Toast.error('Erreur lors de la suppression');
        }
      },
    });
  }

  modalActions.push({
    label: isEdit ? 'Enregistrer' : 'Créer le deal',
    class: 'btn-primary',
    onClick: async (overlay) => {
      await saveDeal(overlay, deal);
    },
  });

  Modal.open({
    title: isEdit ? 'Modifier le deal' : 'Nouveau deal',
    content,
    size: 'lg',
    actions: modalActions,
    id: 'modal-deal',
  });

  // Bind alerte capacité dynamique + toggle client type + mode existing/new
  setTimeout(() => {
    // --- Toggle Entreprise / Particulier ---
    let dealClientType = isParticulier ? 'particulier' : 'entreprise';
    document.querySelectorAll('.deal-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.deal-toggle-btn').forEach(b => {
          b.style.background = 'var(--surface)'; b.style.color = 'var(--text)';
        });
        btn.style.background = 'var(--accent)'; btn.style.color = '#fff';
        dealClientType = btn.dataset.type;
        document.getElementById('deal-client-type-value').value = dealClientType;

        const isPartType = dealClientType === 'particulier';
        document.getElementById('deal-client-entreprise').style.display = isPartType ? 'none' : '';
        document.getElementById('deal-client-particulier').style.display = isPartType ? '' : 'none';
      });
    });

    // --- Toggle Client existant / Nouveau ---
    const modeSelect = document.getElementById('deal-client-mode');
    modeSelect?.addEventListener('change', () => {
      const isNew = modeSelect.value === 'new';
      document.getElementById('deal-existing-company').style.display = isNew ? 'none' : '';
      document.getElementById('deal-new-company').style.display = isNew ? '' : 'none';
    });

    // --- Capacité salle ---
    const roomSelect = document.getElementById('deal-room');
    const guestsInput = document.getElementById('deal-guests');
    const checkCapacity = () => {
      const alert = document.getElementById('deal-capacity-alert');
      if (!alert) return;
      const roomKey = roomSelect?.value;
      const guests = parseInt(guestsInput?.value) || 0;
      const room = ROOMS[roomKey];
      if (room && room.capacity && guests > room.capacity) {
        alert.style.display = 'block';
        alert.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Attention : ${guests} participants pour ${room.label} (capacité max : ${room.capacity})`;
      } else {
        alert.style.display = 'none';
      }
    };
    roomSelect?.addEventListener('change', checkCapacity);
    guestsInput?.addEventListener('input', checkCapacity);
    checkCapacity();
  }, 50);
}

// ============================================================
// SAUVEGARDE DEAL
// ============================================================

async function saveDeal(overlay, existingDeal) {
  const title = document.getElementById('deal-title')?.value?.trim();
  if (!title) {
    Toast.warning('Le titre est obligatoire');
    return;
  }

  // --- Déterminer le client ---
  let companyId = null;
  let contactId = null;

  // Quel mode : Entreprise ou Particulier ?
  const isParticulier = document.getElementById('deal-client-type-value')?.value === 'particulier';

  const email = document.getElementById('deal-contact-email')?.value?.trim() || null;
  const phone = document.getElementById('deal-contact-phone')?.value?.trim() || null;

  try {
    if (isParticulier) {
      // --- Mode Particulier ---
      const prenom = document.getElementById('deal-part-prenom')?.value?.trim();
      const nom = document.getElementById('deal-part-nom')?.value?.trim();
      if (!prenom && !nom) {
        Toast.warning('Entrez au moins le nom du particulier');
        return;
      }
      const fullName = [prenom, nom].filter(Boolean).join(' ');

      // Créer ou trouver l'entreprise "Particulier — Nom"
      const companyName = `Particulier — ${fullName}`;
      let existing = await CRM.checkDuplicateCompany(companyName);
      if (!existing) {
        existing = await DB.insert('companies', {
          name: companyName,
          sector: 'Particulier',
          phone,
          email,
          source: document.getElementById('deal-source')?.value || null,
          ai_score: 0,
        });
      }
      companyId = existing.id;

      // Créer le contact
      const contact = await DB.insert('contacts', {
        company_id: companyId,
        first_name: prenom || '',
        last_name: nom || '',
        email,
        phone,
      });
      contactId = contact.id;

    } else {
      // --- Mode Entreprise ---
      const mode = document.getElementById('deal-client-mode')?.value || 'existing';

      if (mode === 'existing') {
        companyId = document.getElementById('deal-company')?.value || null;
      } else {
        // Nouveau client
        const newName = document.getElementById('deal-new-company-name')?.value?.trim();
        if (!newName) {
          Toast.warning("Entrez le nom de l'entreprise");
          return;
        }
        const sector = document.getElementById('deal-new-company-sector')?.value || null;

        let existing = await CRM.checkDuplicateCompany(newName);
        if (existing) {
          companyId = existing.id;
          Toast.info(`"${existing.name}" existait déjà — deal rattaché`);
        } else {
          const newCompany = await DB.insert('companies', {
            name: newName,
            sector,
            phone,
            email,
            source: document.getElementById('deal-source')?.value || null,
            ai_score: 0,
          });
          companyId = newCompany.id;
        }
      }

      // Mettre à jour email/tel sur l'entreprise existante si renseignés
      if (companyId && (email || phone)) {
        const updates = {};
        if (email) updates.email = email;
        if (phone) updates.phone = phone;
        try { await DB.update('companies', companyId, updates); } catch {}
      }
    }

    // --- Créer le deal ---
    const data = {
      title,
      amount: parseFloat(document.getElementById('deal-amount')?.value) || 0,
      company_id: companyId,
      contact_id: contactId,
      status: document.getElementById('deal-status')?.value || 'Nouveau',
      room_type: document.getElementById('deal-room')?.value || null,
      nb_guests: parseInt(document.getElementById('deal-guests')?.value) || null,
      date_event: document.getElementById('deal-date-event')?.value || null,
      date_relance: document.getElementById('deal-date-relance')?.value || null,
      source: document.getElementById('deal-source')?.value || null,
      infos: document.getElementById('deal-infos')?.value?.trim() || null,
      priority_score: calculateLeadScore({
        amount: parseFloat(document.getElementById('deal-amount')?.value) || 0,
        date_event: document.getElementById('deal-date-event')?.value,
        date_relance: document.getElementById('deal-date-relance')?.value,
        nb_relances: existingDeal?.nb_relances || 0,
      }),
    };

    if (existingDeal) {
      await DB.update('deals', existingDeal.id, data);
      Toast.success('Deal mis à jour');
    } else {
      data.nb_relances = 0;
      const newDeal = await DB.insert('deals', data);
      await CRM.logActivity({
        deal_id: newDeal.id,
        company_id: companyId,
        type: 'deal_created',
        title: `Deal créé : ${title}`,
      });
      Toast.success('Deal créé avec succès');
    }
    Modal.close(overlay);
    await loadPipelineData();
  } catch (err) {
    console.error('[Pipeline] Erreur sauvegarde:', err);
    Toast.error('Erreur lors de la sauvegarde');
  }
}

// ============================================================
// LEAD SCORING
// ============================================================

function calculateLeadScore({ amount = 0, date_event = null, date_relance = null, nb_relances = 0 }) {
  let score = 0;

  // Montant (0-30 pts)
  if (amount >= 1000) score += 30;
  else if (amount >= 500) score += 20;
  else if (amount >= 200) score += 10;

  // Date événement proche (0-30 pts)
  if (date_event) {
    const daysUntil = Math.round((new Date(date_event) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 7 && daysUntil >= 0) score += 30;
    else if (daysUntil <= 14) score += 20;
    else if (daysUntil <= 30) score += 15;
    else if (daysUntil <= 60) score += 5;
  }

  // Relance en retard (0-20 pts)
  if (date_relance) {
    const daysOverdue = Math.round((new Date() - new Date(date_relance)) / (1000 * 60 * 60 * 24));
    if (daysOverdue > 7) score += 20;
    else if (daysOverdue > 0) score += 10;
  }

  // Nombre de relances (0-20 pts) — plus on a relancé, plus c'est engagé
  if (nb_relances >= 3) score += 20;
  else if (nb_relances >= 1) score += 10;

  return Math.min(score, 100);
}

// ============================================================
// RELANCE MODAL
// ============================================================

function injectRelanceModal() {
  if (document.getElementById('relance-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'relance-modal';
  modal.className = 'crm-modal-overlay';
  modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0.35);backdrop-filter:blur(2px);align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:var(--radius);box-shadow:0 8px 40px rgba(0,0,0,0.18);width:90%;max-width:440px;padding:24px;animation:modalSlideIn 0.25s ease;">
      <div style="font-family:var(--font-head);font-size:18px;font-weight:600;margin-bottom:16px;">Enregistrer une relance</div>
      <div id="relance-deal-info" style="font-size:13px;color:var(--muted);margin-bottom:16px;"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;" id="relance-options">
        <button class="relance-opt-btn" data-val="Mail" style="padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;font-family:var(--font-body);font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.15s;">
          <i class="fas fa-envelope" style="color:var(--accent);"></i> Mail
        </button>
        <button class="relance-opt-btn" data-val="Tel" style="padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;font-family:var(--font-body);font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.15s;">
          <i class="fas fa-phone" style="color:var(--won);"></i> Téléphone
        </button>
        <button class="relance-opt-btn" data-val="SMS" style="padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;font-family:var(--font-body);font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.15s;">
          <i class="fas fa-comment-sms" style="color:var(--progress);"></i> SMS
        </button>
        <button class="relance-opt-btn" data-val="Autre" style="padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;font-family:var(--font-body);font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.15s;">
          <i class="fas fa-ellipsis" style="color:var(--muted);"></i> Autre
        </button>
      </div>
      <textarea id="relance-note" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:var(--font-body);resize:vertical;min-height:60px;margin-bottom:12px;" placeholder="Note sur cet échange (optionnel)…"></textarea>
      <div id="relance-next-info" style="padding:10px 12px;background:var(--accent-soft);border-radius:8px;font-size:12px;color:var(--accent);margin-bottom:16px;display:none;"></div>
      <div style="display:flex;gap:8px;">
        <button class="btn-secondary" style="flex:1;padding:10px;border-radius:8px;font-size:13px;cursor:pointer;" onclick="closeRelanceModal()">Annuler</button>
        <button class="btn-primary" style="flex:2;padding:10px;border-radius:8px;font-size:13px;cursor:pointer;" id="btn-confirm-relance">
          <i class="fas fa-check"></i> Confirmer la relance
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Bind option buttons
  modal.querySelectorAll('.relance-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.relance-opt-btn').forEach(b => {
        b.style.background = 'var(--surface)';
        b.style.borderColor = 'var(--border)';
        b.style.fontWeight = '400';
      });
      btn.style.background = 'var(--accent-soft)';
      btn.style.borderColor = 'var(--accent)';
      btn.style.fontWeight = '600';
      relanceMoyen = btn.dataset.val;
    });
  });

  // Bind confirm
  document.getElementById('btn-confirm-relance')?.addEventListener('click', confirmRelance);

  // Click overlay ferme
  modal.addEventListener('click', (e) => { if (e.target === modal) closeRelanceModal(); });
}

function openRelanceModal(dealId) {
  injectRelanceModal();
  currentRelanceId = dealId;
  relanceMoyen = null;

  const deal = pipelineDeals.find(d => d.id === dealId);
  if (!deal) return;

  const company = pipelineCompanies.find(c => c.id === deal.company_id);

  // Reset
  document.querySelectorAll('.relance-opt-btn').forEach(b => {
    b.style.background = 'var(--surface)'; b.style.borderColor = 'var(--border)'; b.style.fontWeight = '400';
  });
  document.getElementById('relance-note').value = '';

  // Info deal
  const info = document.getElementById('relance-deal-info');
  if (info) info.innerHTML = `<strong>${deal.title || company?.name || 'Deal'}</strong> · ${Fmt.currency(deal.amount)} · ${deal.nb_relances || 0} relance${(deal.nb_relances || 0) > 1 ? 's' : ''} effectuée${(deal.nb_relances || 0) > 1 ? 's' : ''}`;

  // Calculer et afficher la prochaine date
  const nextDate = computeNextRelance({ ...deal, nb_relances: (deal.nb_relances || 0) + 1 });
  const nextEl = document.getElementById('relance-next-info');
  if (nextDate) {
    const diff = Math.round((new Date(nextDate) - new Date(TODAY)) / 86400000);
    nextEl.innerHTML = `<i class="fas fa-calendar-check"></i> Prochaine relance prévue : <strong>${Fmt.date(nextDate)}</strong> (dans ${diff}j)`;
    nextEl.style.display = 'block';
  } else if (deal.date_event) {
    nextEl.innerHTML = `<i class="fas fa-calendar"></i> Pas de relance prévue avant l'événement du ${Fmt.date(deal.date_event)}`;
    nextEl.style.display = 'block';
  } else {
    nextEl.style.display = 'none';
  }

  // Afficher
  document.getElementById('relance-modal').style.display = 'flex';
}

function closeRelanceModal() {
  const modal = document.getElementById('relance-modal');
  if (modal) modal.style.display = 'none';
  currentRelanceId = null;
}

async function confirmRelance() {
  if (!relanceMoyen) { Toast.warning('Choisissez un moyen de relance'); return; }
  const deal = pipelineDeals.find(d => d.id === currentRelanceId);
  if (!deal) return;

  const note = document.getElementById('relance-note')?.value?.trim() || '';
  const n = (deal.nb_relances || 0) + 1;
  const nextDate = computeNextRelance({ ...deal, nb_relances: n });

  // Construire le log
  const dateJour = new Date().toLocaleDateString('fr-FR');
  let log = `[${dateJour}] Relance #${n} par ${relanceMoyen}`;
  if (note) log += ` : ${note}`;

  const updates = {
    status: 'En cours',
    nb_relances: n,
    infos: log + '\n' + (deal.infos || ''),
  };
  if (nextDate) updates.date_relance = nextDate;

  try {
    await DB.update('deals', deal.id, updates);

    // Logger l'activité
    await CRM.logActivity({
      deal_id: deal.id,
      company_id: deal.company_id,
      type: 'call',
      title: `Relance #${n} par ${relanceMoyen}`,
      body: note,
    });

    const msg = nextDate
      ? `Relance enregistrée · Prochaine le ${Fmt.date(nextDate)}`
      : `Relance enregistrée · Pas de prochaine relance prévue`;
    Toast.success(msg);
    closeRelanceModal();
    await loadPipelineData();
  } catch (err) {
    console.error('[Relance] Erreur:', err);
    Toast.error('Erreur lors de l\'enregistrement');
  }
}
