// ============================================================
// supabase.js — Client Supabase + helpers CRUD
// NOTE : le client s'appelle 'sb' (pas 'supabase') car le CDN
//        crée déjà une globale window.supabase
// ============================================================

// --- Initialisation client Supabase ---
let sb;
try {
  if (window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_ANON_KEY
    );
  } else {
    console.error('[supabase.js] Supabase CDN non chargé.');
  }
} catch (e) {
  console.error('[supabase.js] Erreur initialisation:', e.message);
}

function _requireSB() {
  if (!sb) throw new Error('Supabase non disponible — rechargez la page.');
}

// ============================================================
// CRUD Générique
// ============================================================

const DB = {
  async getAll(table, { orderBy = 'created_at', ascending = false, filters = {}, limit = null } = {}) {
    _requireSB();
    let query = sb.from(table).select('*').order(orderBy, { ascending });
    for (const [col, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null && val !== '') {
        query = query.eq(col, val);
      }
    }
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) { console.error(`[DB.getAll] ${table}:`, error.message); throw error; }
    return data || [];
  },

  async getById(table, id) {
    _requireSB();
    const { data, error } = await sb.from(table).select('*').eq('id', id).single();
    if (error) { console.error(`[DB.getById] ${table}:`, error.message); throw error; }
    return data;
  },

  async getWhere(table, column, value, { orderBy = 'created_at', ascending = false } = {}) {
    _requireSB();
    const { data, error } = await sb.from(table).select('*').eq(column, value).order(orderBy, { ascending });
    if (error) { console.error(`[DB.getWhere] ${table}:`, error.message); throw error; }
    return data || [];
  },

  async insert(table, row) {
    _requireSB();
    const { data, error } = await sb.from(table).insert(row).select().single();
    if (error) { console.error(`[DB.insert] ${table}:`, error.message); throw error; }
    return data;
  },

  async insertMany(table, rows) {
    _requireSB();
    if (!rows.length) return [];
    const { data, error } = await sb.from(table).insert(rows).select();
    if (error) { console.error(`[DB.insertMany] ${table}:`, error.message); throw error; }
    return data || [];
  },

  async update(table, id, updates) {
    _requireSB();
    updates.updated_at = new Date().toISOString();
    const { data, error } = await sb.from(table).update(updates).eq('id', id).select().single();
    if (error) { console.error(`[DB.update] ${table}:`, error.message); throw error; }
    return data;
  },

  async remove(table, id) {
    _requireSB();
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) { console.error(`[DB.remove] ${table}:`, error.message); throw error; }
    return true;
  },

  async upsert(table, row, { onConflict = 'id' } = {}) {
    _requireSB();
    const { data, error } = await sb.from(table).upsert(row, { onConflict }).select().single();
    if (error) { console.error(`[DB.upsert] ${table}:`, error.message); throw error; }
    return data;
  },

  async count(table, filters = {}) {
    _requireSB();
    let query = sb.from(table).select('*', { count: 'exact', head: true });
    for (const [col, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null && val !== '') {
        query = query.eq(col, val);
      }
    }
    const { count, error } = await query;
    if (error) { console.error(`[DB.count] ${table}:`, error.message); throw error; }
    return count || 0;
  },

  async search(table, column, term, { orderBy = 'created_at', ascending = false, limit = 50 } = {}) {
    _requireSB();
    const { data, error } = await sb.from(table).select('*')
      .ilike(column, `%${term}%`).order(orderBy, { ascending }).limit(limit);
    if (error) { console.error(`[DB.search] ${table}:`, error.message); throw error; }
    return data || [];
  },
};

// ============================================================
// Settings helpers (table key-value)
// ============================================================

const Settings = {
  async get(key, defaultValue = null) {
    if (!sb) return defaultValue;
    try {
      const { data, error } = await sb.from('settings').select('value').eq('key', key).single();
      if (error || !data) return defaultValue;
      return data.value;
    } catch {
      return defaultValue;
    }
  },

  async set(key, value) {
    _requireSB();
    const { data, error } = await sb
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .select().single();
    if (error) { console.error(`[Settings.set] ${key}:`, error.message); throw error; }
    return data;
  },

  async getAll() {
    if (!sb) return {};
    const { data, error } = await sb.from('settings').select('*');
    if (error) { console.error('[Settings.getAll]:', error.message); return {}; }
    const map = {};
    (data || []).forEach(row => { map[row.key] = row.value; });
    return map;
  },
};

