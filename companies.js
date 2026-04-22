// ============================================================
// companies.js — Entreprises & Contacts
// Vue grille/liste, fiche détail 6 onglets, timeline, modales
// ============================================================

let companiesData = [];
let companiesView = 'grid'; // 'grid' | 'list'
let companiesFilters = { sector: '', source: '', search: '' };

// Contacts temporaires lors de la création d'une entreprise
let _pendingContacts = [];

// ============================================================
// RENDER PRINCIPAL
// ============================================================

async function renderCompanies() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <div>
        <h1 style="margin:0;font-family:var(--font-head);font-size:24px;font-weight:600;">Entreprises & Contacts</h1>
        <p style="margin:4px 0 0;font-size:13px;color:var(--muted);" id="companies-subtitle">Chargement…</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <div style="position:relative;">
          <input type="text" id="companies-search" placeholder="Rechercher…"
            style="padding:8px 12px 8px 34px;border:1px solid var(--border);border-radius:8px;font-size:13px;width:200px;font-family:var(--font-body);background:var(--surface);">
          <i class="fas fa-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;"></i>
        </div>
        <select id="companies-filter-sector" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:var(--font-body);background:var(--surface);">
          <option value="">Tous secteurs</option>
          ${SECTORS.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <select id="companies-filter-source" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:var(--font-body);background:var(--surface);">
          <option value="">Toutes sources</option>
          ${LEAD_SOURCES.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <div style="display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
          <button id="btn-view-grid" class="view-toggle active" title="Grille" style="padding:8px 10px;border:none;cursor:pointer;font-size:13px;background:var(--accent);color:#fff;">
            <i class="fas fa-grip"></i>
          </button>
          <button id="btn-view-list" class="view-toggle" title="Liste" style="padding:8px 10px;border:none;cursor:pointer;font-size:13px;background:var(--surface);color:var(--muted);">
            <i class="fas fa-list"></i>
          </button>
        </div>
        <button id="btn-add-company" class="btn-primary" style="padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;">
          <i class="fas fa-plus"></i> Nouvelle entreprise
        </button>
      </div>
    </div>
    <div id="companies-container"></div>
  `;

  document.getElementById('companies-search')?.addEventListener('input', debounce(applyCompaniesFilters, 250));
  document.getElementById('companies-filter-sector')?.addEventListener('change', applyCompaniesFilters);
  document.getElementById('companies-filter-source')?.addEventListener('change', applyCompaniesFilters);
  document.getElementById('btn-view-grid')?.addEventListener('click', () => switchCompaniesView('grid'));
  document.getElementById('btn-view-list')?.addEventListener('click', () => switchCompaniesView('list'));
  document.getElementById('btn-add-company')?.addEventListener('click', () => openCompanyModal());

  await loadCompaniesData();
}

async function loadCompaniesData() {
  Loader.show();
  try {
    companiesData = await CRM.getCompanies();
    document.getElementById('companies-subtitle').textContent = `${companiesData.length} entreprise${companiesData.length > 1 ? 's' : ''}`;
    renderCompaniesView(companiesData);
  } catch (err) {
    console.error('[Companies] Erreur:', err);
    companiesData = [];
    Toast.error(`Entreprises : ${err.message || err}`);
    const container = document.getElementById('companies-container');
    if (container) container.innerHTML = emptyState('fa-exclamation-triangle', 'Erreur de connexion', err.message || 'Impossible de charger les entreprises');
  } finally {
    Loader.hide();
  }
}

function applyCompaniesFilters() {
  companiesFilters.search = (document.getElementById('companies-search')?.value || '').toLowerCase().trim();
  companiesFilters.sector = document.getElementById('companies-filter-sector')?.value || '';
  companiesFilters.source = document.getElementById('companies-filter-source')?.value || '';

  let filtered = [...companiesData];
  if (companiesFilters.search) {
    filtered = filtered.filter(c => {
      const h = [c.name, c.city, c.email, c.phone].filter(Boolean).join(' ').toLowerCase();
      return h.includes(companiesFilters.search);
    });
  }
  if (companiesFilters.sector) filtered = filtered.filter(c => c.sector === companiesFilters.sector);
  if (companiesFilters.source) filtered = filtered.filter(c => c.source === companiesFilters.source);

  renderCompaniesView(filtered);
}

function switchCompaniesView(view) {
  companiesView = view;
  document.getElementById('btn-view-grid').style.background = view === 'grid' ? 'var(--accent)' : 'var(--surface)';
  document.getElementById('btn-view-grid').style.color = view === 'grid' ? '#fff' : 'var(--muted)';
  document.getElementById('btn-view-list').style.background = view === 'list' ? 'var(--accent)' : 'var(--surface)';
  document.getElementById('btn-view-list').style.color = view === 'list' ? '#fff' : 'var(--muted)';
  applyCompaniesFilters();
}

// ============================================================
// VUE GRILLE
// ============================================================

function renderCompaniesView(companies) {
  const container = document.getElementById('companies-container');
  if (!container) return;

  if (!companies.length) {
    container.innerHTML = emptyState('fa-building', 'Aucune entreprise', 'Ajoutez votre première entreprise ou lancez une prospection');
    return;
  }

  if (companiesView === 'grid') {
    renderCompaniesGrid(container, companies);
  } else {
    renderCompaniesList(container, companies);
  }
}

function renderCompaniesGrid(container, companies) {
  container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;"></div>`;
  const grid = container.firstElementChild;

  companies.forEach(c => {
    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
      padding:20px;cursor:pointer;transition:all 0.15s;
    `;
    card.onmouseenter = () => { card.style.boxShadow = 'var(--shadow)'; card.style.transform = 'translateY(-2px)'; };
    card.onmouseleave = () => { card.style.boxShadow = 'none'; card.style.transform = 'none'; };

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="width:42px;height:42px;border-radius:10px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--accent);font-size:14px;">
          ${Fmt.initials(c.name)}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.name}</div>
          ${c.city ? `<div style="font-size:12px;color:var(--muted);">${c.city}</div>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        ${c.sector ? `<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:var(--surface2);color:var(--muted);font-weight:500;">${c.sector}</span>` : ''}
        ${Fmt.reactivityBadge(c.ai_score)}
      </div>
      ${c.phone || c.email ? `
        <div style="margin-top:10px;display:flex;gap:12px;font-size:12px;color:var(--muted);">
          ${c.phone ? `<span><i class="fas fa-phone" style="font-size:10px;margin-right:3px;"></i>${c.phone}</span>` : ''}
          ${c.email ? `<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;"><i class="fas fa-envelope" style="font-size:10px;margin-right:3px;"></i>${c.email}</span>` : ''}
        </div>
      ` : ''}
    `;

    card.addEventListener('click', () => openCompanyDetail(c.id));
    grid.appendChild(card);
  });
}

function renderCompaniesList(container, companies) {
  container.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:var(--surface2);border-bottom:1px solid var(--border);">
            <th style="text-align:left;padding:12px 16px;font-weight:600;color:var(--muted);font-size:12px;">Entreprise</th>
            <th style="text-align:left;padding:12px;font-weight:600;color:var(--muted);font-size:12px;">Secteur</th>
            <th style="text-align:left;padding:12px;font-weight:600;color:var(--muted);font-size:12px;">Ville</th>
            <th style="text-align:left;padding:12px;font-weight:600;color:var(--muted);font-size:12px;">Source</th>
            <th style="text-align:center;padding:12px;font-weight:600;color:var(--muted);font-size:12px;">Score</th>
          </tr>
        </thead>
        <tbody id="companies-table-body"></tbody>
      </table>
    </div>
  `;

  const tbody = document.getElementById('companies-table-body');
  companies.forEach(c => {
    const tr = document.createElement('tr');
    tr.style.cssText = 'border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.1s;';
    tr.onmouseenter = () => tr.style.background = 'var(--surface2)';
    tr.onmouseleave = () => tr.style.background = 'none';
    tr.innerHTML = `
      <td style="padding:12px 16px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;border-radius:8px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--accent);font-size:12px;">${Fmt.initials(c.name)}</div>
          <span style="font-weight:500;">${c.name}</span>
        </div>
      </td>
      <td style="padding:12px;">${c.sector || '—'}</td>
      <td style="padding:12px;">${c.city || '—'}</td>
      <td style="padding:12px;">${c.source || '—'}</td>
      <td style="padding:12px;text-align:center;">${Fmt.reactivityBadge(c.ai_score)}</td>
    `;
    tr.addEventListener('click', () => openCompanyDetail(c.id));
    tbody.appendChild(tr);
  });
}

// ============================================================
// FICHE DETAIL ENTREPRISE
// ============================================================

async function openCompanyDetail(companyId) {
  const main = document.getElementById('main-content');
  if (!main) return;

  Loader.show();

  try {
    const company = await CRM.getCompany(companyId);
    const [contacts, deals, activities] = await Promise.all([
      CRM.getContacts(companyId),
      CRM.getDealsByCompany(companyId),
      CRM.getActivities(companyId),
    ]);

    Loader.hide();

    main.innerHTML = `
      <div style="margin-bottom:20px;">
        <button id="btn-back-companies" style="background:none;border:none;cursor:pointer;color:var(--accent);font-size:13px;font-weight:500;padding:0;display:flex;align-items:center;gap:4px;">
          <i class="fas fa-arrow-left"></i> Retour aux entreprises
        </button>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
          <div style="display:flex;align-items:center;gap:16px;">
            <div style="width:56px;height:56px;border-radius:14px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--accent);font-size:20px;">
              ${Fmt.initials(company.name)}
            </div>
            <div>
              <h2 style="margin:0;font-family:var(--font-head);font-size:22px;font-weight:600;">${company.name}</h2>
              <div style="display:flex;gap:8px;align-items:center;margin-top:4px;">
                ${company.sector ? `<span style="font-size:12px;padding:2px 8px;border-radius:12px;background:var(--surface2);color:var(--muted);">${company.sector}</span>` : ''}
                ${company.city ? `<span style="font-size:12px;color:var(--muted);"><i class="fas fa-map-marker-alt" style="font-size:10px;"></i> ${company.city}</span>` : ''}
                ${Fmt.reactivityBadge(company.ai_score)}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn-secondary" style="padding:8px 14px;border-radius:8px;font-size:13px;cursor:pointer;" onclick="openScriptSelector('${company.sector || 'default'}', {companyName:'${company.name.replace(/'/g, "\\'")}'})" title="Générer un script">
              <i class="fas fa-file-lines"></i> Script
            </button>
            <button class="btn-secondary" style="padding:8px 14px;border-radius:8px;font-size:13px;cursor:pointer;" onclick="openCompanyModal(${JSON.stringify(company).replace(/"/g, '&quot;')})" title="Modifier">
              <i class="fas fa-pen"></i> Modifier
            </button>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:4px;border-bottom:2px solid var(--border);margin-bottom:20px;" id="company-tabs">
        <button class="company-tab active" data-tab="apercu" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;color:var(--accent);border-bottom:2px solid var(--accent);margin-bottom:-2px;">Aperçu</button>
        <button class="company-tab" data-tab="contacts" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-2px;">Contacts (${contacts.length})</button>
        <button class="company-tab" data-tab="deals" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-2px;">Deals (${deals.length})</button>
        <button class="company-tab" data-tab="activites" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-2px;">Activités</button>
        <button class="company-tab" data-tab="notes" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-2px;">Notes</button>
      </div>
      <div id="company-tab-content"></div>
    `;

    document.getElementById('btn-back-companies')?.addEventListener('click', renderCompanies);

    document.querySelectorAll('.company-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.company-tab').forEach(t => {
          t.style.color = 'var(--muted)';
          t.style.borderBottomColor = 'transparent';
          t.classList.remove('active');
        });
        tab.style.color = 'var(--accent)';
        tab.style.borderBottomColor = 'var(--accent)';
        tab.classList.add('active');
        renderCompanyTab(tab.dataset.tab, company, { contacts, deals, activities });
      });
    });

    renderCompanyTab('apercu', company, { contacts, deals, activities });

  } catch (err) {
    Loader.hide();
    console.error('[Companies] Erreur fiche détail:', err);
    Toast.error('Erreur de chargement de la fiche');
  }
}

// ============================================================
// RENDU DES ONGLETS
// ============================================================

function renderCompanyTab(tab, company, data) {
  const container = document.getElementById('company-tab-content');
  if (!container) return;

  switch (tab) {
    case 'apercu': renderTabApercu(container, company, data); break;
    case 'contacts': renderTabContacts(container, company, data.contacts); break;
    case 'deals': renderTabDeals(container, data.deals); break;
    case 'activites': renderTabActivites(container, data.activities); break;
    case 'notes': renderTabNotes(container, company); break;
  }
}

function renderTabApercu(container, company, data) {
  const wonDeals = data.deals.filter(d => d.status === 'Gagné');
  const totalCA = wonDeals.reduce((s, d) => s + (d.amount || 0), 0);
  const activeDeals = data.deals.filter(d => !['Gagné', 'Perdu'].includes(d.status));

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
        <h4 style="margin:0 0 16px;font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Informations</h4>
        <div style="display:grid;gap:12px;font-size:13px;">
          ${infoRow('fa-building', 'Secteur', company.sector)}
          ${infoRow('fa-map-marker-alt', 'Adresse', company.address)}
          ${infoRow('fa-city', 'Ville', company.city)}
          ${infoRow('fa-phone', 'Téléphone', company.phone)}
          ${infoRow('fa-envelope', 'Email', company.email)}
          ${infoRow('fa-globe', 'Site web', company.website ? `<a href="${company.website}" target="_blank" style="color:var(--accent);">${company.website.replace(/^https?:\/\//, '')}</a>` : null)}
          ${infoRow('fa-tag', 'Source', company.source)}
          ${infoRow('fa-calendar', 'Créé le', Fmt.dateLong(company.created_at))}
        </div>
      </div>
      <div style="display:grid;gap:16px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div style="background:var(--won-soft);border-radius:var(--radius);padding:16px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:var(--won);">${Fmt.currency(totalCA)}</div>
            <div style="font-size:12px;color:var(--won);margin-top:4px;">CA total</div>
          </div>
          <div style="background:var(--accent-soft);border-radius:var(--radius);padding:16px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:var(--accent);">${activeDeals.length}</div>
            <div style="font-size:12px;color:var(--accent);margin-top:4px;">Deals actifs</div>
          </div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
          <h4 style="margin:0 0 12px;font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Dernières activités</h4>
          ${data.activities.length ? data.activities.slice(0, 5).map(a => `
            <div style="display:flex;gap:10px;align-items:start;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
              <i class="fas ${activityIcon(a.type)}" style="color:var(--muted);margin-top:2px;width:14px;text-align:center;font-size:11px;"></i>
              <div style="flex:1;">
                <div style="font-weight:500;">${a.title}</div>
                <div style="font-size:11px;color:var(--muted);">${Fmt.dateRelative(a.created_at)}</div>
              </div>
            </div>
          `).join('') : '<p style="font-size:13px;color:var(--muted);">Aucune activité</p>'}
        </div>
      </div>
    </div>
  `;
}

function infoRow(icon, label, value) {
  if (!value) return '';
  return `
    <div style="display:flex;align-items:start;gap:10px;">
      <i class="fas ${icon}" style="color:var(--muted);width:14px;text-align:center;margin-top:2px;font-size:12px;"></i>
      <div><span style="color:var(--muted);margin-right:6px;">${label} :</span><span style="color:var(--text);font-weight:500;">${value}</span></div>
    </div>
  `;
}

function activityIcon(type) {
  const map = {
    'deal_created': 'fa-handshake', 'status_change': 'fa-exchange-alt', 'note': 'fa-sticky-note',
    'call': 'fa-phone', 'email': 'fa-envelope', 'meeting': 'fa-users',
    'company_created': 'fa-building', 'quote_created': 'fa-file-invoice',
  };
  return map[type] || 'fa-circle';
}

// ============================================================
// ONGLET CONTACTS — cartes avec édition et affichage notes
// ============================================================

function renderTabContacts(container, company, contacts) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <span style="font-size:14px;font-weight:600;">${contacts.length} contact${contacts.length > 1 ? 's' : ''}</span>
      <button class="btn-primary" style="padding:8px 14px;border-radius:8px;font-size:13px;cursor:pointer;" id="btn-add-contact">
        <i class="fas fa-user-plus"></i> Ajouter un contact
      </button>
    </div>
    <div id="contacts-list">
      ${contacts.length ? contacts.map(ct => renderContactCard(ct, company.id)).join('') : emptyState('fa-users', 'Aucun contact', 'Ajoutez un premier contact')}
    </div>
  `;

  document.getElementById('btn-add-contact')?.addEventListener('click', () => openContactModal(company.id, null));

  container.querySelectorAll('.btn-edit-contact').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ct = JSON.parse(decodeURIComponent(btn.dataset.contact));
      openContactModal(company.id, ct);
    });
  });

  container.querySelectorAll('.btn-delete-contact').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteContact(btn.dataset.id, company.id);
    });
  });
}

