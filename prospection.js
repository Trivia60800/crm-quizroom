// ============================================================
// prospection.js — Recherche Google Places exhaustive
// Recherche par nom exact OU par secteur d'activité
// Types personnalisables, pagination complète (jusqu'à 60 résultats)
// ============================================================

let prospectionMap       = null;
let prospectionMarkers   = [];
let prospectionService   = null;
let prospectionInfoWindow = null;
let prospectionAllResults = []; // cache des résultats courants
let prospectionCustomTypes = []; // types d'établissements editables
let prospectionSearchAborted = false;

// Types prédéfinis (modifiables dans l'UI)
const DEFAULT_PROSPECT_TYPES = [
  'Agence bancaire',
  'Agence immobilière',
  'Cabinet comptable',
  'Cabinet médical',
  'Centre commercial',
  'Collectivité / Mairie',
  'CSE / Comité d\'entreprise',
  'École / Université',
  'Entreprise industrielle',
  'Hôtel',
  'Pharmacie',
  'Restaurant / Traiteur',
  'Salle de sport / Fitness',
  'Salon de coiffure / Beauté',
  'Supermarché / Grande surface',
];

// ============================================================
// CHARGEMENT DES TYPES PERSONNALISÉS
// ============================================================

async function loadCustomTypes() {
  try {
    const stored = await Settings.get('prospection_custom_types', null);
    if (stored && Array.isArray(stored)) {
      prospectionCustomTypes = stored;
    } else {
      prospectionCustomTypes = [...DEFAULT_PROSPECT_TYPES];
      await Settings.set('prospection_custom_types', prospectionCustomTypes);
    }
  } catch {
    prospectionCustomTypes = [...DEFAULT_PROSPECT_TYPES];
  }
}

async function saveCustomTypes() {
  try { await Settings.set('prospection_custom_types', prospectionCustomTypes); } catch {}
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================

async function renderProspection() {
  const main = document.getElementById('main-content');
  if (!main) return;

  await loadCustomTypes();

  main.innerHTML = `
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
      <div>
        <h1 style="margin:0;font-family:var(--font-head);font-size:24px;font-weight:600;">Prospection</h1>
        <p style="margin:4px 0 0;font-size:13px;color:var(--muted);">Recherchez des entreprises autour de votre zone et ajoutez-les au CRM</p>
      </div>
    </div>

    <!-- Barre de recherche principale -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px;">

      <!-- Sélecteur de mode -->
      <div style="display:flex;gap:0;border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:14px;width:fit-content;">
        <button class="search-mode-btn active" data-mode="nom"
          style="padding:8px 18px;border:none;font-size:13px;font-weight:500;cursor:pointer;font-family:var(--font-body);background:var(--accent);color:#fff;display:flex;align-items:center;gap:6px;">
          <i class="fas fa-building"></i> Par nom / enseigne
        </button>
        <button class="search-mode-btn" data-mode="secteur"
          style="padding:8px 18px;border:none;font-size:13px;font-weight:500;cursor:pointer;font-family:var(--font-body);background:var(--surface);color:var(--muted);display:flex;align-items:center;gap:6px;border-left:1px solid var(--border);">
          <i class="fas fa-layer-group"></i> Par secteur d'activité
        </button>
        <button class="search-mode-btn" data-mode="type"
          style="padding:8px 18px;border:none;font-size:13px;font-weight:500;cursor:pointer;font-family:var(--font-body);background:var(--surface);color:var(--muted);display:flex;align-items:center;gap:6px;border-left:1px solid var(--border);">
          <i class="fas fa-tags"></i> Par type d'établissement
        </button>
      </div>

      <!-- Description du mode actif -->
      <div id="search-mode-hint" style="font-size:12px;color:var(--muted);margin-bottom:10px;padding:6px 10px;background:var(--surface2);border-radius:6px;">
        <i class="fas fa-info-circle" style="margin-right:4px;"></i>
        <span id="search-mode-hint-text">Recherchez une enseigne précise : "Crédit Agricole", "McDonald's", "Leclerc"… → uniquement cette entreprise.</span>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:220px;position:relative;">
          <i id="search-icon" class="fas fa-building" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;pointer-events:none;"></i>
          <input type="text" id="prospect-search" placeholder="Ex : Crédit Agricole, BNP Paribas…"
            style="width:100%;padding:10px 14px 10px 36px;border:1px solid var(--border);border-radius:8px;font-size:14px;font-family:var(--font-body);background:var(--surface);">
        </div>
        <select id="prospect-radius" style="padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:var(--font-body);background:var(--surface);">
          <option value="5000">5 km</option>
          <option value="10000">10 km</option>
          <option value="20000" selected>20 km</option>
          <option value="30000">30 km</option>
          <option value="50000">50 km</option>
        </select>
        <button id="btn-prospect-search" class="btn-primary" style="padding:10px 20px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;">
          <i class="fas fa-magnifying-glass-location"></i> Rechercher
        </button>
      </div>

      <!-- Types rapides (visibles seulement en mode "type") -->
      <div id="prospect-chips-row" style="display:none;gap:6px;flex-wrap:wrap;align-items:center;">
        <span style="font-size:12px;color:var(--muted);margin-right:2px;white-space:nowrap;">Accès rapide :</span>
        <div id="prospect-type-chips" style="display:flex;gap:5px;flex-wrap:wrap;flex:1;"></div>
        <button id="btn-manage-types" style="padding:5px 10px;border:1px dashed var(--border);border-radius:6px;font-size:11px;cursor:pointer;background:none;color:var(--muted);display:flex;align-items:center;gap:4px;white-space:nowrap;">
          <i class="fas fa-pen"></i> Gérer les types
        </button>
      </div>

      <!-- Secteurs rapides (visibles seulement en mode "secteur") -->
      <div id="prospect-sectors-row" style="display:none;gap:6px;flex-wrap:wrap;align-items:center;">
        <span style="font-size:12px;color:var(--muted);margin-right:2px;white-space:nowrap;">Secteurs :</span>
        <div id="prospect-sector-chips" style="display:flex;gap:5px;flex-wrap:wrap;"></div>
      </div>
    </div>

    <!-- Corps principal : résultats + carte -->
    <div id="prospection-container" style="display:grid;grid-template-columns:400px 1fr;gap:16px;min-height:520px;">

      <!-- Panel résultats -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);display:flex;flex-direction:column;overflow:hidden;">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
          <div>
            <span style="font-weight:600;font-size:14px;font-family:var(--font-head);">Résultats</span>
            <span id="prospect-results-count" style="font-size:12px;color:var(--muted);margin-left:8px;"></span>
          </div>
          <div style="display:flex;gap:6px;" id="prospect-actions-header" style="display:none;"></div>
        </div>
        <div id="prospect-results-list" style="flex:1;overflow-y:auto;padding:8px;">
          ${emptyState('fa-map-marker-alt', 'Lancez une recherche', 'Tapez un nom d\'enseigne, un secteur d\'activité ou choisissez un type ci-dessus')}
        </div>
      </div>

      <!-- Carte -->
      <div style="border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);min-height:520px;position:relative;">
        <div id="prospection-map" style="width:100%;height:100%;min-height:520px;"></div>
        <div id="map-loading" style="display:none;position:absolute;inset:0;background:rgba(255,255,255,0.7);display:none;align-items:center;justify-content:center;font-size:14px;color:var(--muted);">
          <div style="text-align:center;"><i class="fas fa-spinner fa-spin" style="font-size:24px;margin-bottom:8px;display:block;"></i>Chargement de la carte…</div>
        </div>
      </div>
    </div>
  `;

  renderTypeChips();
  renderSectorChips();
  document.getElementById('btn-prospect-search')?.addEventListener('click', launchSearch);
  document.getElementById('prospect-search')?.addEventListener('keydown', e => { if (e.key === 'Enter') launchSearch(); });
  document.getElementById('btn-manage-types')?.addEventListener('click', openTypesManager);

  // Bind mode buttons
  document.querySelectorAll('.search-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.search-mode-btn').forEach(b => {
        b.style.background = 'var(--surface)'; b.style.color = 'var(--muted)';
        b.classList.remove('active');
      });
      btn.style.background = 'var(--accent)'; btn.style.color = '#fff';
      btn.classList.add('active');
      updateSearchMode(btn.dataset.mode);
    });
  });

  if (!CONFIG.GOOGLE_MAPS_KEY) {
    renderNoMapsKey();
    return;
  }
  if (!window.google?.maps) await loadGoogleMapsScript();
  if (window.google?.maps) initMap();
  else renderNoMapsKey();
}

