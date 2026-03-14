// ============================================================
// supabase.js — Client Supabase + helpers CRUD
// Le client s'appelle 'sb' (pas 'supabase') car le CDN
// crée déjà une globale window.supabase
// ============================================================

let sb;
try {
  if (window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_ANON_KEY,
      { db: { schema: 'public' } }
    );
    console.log('[supabase.js] Client initialisé.');
  } else {
    console.error('[supabase.js] CDN Supabase non chargé.');
  }
} catch (e) {
  console.error('[supabase.js] Erreur init:', e.message);
}

function _requireSB() {
  if (!sb) throw new Error('Supabase non disponible — rechargez la page.');
}

// ============================================================
// SCHEMA CACHE AUTO-REPAIR
// Si PostgREST ne trouve pas les tables, on force un reload
// via la fonction SQL reload_schema_cache() puis on retente.
// ============================================================

let _schemaReloaded = false;

async function _reloadSchemaCache() {
  if (_schemaReloaded) return; // On ne tente qu'une fois
  _schemaReloaded = true;
  console.warn('[supabase.js] Tentative de rechargement du cache schema PostgREST...');
  try {
    await sb.rpc('reload_schema_cache');
    // Attendre que PostgREST prenne en compte le rechargement
    await new Promise(r => setTimeout(r, 2000));
    console.log('[supabase.js] Cache schema rechargé.');
  } catch (e) {
    console.warn('[supabase.js] reload_schema_cache non disponible:', e.message);
    // Fallback : tenter un appel direct REST pour forcer la détection
    try {
      const url = `${CONFIG.SUPABASE_URL}/rest/v1/settings?select=key&limit=1`;
      await fetch(url, {
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        }
      });
    } catch {}
  }
}

/**
 * Wrapper qui retente une query après reload schema si erreur PGRST204
 */
async function _queryWithRetry(queryFn) {
  const result = await queryFn();
  if (result.error && result.error.code === 'PGRST204') {
    await _reloadSchemaCache();
    return await queryFn();
  }
  return result;
}

// ============================================================
// CRUD Générique
// ============================================================

