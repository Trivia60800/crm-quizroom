'use strict';
/* ================================================================
   script.js — Quiz Room CRM · Phase 1
   Auth · Routing SPA · ROOMS · KPIs header · Dashboard
================================================================ */

/* ────────────────────────────────────────────────────────────────
   RÉFÉRENTIEL SALLES
──────────────────────────────────────────────────────────────── */
const ROOMS = {
  quiz_standard:   { label: 'Quiz – 1 salle',             capacity: 18,  type: 'quiz'     },
  quiz_tournoi:    { label: 'Quiz – Tournoi (2 salles)',   capacity: 36,  type: 'quiz'     },
  karaoke_cabaret: { label: 'Karaoké – Cabaret',           capacity: 13,  type: 'karaoke'  },
  karaoke_jungle:  { label: 'Karaoké – Jungle',            capacity: 17,  type: 'karaoke'  },
  privatisation:   { label: 'Privatisation complète',      capacity: null, type: 'full'    },
};

/* ────────────────────────────────────────────────────────────────
   AUTH
──────────────────────────────────────────────────────────────── */
const CRM_PASSWORD  = 'AMIENS2026';
const SESSION_KEY   = 'crm_auth';

function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

function handleLogin() {
  const input = document.getElementById('login-password');
  const err   = document.getElementById('login-error');
  if (!input) return;

  if (input.value.trim() === CRM_PASSWORD) {
    sessionStorage.setItem(SESSION_KEY, '1');
  _phase6Init();
    err.classList.remove('show');
    bootApp();
  } else {
    err.classList.add('show');
    input.value = '';
    input.focus();
    // Shake animation
    const card = document.querySelector('.login-card');
    if (card) { card.style.animation = 'none'; void card.offsetWidth; card.style.animation = ''; }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Enter key on password
  const pw = document.getElementById('login-password');
  if (pw) pw.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

  if (isAuthenticated()) {
    bootApp();
  }
  // else: login overlay remains visible
});

/* ────────────────────────────────────────────────────────────────
   BOOT
──────────────────────────────────────────────────────────────── */
function bootApp() {
  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('crm-shell').classList.remove('hidden');

  // Wire sidebar nav clicks
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.section));
  });

  // Wire global search
  initGlobalSearch(query => {
    if (currentSection === 'pipeline') pipelineSearch(query);
    // Les autres modules brancheront leur propre handler dans leurs phases
  });

  // Initial route
  const hash = location.hash.replace('#', '');
  navigate(SECTIONS[hash] ? hash : 'pipeline');

  // Update KPIs
  updateGlobalKPIs();
}

/* ────────────────────────────────────────────────────────────────
   SECTIONS
──────────────────────────────────────────────────────────────── */
let currentSection = 'pipeline';

const SECTIONS = {
  dashboard:   { title: 'Tableau de bord',  icon: 'fa-house',                     render: renderDashboard    },
  prospection: { title: 'Prospection',      icon: 'fa-magnifying-glass-location', render: renderProspection  },
  companies:   { title: 'Entreprises',      icon: 'fa-building',                  render: renderCompanies    },
  pipeline:    { title: 'Pipeline',         icon: 'fa-table-columns',             render: renderPipeline     },
  quotes:      { title: 'Devis',            icon: 'fa-file-invoice-dollar',       render: renderQuotes       },
  mediatheque: { title: 'Médiathèque',      icon: 'fa-folder-open',               render: renderMediatheque  },
  email:       { title: 'Emails',           icon: 'fa-envelope',                  render: renderEmail        },
  analytics:   { title: 'Analytique',       icon: 'fa-chart-line',                render: renderAnalytics    },
  settings:    { title: 'Paramètres',       icon: 'fa-gear',                      render: renderSettings     },
};