// ============================================================
// CHIPS DE TYPES RAPIDES
// ============================================================

function renderTypeChips() {
  const container = document.getElementById('prospect-type-chips');
  if (!container) return;
  container.innerHTML = '';
  prospectionCustomTypes.slice(0, 10).forEach(type => {
    const chip = document.createElement('button');
    chip.style.cssText = 'padding:4px 10px;border:1px solid var(--border);border-radius:12px;font-size:11px;cursor:pointer;background:var(--surface2);color:var(--text);font-family:var(--font-body);transition:all 0.15s;white-space:nowrap;';
    chip.textContent = type;
    chip.onmouseenter = () => { chip.style.background = 'var(--accent-soft)'; chip.style.borderColor = 'var(--accent)'; chip.style.color = 'var(--accent)'; };
    chip.onmouseleave = () => { chip.style.background = 'var(--surface2)'; chip.style.borderColor = 'var(--border)'; chip.style.color = 'var(--text)'; };
    chip.addEventListener('click', () => {
      // Basculer en mode "type"
      document.querySelectorAll('.search-mode-btn').forEach(b => { b.style.background = 'var(--surface)'; b.style.color = 'var(--muted)'; b.classList.remove('active'); });
      const typeBtn = document.querySelector('.search-mode-btn[data-mode="type"]');
      if (typeBtn) { typeBtn.style.background = 'var(--accent)'; typeBtn.style.color = '#fff'; typeBtn.classList.add('active'); }
      updateSearchMode('type');
      document.getElementById('prospect-search').value = type;
      launchSearch();
    });
    container.appendChild(chip);
  });
}

// ============================================================
// GESTIONNAIRE DE TYPES
// ============================================================

function openTypesManager() {
  const content = `
    <div style="display:grid;gap:14px;">
      <div style="font-size:13px;color:var(--muted);">
        Ces types apparaissent comme raccourcis de recherche rapide. Ajoutez vos propres secteurs d'activité.
      </div>

      <!-- Ajouter un type -->
      <div style="display:flex;gap:8px;">
        <input type="text" id="new-type-input" class="form-input" placeholder="Ex: Agence de voyage, Cabinet d'avocat…" style="flex:1;">
        <button id="btn-add-type" class="btn-primary" style="padding:8px 16px;border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap;">
          <i class="fas fa-plus"></i> Ajouter
        </button>
      </div>

      <!-- Liste des types existants -->
      <div id="types-list" style="display:grid;gap:6px;max-height:360px;overflow-y:auto;">
        ${prospectionCustomTypes.map((t, i) => `
          <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface2);border-radius:8px;" data-type-idx="${i}">
            <i class="fas fa-grip-vertical" style="color:var(--muted);font-size:11px;"></i>
            <span style="flex:1;font-size:13px;">${t}</span>
            <button onclick="removeCustomType(${i})"
              style="background:none;border:none;cursor:pointer;color:var(--muted);padding:2px 6px;font-size:12px;">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  Modal.open({
    title: 'Gérer les types d\'établissement',
    content,
    size: 'md',
    actions: [
      { label: 'Fermer', class: 'btn-primary', onClick: async (o) => {
        await saveCustomTypes();
        Modal.close(o);
        renderTypeChips();
      }}
    ]
  });

  setTimeout(() => {
    document.getElementById('btn-add-type')?.addEventListener('click', async () => {
      const val = document.getElementById('new-type-input')?.value?.trim();
      if (!val) return;
      if (prospectionCustomTypes.includes(val)) { Toast.warning('Ce type existe déjà'); return; }
      prospectionCustomTypes.push(val);
      // Rebind l'input
      document.getElementById('new-type-input').value = '';
      // Rafraîchir la liste dans la modal
      const list = document.getElementById('types-list');
      if (list) {
        const i = prospectionCustomTypes.length - 1;
        list.insertAdjacentHTML('beforeend', `
          <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface2);border-radius:8px;" data-type-idx="${i}">
            <i class="fas fa-grip-vertical" style="color:var(--muted);font-size:11px;"></i>
            <span style="flex:1;font-size:13px;">${val}</span>
            <button onclick="removeCustomType(${i})" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:2px 6px;font-size:12px;">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `);
      }
    });
    document.getElementById('new-type-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-add-type')?.click();
    });
  }, 50);
}

