// ============================================================
// settings.js — Paramètres (7 onglets)
// ============================================================

let settingsTab = 'profil';

// ============================================================
// RENDER PRINCIPAL
// ============================================================

async function renderSettings() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div class="page-header" style="margin-bottom:24px;">
      <h1 style="margin:0;font-family:var(--font-head);font-size:24px;font-weight:600;">Paramètres</h1>
      <p style="margin:4px 0 0;font-size:13px;color:var(--muted);">Configurez votre CRM</p>
    </div>
    <div style="display:grid;grid-template-columns:220px 1fr;gap:20px;min-height:500px;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:8px;">
        <nav id="settings-nav" style="display:flex;flex-direction:column;gap:2px;">
          ${settingsNavItem('profil', 'fa-user', 'Profil')}
          ${settingsNavItem('entreprise', 'fa-building', 'Quiz Room')}
          ${settingsNavItem('catalogue', 'fa-tags', 'Catalogue')}
          ${settingsNavItem('scripts', 'fa-file-lines', 'Scripts')}
          ${settingsNavItem('import-export', 'fa-file-csv', 'Import / Export')}
          ${settingsNavItem('maps', 'fa-map', 'API Google Maps')}
          ${settingsNavItem('securite', 'fa-lock', 'Sécurité')}
        </nav>
      </div>
      <div id="settings-content" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;"></div>
    </div>
  `;

  // Bind nav
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      settingsTab = item.dataset.tab;
      document.querySelectorAll('.settings-nav-item').forEach(i => {
        i.style.background = 'none'; i.style.color = 'var(--text)'; i.style.fontWeight = '400';
      });
      item.style.background = 'var(--accent-soft)'; item.style.color = 'var(--accent)'; item.style.fontWeight = '600';
      renderSettingsTab();
    });
  });

  // Afficher onglet par défaut
  const firstItem = document.querySelector(`.settings-nav-item[data-tab="${settingsTab}"]`);
  if (firstItem) { firstItem.style.background = 'var(--accent-soft)'; firstItem.style.color = 'var(--accent)'; firstItem.style.fontWeight = '600'; }
  renderSettingsTab();
}

function settingsNavItem(tab, icon, label) {
  return `<button class="settings-nav-item" data-tab="${tab}" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:none;background:none;cursor:pointer;border-radius:8px;font-size:13px;font-family:var(--font-body);color:var(--text);text-align:left;width:100%;transition:background 0.1s;">
    <i class="fas ${icon}" style="width:16px;text-align:center;font-size:13px;"></i>${label}
  </button>`;
}

async function renderSettingsTab() {
  const container = document.getElementById('settings-content');
  if (!container) return;

  switch (settingsTab) {
    case 'profil': await renderSettingsProfil(container); break;
    case 'entreprise': await renderSettingsEntreprise(container); break;
    case 'catalogue': await renderSettingsCatalogue(container); break;
    case 'scripts': renderSettingsScripts(container); break;
    case 'import-export': renderSettingsImportExport(container); break;
    case 'maps': await renderSettingsMaps(container); break;
    case 'securite': renderSettingsSecurite(container); break;
  }
}

// ============================================================
// 1. PROFIL
// ============================================================

async function renderSettingsProfil(container) {
  const settings = await Settings.getAll();
  container.innerHTML = `
    <h3 style="margin:0 0 20px;font-family:var(--font-head);font-size:18px;font-weight:600;">Profil utilisateur</h3>
    <div style="display:grid;gap:16px;max-width:500px;">
      <div>
        <label class="form-label">Votre prénom / nom</label>
        <input type="text" id="set-user-name" class="form-input" value="${settings.user_name || ''}" placeholder="Ex: Raphaël">
      </div>
      <div>
        <label class="form-label">Téléphone</label>
        <input type="tel" id="set-user-phone" class="form-input" value="${settings.user_phone || ''}" placeholder="06 …">
      </div>
      <div>
        <label class="form-label">Signature email</label>
        <textarea id="set-user-signature" class="form-input" rows="3" placeholder="Votre signature pour les scripts email">${settings.user_signature || ''}</textarea>
      </div>
      <button class="btn-primary" style="padding:10px 20px;border-radius:8px;font-size:13px;cursor:pointer;width:fit-content;" id="btn-save-profil">
        <i class="fas fa-save"></i> Enregistrer
      </button>
    </div>
  `;

  document.getElementById('btn-save-profil')?.addEventListener('click', async () => {
    try {
      const name = document.getElementById('set-user-name')?.value || '';
      await Settings.set('user_name', name);
      await Settings.set('user_phone', document.getElementById('set-user-phone')?.value || '');
      await Settings.set('user_signature', document.getElementById('set-user-signature')?.value || '');
      sessionStorage.setItem('crm_user_name', name);
      Toast.success('Profil enregistré');
    } catch { Toast.error('Erreur'); }
  });
}

// ============================================================
// 2. ENTREPRISE (Quiz Room)
// ============================================================

async function renderSettingsEntreprise(container) {
  const settings = await Settings.getAll();
  container.innerHTML = `
    <h3 style="margin:0 0 20px;font-family:var(--font-head);font-size:18px;font-weight:600;">Informations Quiz Room</h3>
    <p style="margin:0 0 16px;font-size:13px;color:var(--muted);">Ces informations apparaissent sur les devis PDF.</p>
    <div style="display:grid;gap:16px;max-width:500px;">
      <div>
        <label class="form-label">Nom commercial</label>
        <input type="text" id="set-biz-name" class="form-input" value="${settings.business_name || CONFIG.BUSINESS.name}" placeholder="Quiz Room Amiens">
      </div>
      <div>
        <label class="form-label">Adresse</label>
        <input type="text" id="set-biz-address" class="form-input" value="${settings.business_address || CONFIG.BUSINESS.address}" placeholder="Adresse complète">
      </div>
      <div>
        <label class="form-label">SIRET</label>
        <input type="text" id="set-biz-siret" class="form-input" value="${settings.business_siret || ''}" placeholder="123 456 789 00010">
      </div>
      <div>
        <label class="form-label">Email</label>
        <input type="email" id="set-biz-email" class="form-input" value="${settings.business_email || ''}" placeholder="contact@quizroom-amiens.fr">
      </div>
      <div>
        <label class="form-label">Téléphone</label>
        <input type="tel" id="set-biz-phone" class="form-input" value="${settings.business_phone || ''}" placeholder="03 22 …">
      </div>
      <div>
        <label class="form-label">Mentions légales (bas de devis PDF)</label>
        <textarea id="set-biz-mentions" class="form-input" rows="3">${settings.mentions_legales || ''}</textarea>
      </div>
      <button class="btn-primary" style="padding:10px 20px;border-radius:8px;font-size:13px;cursor:pointer;width:fit-content;" id="btn-save-biz">
        <i class="fas fa-save"></i> Enregistrer
      </button>
    </div>
  `;

  document.getElementById('btn-save-biz')?.addEventListener('click', async () => {
    try {
      await Settings.set('business_name', document.getElementById('set-biz-name')?.value || '');
      await Settings.set('business_address', document.getElementById('set-biz-address')?.value || '');
      await Settings.set('business_siret', document.getElementById('set-biz-siret')?.value || '');
      await Settings.set('business_email', document.getElementById('set-biz-email')?.value || '');
      await Settings.set('business_phone', document.getElementById('set-biz-phone')?.value || '');
      await Settings.set('mentions_legales', document.getElementById('set-biz-mentions')?.value || '');
      Toast.success('Informations enregistrées');
    } catch { Toast.error('Erreur'); }
  });
}

// ============================================================
// 3. CATALOGUE
// ============================================================

async function renderSettingsCatalogue(container) {
  const catalogue = await CRM.getCatalogue(false);

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h3 style="margin:0;font-family:var(--font-head);font-size:18px;font-weight:600;">Catalogue des prestations</h3>
      <button class="btn-primary" style="padding:8px 14px;border-radius:8px;font-size:13px;cursor:pointer;" id="btn-add-catalogue">
        <i class="fas fa-plus"></i> Ajouter
      </button>
    </div>
    <div id="catalogue-list">
      ${catalogue.length ? catalogue.map(item => `
        <div style="display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;${!item.active ? 'opacity:0.5;' : ''}">
          <div style="flex:1;">
            <div style="font-weight:600;font-size:14px;">${item.name}</div>
            ${item.description ? `<div style="font-size:12px;color:var(--muted);margin-top:2px;">${item.description}</div>` : ''}
          </div>
          <div style="font-weight:600;font-size:14px;color:var(--accent);white-space:nowrap;">${Fmt.currency(item.price_ht)} HT</div>
          <span style="font-size:11px;color:var(--muted);">TVA ${item.tva_rate || CONFIG.TVA_DEFAULT}%</span>
          <button class="btn-icon" style="background:none;border:none;cursor:pointer;color:var(--accent);padding:4px 8px;" data-edit-cat="${item.id}" title="Modifier">
            <i class="fas fa-pen" style="font-size:12px;"></i>
          </button>
          <button class="btn-icon" style="background:none;border:none;cursor:pointer;color:var(--urgent);padding:4px 8px;" data-del-cat="${item.id}" title="Supprimer">
            <i class="fas fa-trash" style="font-size:12px;"></i>
          </button>
        </div>
      `).join('') : emptyState('fa-tags', 'Catalogue vide', 'Ajoutez vos prestations pour les utiliser dans les devis')}
    </div>
  `;

  document.getElementById('btn-add-catalogue')?.addEventListener('click', () => openCatalogueModal());
  container.querySelectorAll('[data-edit-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = catalogue.find(c => c.id === btn.dataset.editCat);
      if (item) openCatalogueModal(item);
    });
  });
  container.querySelectorAll('[data-del-cat]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await Modal.confirm({ title: 'Supprimer cette prestation ?', danger: true });
      if (!ok) return;
      try {
        await DB.remove('catalogue', btn.dataset.delCat);
        Toast.success('Prestation supprimée');
        renderSettingsTab();
      } catch { Toast.error('Erreur'); }
    });
  });
}

