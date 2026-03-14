// ============================================================
// dashboard.js — Dashboard KPIs, Chart.js, Agenda, Top Deals
// ============================================================

let dashboardCharts = [];

// ============================================================
// RENDER PRINCIPAL
// ============================================================

async function renderDashboard() {
  const main = document.getElementById('main-content');
  if (!main) return;

  // Détruire les anciens charts
  dashboardCharts.forEach(c => c.destroy());
  dashboardCharts = [];

  main.innerHTML = `
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
      <div>
        <h1 style="margin:0;font-family:var(--font-head);font-size:24px;font-weight:600;">Dashboard</h1>
        <p style="margin:4px 0 0;font-size:13px;color:var(--muted);">Vue d'ensemble de votre activité commerciale</p>
      </div>
      <div style="font-size:13px;color:var(--muted);">
        <i class="fas fa-calendar"></i> ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
    </div>

    <!-- KPI Cards -->
    <div id="dashboard-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px;">
      ${kpiCardSkeleton(6)}
    </div>

    <!-- Charts row -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:24px;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
        <h3 style="margin:0 0 16px;font-size:15px;font-weight:600;font-family:var(--font-head);">CA sur 12 mois</h3>
        <div style="position:relative;height:220px;"><canvas id="chart-ca-12m"></canvas></div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
        <h3 style="margin:0 0 16px;font-size:15px;font-weight:600;font-family:var(--font-head);">Répartition par secteur</h3>
        <div style="position:relative;height:220px;"><canvas id="chart-sectors"></canvas></div>
      </div>
    </div>

    <!-- Bottom row -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;">
      <!-- Funnel -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
        <h3 style="margin:0 0 16px;font-size:15px;font-weight:600;font-family:var(--font-head);">Funnel de conversion</h3>
        <div id="dashboard-funnel"></div>
      </div>
      <!-- Agenda du jour -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
        <h3 style="margin:0 0 16px;font-size:15px;font-weight:600;font-family:var(--font-head);">
          <i class="fas fa-bell" style="color:var(--warning);font-size:13px;"></i> Relances du jour
        </h3>
        <div id="dashboard-agenda"></div>
      </div>
      <!-- Top deals -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
        <h3 style="margin:0 0 16px;font-size:15px;font-weight:600;font-family:var(--font-head);">Top 5 deals à prioriser</h3>
        <div id="dashboard-top-deals"></div>
      </div>
    </div>
  `;

  await loadDashboardData();
}

function kpiCardSkeleton(count) {
  return Array(count).fill(`
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;">
      <div style="height:12px;width:60%;background:var(--surface2);border-radius:4px;margin-bottom:10px;"></div>
      <div style="height:24px;width:40%;background:var(--surface2);border-radius:4px;"></div>
    </div>
  `).join('');
}

// ============================================================
// CHARGEMENT DES DONNÉES
// ============================================================

async function loadDashboardData() {
  try {
    // Chargement individuel — si une table échoue, les autres fonctionnent quand même
    const deals = await safeQuery(() => CRM.getDeals(), 'deals');
    const companies = await safeQuery(() => CRM.getCompanies(), 'companies');
    const quotes = await safeQuery(() => CRM.getQuotes(), 'quotes');
    const relancesDues = await safeQuery(() => CRM.getRelancesDues(), 'relances');

    // --- KPIs ---
    const monthRevenue = deals
      .filter(d => d.status === 'Gagné' && isThisMonth(d.updated_at))
      .reduce((s, d) => s + (d.amount || 0), 0);

    const pipelineTotal = deals
      .filter(d => ['Nouveau', 'En cours', 'À relancer'].includes(d.status))
      .reduce((s, d) => s + (d.amount || 0), 0);

    const totalDeals = deals.length;
    const wonDeals = deals.filter(d => d.status === 'Gagné').length;
    const conversionRate = totalDeals ? Math.round((wonDeals / totalDeals) * 100) : 0;

    // Délai moyen closing (jours entre création et gagné)
    const wonDealsData = deals.filter(d => d.status === 'Gagné' && d.created_at && d.updated_at);
    const avgClosingDays = wonDealsData.length
      ? Math.round(wonDealsData.reduce((s, d) => s + daysBetween(d.created_at, d.updated_at), 0) / wonDealsData.length)
      : 0;

    const pendingQuotes = quotes.filter(q => ['Brouillon', 'Envoyé', 'Négociation'].includes(q.status)).length;

    renderKPIs(monthRevenue, pipelineTotal, relancesDues.length, conversionRate, avgClosingDays, pendingQuotes);

    // --- Charts ---
    renderCA12Chart(deals);
    renderSectorsChart(deals, companies);
    renderFunnel(deals);
    renderAgenda(relancesDues, companies);
    renderTopDeals(deals, companies);

  } catch (err) {
    console.error('[Dashboard] Erreur:', err);
    Toast.error(`Dashboard : ${err.message || err}`);
  }
}