const DB = {
  async getAll(table, { orderBy = 'created_at', ascending = false, filters = {}, limit = null } = {}) {
    _requireSB();
    const result = await _queryWithRetry(() => {
      let query = sb.from(table).select('*').order(orderBy, { ascending });
      for (const [col, val] of Object.entries(filters)) {
        if (val !== undefined && val !== null && val !== '') query = query.eq(col, val);
      }
      if (limit) query = query.limit(limit);
      return query;
    });
    if (result.error) { console.error(`[DB.getAll] ${table}:`, result.error.message); throw result.error; }
    return result.data || [];
  },

  async getById(table, id) {
    _requireSB();
    const result = await _queryWithRetry(() =>
      sb.from(table).select('*').eq('id', id).single()
    );
    if (result.error) { console.error(`[DB.getById] ${table}:`, result.error.message); throw result.error; }
    return result.data;
  },

  async getWhere(table, column, value, { orderBy = 'created_at', ascending = false } = {}) {
    _requireSB();
    const result = await _queryWithRetry(() =>
      sb.from(table).select('*').eq(column, value).order(orderBy, { ascending })
    );
    if (result.error) { console.error(`[DB.getWhere] ${table}:`, result.error.message); throw result.error; }
    return result.data || [];
  },

  async insert(table, row) {
    _requireSB();
    const result = await _queryWithRetry(() =>
      sb.from(table).insert(row).select().single()
    );
    if (result.error) { console.error(`[DB.insert] ${table}:`, result.error.message); throw result.error; }
    return result.data;
  },

  async insertMany(table, rows) {
    _requireSB();
    if (!rows.length) return [];
    const result = await _queryWithRetry(() =>
      sb.from(table).insert(rows).select()
    );
    if (result.error) { console.error(`[DB.insertMany] ${table}:`, result.error.message); throw result.error; }
    return result.data || [];
  },

  async update(table, id, updates) {
    _requireSB();
    updates.updated_at = new Date().toISOString();
    const result = await _queryWithRetry(() =>
      sb.from(table).update(updates).eq('id', id).select().single()
    );
    if (result.error) { console.error(`[DB.update] ${table}:`, result.error.message); throw result.error; }
    return result.data;
  },

  async remove(table, id) {
    _requireSB();
    const result = await _queryWithRetry(() =>
      sb.from(table).delete().eq('id', id)
    );
    if (result.error) { console.error(`[DB.remove] ${table}:`, result.error.message); throw result.error; }
    return true;
  },

  async upsert(table, row, { onConflict = 'id' } = {}) {
    _requireSB();
    const result = await _queryWithRetry(() =>
      sb.from(table).upsert(row, { onConflict }).select().single()
    );
    if (result.error) { console.error(`[DB.upsert] ${table}:`, result.error.message); throw result.error; }
    return result.data;
  },

  async count(table, filters = {}) {
    _requireSB();
    const result = await _queryWithRetry(() => {
      let query = sb.from(table).select('*', { count: 'exact', head: true });
      for (const [col, val] of Object.entries(filters)) {
        if (val !== undefined && val !== null && val !== '') query = query.eq(col, val);
      }
      return query;
    });
    if (result.error) { console.error(`[DB.count] ${table}:`, result.error.message); throw result.error; }
    return result.count || 0;
  },

  async search(table, column, term, { orderBy = 'created_at', ascending = false, limit = 50 } = {}) {
    _requireSB();
    const result = await _queryWithRetry(() =>
      sb.from(table).select('*').ilike(column, `%${term}%`).order(orderBy, { ascending }).limit(limit)
    );
    if (result.error) { console.error(`[DB.search] ${table}:`, result.error.message); throw result.error; }
    return result.data || [];
  },
};

// ============================================================
// Settings helpers (table key-value)
// ============================================================

const Settings = {
  async get(key, defaultValue = null) {
    if (!sb) return defaultValue;
    try {
      const result = await _queryWithRetry(() =>
        sb.from('settings').select('value').eq('key', key).single()
      );
      if (result.error || !result.data) return defaultValue;
      return result.data.value;
    } catch {
      return defaultValue;
    }
  },

  async set(key, value) {
    _requireSB();
    const result = await _queryWithRetry(() =>
      sb.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' }).select().single()
    );
    if (result.error) { console.error(`[Settings.set] ${key}:`, result.error.message); throw result.error; }
    return result.data;
  },

  async getAll() {
    if (!sb) return {};
    try {
      const result = await _queryWithRetry(() =>
        sb.from('settings').select('*')
      );
      if (result.error) { console.error('[Settings.getAll]:', result.error.message); return {}; }
      const map = {};
      (result.data || []).forEach(row => { map[row.key] = row.value; });
      return map;
    } catch {
      return {};
    }
  },
};

// ============================================================
// Helpers spécifiques métier
// ============================================================

