// ============================================================
// analytics.js — Analytique avancée par période
// ============================================================

let analyticsCharts = [];
let analyticsPeriod = 30; // jours

// ============================================================
// RENDER PRINCIPAL
// ============================================================

async function renderAnalytics() {
  const main = document.getElementById('main-content');
  if (!main) return;

  analyticsCharts.forEach(c => c.destroy());
  analyticsCharts = [];

  main.innerHTML = `
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <div>
        <h1 style="margin:0;font-family:var(--font-head);font-size:24px;font-weight:600;">Analytique</h1>
        <p style="margin:4px 0 0;font-size:13px;color:var(--muted);">Analyse détaillée de vos performances commerciales</p>
      </div>
      <div style="display:flex;gap:6px;" id="analytics-period-btns">
        <button class="period-btn active" data-days="30" style="padding:7px 14px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:var(--accent);color:#fff;">30 jours</button>
        <button class="period-btn" data-days="90" style="padding:7px 14px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:var(--surface);color:var(--text);">3 mois</button>
        <button class="period-btn" data-days="180" style="padding:7px 14px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:var(--surface);color:var(--text);">6 mois</button>
        <button class="period-btn" data-days="365" style="padding:7px 14px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:var(--surface);color:var(--text);">12 mois</button>
      </div>
    </div>

    <!-- Résumé textuel -->
    <div id="analytics-summary" style="background:var(--accent-soft);border:1px solid rgba(91,76,240,0.15);border-radius:var(--radius);padding:20px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <i class="fas fa-chart-pie" style="color:var(--accent);"></i>
        <h3 style="margin:0;font-size:15px;font-weight:600;font-family:var(--font-head);">Résumé de la période</h3>
      </div>
      <p id="analytics-summary-text" style="margin:0;font-size:14px;line-height:1.7;color:var(--text);">Chargement…</p>
    </div>

    <!-- Section Revenus -->
    <div style="margin-bottom:24px;">
      <h3 style="font-family:var(--font-head);font-size:16px;font-weight:600;margin:0 0 14px;">Revenus</h3>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
          <div style="position:relative;height:200px;"><canvas id="analytics-revenue-chart"></canvas></div>
        </div>
        <div style="display:grid;gap:12px;" id="analytics-revenue-kpis"></div>
      </div>
    </div>

    <!-- Section Pipeline -->
    <div style="margin-bottom:24px;">
      <h3 style="font-family:var(--font-head);font-size:16px;font-weight:600;margin:0 0 14px;">Santé du Pipeline</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
          <div style="position:relative;height:200px;"><canvas id="analytics-pipeline-chart"></canvas></div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
          <h4 style="margin:0 0 12px;font-size:14px;font-weight:600;">Goulots d'étranglement</h4>
          <div id="analytics-bottlenecks"></div>
        </div>
      </div>
    </div>

    <!-- Section Devis + Sources -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
        <h4 style="margin:0 0 12px;font-size:14px;font-weight:600;">Performance des devis</h4>
        <div id="analytics-quotes-kpis"></div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
        <h4 style="margin:0 0 12px;font-size:14px;font-weight:600;">Sources de leads</h4>
        <canvas id="analytics-sources-chart" height="200" style="max-height:200px;"></canvas>
      </div>
    </div>
  `;

  // Bind période
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => {
        b.style.background = 'var(--surface)'; b.style.color = 'var(--text)'; b.classList.remove('active');
      });
      btn.style.background = 'var(--accent)'; btn.style.color = '#fff'; btn.classList.add('active');
      analyticsPeriod = parseInt(btn.dataset.days);
      loadAnalyticsData();
    });
  });

  await loadAnalyticsData();
}

// ============================================================
// CHARGEMENT
// ============================================================