function openCatalogueModal(item = null) {
  const isEdit = !!item;
  const content = `
    <div style="display:grid;gap:14px;">
      <div>
        <label class="form-label">Nom de la prestation *</label>
        <input type="text" id="cat-name" class="form-input" value="${item?.name || ''}" placeholder="Ex: Soirée Quiz 1 salle">
      </div>
      <div>
        <label class="form-label">Description</label>
        <input type="text" id="cat-desc" class="form-input" value="${item?.description || ''}" placeholder="Description courte">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label class="form-label">Prix HT (€)</label>
          <input type="number" id="cat-price" class="form-input" value="${item?.price_ht || ''}" min="0" step="0.01">
        </div>
        <div>
          <label class="form-label">TVA (%)</label>
          <input type="number" id="cat-tva" class="form-input" value="${item?.tva_rate || CONFIG.TVA_DEFAULT}" min="0" max="100">
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="cat-active" ${item?.active !== false ? 'checked' : ''}>
        <label for="cat-active" style="font-size:13px;">Actif (visible dans les devis)</label>
      </div>
    </div>
  `;

  Modal.open({
    title: isEdit ? 'Modifier la prestation' : 'Nouvelle prestation',
    content,
    size: 'md',
    actions: [
      { label: 'Annuler', class: 'btn-secondary', onClick: (o) => Modal.close(o) },
      {
        label: isEdit ? 'Enregistrer' : 'Ajouter',
        class: 'btn-primary',
        onClick: async (overlay) => {
          const name = document.getElementById('cat-name')?.value?.trim();
          if (!name) { Toast.warning('Le nom est obligatoire'); return; }
          const data = {
            name,
            description: document.getElementById('cat-desc')?.value || null,
            price_ht: parseFloat(document.getElementById('cat-price')?.value) || 0,
            tva_rate: parseFloat(document.getElementById('cat-tva')?.value) || CONFIG.TVA_DEFAULT,
            active: document.getElementById('cat-active')?.checked ?? true,
          };
          try {
            if (isEdit) await DB.update('catalogue', item.id, data);
            else await DB.insert('catalogue', data);
            Toast.success(isEdit ? 'Prestation mise à jour' : 'Prestation ajoutée');
            Modal.close(overlay);
            renderSettingsTab();
          } catch { Toast.error('Erreur'); }
        }
      }
    ]
  });
}

