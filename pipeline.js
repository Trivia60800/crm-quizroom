// ============================================================
// pipeline.js — Kanban Pipeline, Drag & Drop, Lead Scoring
// ============================================================

let pipelineDeals = [];
let pipelineCompanies = [];
let sortableInstances = [];

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
    const statusDeals = deals.filter(d => d.status === status);
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

  // Alerte capacité
  let capacityWarning = '';
  if (room && room.capacity && deal.nb_guests > room.capacity) {
    capacityWarning = `
      <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--urgent);margin-top:6px;">
        <i class="fas fa-exclamation-triangle"></i> ${deal.nb_guests}/${room.capacity} — capacité dépassée
      </div>
    `;
  }

  // Alerte relance en retard
  let relanceWarning = '';
  if (deal.date_relance && !['Gagné', 'Perdu'].includes(deal.status)) {
    const today = new Date().toISOString().split('T')[0];
    if (deal.date_relance <= today) {
      relanceWarning = `
        <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--warning);margin-top:4px;">
          <i class="fas fa-clock"></i> Relance : ${Fmt.dateRelative(deal.date_relance)}
        </div>
      `;
    }
  }

  const card = document.createElement('div');
  card.className = 'deal-card';
  card.dataset.dealId = deal.id;
  card.style.cssText = `
    background: var(--surface); border-radius: 10px; padding: 14px;
    cursor: grab; border: 1px solid var(--border);
    transition: box-shadow 0.15s, transform 0.15s;
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
    ${deal.priority_score != null ? `<div style="margin-top:8px;">${Fmt.scoreBar(deal.priority_score)}</div>` : ''}
    ${capacityWarning}
    ${relanceWarning}
  `;

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

  const content = `
    <div style="display:grid;gap:16px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Titre du deal *</label>
          <input type="text" id="deal-title" class="form-input" value="${deal?.title || ''}" placeholder="Ex: Soirée CSE Décembre">
        </div>
        <div>
          <label class="form-label">Montant (€)</label>
          <input type="number" id="deal-amount" class="form-input" value="${deal?.amount || ''}" placeholder="0" min="0" step="50">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Entreprise</label>
          <select id="deal-company" class="form-input">
            <option value="">— Sélectionner —</option>
            ${companyOptions}
          </select>
        </div>
        <div>
          <label class="form-label">Statut</label>
          <select id="deal-status" class="form-input">
            ${statusOptions}
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Salle</label>
          <select id="deal-room" class="form-input">
            <option value="">— Sélectionner —</option>
            ${roomOptions}
          </select>
        </div>
        <div>
          <label class="form-label">Nb participants</label>
          <input type="number" id="deal-guests" class="form-input" value="${deal?.nb_guests || ''}" placeholder="0" min="1">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Date événement</label>
          <input type="date" id="deal-date-event" class="form-input" value="${Fmt.dateInput(deal?.date_event)}">
        </div>
        <div>
          <label class="form-label">Date relance</label>
          <input type="date" id="deal-date-relance" class="form-input" value="${Fmt.dateInput(deal?.date_relance)}">
        </div>
      </div>
      <div>
        <label class="form-label">Source</label>
        <select id="deal-source" class="form-input">
          <option value="">— Sélectionner —</option>
          ${LEAD_SOURCES.map(s => `<option value="${s}" ${deal?.source === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
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

  // Bind alerte capacité dynamique
  setTimeout(() => {
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

  const data = {
    title,
    amount: parseFloat(document.getElementById('deal-amount')?.value) || 0,
    company_id: document.getElementById('deal-company')?.value || null,
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

  try {
    if (existingDeal) {
      await DB.update('deals', existingDeal.id, data);
      Toast.success('Deal mis à jour');
    } else {
      data.nb_relances = 0;
      const newDeal = await DB.insert('deals', data);
      // Logger l'activité
      await CRM.logActivity({
        deal_id: newDeal.id,
        company_id: data.company_id,
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