function navigate(section) {
  if (!SECTIONS[section]) section = 'pipeline';
  currentSection = section;

  // Sidebar active state
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.classList.toggle('active', item.dataset.section === section);
  });

  // Header title
  const titleEl = document.getElementById('header-title');
  if (titleEl) titleEl.textContent = SECTIONS[section].title;

  // Clear search
  const searchEl = document.getElementById('global-search');
  if (searchEl) searchEl.value = '';

  // Update URL
  history.replaceState(null, '', '#' + section);

  // Render
  const content = document.getElementById('app-content');
  if (content) content.innerHTML = '';
  SECTIONS[section].render();
}

/* ────────────────────────────────────────────────────────────────
   SIDEBAR TOGGLE
──────────────────────────────────────────────────────────────── */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
  // Persist
  sessionStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed') ? '1' : '0');
}

// Restore sidebar state
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('sidebar_collapsed') === '1') {
    document.getElementById('sidebar')?.classList.add('collapsed');
  }
});

/* ────────────────────────────────────────────────────────────────
   BOUTON "+ NOUVEAU" CONTEXTUEL
──────────────────────────────────────────────────────────────── */
function handleNewButton() {
  switch (currentSection) {
    case 'pipeline':   openAddModal();          break;
    case 'companies':
      if (typeof openAddCompanyModal === 'function') openAddCompanyModal();
      else showToast('Module Entreprises — Phase 2', 'info');
      break;
    case 'quotes':
      if (typeof openAddQuoteModal === 'function') openAddQuoteModal();
      else showToast('Module Devis — Phase 4', 'info');
      break;
    case 'prospection':
      if (typeof openAddProspectModal === 'function') openAddProspectModal();
      else showToast('Module Prospection — Phase 3', 'info');
      break;
    default:
      showToast('Utilisez le module dédié', 'info');
  }
}

