// ============================================================
// prospection.js — Google Maps + Places API + Scripts prédéfinis
// ============================================================

let prospectionMap = null;
let prospectionMarkers = [];
let prospectionService = null;
let prospectionInfoWindow = null;
let prospectionSelectedPlace = null;

// ============================================================
// RENDER PRINCIPAL
// ============================================================

async function renderProspection() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <div>
        <h1 style="margin:0;font-family:var(--font-head);font-size:24px;font-weight:600;">Prospection</h1>
        <p style="margin:4px 0 0;font-size:13px;color:var(--muted);">Recherchez des entreprises autour d'Amiens et ajoutez-les au CRM</p>
      </div>
    </div>
    <div id="prospection-container" style="display:grid;grid-template-columns:1fr 380px;gap:20px;height:calc(100vh - 200px);min-height:500px;">
      <div id="prospection-map-area" style="border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);position:relative;">
        <div id="prospection-map" style="width:100%;height:100%;"></div>
        <div id="map-search-bar" style="position:absolute;top:12px;left:12px;right:12px;z-index:10;display:flex;gap:8px;">
          <div style="flex:1;position:relative;">
            <input type="text" id="prospect-search" placeholder="Rechercher : restaurants, CSE, agences…"
              style="width:100%;padding:10px 14px 10px 38px;border:none;border-radius:10px;font-size:14px;font-family:var(--font-body);box-shadow:0 2px 12px rgba(0,0,0,0.15);background:var(--surface);">
            <i class="fas fa-search" style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px;"></i>
          </div>
          <button id="btn-prospect-search" class="btn-primary" style="padding:10px 18px;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;box-shadow:0 2px 12px rgba(0,0,0,0.15);">
            <i class="fas fa-magnifying-glass-location"></i> Rechercher
          </button>
        </div>
      </div>
      <div id="prospection-panel" style="background:var(--surface);border-radius:var(--radius);border:1px solid var(--border);overflow-y:auto;display:flex;flex-direction:column;">
        <div style="padding:16px;border-bottom:1px solid var(--border);">
          <h3 style="margin:0;font-size:15px;font-weight:600;font-family:var(--font-head);">Résultats</h3>
          <p id="prospect-results-count" style="margin:4px 0 0;font-size:12px;color:var(--muted);">Effectuez une recherche</p>
        </div>
        <div id="prospect-results-list" style="flex:1;overflow-y:auto;padding:8px;">
          ${emptyState('fa-map-marker-alt', 'Recherchez des entreprises', 'Utilisez la barre de recherche ci-dessus')}
        </div>
      </div>
    </div>
  `;

  // Vérifier la clé Maps
  if (!CONFIG.GOOGLE_MAPS_KEY) {
    renderNoMapsKey();
    return;
  }

  // Charger Google Maps si pas déjà chargé
  if (!window.google?.maps) {
    await loadGoogleMapsScript();
  }

  if (window.google?.maps) {
    initMap();
  } else {
    renderNoMapsKey();
  }
}

// ============================================================
// CHARGEMENT GOOGLE MAPS
// ============================================================

function loadGoogleMapsScript() {
  return new Promise((resolve) => {
    if (window.google?.maps) { resolve(); return; }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      console.error('[Prospection] Erreur chargement Google Maps');
      resolve(); // On résout quand même, on gèrera l'erreur après
    };
    document.head.appendChild(script);
  });
}

// ============================================================
// FALLBACK SANS CLÉ MAPS
// ============================================================

function renderNoMapsKey() {
  const mapArea = document.getElementById('prospection-map-area');
  if (mapArea) {
    mapArea.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px;text-align:center;background:var(--surface2);">
        <i class="fas fa-map-marked-alt" style="font-size:48px;color:var(--muted);margin-bottom:16px;opacity:0.5;"></i>
        <h3 style="margin:0 0 8px;font-family:var(--font-head);font-size:18px;">Clé Google Maps non configurée</h3>
        <p style="margin:0 0 20px;font-size:13px;color:var(--muted);max-width:400px;">
          Pour utiliser la carte et rechercher des entreprises, configurez votre clé API Google Maps dans <strong>Paramètres → API Google Maps</strong>.
        </p>
        <button class="btn-primary" style="padding:10px 20px;border-radius:8px;font-size:13px;cursor:pointer;" onclick="navigateTo('settings')">
          <i class="fas fa-cog"></i> Aller dans Paramètres
        </button>
      </div>
    `;
  }

  // Afficher le formulaire d'ajout manuel dans le panel
  const panel = document.getElementById('prospect-results-list');
  if (panel) {
    panel.innerHTML = `
      <div style="padding:16px;">
        <h4 style="margin:0 0 16px;font-size:14px;font-weight:600;">Ajout manuel d'un prospect</h4>
        <div style="display:grid;gap:12px;">
          <div>
            <label class="form-label">Nom de l'entreprise *</label>
            <input type="text" id="manual-company-name" class="form-input" placeholder="Ex: ACME Corp">
          </div>
          <div>
            <label class="form-label">Secteur</label>
            <select id="manual-company-sector" class="form-input">
              <option value="">— Sélectionner —</option>
              ${SECTORS.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Adresse</label>
            <input type="text" id="manual-company-address" class="form-input" placeholder="Adresse complète">
          </div>
          <div>
            <label class="form-label">Téléphone</label>
            <input type="tel" id="manual-company-phone" class="form-input" placeholder="06 00 00 00 00">
          </div>
          <div>
            <label class="form-label">Email</label>
            <input type="email" id="manual-company-email" class="form-input" placeholder="contact@entreprise.fr">
          </div>
          <div>
            <label class="form-label">Site web</label>
            <input type="url" id="manual-company-website" class="form-input" placeholder="https://…">
          </div>
          <button id="btn-manual-add" class="btn-primary" style="padding:10px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;width:100%;">
            <i class="fas fa-plus"></i> Ajouter au CRM
          </button>
        </div>
      </div>
    `;
    document.getElementById('btn-manual-add')?.addEventListener('click', addManualCompany);
  }
}