/** Exécute une requête, retourne [] en cas d'erreur au lieu de planter */
async function safeQuery(fn, label) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[Dashboard] Erreur chargement ${label}:`, err.message || err);
    return [];
  }
}

// ============================================================
// KPI CARDS
// ============================================================

function renderKPIs(monthRevenue, pipelineTotal, relances, convRate, avgDays, pendingQuotes) {
  const container = document.getElementById('dashboard-kpis');
  if (!container) return;

  const kpis = [
    { label: 'CA du mois', value: Fmt.currency(monthRevenue), icon: 'fa-euro-sign', color: 'var(--won)', bg: 'var(--won-soft)' },
    { label: 'Pipeline actif', value: Fmt.currency(pipelineTotal), icon: 'fa-chart-line', color: 'var(--accent)', bg: 'var(--accent-soft)' },
    { label: 'Relances dues', value: relances, icon: 'fa-bell', color: relances > 0 ? 'var(--warning)' : 'var(--muted)', bg: relances > 0 ? 'var(--warning-soft)' : 'var(--surface2)' },
    { label: 'Taux conversion', value: Fmt.percent(convRate), icon: 'fa-bullseye', color: 'var(--progress)', bg: 'var(--progress-soft)' },
    { label: 'Délai closing moy.', value: `${avgDays}j`, icon: 'fa-clock', color: 'var(--muted)', bg: 'var(--surface2)' },
    { label: 'Devis en attente', value: pendingQuotes, icon: 'fa-file-invoice', color: pendingQuotes > 0 ? 'var(--accent)' : 'var(--muted)', bg: pendingQuotes > 0 ? 'var(--accent-soft)' : 'var(--surface2)' },
  ];

  container.innerHTML = kpis.map(k => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;transition:transform 0.15s;"
      onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow)'"
      onmouseleave="this.style.transform='none';this.style.boxShadow='none'">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:34px;height:34px;border-radius:8px;background:${k.bg};display:flex;align-items:center;justify-content:center;">
          <i class="fas ${k.icon}" style="color:${k.color};font-size:14px;"></i>
        </div>
        <span style="font-size:12px;color:var(--muted);font-weight:500;">${k.label}</span>
      </div>
      <div style="font-size:22px;font-weight:700;color:var(--text);font-family:var(--font-body);">${k.value}</div>
    </div>
  `).join('');
}

// ============================================================
// CHART — CA 12 MOIS
// ============================================================

function renderCA12Chart(deals) {
  const ctx = document.getElementById('chart-ca-12m');
  if (!ctx) return;

  const months = [];
  const values = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    months.push(label);

    const monthRevenue = deals
      .filter(deal => deal.status === 'Gagné' && deal.updated_at && isSameMonth(deal.updated_at, d))
      .reduce((s, deal) => s + (deal.amount || 0), 0);
    values.push(monthRevenue);
  }

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [{
        label: 'CA (€)',
        data: values,
        backgroundColor: 'rgba(91, 76, 240, 0.15)',
        borderColor: '#5b4cf0',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => Fmt.currency(ctx.parsed.y),
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v) => v >= 1000 ? `${(v/1000).toFixed(0)}k€` : `${v}€`,
            font: { family: 'DM Sans', size: 11 },
            color: '#9a9690',
          },
          grid: { color: 'rgba(0,0,0,0.04)' },
        },
        x: {
          ticks: { font: { family: 'DM Sans', size: 11 }, color: '#9a9690' },
          grid: { display: false },
        }
      }
    }
  });
  dashboardCharts.push(chart);
}

// ============================================================
// CHART — RÉPARTITION PAR SECTEUR
// ============================================================