function renderContactCard(ct, companyId) {
  const fullName = `${ct.first_name || ''} ${ct.last_name || ''}`.trim();
  const contactJson = encodeURIComponent(JSON.stringify(ct));
  const hasExtra = ct.notes || ct.exchange_history;

  return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:10px;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;">
        <div style="width:40px;height:40px;border-radius:50%;background:var(--progress-soft);display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--progress);font-size:13px;flex-shrink:0;">
          ${Fmt.initials(fullName)}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;">${fullName || '—'}</div>
          ${ct.job_title ? `<div style="font-size:12px;color:var(--muted);margin-top:1px;">${ct.job_title}</div>` : ''}
          <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;font-size:12px;color:var(--muted);">
            ${ct.phone ? `<span><i class="fas fa-phone" style="font-size:10px;margin-right:4px;"></i>${ct.phone}</span>` : ''}
            ${ct.email ? `<span><i class="fas fa-envelope" style="font-size:10px;margin-right:4px;"></i>${ct.email}</span>` : ''}
            ${ct.linkedin ? `<a href="${ct.linkedin}" target="_blank" style="color:var(--accent);text-decoration:none;"><i class="fab fa-linkedin" style="font-size:11px;margin-right:3px;"></i>LinkedIn</a>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn-edit-contact btn-secondary" data-contact="${contactJson}"
            style="padding:6px 12px;border-radius:7px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:5px;">
            <i class="fas fa-pen" style="font-size:11px;"></i> Modifier
          </button>
          <button class="btn-delete-contact" data-id="${ct.id}"
            style="padding:6px 10px;border-radius:7px;font-size:12px;cursor:pointer;background:none;border:1px solid var(--border);color:var(--muted);">
            <i class="fas fa-trash" style="font-size:11px;"></i>
          </button>
        </div>
      </div>
      ${hasExtra ? `
        <div style="border-top:1px solid var(--border);padding:12px 16px;background:var(--surface2);display:grid;gap:10px;">
          ${ct.exchange_history ? `
            <div>
              <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">
                <i class="fas fa-history" style="margin-right:4px;"></i>Historique des échanges
              </div>
              <div style="font-size:13px;color:var(--text);line-height:1.6;white-space:pre-wrap;">${ct.exchange_history}</div>
            </div>
          ` : ''}
          ${ct.notes ? `
            <div>
              <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">
                <i class="fas fa-sticky-note" style="margin-right:4px;"></i>Notes
              </div>
              <div style="font-size:13px;color:var(--text);line-height:1.6;white-space:pre-wrap;">${ct.notes}</div>
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

function renderTabDeals(container, deals) {
  container.innerHTML = deals.length ? `
    <div style="display:grid;gap:8px;">
      ${deals.map(d => `
        <div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;cursor:pointer;" onclick="openDealModal(${JSON.stringify(d).replace(/"/g, '&quot;')})">
          <div style="flex:1;">
            <div style="font-weight:600;font-size:13px;">${d.title}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">${d.date_event ? Fmt.date(d.date_event) : 'Pas de date'}</div>
          </div>
          <div style="font-weight:600;font-size:14px;color:var(--accent);">${Fmt.currency(d.amount)}</div>
          ${Fmt.statusBadge(d.status)}
        </div>
      `).join('')}
    </div>
  ` : emptyState('fa-handshake', 'Aucun deal', 'Créez un deal depuis le Pipeline');
}

function renderTabActivites(container, activities) {
  if (!activities.length) {
    container.innerHTML = emptyState('fa-clock', 'Aucune activité');
    return;
  }
  container.innerHTML = `
    <div style="position:relative;padding-left:24px;">
      <div style="position:absolute;left:7px;top:0;bottom:0;width:2px;background:var(--border);"></div>
      ${activities.map(a => `
        <div style="position:relative;padding-bottom:20px;">
          <div style="position:absolute;left:-20px;top:2px;width:12px;height:12px;border-radius:50%;background:var(--accent);border:2px solid var(--surface);z-index:1;"></div>
          <div style="padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-weight:600;font-size:13px;"><i class="fas ${activityIcon(a.type)}" style="font-size:11px;color:var(--muted);margin-right:4px;"></i>${a.title}</span>
              <span style="font-size:11px;color:var(--muted);">${Fmt.dateRelative(a.created_at)} · ${Fmt.date(a.created_at)}</span>
            </div>
            ${a.body ? `<p style="margin:4px 0 0;font-size:13px;color:var(--muted);line-height:1.5;">${a.body}</p>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTabNotes(container, company) {
  container.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
      <textarea id="company-notes" class="form-input" rows="8" style="width:100%;resize:vertical;font-size:14px;line-height:1.6;" placeholder="Notes libres sur cette entreprise…">${company.notes || ''}</textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:12px;">
        <button class="btn-primary" style="padding:8px 18px;border-radius:8px;font-size:13px;cursor:pointer;" id="btn-save-notes">
          <i class="fas fa-save"></i> Enregistrer
        </button>
      </div>
    </div>
  `;
  document.getElementById('btn-save-notes')?.addEventListener('click', async () => {
    const notes = document.getElementById('company-notes')?.value || '';
    try {
      await DB.update('companies', company.id, { notes });
      Toast.success('Notes enregistrées');
    } catch {
      Toast.error('Erreur lors de la sauvegarde');
    }
  });
}

// ============================================================
// MODAL ENTREPRISE — avec section contacts à la création
// ============================================================

function openCompanyModal(company = null) {
  const isEdit = !!company;
  const c = company || {};
  _pendingContacts = [];

  const content = `
    <div style="display:grid;gap:14px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Nom *</label>
          <input type="text" id="comp-name" class="form-input" value="${c.name || ''}" placeholder="Nom de l'entreprise">
        </div>
        <div>
          <label class="form-label">Secteur</label>
          <div style="position:relative;">
            <input
              type="text"
              id="comp-sector"
              class="form-input"
              list="sectors-datalist"
              value="${c.sector || ''}"
              placeholder="Choisir ou saisir un secteur…"
              autocomplete="off"
            >
            <datalist id="sectors-datalist">
              ${SECTORS.map(s => `<option value="${s}">`).join('')}
            </datalist>
            <i class="fas fa-chevron-down" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:11px;pointer-events:none;"></i>
          </div>
        </div>
      </div>
      <div>
        <label class="form-label">Adresse</label>
        <input type="text" id="comp-address" class="form-input" value="${c.address || ''}" placeholder="Adresse complète">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Ville</label>
          <input type="text" id="comp-city" class="form-input" value="${c.city || ''}" placeholder="Amiens">
        </div>
        <div>
          <label class="form-label">Téléphone</label>
          <input type="tel" id="comp-phone" class="form-input" value="${c.phone || ''}" placeholder="03 22 …">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Email</label>
          <input type="email" id="comp-email" class="form-input" value="${c.email || ''}" placeholder="contact@…">
        </div>
        <div>
          <label class="form-label">Site web</label>
          <input type="url" id="comp-website" class="form-input" value="${c.website || ''}" placeholder="https://…">
        </div>
      </div>
      <div>
        <label class="form-label">Source</label>
        <select id="comp-source" class="form-input">
          <option value="">— Sélectionner —</option>
          ${LEAD_SOURCES.map(s => `<option value="${s}" ${c.source === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div id="comp-duplicate-warning" style="display:none;padding:10px;background:var(--warning-soft);border-radius:8px;font-size:13px;color:var(--warning);"></div>

      ${!isEdit ? `
        <div style="border-top:2px dashed var(--border);padding-top:14px;margin-top:4px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div>
              <div style="font-size:13px;font-weight:600;"><i class="fas fa-users" style="margin-right:6px;color:var(--accent);"></i>Contacts rattachés</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px;">Optionnel — vous pouvez en ajouter après création</div>
            </div>
            <button type="button" id="btn-add-pending-contact"
              style="padding:6px 14px;border-radius:7px;font-size:12px;font-weight:500;cursor:pointer;background:var(--accent-soft);color:var(--accent);border:1px solid var(--accent);display:flex;align-items:center;gap:6px;">
              <i class="fas fa-plus" style="font-size:10px;"></i> Ajouter
            </button>
          </div>
          <div id="pending-contacts-list" style="display:grid;gap:8px;min-height:4px;"></div>
        </div>
      ` : ''}
    </div>
  `;

  const actions = [
    { label: 'Annuler', class: 'btn-secondary', onClick: (o) => Modal.close(o) },
  ];

  if (isEdit) {
    actions.push({
      label: 'Supprimer', class: 'btn-danger',
      onClick: async (overlay) => {
        const ok = await Modal.confirm({ title: 'Supprimer cette entreprise ?', message: 'Tous les contacts, deals et activités associés seront conservés mais dissociés.', danger: true });
        if (!ok) return;
        try {
          await DB.remove('companies', c.id);
          Modal.close(overlay);
          Toast.success('Entreprise supprimée');
          await renderCompanies();
        } catch { Toast.error('Erreur lors de la suppression'); }
      }
    });
  }

  actions.push({
    label: isEdit ? 'Enregistrer' : 'Créer',
    class: 'btn-primary',
    onClick: async (overlay) => {
      const name = document.getElementById('comp-name')?.value?.trim();
      if (!name) { Toast.warning('Le nom est obligatoire'); return; }

      if (!isEdit) {
        const dup = await CRM.checkDuplicateCompany(name);
        if (dup) {
          const warn = document.getElementById('comp-duplicate-warning');
          if (warn) { warn.style.display = 'block'; warn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> "${dup.name}" existe déjà dans le CRM.`; }
          return;
        }
      }

      const data = {
        name,
        sector: document.getElementById('comp-sector')?.value || null,
        address: document.getElementById('comp-address')?.value || null,
        city: document.getElementById('comp-city')?.value || null,
        phone: document.getElementById('comp-phone')?.value || null,
        email: document.getElementById('comp-email')?.value || null,
        website: document.getElementById('comp-website')?.value || null,
        source: document.getElementById('comp-source')?.value || null,
      };

      try {
        if (isEdit) {
          await DB.update('companies', c.id, data);
          Toast.success('Entreprise mise à jour');
          Modal.close(overlay);
          await renderCompanies();
        } else {
          const newComp = await DB.insert('companies', { ...data, ai_score: 0 });
          await CRM.logActivity({ company_id: newComp.id, type: 'company_created', title: `Entreprise créée : ${name}` });

          if (_pendingContacts.length > 0) {
            for (const ct of _pendingContacts) {
              await DB.insert('contacts', { ...ct, company_id: newComp.id });
            }
            Toast.success(`Entreprise créée avec ${_pendingContacts.length} contact${_pendingContacts.length > 1 ? 's' : ''}`);
          } else {
            Toast.success('Entreprise créée');
          }
          _pendingContacts = [];
          Modal.close(overlay);
          await renderCompanies();
        }
      } catch (err) {
        console.error('[Companies] Save error:', err);
        Toast.error('Erreur lors de la sauvegarde');
      }
    }
  });

  Modal.open({ title: isEdit ? 'Modifier l\'entreprise' : 'Nouvelle entreprise', content, size: 'lg', actions, id: 'modal-company' });

  if (!isEdit) {
    setTimeout(() => {
      document.getElementById('btn-add-pending-contact')?.addEventListener('click', openPendingContactForm);
    }, 50);
  }
}

// ============================================================
// CONTACTS EN ATTENTE (lors de la création d'entreprise)
// ============================================================

function openPendingContactForm() {
  const formId = `pct-${Date.now()}`;
  const list = document.getElementById('pending-contacts-list');
  if (!list) return;

  list.insertAdjacentHTML('beforeend', `
    <div id="${formId}" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;position:relative;">
      <button type="button" onclick="document.getElementById('${formId}').remove()"
        style="position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;">
        <i class="fas fa-times"></i>
      </button>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <label class="form-label" style="font-size:11px;">Prénom *</label>
          <input type="text" class="form-input pct-first" style="font-size:13px;" placeholder="Jean">
        </div>
        <div>
          <label class="form-label" style="font-size:11px;">Nom *</label>
          <input type="text" class="form-input pct-last" style="font-size:13px;" placeholder="Dupont">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <label class="form-label" style="font-size:11px;">Email</label>
          <input type="email" class="form-input pct-email" style="font-size:13px;" placeholder="jean@…">
        </div>
        <div>
          <label class="form-label" style="font-size:11px;">Téléphone</label>
          <input type="tel" class="form-input pct-phone" style="font-size:13px;" placeholder="06 …">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <label class="form-label" style="font-size:11px;">Poste / Fonction</label>
          <input type="text" class="form-input pct-job" style="font-size:13px;" placeholder="Responsable CSE">
        </div>
        <div>
          <label class="form-label" style="font-size:11px;">LinkedIn</label>
          <input type="url" class="form-input pct-linkedin" style="font-size:13px;" placeholder="https://linkedin.com/in/…">
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;">
        <button type="button" class="btn-primary pct-save" style="padding:6px 14px;border-radius:7px;font-size:12px;cursor:pointer;">
          <i class="fas fa-check"></i> Valider ce contact
        </button>
      </div>
    </div>
  `);

  const formEl = document.getElementById(formId);
  formEl?.querySelector('.pct-save')?.addEventListener('click', () => {
    const first = formEl.querySelector('.pct-first')?.value?.trim();
    const last = formEl.querySelector('.pct-last')?.value?.trim();
    if (!first || !last) { Toast.warning('Prénom et nom sont obligatoires'); return; }

    const idx = _pendingContacts.length;
    _pendingContacts.push({
      first_name: first,
      last_name: last,
      email: formEl.querySelector('.pct-email')?.value?.trim() || null,
      phone: formEl.querySelector('.pct-phone')?.value?.trim() || null,
      job_title: formEl.querySelector('.pct-job')?.value?.trim() || null,
      linkedin: formEl.querySelector('.pct-linkedin')?.value?.trim() || null,
    });

    formEl.insertAdjacentHTML('afterend', `
      <div data-pending-idx="${idx}"
        style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--progress-soft);display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--progress);font-size:12px;">
          ${Fmt.initials(`${first} ${last}`)}
        </div>
        <div style="flex:1;">
          <div style="font-weight:600;font-size:13px;">${first} ${last}</div>
          ${_pendingContacts[idx].job_title ? `<div style="font-size:11px;color:var(--muted);">${_pendingContacts[idx].job_title}</div>` : ''}
        </div>
        <button type="button" onclick="removePendingContact(this, ${idx})"
          style="background:none;border:none;cursor:pointer;color:var(--muted);padding:4px 8px;font-size:13px;">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `);
    formEl.remove();
  });
}

function removePendingContact(btn, idx) {
  _pendingContacts[idx] = null; // null pour ne pas décaler les indices
  btn.closest('[data-pending-idx]')?.remove();
}

// ============================================================
// MODAL CONTACT — Création ET Édition complète
// ============================================================

function openContactModal(companyId, contact = null) {
  const isEdit = !!contact;
  const ct = contact || {};

  const content = `
    <div style="display:grid;gap:14px;">
      <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;padding-bottom:6px;border-bottom:1px solid var(--border);">
        <i class="fas fa-user" style="margin-right:5px;"></i>Identité
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Prénom *</label>
          <input type="text" id="ct-first" class="form-input" value="${ct.first_name || ''}" placeholder="Jean">
        </div>
        <div>
          <label class="form-label">Nom *</label>
          <input type="text" id="ct-last" class="form-input" value="${ct.last_name || ''}" placeholder="Dupont">
        </div>
      </div>
      <div>
        <label class="form-label">Poste / Fonction</label>
        <input type="text" id="ct-job" class="form-input" value="${ct.job_title || ''}" placeholder="Responsable CSE">
      </div>

      <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;padding-bottom:6px;border-bottom:1px solid var(--border);margin-top:4px;">
        <i class="fas fa-address-book" style="margin-right:5px;"></i>Coordonnées
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Email</label>
          <input type="email" id="ct-email" class="form-input" value="${ct.email || ''}" placeholder="jean@…">
        </div>
        <div>
          <label class="form-label">Téléphone</label>
          <input type="tel" id="ct-phone" class="form-input" value="${ct.phone || ''}" placeholder="06 …">
        </div>
      </div>
      <div>
        <label class="form-label">LinkedIn</label>
        <div style="position:relative;">
          <i class="fab fa-linkedin" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#0077b5;font-size:14px;pointer-events:none;"></i>
          <input type="url" id="ct-linkedin" class="form-input" value="${ct.linkedin || ''}"
            placeholder="https://linkedin.com/in/…" style="padding-left:34px;">
        </div>
      </div>

      <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;padding-bottom:6px;border-bottom:1px solid var(--border);margin-top:4px;">
        <i class="fas fa-sticky-note" style="margin-right:5px;"></i>Notes
      </div>
      <div>
        <label class="form-label">Notes libres</label>
        <textarea id="ct-notes" class="form-input" rows="3" style="resize:vertical;"
          placeholder="Informations complémentaires…">${ct.notes || ''}</textarea>
      </div>

      <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;padding-bottom:6px;border-bottom:1px solid var(--border);margin-top:4px;">
        <i class="fas fa-history" style="margin-right:5px;"></i>Historique des échanges
      </div>
      <div>
        <label class="form-label">Journal des échanges</label>
        <textarea id="ct-history" class="form-input" rows="6" style="resize:vertical;line-height:1.6;"
          placeholder="Ex :&#10;12/03/2025 — Appel : intéressé par l'offre séminaire, rappeler en mai&#10;04/04/2025 — Email envoyé avec devis&#10;20/04/2025 — RDV confirmé">${ct.exchange_history || ''}</textarea>
        <div style="font-size:11px;color:var(--muted);margin-top:5px;">
          <i class="fas fa-lightbulb" style="margin-right:3px;"></i>
          Conseil : ajoutez la date devant chaque échange pour garder un historique clair.
        </div>
      </div>
    </div>
  `;

  const actions = [
    { label: 'Annuler', class: 'btn-secondary', onClick: (o) => Modal.close(o) },
  ];

  if (isEdit) {
    actions.push({
      label: 'Supprimer', class: 'btn-danger',
      onClick: async (overlay) => {
        const ok = await Modal.confirm({ title: 'Supprimer ce contact ?', danger: true });
        if (!ok) return;
        try {
          await DB.remove('contacts', ct.id);
          Toast.success('Contact supprimé');
          Modal.close(overlay);
          openCompanyDetail(companyId);
        } catch { Toast.error('Erreur lors de la suppression'); }
      }
    });
  }

  actions.push({
    label: isEdit ? 'Enregistrer' : 'Ajouter',
    class: 'btn-primary',
    onClick: async (overlay) => {
      const first = document.getElementById('ct-first')?.value?.trim();
      const last = document.getElementById('ct-last')?.value?.trim();
      if (!first || !last) { Toast.warning('Prénom et nom sont obligatoires'); return; }

      const payload = {
        company_id: companyId,
        first_name: first,
        last_name: last,
        job_title: document.getElementById('ct-job')?.value?.trim() || null,
        email: document.getElementById('ct-email')?.value?.trim() || null,
        phone: document.getElementById('ct-phone')?.value?.trim() || null,
        linkedin: document.getElementById('ct-linkedin')?.value?.trim() || null,
        notes: document.getElementById('ct-notes')?.value || null,
        exchange_history: document.getElementById('ct-history')?.value || null,
      };

      try {
        if (isEdit) {
          await DB.update('contacts', ct.id, payload);
          Toast.success('Contact mis à jour');
        } else {
          await DB.insert('contacts', payload);
          Toast.success('Contact ajouté');
        }
        Modal.close(overlay);
        openCompanyDetail(companyId);
      } catch (err) {
        console.error('[Contacts] Save error:', err);
        Toast.error("Erreur lors de l'enregistrement du contact");
      }
    }
  });

  Modal.open({
    title: isEdit
      ? `Modifier — ${ct.first_name || ''} ${ct.last_name || ''}`.trim()
      : 'Ajouter un contact',
    content,
    size: 'lg',
    actions,
    id: 'modal-contact'
  });
}

async function deleteContact(contactId, companyId) {
  const ok = await Modal.confirm({ title: 'Supprimer ce contact ?', danger: true });
  if (!ok) return;
  try {
    await DB.remove('contacts', contactId);
    Toast.success('Contact supprimé');
    openCompanyDetail(companyId);
  } catch {
    Toast.error('Erreur lors de la suppression');
  }
}