// ============================================================
// AJOUT MANUEL (sans Maps)
// ============================================================

async function addManualCompany() {
  const name = document.getElementById('manual-company-name')?.value?.trim();
  if (!name) {
    Toast.warning('Le nom est obligatoire');
    return;
  }

  // Vérifier doublon
  const existing = await CRM.checkDuplicateCompany(name);
  if (existing) {
    Toast.warning(`"${existing.name}" existe déjà dans le CRM`);
    return;
  }

  try {
    const company = await DB.insert('companies', {
      name,
      sector: document.getElementById('manual-company-sector')?.value || null,
      address: document.getElementById('manual-company-address')?.value || null,
      city: 'Amiens',
      phone: document.getElementById('manual-company-phone')?.value || null,
      email: document.getElementById('manual-company-email')?.value || null,
      website: document.getElementById('manual-company-website')?.value || null,
      source: 'Prospection',
      ai_score: 0,
    });

    await CRM.logActivity({
      company_id: company.id,
      type: 'company_created',
      title: `Entreprise ajoutée (ajout manuel) : ${name}`,
    });

    Toast.success(`${name} ajouté au CRM !`);

    // Reset le form
    ['manual-company-name', 'manual-company-sector', 'manual-company-address', 'manual-company-phone', 'manual-company-email', 'manual-company-website'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  } catch (err) {
    console.error('[Prospection] Erreur ajout manuel:', err);
    Toast.error("Erreur lors de l'ajout");
  }
}

// ============================================================
// INITIALISATION MAP
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

  prospectionService = new google.maps.places.PlacesService(prospectionMap);
  prospectionInfoWindow = new google.maps.InfoWindow();

  // Bind recherche
  document.getElementById('btn-prospect-search')?.addEventListener('click', searchPlaces);
  document.getElementById('prospect-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchPlaces();
  });
}

// ============================================================
// RECHERCHE PLACES
// ============================================================

function searchPlaces() {
  const query = document.getElementById('prospect-search')?.value?.trim();
  if (!query) {
    Toast.warning('Entrez un terme de recherche');
    return;
  }

  if (!prospectionService) {
    Toast.error('Google Maps non initialisé');
    return;
  }

  // Nettoyer les anciens marqueurs
  clearMarkers();

  const request = {
    location: CONFIG.MAP_CENTER,
    radius: CONFIG.SEARCH_RADIUS,
    keyword: query,
  };

  Loader.show(document.getElementById('prospection-panel'));

  prospectionService.nearbySearch(request, (results, status) => {
    Loader.hide(document.getElementById('prospection-panel'));

    if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.length) {
      const list = document.getElementById('prospect-results-list');
      if (list) list.innerHTML = emptyState('fa-search', 'Aucun résultat', `Aucune entreprise trouvée pour "${query}"`);
      document.getElementById('prospect-results-count').textContent = '0 résultat';
      return;
    }

    document.getElementById('prospect-results-count').textContent = `${results.length} résultat${results.length > 1 ? 's' : ''}`;

    renderProspectResults(results);
    addMarkersToMap(results);
  });
}