function renderSectorsChart(deals, companies) {
  const ctx = document.getElementById('chart-sectors');
  if (!ctx) return;

  const sectorMap = {};
  deals.filter(d => d.status === 'Gagné').forEach(d => {
    const comp = companies.find(c => c.id === d.company_id);
    const sector = comp?.sector || 'Autre';
    sectorMap[sector] = (sectorMap[sector] || 0) + (d.amount || 0);
  });

  const labels = Object.keys(sectorMap);
  const values = Object.values(sectorMap);
  const colors = ['#5b4cf0', '#0284c7', '#d97706', '#16a34a', '#dc2626', '#8b5cf6', '#9a9690'];

  if (!labels.length) {
    ctx.parentElement.innerHTML += '<p style="text-align:center;color:var(--muted);font-size:13px;">Aucune donnée</p>';
    return;
  }

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 0,
        spacing: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'DM Sans', size: 11 }, padding: 12, usePointStyle: true, pointStyle: 'circle' }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${Fmt.currency(ctx.parsed)}`,
          }
        }
      }
    }
  });
  dashboardCharts.push(chart);
}

// ============================================================
// FUNNEL DE CONVERSION
// ============================================================

function renderFunnel(deals) {
  const container = document.getElementById('dashboard-funnel');
  if (!container) return;

  const stages = CONFIG.PIPELINE_STATUSES.filter(s => s !== 'Perdu');
  const maxCount = Math.max(...stages.map(s => deals.filter(d => d.status === s).length), 1);

  container.innerHTML = stages.map((status, i) => {
    const count = deals.filter(d => d.status === status).length;
    const pct = Math.max((count / maxCount) * 100, 15);
    const colors = {
      'Nouveau':    'var(--accent)',
      'En cours':   'var(--progress)',
      'À relancer': 'var(--warning)',
      'Gagné':      'var(--won)',
    };
    const color = colors[status] || 'var(--muted)';

    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
          <span style="font-weight:500;">${status}</span>
          <span style="color:var(--muted);">${count}</span>
        </div>
        <div style="height:24px;background:var(--surface2);border-radius:6px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:6px;transition:width 0.5s;opacity:${1 - i * 0.15};"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
// AGENDA (relances dues)
// ============================================================

function renderAgenda(relances, companies) {
  const container = document.getElementById('dashboard-agenda');
  if (!container) return;

  if (!relances.length) {
    container.innerHTML = `<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px;">
      <i class="fas fa-check-circle" style="font-size:24px;margin-bottom:8px;color:var(--won);display:block;"></i>
      Aucune relance due ! 🎉
    </div>`;
    return;
  }

  container.innerHTML = relances.slice(0, 8).map(d => {
    const comp = companies.find(c => c.id === d.company_id);
    const overdue = d.date_relance < new Date().toISOString().split('T')[0];
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${overdue ? 'var(--urgent)' : 'var(--warning)'};flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.title || 'Sans titre'}</div>
          <div style="font-size:11px;color:var(--muted);">${comp?.name || ''} · ${Fmt.dateRelative(d.date_relance)}</div>
        </div>
        <span style="font-weight:600;font-size:12px;white-space:nowrap;">${Fmt.currency(d.amount)}</span>
      </div>
    `;
  }).join('');
}

// ============================================================
// TOP 5 DEALS
// ============================================================

function renderTopDeals(deals, companies) {
  const container = document.getElementById('dashboard-top-deals');
  if (!container) return;

  const activeDeals = deals
    .filter(d => ['Nouveau', 'En cours', 'À relancer'].includes(d.status))
    .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
    .slice(0, 5);

  if (!activeDeals.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--muted);font-size:13px;padding:20px;">Aucun deal actif</p>';
    return;
  }

  container.innerHTML = activeDeals.map((d, i) => {
    const comp = companies.find(c => c.id === d.company_id);
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
        <div style="width:22px;height:22px;border-radius:50%;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--accent);flex-shrink:0;">
          ${i + 1}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.title}</div>
          <div style="font-size:11px;color:var(--muted);">${comp?.name || ''}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:600;font-size:13px;">${Fmt.currency(d.amount)}</div>
          <div style="width:50px;margin-top:4px;">${Fmt.scoreBar(d.priority_score)}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
// HELPERS DATE
// ============================================================

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isSameMonth(dateStr, ref) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
}

function daysBetween(a, b) {
  return Math.round(Math.abs(new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}