function removeCustomType(idx) {
  prospectionCustomTypes.splice(idx, 1);
  // Rafraîchir la liste
  const list = document.getElementById('types-list');
  if (list) {
    list.innerHTML = prospectionCustomTypes.map((t, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface2);border-radius:8px;" data-type-idx="${i}">
        <i class="fas fa-grip-vertical" style="color:var(--muted);font-size:11px;"></i>
        <span style="flex:1;font-size:13px;">${t}</span>
        <button onclick="removeCustomType(${i})" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:2px 6px;font-size:12px;">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `).join('');
  }
}

// ============================================================
// CHARGEMENT GOOGLE MAPS
// ============================================================

function loadGoogleMapsScript() {
  return new Promise(resolve => {
    if (window.google?.maps) { resolve(); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_KEY}&libraries=places`;
    script.async = true; script.defer = true;
    script.onload = resolve;
    script.onerror = () => { console.error('[Prospection] Erreur chargement Google Maps'); resolve(); };
    document.head.appendChild(script);
  });
}

function renderNoMapsKey() {
  const mapEl = document.getElementById('prospection-map');
  if (mapEl) {
    mapEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px;text-align:center;background:var(--surface2);">
        <i class="fas fa-map-marked-alt" style="font-size:48px;color:var(--muted);margin-bottom:16px;opacity:0.5;"></i>
        <h3 style="margin:0 0 8px;font-family:var(--font-head);font-size:18px;">Clé Google Maps non configurée</h3>
        <p style="margin:0 0 20px;font-size:13px;color:var(--muted);max-width:400px;">
          Configurez votre clé API Google Maps dans <strong>Paramètres → API Google Maps</strong>.
        </p>
        <button class="btn-primary" style="padding:10px 20px;border-radius:8px;font-size:13px;cursor:pointer;" onclick="navigateTo('settings')">
          <i class="fas fa-cog"></i> Aller dans Paramètres
        </button>
      </div>
    `;
  }
}

// ============================================================
// INIT MAP
// ============================================================

function initMap() {
  const mapEl = document.getElementById('prospection-map');
  if (!mapEl || !window.google?.maps) return;

  prospectionMap = new google.maps.Map(mapEl, {
    center: CONFIG.MAP_CENTER,
    zoom: CONFIG.MAP_ZOOM,
    styles: getMapStyles(),
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
  });

  prospectionService   = new google.maps.places.PlacesService(prospectionMap);
  prospectionInfoWindow = new google.maps.InfoWindow();
}

// ============================================================
// MODES DE RECHERCHE
// ============================================================

const SEARCH_MODE_CONFIG = {
  nom: {
    icon: 'fa-building',
    placeholder: 'Ex : Crédit Agricole, BNP Paribas, McDonald\'s…',
    hint: 'Recherchez une enseigne précise → uniquement cette entreprise est retournée.',
  },
  secteur: {
    icon: 'fa-layer-group',
    placeholder: 'Ex : banque, pharmacie, restaurant, hôtel, coiffeur…',
    hint: 'Recherche exhaustive par secteur → TOUTES les entreprises du secteur dans la zone, toutes enseignes confondues.',
  },
  type: {
    icon: 'fa-tags',
    placeholder: 'Ex : Agence bancaire, Cabinet médical, Salle de sport…',
    hint: 'Sélectionnez un type prédéfini ou saisissez librement → résultats pour ce type d\'établissement.',
  },
};

function getCurrentMode() {
  return document.querySelector('.search-mode-btn.active')?.dataset?.mode || 'nom';
}

function updateSearchMode(mode) {
  const cfg = SEARCH_MODE_CONFIG[mode] || SEARCH_MODE_CONFIG.nom;
  const input = document.getElementById('prospect-search');
  const icon  = document.getElementById('search-icon');
  const hintEl = document.getElementById('search-mode-hint-text');

  if (input) { input.placeholder = cfg.placeholder; input.value = ''; }
  if (icon)  icon.className = `fas ${cfg.icon}`;
  if (hintEl) hintEl.textContent = cfg.hint;

  document.getElementById('prospect-chips-row').style.display  = mode === 'type'    ? 'flex' : 'none';
  document.getElementById('prospect-sectors-row').style.display = mode === 'secteur' ? 'flex' : 'none';
}

// Chips secteurs pour le mode "secteur"
const QUICK_SECTORS = [
  'banque', 'pharmacie', 'restaurant', 'hôtel', 'cabinet médical',
  'agence immobilière', 'école', 'salon de coiffure', 'salle de sport',
  'supermarché', 'assurance', 'garage automobile', 'cabinet comptable',
];

function renderSectorChips() {
  const container = document.getElementById('prospect-sector-chips');
  if (!container) return;
  container.innerHTML = '';
  QUICK_SECTORS.forEach(sector => {
    const chip = document.createElement('button');
    chip.style.cssText = 'padding:4px 10px;border:1px solid var(--border);border-radius:12px;font-size:11px;cursor:pointer;background:var(--surface2);color:var(--text);font-family:var(--font-body);transition:all 0.15s;white-space:nowrap;';
    chip.textContent = sector;
    chip.onmouseenter = () => { chip.style.background = 'var(--progress-soft)'; chip.style.borderColor = 'var(--progress)'; chip.style.color = 'var(--progress)'; };
    chip.onmouseleave = () => { chip.style.background = 'var(--surface2)'; chip.style.borderColor = 'var(--border)'; chip.style.color = 'var(--text)'; };
    chip.addEventListener('click', () => {
      document.getElementById('prospect-search').value = sector;
      launchSearch();
    });
    container.appendChild(chip);
  });
}

// ============================================================
// LANCEMENT RECHERCHE — adapté selon le mode
// ============================================================

function launchSearch() {
  const query = document.getElementById('prospect-search')?.value?.trim();
  if (!query) { Toast.warning('Entrez un terme de recherche'); return; }
  if (!prospectionService) { Toast.error('Google Maps non initialisé'); return; }

  clearMarkers();
  prospectionAllResults = [];
  prospectionSearchAborted = false;

  const radius = parseInt(document.getElementById('prospect-radius')?.value) || 20000;
  const mode   = getCurrentMode();
  const center = prospectionMap ? prospectionMap.getCenter() : CONFIG.MAP_CENTER;

  showSearchProgress(mode, radius);

  // Tous les modes utilisent la grille de tuiles pour être exhaustifs
  launchTiledSearch(query, center, radius, mode);
}

// ============================================================
// GRILLE DE TUILES — cœur de la recherche exhaustive
//
// Problème : Google Places plafonne à 60 résultats par requête
// (3 pages × 20) quelle que soit la taille du rayon.
// Solution : quadriller la zone en cercles qui se chevauchent,
// lancer une requête par cellule, fusionner + dédupliquer.
//
// Rayon des tuiles = R/4 pour couvrir complètement sans trous.
// Grille hexagonale (plus efficace que grille carrée).
// ============================================================

function buildHexGrid(centerLat, centerLng, radiusM) {
  // Convertir le rayon des tuiles en degrés
  const tileRadius = Math.max(radiusM / 3.5, 2500); // min 2.5 km
  const latDeg  = tileRadius / 111320;
  const lngDeg  = tileRadius / (111320 * Math.cos(centerLat * Math.PI / 180));

  // Espacement hexagonal : rangées décalées
  const rowSpacing = latDeg * Math.sqrt(3);
  const colSpacing = lngDeg * 2;

  const cells = [];
  const maxLat = centerLat + radiusM / 111320;
  const minLat = centerLat - radiusM / 111320;
  const maxLng = centerLng + radiusM / (111320 * Math.cos(centerLat * Math.PI / 180));
  const minLng = centerLng - radiusM / (111320 * Math.cos(centerLat * Math.PI / 180));

  let row = 0;
  for (let lat = minLat; lat <= maxLat + latDeg; lat += rowSpacing, row++) {
    const offset = (row % 2) * lngDeg;
    for (let lng = minLng - offset; lng <= maxLng + lngDeg; lng += colSpacing) {
      // Vérifier que la cellule est dans le rayon global
      const dLat = lat - centerLat;
      const dLng = lng - centerLng;
      const distM = Math.sqrt(
        (dLat * 111320) ** 2 +
        (dLng * 111320 * Math.cos(centerLat * Math.PI / 180)) ** 2
      );
      if (distM <= radiusM + tileRadius) {
        cells.push({ lat, lng, tileRadius });
      }
    }
  }
  return cells;
}

// Mapping secteurs FR → types Google Places
const SECTOR_TO_GOOGLE_TYPES = {
  banque: ['bank'], 'agence bancaire': ['bank'], crédit: ['bank'],
  pharmacie: ['pharmacy'], pharmacien: ['pharmacy'],
  restaurant: ['restaurant'], brasserie: ['restaurant'], pizzeria: ['restaurant'],
  restauration: ['restaurant', 'cafe', 'bar'], café: ['cafe'], bar: ['bar'],
  hôtel: ['lodging'], hotel: ['lodging'], hébergement: ['lodging'],
  école: ['school', 'primary_school', 'secondary_school'],
  collège: ['secondary_school'], lycée: ['secondary_school'],
  université: ['university'],
  médecin: ['doctor'], 'cabinet médical': ['doctor', 'health'],
  hôpital: ['hospital'], clinique: ['hospital'],
  'agence immobilière': ['real_estate_agency'], immobilier: ['real_estate_agency'],
  supermarché: ['supermarket', 'grocery_or_supermarket'],
  'grande surface': ['supermarket', 'department_store'],
  coiffeur: ['hair_care', 'beauty_salon'], 'salon de coiffure': ['hair_care'],
  sport: ['gym', 'stadium'], 'salle de sport': ['gym'], fitness: ['gym'],
  assurance: ['insurance_agency'], mutuelle: ['insurance_agency'],
  garage: ['car_repair', 'car_dealer'], automobile: ['car_repair', 'car_dealer'],
  comptable: ['accounting'], 'cabinet comptable': ['accounting'],
  avocat: ['lawyer'], notaire: ['lawyer'],
  mairie: ['local_government_office', 'city_hall'],
  collectivité: ['local_government_office'],
  'agence de voyage': ['travel_agency'], voyage: ['travel_agency'],
  dentiste: ['dentist'], opticien: ['store'],
  pressing: ['laundry'], laverie: ['laundry'],
};

function getSectorGoogleTypes(query) {
  const q = query.toLowerCase().trim();
  for (const [key, types] of Object.entries(SECTOR_TO_GOOGLE_TYPES)) {
    if (q.includes(key) || key.includes(q)) return types;
  }
  return null;
}

function getSectorVariants(query) {
  const variants = {
    'banque': ['banque', 'agence bancaire', 'crédit', 'caisse d\'épargne'],
    'agence bancaire': ['banque', 'agence bancaire', 'crédit', 'caisse'],
    'pharmacie': ['pharmacie', 'pharmacien', 'officine'],
    'restaurant': ['restaurant', 'brasserie', 'pizzeria', 'bistrot', 'snack'],
    'hôtel': ['hôtel', 'auberge', 'hébergement'],
    'école': ['école', 'collège', 'lycée', 'établissement scolaire'],
    'coiffeur': ['coiffeur', 'salon de coiffure', 'barbier', 'barbershop'],
    'salon de coiffure': ['salon de coiffure', 'coiffeur', 'barbier'],
    'salle de sport': ['salle de sport', 'fitness', 'gym', 'musculation', 'CrossFit'],
    'garage': ['garage', 'carrosserie', 'réparation auto', 'mécanique'],
    'assurance': ['assurance', 'mutuelle', 'assureur', 'compagnie d\'assurance'],
    'supermarché': ['supermarché', 'superette', 'épicerie', 'alimentation'],
    'agence immobilière': ['agence immobilière', 'immobilier', 'promoteur'],
    'cabinet médical': ['médecin', 'généraliste', 'cabinet médical', 'spécialiste'],
    'cabinet comptable': ['expert-comptable', 'cabinet comptable', 'comptabilité'],
    'agence de voyage': ['agence de voyage', 'voyagiste', 'tourisme'],
    'dentiste': ['dentiste', 'cabinet dentaire', 'chirurgien-dentiste'],
  };
  const q = query.toLowerCase();
  for (const [key, vars] of Object.entries(variants)) {
    if (q.includes(key) || key.includes(q)) return vars;
  }
  return [query];
}

async function launchTiledSearch(query, center, radius, mode) {
  const centerLat = typeof center.lat === 'function' ? center.lat() : center.lat;
  const centerLng = typeof center.lng === 'function' ? center.lng() : center.lng;

  const cells = buildHexGrid(centerLat, centerLng, radius);
  const tileRadius = cells[0]?.tileRadius || Math.max(radius / 3.5, 2500);

  updateProgress(`Quadrillage : ${cells.length} zones à analyser…`, 0, cells.length);

  // Variantes de la requête
  const variants = mode === 'secteur' ? getSectorVariants(query) : [query];
  const googleTypes = (mode === 'secteur' || mode === 'type') ? getSectorGoogleTypes(query) : null;

  const allRaw = [];
  let completed = 0;

  // Traiter les cellules par lots de 5 (éviter de surcharger l'API)
  const BATCH = 5;
  for (let i = 0; i < cells.length; i += BATCH) {
    if (prospectionSearchAborted) break;
    const batch = cells.slice(i, i + BATCH);

    await Promise.all(batch.map(cell => {
      const cellCenter = new google.maps.LatLng(cell.lat, cell.lng);
      const cellPromises = [];

      // textSearch pour chaque variante
      variants.forEach(v => {
        cellPromises.push(tileTextSearch(v, cellCenter, tileRadius));
      });

      // nearbySearch par type Google si disponible
      if (googleTypes) {
        googleTypes.forEach(gType => {
          cellPromises.push(tileNearbySearch(gType, cellCenter, tileRadius));
        });
      }

      return Promise.all(cellPromises).then(results => {
        allRaw.push(...results.flat());
        completed++;
        updateProgress(
          `Zone ${completed}/${cells.length} analysée…`,
          completed,
          cells.length
        );
      });
    }));

    // Petite pause entre les lots pour respecter les quotas
    if (i + BATCH < cells.length) await sleep(300);
  }

  // Dédupliquer par place_id
  const seen = new Set();
  prospectionAllResults = allRaw.filter(p => {
    if (!p?.place_id || seen.has(p.place_id)) return false;
    seen.add(p.place_id);
    return true;
  });

  finalizeResults(query, radius);
}

// Une requête textSearch sur une tuile, avec pagination complète
function tileTextSearch(query, center, radius) {
  return new Promise(resolve => {
    const results = [];
    function doPage(paginationToken) {
      const req = paginationToken
        ? null // nextPage() est appelé sur l'objet pagination
        : { query, location: center, radius };

      if (!req) { resolve(results); return; } // sécurité

      prospectionService.textSearch(req, (res, status, pagination) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && res?.length) {
          results.push(...res);
          if (pagination?.hasNextPage) {
            setTimeout(() => pagination.nextPage((r2, s2, p2) => {
              if (s2 === google.maps.places.PlacesServiceStatus.OK && r2?.length) {
                results.push(...r2);
                if (p2?.hasNextPage) {
                  setTimeout(() => p2.nextPage((r3, s3) => {
                    if (s3 === google.maps.places.PlacesServiceStatus.OK && r3?.length) results.push(...r3);
                    resolve(results);
                  }), 2100);
                } else resolve(results);
              } else resolve(results);
            }), 2100);
          } else resolve(results);
        } else resolve(results);
      });
    }
    doPage();
  });
}