// ============================================================
// Helpers spécifiques métier
// ============================================================

const CRM = {
  // --- Companies ---
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
      const { data } = await sb.from('companies').select('id, name').eq('google_place_id', googlePlaceId).limit(1);
      if (data && data.length > 0) return data[0];
    }
    const { data } = await sb.from('companies').select('id, name').ilike('name', name.trim()).limit(1);
    return (data && data.length > 0) ? data[0] : null;
  },

  // --- Contacts ---
  async getContacts(companyId) {
    return DB.getWhere('contacts', 'company_id', companyId, { orderBy: 'last_name', ascending: true });
  },

  // --- Deals ---
  async getDeals(filters = {}) {
    return DB.getAll('deals', { filters });
  },

  async getDealsByStatus(status) {
    return DB.getWhere('deals', 'status', status);
  },

  async getDealsByCompany(companyId) {
    return DB.getWhere('deals', 'company_id', companyId);
  },

  // --- Activities ---
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

  // --- Quotes ---
  async getQuotes(filters = {}) {
    return DB.getAll('quotes', { filters });
  },

  async getNextQuoteNumber() {
    if (!sb) return `${CONFIG.QUOTE_PREFIX}-${new Date().getFullYear()}-001`;
    const year = new Date().getFullYear();
    const prefix = `${CONFIG.QUOTE_PREFIX}-${year}-`;
    const { data } = await sb.from('quotes').select('quote_number')
      .ilike('quote_number', `${prefix}%`).order('quote_number', { ascending: false }).limit(1);
    if (data && data.length > 0) {
      const lastNum = parseInt(data[0].quote_number.replace(prefix, ''), 10);
      return `${prefix}${String(lastNum + 1).padStart(3, '0')}`;
    }
    return `${prefix}001`;
  },

  // --- Catalogue ---
  async getCatalogue(activeOnly = true) {
    if (activeOnly) {
      return DB.getAll('catalogue', { orderBy: 'name', ascending: true, filters: { active: true } });
    }
    return DB.getAll('catalogue', { orderBy: 'name', ascending: true });
  },

  // --- Templates ---
  async getTemplates(type = null) {
    if (type) return DB.getWhere('templates', 'type', type, { orderBy: 'name', ascending: true });
    return DB.getAll('templates', { orderBy: 'name', ascending: true });
  },

  // --- Stats rapides ---
  async getMonthRevenue() {
    if (!sb) return 0;
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    const { data, error } = await sb.from('deals').select('amount').eq('status', 'Gagné').gte('updated_at', start.toISOString());
    if (error) return 0;
    return (data || []).reduce((sum, d) => sum + (d.amount || 0), 0);
  },

  async getPipelineTotal() {
    if (!sb) return 0;
    const { data, error } = await sb.from('deals').select('amount').in('status', ['Nouveau', 'En cours', 'À relancer']);
    if (error) return 0;
    return (data || []).reduce((sum, d) => sum + (d.amount || 0), 0);
  },

  async getRelancesDues() {
    if (!sb) return [];
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await sb.from('deals').select('*').in('status', ['Nouveau', 'En cours', 'À relancer']).lte('date_relance', today);
    if (error) return [];
    return data || [];
  },

  async getConversionRate() {
    if (!sb) return 0;
    const { count: total } = await sb.from('deals').select('*', { count: 'exact', head: true });
    const { count: won } = await sb.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'Gagné');
    if (!total) return 0;
    return Math.round((won / total) * 100);
  },
};

// ============================================================
// Chargement initial : récupérer la clé Google Maps depuis settings
// ============================================================

async function loadGoogleMapsKeyFromSettings() {
  try {
    const key = await Settings.get('google_maps_key');
    if (key) CONFIG.GOOGLE_MAPS_KEY = key;
  } catch (e) {
    console.warn('[supabase.js] Clé Maps non chargée:', e.message);
  }
}
