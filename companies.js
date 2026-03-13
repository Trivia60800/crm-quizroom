// ============================================================
// companies.js — Entreprises & Contacts
// Vue grille/liste, fiche détail 6 onglets, timeline, modales
// ============================================================

let companiesData = [];
let companiesView = 'grid'; // 'grid' | 'list'
let companiesFilters = { sector: '', source: '', search: '' };

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

  // Bind events
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
    Toast.error('Erreur de chargement des entreprises');
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

    const sectorColor = c.sector === 'CSE' ? 'var(--accent)' : c.sector === 'Entreprise' ? 'var(--progress)' : 'var(--warning)';

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
// FICHE DÉTAIL ENTREPRISE (6 onglets)
// ============================================================

async function openCompanyDetail(companyId) {
  const main = document.getElementById('main-content');
  if (!main) return;

  Loader.show();

  try {
    const company = await CRM.getCompany(companyId);
    const [contacts, deals, activities, quotes] = await Promise.all([
      CRM.getContacts(companyId),
      CRM.getDealsByCompany(companyId),
      CRM.getActivities(companyId),
      DB.getWhere('quotes', 'company_id', companyId),
    ]);

    Loader.hide();

    main.innerHTML = `
      <div style="margin-bottom:20px;">
        <button id="btn-back-companies" style="background:none;border:none;cursor:pointer;color:var(--accent);font-size:13px;font-weight:500;padding:0;display:flex;align-items:center;gap:4px;">
          <i class="fas fa-arrow-left"></i> Retour aux entreprises
        </button>
      </div>

      <!-- Header fiche -->
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

      <!-- Onglets -->
      <div style="display:flex;gap:4px;border-bottom:2px solid var(--border);margin-bottom:20px;" id="company-tabs">
        <button class="company-tab active" data-tab="apercu" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;color:var(--accent);border-bottom:2px solid var(--accent);margin-bottom:-2px;">Aperçu</button>
        <button class="company-tab" data-tab="contacts" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-2px;">Contacts (${contacts.length})</button>
        <button class="company-tab" data-tab="deals" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-2px;">Deals (${deals.length})</button>
        <button class="company-tab" data-tab="devis" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-2px;">Devis (${quotes.length})</button>
        <button class="company-tab" data-tab="activites" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-2px;">Activités</button>
        <button class="company-tab" data-tab="notes" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-2px;">Notes</button>
      </div>
      <div id="company-tab-content"></div>
    `;

    // Bind navigation retour
    document.getElementById('btn-back-companies')?.addEventListener('click', renderCompanies);

    // Bind onglets
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
        renderCompanyTab(tab.dataset.tab, company, { contacts, deals, activities, quotes });
      });
    });

    // Afficher le premier onglet
    renderCompanyTab('apercu', company, { contacts, deals, activities, quotes });

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
    case 'devis': renderTabDevis(container, data.quotes); break;
    case 'activites': renderTabActivites(container, data.activities); break;
    case 'notes': renderTabNotes(container, company); break;
  }
}