// Une requête nearbySearch sur une tuile
function tileNearbySearch(type, center, radius) {
  return new Promise(resolve => {
    prospectionService.nearbySearch(
      { location: center, radius, type },
      (results, status) => resolve(status === google.maps.places.PlacesServiceStatus.OK ? (results || []) : [])
    );
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// AFFICHAGE PROGRESSION
// ============================================================

function showSearchProgress(mode, radius) {
  const list    = document.getElementById('prospect-results-list');
  const countEl = document.getElementById('prospect-results-count');
  if (list) list.innerHTML = `
    <div style="padding:30px 20px;text-align:center;color:var(--muted);">
      <i class="fas fa-radar fa-spin" style="font-size:28px;margin-bottom:14px;display:block;color:var(--accent);"></i>
      <div style="font-size:14px;font-weight:500;color:var(--text);margin-bottom:6px;">Analyse exhaustive en cours…</div>
      <div style="font-size:12px;margin-bottom:16px;" id="progress-label">Initialisation…</div>
      <div style="background:var(--surface2);border-radius:100px;height:6px;overflow:hidden;max-width:260px;margin:0 auto;">
        <div id="progress-bar" style="height:100%;width:0%;background:var(--accent);border-radius:100px;transition:width 0.3s;"></div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:10px;">
        La zone est découpée en sous-zones pour ne manquer aucune entreprise
      </div>
    </div>
  `;
  if (countEl) countEl.textContent = '';
}

function updateProgress(label, done, total) {
  const labelEl = document.getElementById('progress-label');
  const barEl   = document.getElementById('progress-bar');
  if (labelEl) labelEl.textContent = label;
  if (barEl && total > 0) barEl.style.width = `${Math.round((done / total) * 100)}%`;

  // Mettre à jour le compteur en temps réel
  const countEl = document.getElementById('prospect-results-count');
  if (countEl && prospectionAllResults.length > 0) {
    countEl.textContent = `${prospectionAllResults.length} trouvé${prospectionAllResults.length > 1 ? 's' : ''} (analyse en cours…)`;
  }
}

function finalizeResults(query, radius) {
  if (prospectionSearchAborted) return;

  // Trier par distance au centre (les plus proches d'abord)
  const center = prospectionMap ? prospectionMap.getCenter() : CONFIG.MAP_CENTER;
  const cLat = typeof center.lat === 'function' ? center.lat() : center.lat;
  const cLng = typeof center.lng === 'function' ? center.lng() : center.lng;

  prospectionAllResults.sort((a, b) => {
    const distA = a.geometry?.location
      ? Math.hypot(a.geometry.location.lat() - cLat, a.geometry.location.lng() - cLng)
      : 9999;
    const distB = b.geometry?.location
      ? Math.hypot(b.geometry.location.lat() - cLat, b.geometry.location.lng() - cLng)
      : 9999;
    return distA - distB;
  });

  const unique = prospectionAllResults;
  const radiusLabel = radius >= 1000 ? `${radius / 1000} km` : `${radius} m`;
  const countEl = document.getElementById('prospect-results-count');
  if (countEl) countEl.textContent = `${unique.length} résultat${unique.length > 1 ? 's' : ''} dans ${radiusLabel}`;

  // Bouton "Tout importer"
  const actionsHeader = document.getElementById('prospect-actions-header');
  if (actionsHeader && unique.length > 0) {
    actionsHeader.style.display = 'flex';
    actionsHeader.innerHTML = `
      <button id="btn-import-all"
        style="padding:5px 12px;border-radius:6px;font-size:11px;font-weight:500;cursor:pointer;background:var(--accent-soft);color:var(--accent);border:1px solid var(--accent);display:flex;align-items:center;gap:4px;">
        <i class="fas fa-file-import" style="font-size:10px;"></i> Importer tout (${unique.length})
      </button>
    `;
    document.getElementById('btn-import-all')?.addEventListener('click', () => importAllToCRM(unique));
  }

  renderProspectResults(unique);

  // Ajuster la carte
  if (unique.length > 0 && prospectionMap) {
    addMarkersToMap(unique);
    const bounds = new google.maps.LatLngBounds();
    unique.forEach(p => { if (p.geometry?.location) bounds.extend(p.geometry.location); });
    prospectionMap.fitBounds(bounds);
  }
}

// ============================================================
// AFFICHAGE DES RÉSULTATS
// ============================================================

function renderProspectResults(places) {
  const list = document.getElementById('prospect-results-list');
  if (!list) return;
  list.innerHTML = '';

  if (!places.length) {
    list.innerHTML = emptyState('fa-search', 'Aucun résultat', 'Essayez un terme différent ou augmentez le rayon');
    return;
  }

  places.forEach((place) => {
    const card = document.createElement('div');
    card.className = 'prospect-card';
    card.style.cssText = 'padding:12px;margin-bottom:6px;border-radius:8px;cursor:pointer;border:1px solid transparent;transition:all 0.15s;';
    card.onmouseenter = () => { card.style.background = 'var(--surface2)'; card.style.borderColor = 'var(--border)'; };
    card.onmouseleave = () => { card.style.background = 'none'; card.style.borderColor = 'transparent'; };

    const rating = place.rating
      ? `<span style="font-size:11px;color:var(--warning);"><i class="fas fa-star" style="font-size:9px;"></i> ${place.rating}${place.user_ratings_total ? ` <span style="color:var(--muted);">(${place.user_ratings_total})</span>` : ''}</span>`
      : '';
    const isOpen = place.opening_hours?.isOpen?.();
    const openBadge = isOpen !== undefined
      ? `<span style="font-size:11px;color:${isOpen ? 'var(--won)' : 'var(--urgent)'};">${isOpen ? 'Ouvert' : 'Fermé'}</span>`
      : '';

    // Types (filtrés pour affichage)
    const typeLabels = (place.types || [])
      .filter(t => !['point_of_interest', 'establishment', 'food', 'premise'].includes(t))
      .slice(0, 2)
      .map(t => t.replace(/_/g, ' '))
      .join(' · ');

    card.innerHTML = `
      <div style="display:flex;align-items:start;gap:10px;">
        <div style="width:36px;height:36px;border-radius:8px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fas fa-building" style="color:var(--accent);font-size:14px;"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${place.name}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${place.formatted_address || place.vicinity || ''}</div>
          <div style="display:flex;gap:8px;margin-top:4px;align-items:center;flex-wrap:wrap;">
            ${rating}
            ${openBadge}
            ${typeLabels ? `<span style="font-size:10px;color:var(--muted);font-style:italic;">${typeLabels}</span>` : ''}
          </div>
        </div>
        <button class="btn-quick-add" data-idx="${places.indexOf(place)}"
          style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--accent);font-size:11px;cursor:pointer;flex-shrink:0;white-space:nowrap;"
          title="Ajouter au CRM">
          <i class="fas fa-plus" style="font-size:10px;"></i>
        </button>
      </div>
    `;

    // Click sur la carte = afficher détail
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-quick-add')) return;
      showPlaceDetail(place);
      if (prospectionMap && place.geometry?.location) {
        prospectionMap.panTo(place.geometry.location);
        prospectionMap.setZoom(16);
      }
    });

    // Bouton + rapide
    card.querySelector('.btn-quick-add')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:10px;"></i>';
      const ok = await quickAddToCRM(place);
      if (ok) {
        btn.innerHTML = '<i class="fas fa-check" style="font-size:10px;"></i>';
        btn.style.color = 'var(--won)';
        btn.style.borderColor = 'var(--won)';
      } else {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plus" style="font-size:10px;"></i>';
      }
    });

    list.appendChild(card);
  });
}