async function loadAnalyticsData() {
  analyticsCharts.forEach(c => c.destroy());
  analyticsCharts = [];

  Loader.show();
  try {
    const [d, c, q] = await Promise.allSettled([
      CRM.getDeals(),
      CRM.getCompanies(),
      CRM.getQuotes(),
    ]);
    const deals = d.status === 'fulfilled' ? d.value : [];
    const companies = c.status === 'fulfilled' ? c.value : [];
    const quotes = q.status === 'fulfilled' ? q.value : [];

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - analyticsPeriod);
    const cutoffISO = cutoff.toISOString();

    const periodDeals = deals.filter(d => d.created_at >= cutoffISO);
    const periodQuotes = quotes.filter(q => q.created_at >= cutoffISO);

    renderRevenueSection(periodDeals, deals);
    renderPipelineSection(periodDeals, deals);
    renderBottlenecks(deals);
    renderQuotesSection(periodQuotes);
    renderSourcesChart(periodDeals, companies);
    renderSummaryText(periodDeals, periodQuotes, deals, companies);

  } catch (err) {
    console.error('[Analytics] Erreur:', err);
    Toast.error(`Analytics : ${err.message || err}`);
  } finally {
    Loader.hide();
  }
}

// ============================================================
// REVENUS
// ============================================================

function renderRevenueSection(periodDeals, allDeals) {
  const wonPeriod = periodDeals.filter(d => d.status === 'Gagné');
  const totalRevenue = wonPeriod.reduce((s, d) => s + (d.amount || 0), 0);
  const avgDealSize = wonPeriod.length ? totalRevenue / wonPeriod.length : 0;
  const biggestDeal = wonPeriod.reduce((max, d) => (d.amount || 0) > (max?.amount || 0) ? d : max, null);

  // KPIs
  const kpisContainer = document.getElementById('analytics-revenue-kpis');
  if (kpisContainer) {
    kpisContainer.innerHTML = [
      kpiMiniCard('CA période', Fmt.currency(totalRevenue), 'fa-euro-sign', 'var(--won)'),
      kpiMiniCard('Deals gagnés', wonPeriod.length, 'fa-trophy', 'var(--won)'),
      kpiMiniCard('Panier moyen', Fmt.currency(avgDealSize), 'fa-shopping-cart', 'var(--accent)'),
      kpiMiniCard('Plus gros deal', biggestDeal ? Fmt.currency(biggestDeal.amount) : '—', 'fa-gem', 'var(--warning)'),
    ].join('');
  }

  // Chart
  const ctx = document.getElementById('analytics-revenue-chart');
  if (!ctx) return;

  const { labels, values } = buildTimeSeriesData(wonPeriod, analyticsPeriod);

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'CA gagné (€)',
        data: values,
        backgroundColor: 'rgba(22, 163, 74, 0.15)',
        borderColor: '#16a34a',
        borderWidth: 2,
        borderRadius: 6,
      }]
    },
    options: chartDefaults('€'),
  });
  analyticsCharts.push(chart);
}

// ============================================================
// PIPELINE
// ============================================================

function renderPipelineSection(periodDeals) {
  const ctx = document.getElementById('analytics-pipeline-chart');
  if (!ctx) return;

  const statuses = CONFIG.PIPELINE_STATUSES;
  const data = statuses.map(s => periodDeals.filter(d => d.status === s).length);
  const colors = ['#5b4cf0', '#0284c7', '#d97706', '#16a34a', '#dc2626'];

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: statuses,
      datasets: [{
        label: 'Nombre de deals',
        data,
        backgroundColor: colors.map(c => c + '30'),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 6,
      }]
    },
    options: chartDefaults(''),
  });
  analyticsCharts.push(chart);
}