// --- Aperçu ---
function renderTabApercu(container, company, data) {
  const wonDeals = data.deals.filter(d => d.status === 'Gagné');
  const totalCA = wonDeals.reduce((s, d) => s + (d.amount || 0), 0);
  const activeDeals = data.deals.filter(d => !['Gagné', 'Perdu'].includes(d.status));

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
        <h4 style="margin:0 0 16px;font-size:14px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;font-size:12px;">Informations</h4>
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

// --- Contacts ---
function renderTabContacts(container, company, contacts) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <span style="font-size:14px;font-weight:600;">${contacts.length} contact${contacts.length > 1 ? 's' : ''}</span>
      <button class="btn-primary" style="padding:8px 14px;border-radius:8px;font-size:13px;cursor:pointer;" id="btn-add-contact">
        <i class="fas fa-user-plus"></i> Ajouter un contact
      </button>
    </div>
    <div id="contacts-list">
      ${contacts.length ? contacts.map(ct => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-bottom:8px;">
          <div style="width:38px;height:38px;border-radius:50%;background:var(--progress-soft);display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--progress);font-size:13px;">
            ${Fmt.initials((ct.first_name || '') + ' ' + (ct.last_name || ''))}
          </div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:13px;">${ct.first_name || ''} ${ct.last_name || ''}</div>
            <div style="font-size:12px;color:var(--muted);">${ct.job_title || ''}</div>
          </div>
          <div style="display:flex;gap:8px;font-size:12px;color:var(--muted);">
            ${ct.phone ? `<span><i class="fas fa-phone" style="font-size:10px;"></i> ${ct.phone}</span>` : ''}
            ${ct.email ? `<span><i class="fas fa-envelope" style="font-size:10px;"></i> ${ct.email}</span>` : ''}
          </div>
          <button class="btn-icon" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:4px 8px;" onclick="deleteContact('${ct.id}', '${company.id}')">
            <i class="fas fa-trash" style="font-size:12px;"></i>
          </button>
        </div>
      `).join('') : emptyState('fa-users', 'Aucun contact', 'Ajoutez un premier contact')}
    </div>
  `;

  document.getElementById('btn-add-contact')?.addEventListener('click', () => openContactModal(company.id));
}

// --- Deals ---
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

// --- Devis ---
function renderTabDevis(container, quotes) {
  container.innerHTML = quotes.length ? `
    <div style="display:grid;gap:8px;">
      ${quotes.map(q => `
        <div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;">
          <div style="flex:1;">
            <div style="font-weight:600;font-size:13px;">${q.quote_number}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">${Fmt.date(q.created_at)}</div>
          </div>
          <div style="font-weight:600;font-size:14px;color:var(--accent);">${Fmt.currency(q.total_ttc)}</div>
          ${Fmt.statusBadge(q.status)}
        </div>
      `).join('')}
    </div>
  ` : emptyState('fa-file-invoice', 'Aucun devis');
}

// --- Activités (timeline) ---
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

// --- Notes ---
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
// MODAL AJOUT / ÉDITION ENTREPRISE
// ============================================================

function openCompanyModal(company = null) {
  const isEdit = !!company;
  const c = company || {};

  const content = `
    <div style="display:grid;gap:14px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Nom *</label>
          <input type="text" id="comp-name" class="form-input" value="${c.name || ''}" placeholder="Nom de l'entreprise">
        </div>
        <div>
          <label class="form-label">Secteur</label>
          <select id="comp-sector" class="form-input">
            <option value="">— Sélectionner —</option>
            ${SECTORS.map(s => `<option value="${s}" ${c.sector === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
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

      // Duplicate check
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
        } else {
          const newComp = await DB.insert('companies', { ...data, ai_score: 0 });
          await CRM.logActivity({ company_id: newComp.id, type: 'company_created', title: `Entreprise créée : ${name}` });
          Toast.success('Entreprise créée');
        }
        Modal.close(overlay);
        await renderCompanies();
      } catch (err) {
        console.error('[Companies] Save error:', err);
        Toast.error('Erreur lors de la sauvegarde');
      }
    }
  });

  Modal.open({ title: isEdit ? 'Modifier l\'entreprise' : 'Nouvelle entreprise', content, size: 'lg', actions, id: 'modal-company' });
}

// ============================================================
// MODAL CONTACT
// ============================================================

function openContactModal(companyId) {
  const content = `
    <div style="display:grid;gap:14px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Prénom *</label>
          <input type="text" id="ct-first" class="form-input" placeholder="Jean">
        </div>
        <div>
          <label class="form-label">Nom *</label>
          <input type="text" id="ct-last" class="form-input" placeholder="Dupont">
        </div>
      </div>
      <div>
        <label class="form-label">Poste / Fonction</label>
        <input type="text" id="ct-job" class="form-input" placeholder="Responsable CSE">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Email</label>
          <input type="email" id="ct-email" class="form-input" placeholder="jean@…">
        </div>
        <div>
          <label class="form-label">Téléphone</label>
          <input type="tel" id="ct-phone" class="form-input" placeholder="06 …">
        </div>
      </div>
      <div>
        <label class="form-label">Notes</label>
        <textarea id="ct-notes" class="form-input" rows="2" placeholder="Infos complémentaires…"></textarea>
      </div>
    </div>
  `;

  Modal.open({
    title: 'Ajouter un contact',
    content,
    size: 'md',
    actions: [
      { label: 'Annuler', class: 'btn-secondary', onClick: (o) => Modal.close(o) },
      {
        label: 'Ajouter',
        class: 'btn-primary',
        onClick: async (overlay) => {
          const first = document.getElementById('ct-first')?.value?.trim();
          const last = document.getElementById('ct-last')?.value?.trim();
          if (!first || !last) { Toast.warning('Prénom et nom sont obligatoires'); return; }

          try {
            await DB.insert('contacts', {
              company_id: companyId,
              first_name: first,
              last_name: last,
              job_title: document.getElementById('ct-job')?.value || null,
              email: document.getElementById('ct-email')?.value || null,
              phone: document.getElementById('ct-phone')?.value || null,
              notes: document.getElementById('ct-notes')?.value || null,
            });
            Toast.success('Contact ajouté');
            Modal.close(overlay);
            openCompanyDetail(companyId); // Refresh la fiche
          } catch {
            Toast.error("Erreur lors de l'ajout du contact");
          }
        }
      }
    ]
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