// ============================================================
// 4. SCRIPTS
// ============================================================

function renderSettingsScripts(container) {
  const sectors = Object.keys(SCRIPTS_EMAIL);

  container.innerHTML = `
    <h3 style="margin:0 0 8px;font-family:var(--font-head);font-size:18px;font-weight:600;">Scripts prédéfinis</h3>
    <p style="margin:0 0 20px;font-size:13px;color:var(--muted);">Templates email et téléphone utilisés dans la prospection et les fiches entreprise.</p>
    <div style="display:grid;gap:12px;">
      ${sectors.map(sector => {
        const script = SCRIPTS_EMAIL[sector];
        return `
          <div style="border:1px solid var(--border);border-radius:8px;padding:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span style="font-weight:600;font-size:14px;">${sector}</span>
              <div style="display:flex;gap:6px;">
                <button class="btn-secondary" style="padding:6px 12px;font-size:12px;border-radius:6px;cursor:pointer;" onclick="openEmailScriptModal('${sector}')">
                  <i class="fas fa-eye"></i> Voir email
                </button>
                <button class="btn-secondary" style="padding:6px 12px;font-size:12px;border-radius:6px;cursor:pointer;" onclick="openPhoneScriptModal('${sector}')">
                  <i class="fas fa-phone"></i> Voir téléphone
                </button>
              </div>
            </div>
            <div style="font-size:12px;color:var(--muted);">Objet : ${script.subject}</div>
          </div>
        `;
      }).join('')}
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:var(--muted);"><i class="fas fa-info-circle"></i> Pour modifier les scripts, éditez le fichier <code>scripts.js</code> directement.</p>
  `;
}