// ============================================================
// MARQUEURS CARTE
// ============================================================

function addMarkersToMap(places) {
  places.forEach(place => {
    if (!place.geometry?.location || !prospectionMap) return;
    // Éviter les doublons de marqueurs
    if (prospectionMarkers.find(m => m._placeId === place.place_id)) return;

    const marker = new google.maps.Marker({
      position: place.geometry.location,
      map: prospectionMap,
      title: place.name,
      animation: google.maps.Animation.DROP,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: '#5b4cf0',
        fillOpacity: 0.9,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
    });
    marker._placeId = place.place_id;
    marker.addListener('click', () => showPlaceDetail(place));
    prospectionMarkers.push(marker);
  });
}

function clearMarkers() {
  prospectionMarkers.forEach(m => m.setMap(null));
  prospectionMarkers = [];
}

// ============================================================
// DÉTAIL D'UN LIEU — récupère les infos complètes
// ============================================================

function showPlaceDetail(place) {
  if (prospectionService && place.place_id) {
    prospectionService.getDetails(
      {
        placeId: place.place_id,
        fields: [
          'name', 'formatted_address', 'formatted_phone_number',
          'international_phone_number', 'website', 'rating', 'user_ratings_total',
          'opening_hours', 'types', 'address_components', 'url', 'business_status',
        ]
      },
      (detail, status) => {
        renderPlaceDetailPanel(status === google.maps.places.PlacesServiceStatus.OK && detail ? detail : place, place);
      }
    );
  } else {
    renderPlaceDetailPanel(place, place);
  }
}