/* ────────────────────────────────────────────────────────────────
   VALIDATION CAPACITÉ SALLE (globale, utilisée dans pipeline + devis)
──────────────────────────────────────────────────────────────── */
function validateRoomCapacity(roomKey, nbGuests) {
  if (!roomKey || !nbGuests) return null;
  const room = ROOMS[roomKey];
  if (!room || room.capacity === null) return null; // privatisation = libre
  const n = parseInt(nbGuests);
  if (isNaN(n) || n <= 0) return null;
  if (n > room.capacity) {
    return `⚠️ ${n} participants dépasse la capacité de « ${room.label} » (max. ${room.capacity}).`;
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────
   KPIs HEADER (mis à jour dynamiquement)
──────────────────────────────────────────────────────────────── */
async function updateGlobalKPIs() {
  try {
    const { data } = await _sb
      .from('deals')
      .select('amount, status, date_relance');
    if (!data) return;

    const t = today();

    const pipeline = data
      .filter(d => ['new','progress','urgent'].includes(d.status))
      .reduce((s, d) => s + (Number(d.amount) || 0), 0);

    const won = data
      .filter(d => d.status === 'won')
      .reduce((s, d) => s + (Number(d.amount) || 0), 0);

    const totalClosed = data.filter(d => ['won','lost'].includes(d.status)).length;
    const conv = totalClosed > 0
      ? Math.round(data.filter(d => d.status === 'won').length / totalClosed * 100)
      : 0;

    const relances = data.filter(d =>
      d.date_relance &&
      d.date_relance <= t &&
      !['won','lost'].includes(d.status)
    ).length;

    const el = id => document.getElementById(id);
    if (el('kpi-pipeline')) el('kpi-pipeline').textContent = pipeline.toLocaleString('fr-FR') + ' €';
    if (el('kpi-won'))      el('kpi-won').textContent      = won.toLocaleString('fr-FR') + ' €';
    if (el('kpi-conv'))     el('kpi-conv').textContent     = conv + ' %';
    if (el('kpi-relances')) {
      el('kpi-relances').textContent = relances;
      el('kpi-relances').style.color = relances > 0 ? 'var(--urgent)' : '';
    }

    // Badge notification
    const badge = el('notif-badge');
    if (badge) {
      badge.classList.toggle('show', relances > 0);
    }

    // Remplir le panel notifs
    _fillNotifPanel(data, t);

  } catch (e) {
    console.warn('[updateGlobalKPIs]', e.message);
  }
}

function _fillNotifPanel(deals, t) {
  const list = document.getElementById('notif-list');
  if (!list) return;

  const overdue = deals.filter(d =>
    d.date_relance && d.date_relance <= t && !['won','lost'].includes(d.status)
  );

  if (overdue.length === 0) {
    list.innerHTML = '<div class="notif-empty"><i class="fa-solid fa-check-circle" style="color:var(--won);font-size:1.5rem;display:block;margin:0 auto 8px;opacity:1"></i>Aucune relance en retard</div>';
    return;
  }

  list.innerHTML = overdue.map(d => `
    <div class="notif-item">
      <div class="notif-icon urgent"><i class="fa-solid fa-bell"></i></div>
      <div class="notif-content">
        <div class="notif-title">Relance en retard</div>
        <div style="font-size:0.78rem;color:var(--muted)">Deal #${d.id} — ${formatDate(d.date_relance)}</div>
      </div>
    </div>`).join('');
}

/* ────────────────────────────────────────────────────────────────
   RENDER DASHBOARD → délégué à modules/dashboard.js (Phase 5)
──────────────────────────────────────────────────────────────── */
async function _renderDashboardOld() {
  const content = document.getElementById('app-content');
  if (!content) return;

  content.innerHTML = `<div class="page-loading"><div class="spinner"></div><p>Chargement…</p></div>`;

  const deals = await fetchDeals();
  const t = today();

  // KPIs
  const now     = new Date();
  const startM  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const wonMonth = deals
    .filter(d => d.status === 'won' && d.date_created >= startM)
    .reduce((s, d) => s + (Number(d.amount) || 0), 0);

  const actifs = deals.filter(d => ['new','progress','urgent'].includes(d.status)).length;

  const relancesDues = deals.filter(d =>
    d.date_relance && d.date_relance <= t && !['won','lost'].includes(d.status)
  ).length;

  const totalClosed = deals.filter(d => ['won','lost'].includes(d.status)).length;
  const txConv = totalClosed > 0
    ? Math.round(deals.filter(d => d.status === 'won').length / totalClosed * 100)
    : 0;

  // Répartition par type de salle
  const roomCounts = {};
  deals.forEach(d => {
    if (d.room_type && ROOMS[d.room_type]) {
      const t = ROOMS[d.room_type].type;
      roomCounts[t] = (roomCounts[t] || 0) + 1;
    }
  });

  const kpiColors = {
    won:      'var(--won)',
    progress: 'var(--accent)',
    urgent:   'var(--urgent)',
    conv:     'var(--progress)',
  };

  content.innerHTML = `
    <div style="max-width:960px">

      <div style="margin-bottom:24px">
        <h1 style="font-family:var(--font-head);font-size:1.5rem;font-weight:700;margin-bottom:4px">Tableau de bord</h1>
        <p style="color:var(--muted);font-size:0.85rem">${new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</p>
      </div>

      <!-- KPIs -->
      <div class="dashboard-grid" style="margin-bottom:24px">
        <div class="kpi-card" style="--kpi-color:${kpiColors.won}">
          <div class="kpi-icon"><i class="fa-solid fa-trophy"></i></div>
          <div class="kpi-value">${wonMonth.toLocaleString('fr-FR')} €</div>
          <div class="kpi-label">CA gagné ce mois</div>
        </div>
        <div class="kpi-card" style="--kpi-color:${kpiColors.progress}">
          <div class="kpi-icon"><i class="fa-solid fa-spinner"></i></div>
          <div class="kpi-value">${actifs}</div>
          <div class="kpi-label">Deals actifs</div>
        </div>
        <div class="kpi-card" style="--kpi-color:${kpiColors.urgent}">
          <div class="kpi-icon"><i class="fa-solid fa-bell"></i></div>
          <div class="kpi-value" style="color:${relancesDues>0?'var(--urgent)':'inherit'}">${relancesDues}</div>
          <div class="kpi-label">Relances dues</div>
        </div>
        <div class="kpi-card" style="--kpi-color:${kpiColors.conv}">
          <div class="kpi-icon"><i class="fa-solid fa-percent"></i></div>
          <div class="kpi-value">${txConv} %</div>
          <div class="kpi-label">Taux de conversion</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

        <!-- Répartition par salle -->
        <div class="dashboard-section">
          <h3><i class="fa-solid fa-door-open" style="color:var(--accent);margin-right:8px"></i>Deals par espace</h3>
          ${Object.entries({ quiz:'Quiz', karaoke:'Karaoké', full:'Privatisation' }).map(([type, label]) => {
            const count = roomCounts[type] || 0;
            const colors = { quiz: 'var(--accent)', karaoke: 'var(--progress)', full: 'var(--warning)' };
            return `<div class="room-stat-row">
              <span class="room-stat-label">${label}</span>
              <span class="room-stat-count" style="background:${colors[type]}18;color:${colors[type]}">${count} deal${count!==1?'s':''}</span>
            </div>`;
          }).join('')}
          ${Object.keys(roomCounts).length === 0 ? '<p style="color:var(--muted);font-size:0.83rem;text-align:center;padding:16px 0">Aucun deal avec salle renseignée</p>' : ''}
        </div>

        <!-- Pipeline par statut -->
        <div class="dashboard-section">
          <h3><i class="fa-solid fa-table-columns" style="color:var(--progress);margin-right:8px"></i>Répartition pipeline</h3>
          ${[
            { key:'new',      label:'Nouveau',    color:'var(--new)'      },
            { key:'progress', label:'En cours',   color:'var(--progress)' },
            { key:'urgent',   label:'À relancer', color:'var(--urgent)'   },
            { key:'won',      label:'Gagné',      color:'var(--won)'      },
            { key:'lost',     label:'Perdu',      color:'var(--lost)'     },
          ].map(col => {
            const count = deals.filter(d => d.status === col.key).length;
            return `<div class="room-stat-row">
              <span class="room-stat-label">${col.label}</span>
              <span class="room-stat-count" style="background:${col.color}18;color:${col.color}">${count}</span>
            </div>`;
          }).join('')}
        </div>

      </div>

      <!-- Graphiques placeholder -->
      <div class="dashboard-section" style="margin-top:16px">
        <h3><i class="fa-solid fa-chart-line" style="color:var(--muted);margin-right:8px"></i>Graphiques avancés</h3>
        <div class="chart-placeholder">
          <i class="fa-solid fa-chart-area"></i>
          Les graphiques avancés arrivent dans la <strong>Phase 5</strong> (Analytique).
        </div>
      </div>

    </div>`;
}

/* ────────────────────────────────────────────────────────────────
   PLACEHOLDERS — modules à venir
──────────────────────────────────────────────────────────────── */
function _placeholder(title, icon, phase, description = '') {
  const content = document.getElementById('app-content');
  if (!content) return;
  content.innerHTML = `
    <div class="empty-state">
      <i class="fa-solid ${icon} empty-icon"></i>
      <div class="empty-title">${title}</div>
      <div class="empty-sub">
        ${description || 'Module en cours de développement'}
        <br><br>
        <span style="background:var(--accent-soft);color:var(--accent);padding:4px 12px;border-radius:20px;font-size:0.78rem;font-weight:600">
          Phase ${phase}
        </span>
      </div>
    </div>`;
}

// renderProspection()  → modules/prospection.js  (Phase 2)
// renderCompanies()    → modules/companies.js   (Phase 5)
// renderDashboard()    → modules/dashboard.js   (Phase 5)
// renderQuotes()      → définie dans modules/quotes.js       (Phase 3)
// renderMediatheque() → définie dans modules/mediatheque.js   (Phase 4)
// renderEmail()       → définie dans modules/email.js         (Phase 4)
// renderAnalytics() → modules/analytics.js (Phase 6)
// renderSettings()  → modules/settings.js  (Phase 6)