// ============================================================
// 5. IMPORT / EXPORT
// ============================================================

function renderSettingsImportExport(container) {
  container.innerHTML = `
    <h3 style="margin:0 0 20px;font-family:var(--font-head);font-size:18px;font-weight:600;">Import / Export</h3>

    <!-- Export -->
    <div style="margin-bottom:24px;padding:20px;background:var(--surface2);border-radius:var(--radius);">
      <h4 style="margin:0 0 10px;font-size:14px;font-weight:600;"><i class="fas fa-download" style="color:var(--accent);margin-right:6px;"></i>Exporter les données</h4>
      <p style="margin:0 0 12px;font-size:13px;color:var(--muted);">Téléchargez vos entreprises ou deals au format CSV.</p>
      <div style="display:flex;gap:8px;">
        <button class="btn-primary" style="padding:8px 16px;border-radius:8px;font-size:13px;cursor:pointer;" id="btn-export-companies">
          <i class="fas fa-building"></i> Exporter entreprises
        </button>
        <button class="btn-primary" style="padding:8px 16px;border-radius:8px;font-size:13px;cursor:pointer;" id="btn-export-deals">
          <i class="fas fa-handshake"></i> Exporter deals
        </button>
      </div>
    </div>

    <!-- Import -->
    <div style="padding:20px;background:var(--surface2);border-radius:var(--radius);">
      <h4 style="margin:0 0 10px;font-size:14px;font-weight:600;"><i class="fas fa-upload" style="color:var(--won);margin-right:6px;"></i>Importer des entreprises</h4>
      <p style="margin:0 0 8px;font-size:13px;color:var(--muted);">Format CSV attendu : <code>name,sector,address,city,phone,email,website,source</code></p>
      <input type="file" id="csv-file-input" accept=".csv" style="margin-bottom:12px;font-size:13px;">
      <br>
      <button class="btn-primary" style="padding:8px 16px;border-radius:8px;font-size:13px;cursor:pointer;" id="btn-import-csv">
        <i class="fas fa-upload"></i> Importer
      </button>
      <div id="import-result" style="margin-top:12px;"></div>
    </div>
  `;

  document.getElementById('btn-export-companies')?.addEventListener('click', () => exportCSV('companies'));
  document.getElementById('btn-export-deals')?.addEventListener('click', () => exportCSV('deals'));
  document.getElementById('btn-import-csv')?.addEventListener('click', importCSV);
}