// ============================================================
// AFFICHAGE RÉSULTATS
// ============================================================

function renderProspectResults(places) {
  const list = document.getElementById('prospect-results-list');
  if (!list) return;
  list.innerHTML = '';

  places.forEach((place, index) => {
    const card = document.createElement('div');
    card.className = 'prospect-card';
    card.style.cssText = `
      padding: 12px; margin-bottom: 6px; border-radius: 8px; cursor: pointer;
      border: 1px solid transparent; transition: all 0.15s;
    `;
    card.onmouseenter = () => { card.style.background = 'var(--surface2)'; card.style.borderColor = 'var(--border)'; };
    card.onmouseleave = () => { card.style.background = 'none'; card.style.borderColor = 'transparent'; };

    const rating = place.rating ? `<span style="font-size:11px;color:var(--warning);"><i class="fas fa-star" style="font-size:10px;"></i> ${place.rating}</span>` : '';
    const openNow = place.opening_hours?.isOpen?.() ? '<span style="font-size:11px;color:var(--won);">Ouvert</span>' : '';

    card.innerHTML = `
      <div style="display:flex;align-items:start;gap:10px;">
        <div style="width:36px;height:36px;border-radius:8px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fas fa-building" style="color:var(--accent);font-size:14px;"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${place.name}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${place.vicinity || ''}</div>
          <div style="display:flex;gap:8px;margin-top:4px;align-items:center;">
            ${rating}
            ${openNow}
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      showPlaceDetail(place);
      // Centrer la map sur le lieu
      if (prospectionMap && place.geometry?.location) {
        prospectionMap.panTo(place.geometry.location);
        prospectionMap.setZoom(16);
      }
    });

    list.appendChild(card);
  });
}

// ============================================================
// MARQUEURS CARTE
// ============================================================

function addMarkersToMap(places) {
  const bounds = new google.maps.LatLngBounds();

  places.forEach((place, index) => {
    if (!place.geometry?.location) return;

    const marker = new google.maps.Marker({
      position: place.geometry.location,
      map: prospectionMap,
      title: place.name,
      animation: google.maps.Animation.DROP,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#5b4cf0',
        fillOpacity: 0.9,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
    });

    marker.addListener('click', () => {
      showPlaceDetail(place);
    });

    prospectionMarkers.push(marker);
    bounds.extend(place.geometry.location);
  });

  if (places.length > 0) {
    prospectionMap.fitBounds(bounds);
  }
}

function clearMarkers() {
  prospectionMarkers.forEach(m => m.setMap(null));
  prospectionMarkers = [];
}

// ============================================================
// DÉTAIL D'UN LIEU
// ============================================================

function showPlaceDetail(place) {
  prospectionSelectedPlace = place;

  // Récupérer plus de détails via getDetails
  if (prospectionService && place.place_id) {
    prospectionService.getDetails(
      { placeId: place.place_id, fields: ['name', 'formatted_address', 'formatted_phone_number', 'website', 'rating', 'opening_hours', 'types'] },
      (detail, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && detail) {
          renderPlaceDetailPanel(detail);
        } else {
          renderPlaceDetailPanel(place);
        }
      }
    );
  } else {
    renderPlaceDetailPanel(place);
  }
}

function renderPlaceDetailPanel(place) {
  const list = document.getElementById('prospect-results-list');
  if (!list) return;

  const phone = place.formatted_phone_number || '';
  const website = place.website || '';
  const address = place.formatted_address || place.vicinity || '';
  const types = (place.types || []).filter(t => !['point_of_interest', 'establishment'].includes(t)).slice(0, 3);

  list.innerHTML = `
    <div style="padding:16px;">
      <button id="btn-back-results" style="background:none;border:none;cursor:pointer;color:var(--accent);font-size:13px;font-weight:500;padding:0;margin-bottom:16px;display:flex;align-items:center;gap:4px;">
        <i class="fas fa-arrow-left"></i> Retour aux résultats
      </button>

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div style="width:48px;height:48px;border-radius:12px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;">
          <i class="fas fa-building" style="color:var(--accent);font-size:20px;"></i>
        </div>
        <div>
          <h3 style="margin:0;font-size:16px;font-weight:600;">${place.name}</h3>
          ${place.rating ? `<div style="font-size:12px;color:var(--warning);margin-top:2px;"><i class="fas fa-star"></i> ${place.rating}/5</div>` : ''}
        </div>
      </div>

      <div style="display:grid;gap:10px;margin-bottom:20px;">
        ${address ? `<div style="display:flex;align-items:start;gap:8px;font-size:13px;"><i class="fas fa-map-marker-alt" style="color:var(--muted);margin-top:2px;width:16px;text-align:center;"></i><span>${address}</span></div>` : ''}
        ${phone ? `<div style="display:flex;align-items:center;gap:8px;font-size:13px;"><i class="fas fa-phone" style="color:var(--muted);width:16px;text-align:center;"></i><a href="tel:${phone}" style="color:var(--accent);">${phone}</a></div>` : ''}
        ${website ? `<div style="display:flex;align-items:center;gap:8px;font-size:13px;"><i class="fas fa-globe" style="color:var(--muted);width:16px;text-align:center;"></i><a href="${website}" target="_blank" style="color:var(--accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;display:inline-block;">${website.replace(/^https?:\/\//, '')}</a></div>` : ''}
        ${types.length ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">${types.map(t => `<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:var(--surface2);color:var(--muted);">${t.replace(/_/g, ' ')}</span>`).join('')}</div>` : ''}
      </div>

      <div style="margin-bottom:12px;">
        <label class="form-label">Secteur d'activité</label>
        <select id="prospect-sector" class="form-input" style="font-size:13px;">
          ${SECTORS.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>

      <div style="display:grid;gap:8px;">
        <button id="btn-add-to-crm" class="btn-primary" style="padding:10px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:center;gap:6px;">
          <i class="fas fa-plus"></i> Ajouter au CRM
        </button>
        <button id="btn-generate-script" class="btn-secondary" style="padding:10px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:center;gap:6px;">
          <i class="fas fa-file-lines"></i> Générer un script
        </button>
      </div>
    </div>
  `;

  // Bind boutons
  document.getElementById('btn-back-results')?.addEventListener('click', () => {
    searchPlaces(); // Re-lancer la recherche
  });

  document.getElementById('btn-add-to-crm')?.addEventListener('click', () => addPlaceToCRM(place));
  document.getElementById('btn-generate-script')?.addEventListener('click', () => {
    const sector = document.getElementById('prospect-sector')?.value || 'default';
    openScriptSelector(sector, { companyName: place.name });
  });
}

// ============================================================
// AJOUTER AU CRM
// ============================================================

async function addPlaceToCRM(place) {
  const name = place.name;
  const sector = document.getElementById('prospect-sector')?.value || null;

  // Vérifier doublon
  const existing = await CRM.checkDuplicateCompany(name, place.place_id);
  if (existing) {
    Toast.warning(`"${existing.name}" existe déjà dans le CRM`);
    return;
  }

  try {
    const company = await DB.insert('companies', {
      name,
      sector,
      address: place.formatted_address || place.vicinity || null,
      city: 'Amiens',
      phone: place.formatted_phone_number || null,
      email: null,
      website: place.website || null,
      google_place_id: place.place_id || null,
      source: 'Google Maps',
      ai_score: 0,
    });

    await CRM.logActivity({
      company_id: company.id,
      type: 'company_created',
      title: `Entreprise ajoutée depuis Google Maps : ${name}`,
    });

    Toast.success(`${name} ajouté au CRM !`);

    // Changer le bouton pour indiquer que c'est fait
    const btn = document.getElementById('btn-add-to-crm');
    if (btn) {
      btn.innerHTML = '<i class="fas fa-check"></i> Ajouté au CRM';
      btn.disabled = true;
      btn.style.opacity = '0.6';
    }
  } catch (err) {
    console.error('[Prospection] Erreur ajout:', err);
    Toast.error("Erreur lors de l'ajout au CRM");
  }
}

// ============================================================
// STYLES MAP (thème clair épuré)
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