function renderPlaceDetailPanel(detail, originalPlace) {
  const list = document.getElementById('prospect-results-list');
  if (!list) return;

  const phone  = detail.formatted_phone_number || originalPlace.formatted_phone_number || '';
  const website = detail.website || '';
  const address = detail.formatted_address || originalPlace.formatted_address || originalPlace.vicinity || '';

  // Extraire la ville depuis address_components
  let city = '';
  if (detail.address_components) {
    const comp = detail.address_components.find(c => c.types.includes('locality'));
    if (comp) city = comp.long_name;
  }

  const types = (detail.types || originalPlace.types || [])
    .filter(t => !['point_of_interest', 'establishment'].includes(t))
    .slice(0, 4);

  const mapsUrl = detail.url || (originalPlace.geometry?.location
    ? `https://maps.google.com/?q=${originalPlace.geometry.location.lat()},${originalPlace.geometry.location.lng()}`
    : '');

  list.innerHTML = `
    <div style="padding:16px;">
      <button id="btn-back-results" style="background:none;border:none;cursor:pointer;color:var(--accent);font-size:13px;font-weight:500;padding:0;margin-bottom:16px;display:flex;align-items:center;gap:4px;">
        <i class="fas fa-arrow-left"></i> Retour aux résultats
      </button>

      <div style="display:flex;align-items:start;gap:12px;margin-bottom:16px;">
        <div style="width:48px;height:48px;border-radius:12px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fas fa-building" style="color:var(--accent);font-size:20px;"></i>
        </div>
        <div style="flex:1;">
          <h3 style="margin:0;font-size:16px;font-weight:600;">${detail.name}</h3>
          ${detail.rating ? `
            <div style="font-size:12px;color:var(--warning);margin-top:3px;">
              <i class="fas fa-star" style="font-size:11px;"></i> ${detail.rating}/5
              ${detail.user_ratings_total ? `<span style="color:var(--muted);font-size:11px;"> · ${detail.user_ratings_total} avis</span>` : ''}
            </div>
          ` : ''}
          ${detail.business_status === 'CLOSED_PERMANENTLY' ? `<span style="font-size:11px;color:var(--urgent);background:var(--urgent-soft);padding:2px 8px;border-radius:10px;">Fermé définitivement</span>` : ''}
        </div>
      </div>

      <!-- Coordonnées -->
      <div style="display:grid;gap:8px;margin-bottom:16px;font-size:13px;">
        ${address ? `
          <div style="display:flex;align-items:start;gap:8px;">
            <i class="fas fa-map-marker-alt" style="color:var(--muted);margin-top:2px;width:16px;text-align:center;flex-shrink:0;font-size:12px;"></i>
            <div>
              <span>${address}</span>
              ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" style="color:var(--accent);font-size:11px;margin-left:8px;"><i class="fas fa-external-link-alt"></i> Maps</a>` : ''}
            </div>
          </div>
        ` : ''}
        ${phone ? `
          <div style="display:flex;align-items:center;gap:8px;">
            <i class="fas fa-phone" style="color:var(--muted);width:16px;text-align:center;flex-shrink:0;font-size:12px;"></i>
            <a href="tel:${phone}" style="color:var(--accent);">${phone}</a>
          </div>
        ` : `
          <div style="display:flex;align-items:center;gap:8px;opacity:0.5;">
            <i class="fas fa-phone" style="color:var(--muted);width:16px;text-align:center;font-size:12px;"></i>
            <span style="font-size:12px;color:var(--muted);">Téléphone non disponible</span>
          </div>
        `}
        ${website ? `
          <div style="display:flex;align-items:center;gap:8px;">
            <i class="fas fa-globe" style="color:var(--muted);width:16px;text-align:center;flex-shrink:0;font-size:12px;"></i>
            <a href="${website}" target="_blank" style="color:var(--accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px;display:inline-block;">${website.replace(/^https?:\/\//, '')}</a>
          </div>
        ` : ''}
        ${types.length ? `
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px;">
            ${types.map(t => `<span style="font-size:10px;padding:2px 8px;border-radius:12px;background:var(--surface2);color:var(--muted);">${t.replace(/_/g, ' ')}</span>`).join('')}
          </div>
        ` : ''}
      </div>

      <!-- Horaires si dispo -->
      ${detail.opening_hours?.weekday_text?.length ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
            <i class="fas fa-clock" style="margin-right:4px;"></i>Horaires
          </div>
          <div style="display:grid;gap:2px;">
            ${detail.opening_hours.weekday_text.map(h => `<div style="font-size:12px;color:var(--text);">${h}</div>`).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Secteur pour le CRM -->
      <div style="margin-bottom:14px;">
        <label class="form-label" style="font-size:12px;">Secteur d'activité (pour le CRM)</label>
        <input type="text" id="prospect-sector" class="form-input" list="prospect-sectors-list"
          value="${guessSector(detail.types || originalPlace.types || [])}"
          placeholder="Choisir ou saisir…" autocomplete="off" style="font-size:13px;">
        <datalist id="prospect-sectors-list">
          ${SECTORS.map(s => `<option value="${s}">`).join('')}
          ${prospectionCustomTypes.map(t => `<option value="${t}">`).join('')}
        </datalist>
      </div>

      <div style="display:grid;gap:8px;">
        <button id="btn-add-to-crm" class="btn-primary" style="padding:10px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:center;gap:6px;">
          <i class="fas fa-plus"></i> Ajouter au CRM
        </button>
        ${mapsUrl ? `
          <a href="${mapsUrl}" target="_blank"
            style="padding:9px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);text-decoration:none;box-sizing:border-box;">
            <i class="fas fa-map-marker-alt"></i> Voir sur Google Maps
          </a>
        ` : ''}
      </div>
    </div>
  `;

  document.getElementById('btn-back-results')?.addEventListener('click', () => {
    renderProspectResults(prospectionAllResults);
    const countEl = document.getElementById('prospect-results-count');
    if (countEl) countEl.textContent = `${prospectionAllResults.length} résultat${prospectionAllResults.length > 1 ? 's' : ''}`;
  });

  document.getElementById('btn-add-to-crm')?.addEventListener('click', async () => {
    const sector = document.getElementById('prospect-sector')?.value?.trim() || null;
    const ok = await addDetailedPlaceToCRM(detail, originalPlace, sector);
    if (ok) {
      const btn = document.getElementById('btn-add-to-crm');
      if (btn) { btn.innerHTML = '<i class="fas fa-check"></i> Ajouté au CRM !'; btn.disabled = true; btn.style.opacity = '0.6'; }
    }
  });
}

// ============================================================
// DEVINER LE SECTEUR depuis les types Google
// ============================================================

function guessSector(types) {
  const map = {
    bank: 'Agence bancaire',
    atm: 'Agence bancaire',
    real_estate_agency: 'Agence immobilière',
    accounting: 'Cabinet comptable',
    doctor: 'Cabinet médical',
    hospital: 'Santé',
    pharmacy: 'Pharmacie',
    restaurant: 'Restauration',
    food: 'Restauration',
    cafe: 'Restauration',
    bar: 'Restauration',
    lodging: 'Hôtellerie',
    hotel: 'Hôtellerie',
    school: 'Éducation',
    university: 'Éducation',
    gym: 'Sport & Fitness',
    store: 'Commerce',
    supermarket: 'Grande distribution',
    shopping_mall: 'Centre commercial',
    local_government_office: 'Collectivité',
    hair_care: 'Beauté & Bien-être',
    spa: 'Beauté & Bien-être',
    travel_agency: 'Agence de voyage',
    car_dealer: 'Automobile',
    car_repair: 'Automobile',
    lawyer: 'Professions libérales',
    insurance_agency: 'Assurance',
  };
  for (const t of (types || [])) {
    if (map[t]) return map[t];
  }
  return '';
}

// ============================================================
// AJOUT RAPIDE (bouton + sur la liste)
// ============================================================

async function quickAddToCRM(place) {
  const existing = await CRM.checkDuplicateCompany(place.name, place.place_id);
  if (existing) { Toast.warning(`"${place.name}" existe déjà dans le CRM`); return false; }
  try {
    const company = await DB.insert('companies', {
      name: place.name,
      sector: guessSector(place.types || []) || null,
      address: place.formatted_address || place.vicinity || null,
      city: extractCity(place.formatted_address || place.vicinity || ''),
      phone: place.formatted_phone_number || null,
      website: place.website || null,
      google_place_id: place.place_id || null,
      source: 'Prospection',
      ai_score: 0,
    });
    await CRM.logActivity({ company_id: company.id, type: 'company_created', title: `Ajouté depuis prospection : ${place.name}` });
    Toast.success(`${place.name} ajouté !`);
    return true;
  } catch (err) {
    console.error('[Prospection]', err);
    Toast.error("Erreur lors de l'ajout");
    return false;
  }
}

// ============================================================
// AJOUT DÉTAILLÉ (depuis la fiche détail)
// ============================================================

async function addDetailedPlaceToCRM(detail, originalPlace, sector) {
  const name = detail.name || originalPlace.name;
  const existing = await CRM.checkDuplicateCompany(name, originalPlace.place_id);
  if (existing) { Toast.warning(`"${existing.name}" existe déjà dans le CRM`); return false; }
  try {
    const address = detail.formatted_address || originalPlace.formatted_address || originalPlace.vicinity || null;
    const company = await DB.insert('companies', {
      name,
      sector: sector || guessSector(detail.types || originalPlace.types || []) || null,
      address,
      city: extractCity(address || ''),
      phone: detail.formatted_phone_number || null,
      email: null,
      website: detail.website || null,
      google_place_id: originalPlace.place_id || null,
      source: 'Prospection',
      ai_score: 0,
    });
    await CRM.logActivity({ company_id: company.id, type: 'company_created', title: `Ajouté depuis prospection : ${name}` });
    Toast.success(`${name} ajouté au CRM !`);
    return true;
  } catch (err) {
    console.error('[Prospection]', err);
    Toast.error("Erreur lors de l'ajout");
    return false;
  }
}

// ============================================================
// IMPORT EN MASSE
// ============================================================

async function importAllToCRM(places) {
  const ok = await Modal.confirm({
    title: `Importer ${places.length} entreprises ?`,
    message: `Tous les résultats seront ajoutés au CRM (les doublons seront ignorés).`,
  });
  if (!ok) return;

  let added = 0, skipped = 0;
  const btn = document.getElementById('btn-import-all');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Import…'; }

  for (const place of places) {
    const existing = await CRM.checkDuplicateCompany(place.name, place.place_id);
    if (existing) { skipped++; continue; }
    try {
      const company = await DB.insert('companies', {
        name: place.name,
        sector: guessSector(place.types || []) || null,
        address: place.formatted_address || place.vicinity || null,
        city: extractCity(place.formatted_address || place.vicinity || ''),
        phone: place.formatted_phone_number || null,
        website: place.website || null,
        google_place_id: place.place_id || null,
        source: 'Prospection',
        ai_score: 0,
      });
      await CRM.logActivity({ company_id: company.id, type: 'company_created', title: `Import prospection : ${place.name}` });
      added++;
    } catch { skipped++; }
  }

  if (btn) { btn.innerHTML = `<i class="fas fa-check"></i> ${added} importé${added > 1 ? 's' : ''}`; }
  Toast.success(`${added} entreprise${added > 1 ? 's' : ''} importée${added > 1 ? 's' : ''} · ${skipped} ignorée${skipped > 1 ? 's' : ''} (doublons)`);
}

// ============================================================
// UTILITAIRES
// ============================================================

function extractCity(address) {
  if (!address) return '';
  // Essayer d'extraire le nom de ville depuis l'adresse formatée
  const parts = address.split(',').map(p => p.trim());
  // Google format : "Rue, Code Postal Ville, France"
  if (parts.length >= 2) {
    const cityPart = parts[parts.length - 2];
    const match = cityPart.match(/^\d{5}\s+(.+)$/);
    if (match) return match[1];
    return cityPart;
  }
  return '';
}

// ============================================================
// STYLES MAP
// ============================================================

function getMapStyles() {
  return [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e0e7f0' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f0eeff' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#f5f4f1' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f7f6f3' }] },
  ];
}