async function exportCSV(table) {
  try {
    const data = await DB.getAll(table, { orderBy: 'created_at', ascending: false });
    if (!data.length) { Toast.warning('Aucune donnée à exporter'); return; }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    data.forEach(row => {
      const values = headers.map(h => {
        let val = row[h] ?? '';
        if (typeof val === 'object') val = JSON.stringify(val);
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      });
      csvRows.push(values.join(','));
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${table}_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success(`${data.length} lignes exportées`);
  } catch (err) {
    console.error('[Settings] Export error:', err);
    Toast.error("Erreur lors de l'export");
  }
}

async function importCSV() {
  const fileInput = document.getElementById('csv-file-input');
  const resultDiv = document.getElementById('import-result');
  if (!fileInput?.files?.length) { Toast.warning('Sélectionnez un fichier CSV'); return; }

  const file = fileInput.files[0];
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim());

  if (lines.length < 2) { Toast.warning('Le fichier semble vide'); return; }

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const nameIdx = headers.findIndex(h => h.toLowerCase() === 'name' || h.toLowerCase() === 'nom');
  if (nameIdx === -1) { Toast.error('Colonne "name" ou "nom" introuvable'); return; }

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) { errors++; continue; }

    const row = {};
    headers.forEach((h, idx) => {
      const key = h.toLowerCase().replace(/\s+/g, '_');
      row[key] = values[idx]?.replace(/^"|"$/g, '').trim() || null;
    });

    const name = row.name || row.nom;
    if (!name) { skipped++; continue; }

    const dup = await CRM.checkDuplicateCompany(name);
    if (dup) { skipped++; continue; }

    try {
      await DB.insert('companies', {
        name,
        sector: row.sector || row.secteur || null,
        address: row.address || row.adresse || null,
        city: row.city || row.ville || null,
        phone: row.phone || row.telephone || row.tel || null,
        email: row.email || null,
        website: row.website || row.site || null,
        source: row.source || 'Import CSV',
        ai_score: 0,
      });
      imported++;
    } catch { errors++; }
  }

  if (resultDiv) {
    resultDiv.innerHTML = `
      <div style="font-size:13px;padding:12px;background:var(--won-soft);border-radius:8px;color:var(--won);">
        <strong>${imported}</strong> entreprise${imported > 1 ? 's' : ''} importée${imported > 1 ? 's' : ''}
        ${skipped ? ` · <strong>${skipped}</strong> doublon${skipped > 1 ? 's' : ''} ignoré${skipped > 1 ? 's' : ''}` : ''}
        ${errors ? ` · <strong>${errors}</strong> erreur${errors > 1 ? 's' : ''}` : ''}
      </div>
    `;
  }
  Toast.success(`Import terminé : ${imported} entreprise${imported > 1 ? 's' : ''}`);
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ============================================================
// 6. API GOOGLE MAPS
// ============================================================

