// ============================================================
// supabase.js — Client Supabase + helpers CRUD
// ============================================================

// --- Initialisation client Supabase ---
let supabase;
try {
  if (window.supabase && window.supabase.createClient) {
    supabase = window.supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_ANON_KEY
    );
  } else {
    console.error('[supabase.js] Supabase CDN non chargé. Le CRM fonctionnera en mode dégradé.');
  }
} catch (e) {
  console.error('[supabase.js] Erreur initialisation Supabase:', e.message);
}

// ============================================================
// CRUD Générique
// ============================================================

function _requireSupabase() {
  if (!supabase) throw new Error('Supabase non disponible');
}

const DB = {
  // --- SELECT ---
  async getAll(table, { orderBy = 'created_at', ascending = false, filters = {}, limit = null } = {}) {
    _requireSupabase();
    let query = supabase.from(table).select('*').order(orderBy, { ascending });
    for (const [col, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null && val !== '') {
        query = query.eq(col, val);
      }
    }
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) {
      console.error(`[DB.getAll] ${table}:`, error.message);
      throw error;
    }
    return data || [];
  },

  async getById(table, id) {
    _requireSupabase();
    const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
    if (error) {
      console.error(`[DB.getById] ${table} id=${id}:`, error.message);
      throw error;
    }
    return data;
  },

  async getWhere(table, column, value, { orderBy = 'created_at', ascending = false } = {}) {
    _requireSupabase();
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq(column, value)
      .order(orderBy, { ascending });
    if (error) {
      console.error(`[DB.getWhere] ${table} ${column}=${value}:`, error.message);
      throw error;
    }
    return data || [];
  },

  // --- INSERT ---
  async insert(table, row) {
    _requireSupabase();
    const { data, error } = await supabase.from(table).insert(row).select().single();
    if (error) {
      console.error(`[DB.insert] ${table}:`, error.message);
      throw error;
    }
    return data;
  },

  async insertMany(table, rows) {
    _requireSupabase();
    if (!rows.length) return [];
    const { data, error } = await supabase.from(table).insert(rows).select();
    if (error) {
      console.error(`[DB.insertMany] ${table}:`, error.message);
      throw error;
    }
    return data || [];
  },

  // --- UPDATE ---
  async update(table, id, updates) {
    _requireSupabase();
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
    if (error) {
      console.error(`[DB.update] ${table} id=${id}:`, error.message);
      throw error;
    }
    return data;
  },

  // --- DELETE ---
  async remove(table, id) {
    _requireSupabase();
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      console.error(`[DB.remove] ${table} id=${id}:`, error.message);
      throw error;
    }
    return true;
  },

  // --- UPSERT ---
  async upsert(table, row, { onConflict = 'id' } = {}) {
    _requireSupabase();
    const { data, error } = await supabase.from(table).upsert(row, { onConflict }).select().single();
    if (error) {
      console.error(`[DB.upsert] ${table}:`, error.message);
      throw error;
    }
    return data;
  },

  // --- COUNT ---
  async count(table, filters = {}) {
    _requireSupabase();
    let query = supabase.from(table).select('*', { count: 'exact', head: true });
    for (const [col, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null && val !== '') {
        query = query.eq(col, val);
      }
    }
    const { count, error } = await query;
    if (error) {
      console.error(`[DB.count] ${table}:`, error.message);
      throw error;
    }
    return count || 0;
  },

  // --- SEARCH (ilike) ---
  async search(table, column, term, { orderBy = 'created_at', ascending = false, limit = 50 } = {}) {
    _requireSupabase();
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .ilike(column, `%${term}%`)
      .order(orderBy, { ascending })
      .limit(limit);
    if (error) {
      console.error(`[DB.search] ${table} ${column}~${term}:`, error.message);
      throw error;
    }
    return data || [];
  },
};

// ============================================================
// Settings helpers (table key-value)
// ============================================================

const Settings = {
  async get(key, defaultValue = null) {
    if (!supabase) return defaultValue;
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', key)
        .single();
      if (error || !data) return defaultValue;
      return data.value;
    } catch {
      return defaultValue;
    }
  },

  async set(key, value) {
    _requireSupabase();
    const { data, error } = await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .select()
      .single();
    if (error) {
      console.error(`[Settings.set] ${key}:`, error.message);
      throw error;
    }
    return data;
  },

  async getAll() {
    if (!supabase) return {};
    const { data, error } = await supabase.from('settings').select('*');
    if (error) {
      console.error('[Settings.getAll]:', error.message);
      return {};
    }
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
    if (!supabase) return null;
    // Vérifie par google_place_id d'abord, puis par nom similaire
    if (googlePlaceId) {
      const { data } = await supabase
        .from('companies')
        .select('id, name')
        .eq('google_place_id', googlePlaceId)
        .limit(1);
      if (data && data.length > 0) return data[0];
    }
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .ilike('name', name.trim())
      .limit(1);
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
    if (!supabase) return `${CONFIG.QUOTE_PREFIX}-${new Date().getFullYear()}-001`;
    const year = new Date().getFullYear();
    const prefix = `${CONFIG.QUOTE_PREFIX}-${year}-`;
    const { data } = await supabase
      .from('quotes')
      .select('quote_number')
      .ilike('quote_number', `${prefix}%`)
      .order('quote_number', { ascending: false })
      .limit(1);
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
    if (type) {
      return DB.getWhere('templates', 'type', type, { orderBy: 'name', ascending: true });
    }
    return DB.getAll('templates', { orderBy: 'name', ascending: true });
  },

  // --- Stats rapides ---
  async getMonthRevenue() {
    if (!supabase) return 0;
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('deals')
      .select('amount')
      .eq('status', 'Gagné')
      .gte('updated_at', start.toISOString());
    if (error) return 0;
    return (data || []).reduce((sum, d) => sum + (d.amount || 0), 0);
  },

  async getPipelineTotal() {
    if (!supabase) return 0;
    const { data, error } = await supabase
      .from('deals')
      .select('amount')
      .in('status', ['Nouveau', 'En cours', 'À relancer']);
    if (error) return 0;
    return (data || []).reduce((sum, d) => sum + (d.amount || 0), 0);
  },

  async getRelancesDues() {
    if (!supabase) return [];
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .in('status', ['Nouveau', 'En cours', 'À relancer'])
      .lte('date_relance', today);
    if (error) return [];
    return data || [];
  },

  async getConversionRate() {
    if (!supabase) return 0;
    const { count: total } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true });
    const { count: won } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Gagné');
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
    if (key) {
      CONFIG.GOOGLE_MAPS_KEY = key;
    }
  } catch (e) {
    console.warn('[supabase.js] Impossible de charger la clé Google Maps depuis settings:', e.message);
  }
}