const CRM = {
  async getCompanies(filters = {}) {
    return DB.getAll('companies', { orderBy: 'name', ascending: true, filters });
  },
  async getCompany(id) {
    return DB.getById('companies', id);
  },
  async searchCompanies(term) {
    return DB.search('companies', 'name', term, { orderBy: 'name', ascending: true });
  },

  async checkDuplicateCompany(name, googlePlaceId = null) {
    if (!sb) return null;
    if (googlePlaceId) {
      const r = await _queryWithRetry(() =>
        sb.from('companies').select('id, name').eq('google_place_id', googlePlaceId).limit(1)
      );
      if (r.data && r.data.length > 0) return r.data[0];
    }
    const r = await _queryWithRetry(() =>
      sb.from('companies').select('id, name').ilike('name', name.trim()).limit(1)
    );
    return (r.data && r.data.length > 0) ? r.data[0] : null;
  },

  async getContacts(companyId) {
    return DB.getWhere('contacts', 'company_id', companyId, { orderBy: 'last_name', ascending: true });
  },

  async getDeals(filters = {}) {
    return DB.getAll('deals', { filters });
  },
  async getDealsByStatus(status) {
    return DB.getWhere('deals', 'status', status);
  },
  async getDealsByCompany(companyId) {
    return DB.getWhere('deals', 'company_id', companyId);
  },

  async getActivities(companyId) {
    return DB.getWhere('activities', 'company_id', companyId);
  },

  async logActivity(activity) {
    return DB.insert('activities', {
      company_id: activity.company_id || null,
      contact_id: activity.contact_id || null,
      deal_id: activity.deal_id || null,
      type: activity.type || 'note',
      title: activity.title || '',
      body: activity.body || '',
      metadata: activity.metadata || {},
    });
  },

  async getQuotes(filters = {}) {
    return DB.getAll('quotes', { filters });
  },

  async getNextQuoteNumber() {
    if (!sb) return `${CONFIG.QUOTE_PREFIX}-${new Date().getFullYear()}-001`;
    const year = new Date().getFullYear();
    const prefix = `${CONFIG.QUOTE_PREFIX}-${year}-`;
    const r = await _queryWithRetry(() =>
      sb.from('quotes').select('quote_number').ilike('quote_number', `${prefix}%`).order('quote_number', { ascending: false }).limit(1)
    );
    if (r.data && r.data.length > 0) {
      const lastNum = parseInt(r.data[0].quote_number.replace(prefix, ''), 10);
      return `${prefix}${String(lastNum + 1).padStart(3, '0')}`;
    }
    return `${prefix}001`;
  },

  async getCatalogue(activeOnly = true) {
    if (activeOnly) return DB.getAll('catalogue', { orderBy: 'name', ascending: true, filters: { active: true } });
    return DB.getAll('catalogue', { orderBy: 'name', ascending: true });
  },

  async getTemplates(type = null) {
    if (type) return DB.getWhere('templates', 'type', type, { orderBy: 'name', ascending: true });
    return DB.getAll('templates', { orderBy: 'name', ascending: true });
  },

  async getMonthRevenue() {
    if (!sb) return 0;
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    const r = await _queryWithRetry(() =>
      sb.from('deals').select('amount').eq('status', 'Gagné').gte('updated_at', start.toISOString())
    );
    if (r.error) return 0;
    return (r.data || []).reduce((s, d) => s + (d.amount || 0), 0);
  },

  async getPipelineTotal() {
    if (!sb) return 0;
    const r = await _queryWithRetry(() =>
      sb.from('deals').select('amount').in('status', ['Nouveau', 'En cours', 'À relancer'])
    );
    if (r.error) return 0;
    return (r.data || []).reduce((s, d) => s + (d.amount || 0), 0);
  },

  async getRelancesDues() {
    if (!sb) return [];
    const today = new Date().toISOString().split('T')[0];
    const r = await _queryWithRetry(() =>
      sb.from('deals').select('*').in('status', ['Nouveau', 'En cours', 'À relancer']).lte('date_relance', today)
    );
    if (r.error) return [];
    return r.data || [];
  },

  async getConversionRate() {
    if (!sb) return 0;
    const r1 = await _queryWithRetry(() => sb.from('deals').select('*', { count: 'exact', head: true }));
    const r2 = await _queryWithRetry(() => sb.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'Gagné'));
    if (!r1.count) return 0;
    return Math.round((r2.count / r1.count) * 100);
  },
};

// ============================================================
// Chargement clé Google Maps
// ============================================================

async function loadGoogleMapsKeyFromSettings() {
  try {
    const key = await Settings.get('google_maps_key');
    if (key) CONFIG.GOOGLE_MAPS_KEY = key;
  } catch (e) {
    console.warn('[supabase.js] Clé Maps non chargée:', e.message);
  }
}