async function renderSettingsMaps(container) {
  const currentKey = await Settings.get('google_maps_key', '');

  container.innerHTML = `
    <h3 style="margin:0 0 8px;font-family:var(--font-head);font-size:18px;font-weight:600;">API Google Maps</h3>
    <p style="margin:0 0 20px;font-size:13px;color:var(--muted);">Nécessaire pour le module Prospection (recherche d'entreprises sur la carte).</p>
    <div style="max-width:500px;">
      <div style="margin-bottom:16px;">
        <label class="form-label">Clé API Google Maps</label>
        <input type="text" id="set-maps-key" class="form-input" value="${currentKey}" placeholder="AIzaSy…" style="font-family:monospace;">
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button class="btn-primary" style="padding:10px 20px;border-radius:8px;font-size:13px;cursor:pointer;" id="btn-save-maps-key">
          <i class="fas fa-save"></i> Enregistrer
        </button>
        ${currentKey ? `<button class="btn-secondary" style="padding:10px 20px;border-radius:8px;font-size:13px;cursor:pointer;" id="btn-test-maps-key">
          <i class="fas fa-vial"></i> Tester
        </button>` : ''}
      </div>
      <div style="padding:14px;background:var(--surface2);border-radius:8px;font-size:12px;color:var(--muted);line-height:1.6;">
        <strong>Comment obtenir une clé :</strong><br>
        1. Allez sur <a href="https://console.cloud.google.com/apis" target="_blank" style="color:var(--accent);">Google Cloud Console</a><br>
        2. Créez un projet et activez les APIs : Maps JavaScript API + Places API<br>
        3. Créez une clé API dans Identifiants<br>
        4. Collez la clé ci-dessus
      </div>
    </div>
  `;

  document.getElementById('btn-save-maps-key')?.addEventListener('click', async () => {
    const key = document.getElementById('set-maps-key')?.value?.trim() || '';
    try {
      await Settings.set('google_maps_key', key);
      CONFIG.GOOGLE_MAPS_KEY = key;
      Toast.success(key ? 'Clé Google Maps enregistrée' : 'Clé Google Maps supprimée');
    } catch { Toast.error('Erreur'); }
  });

  document.getElementById('btn-test-maps-key')?.addEventListener('click', () => {
    const key = document.getElementById('set-maps-key')?.value?.trim();
    if (!key) { Toast.warning('Entrez une clé'); return; }
    const testScript = document.createElement('script');
    testScript.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=__mapsTestCallback`;
    window.__mapsTestCallback = () => {
      Toast.success('Clé Google Maps valide !');
      delete window.__mapsTestCallback;
    };
    testScript.onerror = () => {
      Toast.error('Clé invalide ou APIs non activées');
      delete window.__mapsTestCallback;
    };
    document.head.appendChild(testScript);
  });
}

// ============================================================
// 7. SÉCURITÉ
// ============================================================

function renderSettingsSecurite(container) {
  container.innerHTML = `
    <h3 style="margin:0 0 20px;font-family:var(--font-head);font-size:18px;font-weight:600;">Sécurité</h3>
    <div style="max-width:400px;">
      <div style="margin-bottom:16px;">
        <label class="form-label">Mot de passe actuel</label>
        <input type="password" id="set-old-pw" class="form-input" placeholder="••••••">
      </div>
      <div style="margin-bottom:16px;">
        <label class="form-label">Nouveau mot de passe</label>
        <input type="password" id="set-new-pw" class="form-input" placeholder="••••••">
      </div>
      <div style="margin-bottom:16px;">
        <label class="form-label">Confirmer</label>
        <input type="password" id="set-confirm-pw" class="form-input" placeholder="••••••">
      </div>
      <button class="btn-primary" style="padding:10px 20px;border-radius:8px;font-size:13px;cursor:pointer;" id="btn-change-pw">
        <i class="fas fa-lock"></i> Changer le mot de passe
      </button>
      <p style="margin:16px 0 0;font-size:12px;color:var(--muted);">
        <i class="fas fa-info-circle"></i> Le mot de passe est stocké dans la table <code>settings</code> de Supabase. Par défaut : <code>AMIENS2026</code>
      </p>
    </div>
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid var(--border);">
      <button style="background:none;border:none;cursor:pointer;color:var(--urgent);font-size:13px;font-weight:500;" id="btn-logout">
        <i class="fas fa-sign-out-alt"></i> Se déconnecter
      </button>
    </div>
  `;

  document.getElementById('btn-change-pw')?.addEventListener('click', async () => {
    const oldPw = document.getElementById('set-old-pw')?.value;
    const newPw = document.getElementById('set-new-pw')?.value;
    const confirmPw = document.getElementById('set-confirm-pw')?.value;

    // Vérifier l'ancien
    const storedPw = await Settings.get('crm_password', CONFIG.CRM_PASSWORD);
    if (oldPw !== storedPw) { Toast.error('Mot de passe actuel incorrect'); return; }
    if (!newPw || newPw.length < 4) { Toast.warning('Le nouveau mot de passe doit faire au moins 4 caractères'); return; }
    if (newPw !== confirmPw) { Toast.error('Les mots de passe ne correspondent pas'); return; }

    try {
      await Settings.set('crm_password', newPw);
      Toast.success('Mot de passe modifié');
      document.getElementById('set-old-pw').value = '';
      document.getElementById('set-new-pw').value = '';
      document.getElementById('set-confirm-pw').value = '';
    } catch { Toast.error('Erreur'); }
  });

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    sessionStorage.removeItem('crm_authenticated');
    sessionStorage.removeItem('crm_user_name');
    location.reload();
  });
}
