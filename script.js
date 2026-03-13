// ============================================================
// script.js — Auth, Router SPA, Sidebar, Init global
// Chargé EN DERNIER après tous les modules
// ============================================================

// ============================================================
// AUTH
// ============================================================

/** Timeout helper — résout avec fallback si la promesse dépasse le délai */
function withTimeout(promise, ms, fallback = null) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function handleLogin() {
  const input = document.getElementById('login-password');
  const btn = document.getElementById('login-btn');
  if (!input) return;

  const password = input.value.trim();
  if (!password) {
    showLoginError('Entrez le mot de passe');
    return;
  }

  // Loading state
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i>Connexion…';
  }
  hideLoginError();

  // 1) Vérification du mot de passe — d'abord localement, puis Supabase avec timeout 3s
  let storedPassword = CONFIG.CRM_PASSWORD;
  try {
    const dbPw = await withTimeout(Settings.get('crm_password'), 3000, null);
    if (dbPw) storedPassword = dbPw;
  } catch {
    // Fallback silencieux vers CONFIG.CRM_PASSWORD
  }

  if (password !== storedPassword) {
    showLoginError('Mot de passe incorrect');
    input.value = '';
    input.focus();
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-arrow-right-to-bracket" style="margin-right:6px;"></i>Se connecter';
    }
    return;
  }

  // 2) Mot de passe OK → afficher l'app IMMÉDIATEMENT
  sessionStorage.setItem('crm_authenticated', 'true');
  showApp();

  // 3) Charger les settings Supabase en arrière-plan (non bloquant)
  loadUserSettingsInBackground();
}

/** Charge nom utilisateur + clé Maps après connexion, sans bloquer l'UI */
async function loadUserSettingsInBackground() {
  try {
    const userName = await withTimeout(Settings.get('user_name'), 3000, null);
    if (userName) {
      sessionStorage.setItem('crm_user_name', userName);
      const el = document.getElementById('sidebar-user-name');
      if (el) el.textContent = userName;
    }
  } catch {}

  try {
    await withTimeout(loadGoogleMapsKeyFromSettings(), 3000);
  } catch {}
}

function showLoginError(message) {
  const errorEl = document.getElementById('login-error');
  if (errorEl) {
    errorEl.innerHTML = `<i class="fas fa-exclamation-circle" style="margin-right:6px;"></i>${message}`;
    errorEl.style.display = 'block';
  }
}

function hideLoginError() {
  const errorEl = document.getElementById('login-error');
  if (errorEl) errorEl.style.display = 'none';
}

function checkAuth() {
  return sessionStorage.getItem('crm_authenticated') === 'true';
}

function showApp() {
  const loginScreen = document.getElementById('login-screen');
  const appShell = document.getElementById('app-shell');
  if (loginScreen) loginScreen.style.display = 'none';
  if (appShell) appShell.style.display = 'flex';

  // Mettre à jour le nom dans la sidebar
  const userName = sessionStorage.getItem('crm_user_name');
  const userNameEl = document.getElementById('sidebar-user-name');
  if (userNameEl && userName) userNameEl.textContent = userName;

  // Naviguer vers le dashboard par défaut
  navigateTo('dashboard');
}

function showLogin() {
  const loginScreen = document.getElementById('login-screen');
  const appShell = document.getElementById('app-shell');
  if (loginScreen) loginScreen.style.display = 'flex';
  if (appShell) appShell.style.display = 'none';

  // Focus le champ mot de passe
  setTimeout(() => {
    const input = document.getElementById('login-password');
    if (input) input.focus();
  }, 100);
}

// ============================================================
// ROUTER SPA
// ============================================================

const ROUTES = {
  dashboard:   { label: 'Dashboard',     icon: 'fa-chart-pie',       render: 'renderDashboard'   },
  pipeline:    { label: 'Pipeline',      icon: 'fa-columns',         render: 'renderPipeline'    },
  prospection: { label: 'Prospection',   icon: 'fa-map-marked-alt',  render: 'renderProspection' },
  companies:   { label: 'Entreprises',   icon: 'fa-building',        render: 'renderCompanies'   },
  quotes:      { label: 'Devis',         icon: 'fa-file-invoice',    render: 'renderQuotes'      },
  analytics:   { label: 'Analytique',    icon: 'fa-chart-bar',       render: 'renderAnalytics'   },
  settings:    { label: 'Paramètres',    icon: 'fa-cog',             render: 'renderSettings'    },
};

let currentRoute = 'dashboard';

function navigateTo(route) {
  if (!ROUTES[route]) {
    console.warn(`[Router] Route inconnue : ${route}`);
    Toast.error(`Module "${route}" introuvable`);
    return;
  }

  currentRoute = route;

  // Mettre à jour la sidebar
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    const isActive = item.dataset.route === route;
    item.style.background = isActive ? 'var(--accent-soft)' : 'transparent';
    item.style.color = isActive ? 'var(--accent)' : 'var(--text)';
    item.style.fontWeight = isActive ? '600' : '400';
  });

  // Appeler la fonction de rendu
  const renderFn = ROUTES[route].render;
  if (typeof window[renderFn] === 'function') {
    try {
      window[renderFn]();
    } catch (err) {
      console.error(`[Router] Erreur rendu ${route}:`, err);
      const main = document.getElementById('main-content');
      if (main) {
        main.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;text-align:center;">
            <i class="fas fa-exclamation-triangle" style="font-size:48px;color:var(--warning);margin-bottom:16px;"></i>
            <h2 style="margin:0 0 8px;font-family:var(--font-head);">Erreur de chargement</h2>
            <p style="color:var(--muted);font-size:14px;margin:0 0 16px;">Le module "${ROUTES[route].label}" a rencontré une erreur.</p>
            <button class="btn-primary" style="padding:10px 20px;border-radius:8px;cursor:pointer;" onclick="navigateTo('dashboard')">
              Retour au Dashboard
            </button>
          </div>
        `;
      }
    }
  } else {
    console.error(`[Router] Fonction ${renderFn}() non trouvée. Le fichier JS correspondant est-il bien chargé ?`);
    const main = document.getElementById('main-content');
    if (main) {
      main.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;text-align:center;">
          <i class="fas fa-puzzle-piece" style="font-size:48px;color:var(--muted);margin-bottom:16px;opacity:0.5;"></i>
          <h2 style="margin:0 0 8px;font-family:var(--font-head);">Module non chargé</h2>
          <p style="color:var(--muted);font-size:14px;margin:0;">La fonction <code>${renderFn}()</code> est introuvable.<br>Vérifiez que le fichier JS est bien inclus dans index.html.</p>
        </div>
      `;
    }
  }
}

// ============================================================
// SIDEBAR NAVIGATION SETUP
// ============================================================

function setupSidebar() {
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const route = item.dataset.route;
      if (route) navigateTo(route);
    });
  });
}

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Setup login
  const loginBtn = document.getElementById('login-btn');
  const loginInput = document.getElementById('login-password');

  if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
  }
  if (loginInput) {
    loginInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
  }

  // Setup sidebar
  setupSidebar();

  // Vérifier si déjà authentifié
  if (checkAuth()) {
    showApp();
    // Charger les settings en arrière-plan (non bloquant)
    loadUserSettingsInBackground();
  } else {
    showLogin();
  }
});