function renderBottlenecks(allDeals) {
  const container = document.getElementById('analytics-bottlenecks');
  if (!container) return;

  const activeDeals = allDeals.filter(d => ['Nouveau', 'En cours', 'À relancer'].includes(d.status));
  const stuckDeals = activeDeals.filter(d => {
    if (!d.updated_at) return false;
    const daysSinceUpdate = Math.round((new Date() - new Date(d.updated_at)) / (1000 * 60 * 60 * 24));
    return daysSinceUpdate > 21;
  });

  if (!stuckDeals.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--won);">
        <i class="fas fa-check-circle" style="font-size:28px;margin-bottom:8px;display:block;"></i>
        <p style="margin:0;font-size:13px;font-weight:500;">Aucun deal bloqué depuis plus de 21 jours</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <p style="font-size:12px;color:var(--urgent);margin:0 0 12px;"><i class="fas fa-exclamation-triangle"></i> ${stuckDeals.length} deal${stuckDeals.length > 1 ? 's' : ''} bloqué${stuckDeals.length > 1 ? 's' : ''} depuis plus de 21 jours</p>
    ${stuckDeals.slice(0, 5).map(d => {
      const days = Math.round((new Date() - new Date(d.updated_at)) / (1000 * 60 * 60 * 24));
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
          <div style="width:8px;height:8px;border-radius:50%;background:var(--urgent);flex-shrink:0;"></div>
          <div style="flex:1;">
            <span style="font-weight:500;">${d.title}</span>
            <span style="color:var(--muted);margin-left:6px;">${d.status}</span>
          </div>
          <span style="color:var(--urgent);font-weight:600;font-size:12px;">${days}j</span>
        </div>
      `;
    }).join('')}
  `;
}

// ============================================================
// DEVIS
// ============================================================

function renderQuotesSection(periodQuotes) {
  const container = document.getElementById('analytics-quotes-kpis');
  if (!container) return;

  const total = periodQuotes.length;
  const signed = periodQuotes.filter(q => q.status === 'Signé');
  const refused = periodQuotes.filter(q => q.status === 'Refusé');
  const acceptRate = total ? Math.round((signed.length / total) * 100) : 0;

  // Délai moyen signature
  const signedWithDates = signed.filter(q => q.created_at && q.signed_at);
  const avgSignDays = signedWithDates.length
    ? Math.round(signedWithDates.reduce((s, q) => s + Math.round((new Date(q.signed_at) - new Date(q.created_at)) / 86400000), 0) / signedWithDates.length)
    : 0;

  const totalValue = signed.reduce((s, q) => s + (q.total_ttc || 0), 0);

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      ${kpiMiniCard('Devis créés', total, 'fa-file-invoice', 'var(--accent)')}
      ${kpiMiniCard('Taux acceptation', Fmt.percent(acceptRate), 'fa-check-circle', 'var(--won)')}
      ${kpiMiniCard('Délai signature moy.', `${avgSignDays}j`, 'fa-clock', 'var(--progress)')}
      ${kpiMiniCard('Valeur signée', Fmt.currency(totalValue), 'fa-euro-sign', 'var(--won)')}
    </div>
    <div style="margin-top:16px;display:grid;gap:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;">
        <span>Signés</span>
        <span style="font-weight:600;color:var(--won);">${signed.length}</span>
      </div>
      <div style="height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${acceptRate}%;background:var(--won);border-radius:4px;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;">
        <span>Refusés</span>
        <span style="font-weight:600;color:var(--urgent);">${refused.length}</span>
      </div>
      <div style="height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${total ? Math.round((refused.length / total) * 100) : 0}%;background:var(--urgent);border-radius:4px;"></div>
      </div>
    </div>
  `;
}

// ============================================================
// SOURCES DE LEADS
// ============================================================

function renderSourcesChart(periodDeals, companies) {
  const ctx = document.getElementById('analytics-sources-chart');
  if (!ctx) return;

  const sourceMap = {};
  periodDeals.forEach(d => {
    const source = d.source || 'Autre';
    sourceMap[source] = (sourceMap[source] || 0) + 1;
  });

  const labels = Object.keys(sourceMap);
  const values = Object.values(sourceMap);

  if (!labels.length) {
    ctx.parentElement.insertAdjacentHTML('beforeend', '<p style="text-align:center;color:var(--muted);font-size:13px;">Aucune donnée</p>');
    return;
  }

  const colors = ['#5b4cf0', '#0284c7', '#d97706', '#16a34a', '#dc2626', '#8b5cf6', '#ec4899', '#9a9690'];

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
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'DM Sans', size: 11 }, padding: 10, usePointStyle: true, pointStyle: 'circle' },
        }
      }
    }
  });
  analyticsCharts.push(chart);
}

// ============================================================
// RÉSUMÉ TEXTUEL
// ============================================================

function renderSummaryText(periodDeals, periodQuotes, allDeals, companies) {
  const el = document.getElementById('analytics-summary-text');
  if (!el) return;

  const won = periodDeals.filter(d => d.status === 'Gagné');
  const lost = periodDeals.filter(d => d.status === 'Perdu');
  const revenue = won.reduce((s, d) => s + (d.amount || 0), 0);
  const active = periodDeals.filter(d => ['Nouveau', 'En cours', 'À relancer'].includes(d.status));
  const pipelineVal = active.reduce((s, d) => s + (d.amount || 0), 0);
  const quoteSigned = periodQuotes.filter(q => q.status === 'Signé').length;
  const stuckCount = allDeals.filter(d => {
    if (!['Nouveau', 'En cours', 'À relancer'].includes(d.status)) return false;
    if (!d.updated_at) return false;
    return Math.round((new Date() - new Date(d.updated_at)) / 86400000) > 21;
  }).length;

  // Top source
  const sourceCount = {};
  periodDeals.forEach(d => { const s = d.source || 'Autre'; sourceCount[s] = (sourceCount[s] || 0) + 1; });
  const topSource = Object.entries(sourceCount).sort((a, b) => b[1] - a[1])[0];

  const parts = [];
  parts.push(`Sur les ${analyticsPeriod} derniers jours, vous avez généré <strong>${Fmt.currency(revenue)}</strong> de CA avec <strong>${won.length} deal${won.length > 1 ? 's' : ''} gagné${won.length > 1 ? 's' : ''}</strong>.`);

  if (lost.length > 0) {
    parts.push(`${lost.length} deal${lost.length > 1 ? 's ont été perdus' : ' a été perdu'}.`);
  }

  parts.push(`Votre pipeline actif contient <strong>${active.length} deal${active.length > 1 ? 's' : ''}</strong> pour un potentiel de <strong>${Fmt.currency(pipelineVal)}</strong>.`);

  if (stuckCount > 0) {
    parts.push(`⚠️ <strong>${stuckCount} deal${stuckCount > 1 ? 's' : ''}</strong> ${stuckCount > 1 ? 'sont bloqués' : 'est bloqué'} depuis plus de 21 jours — pensez à les relancer ou les clôturer.`);
  }

  if (quoteSigned > 0) {
    parts.push(`${quoteSigned} devis ${quoteSigned > 1 ? 'ont été signés' : 'a été signé'} sur la période.`);
  }

  if (topSource) {
    parts.push(`Votre principale source de leads est <strong>${topSource[0]}</strong> (${topSource[1]} deal${topSource[1] > 1 ? 's' : ''}).`);
  }

  el.innerHTML = parts.join(' ');
}

// ============================================================
// HELPERS
// ============================================================

function kpiMiniCard(label, value, icon, color) {
  return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <i class="fas ${icon}" style="color:${color};font-size:13px;"></i>
        <span style="font-size:11px;color:var(--muted);font-weight:500;">${label}</span>
      </div>
      <div style="font-size:18px;font-weight:700;color:var(--text);">${value}</div>
    </div>
  `;
}

function buildTimeSeriesData(deals, periodDays) {
  const now = new Date();
  const labels = [];
  const values = [];

  if (periodDays <= 30) {
    // Par semaine
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      labels.push(`S-${i}`);
      const weekDeals = deals.filter(d => {
        const dt = new Date(d.updated_at || d.created_at);
        return dt >= weekStart && dt < weekEnd;
      });
      values.push(weekDeals.reduce((s, d) => s + (d.amount || 0), 0));
    }
  } else {
    // Par mois
    const months = Math.ceil(periodDays / 30);
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleDateString('fr-FR', { month: 'short' }));
      const monthDeals = deals.filter(deal => {
        const dt = new Date(deal.updated_at || deal.created_at);
        return dt.getMonth() === d.getMonth() && dt.getFullYear() === d.getFullYear();
      });
      values.push(monthDeals.reduce((s, dl) => s + (dl.amount || 0), 0));
    }
  }

  return { labels, values };
}

function chartDefaults(unit) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => unit === '€' ? Fmt.currency(ctx.parsed.y) : `${ctx.parsed.y}`,
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (v) => unit === '€' ? (v >= 1000 ? `${(v/1000).toFixed(0)}k€` : `${v}€`) : v,
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
  };
}
