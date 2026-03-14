// ============================================================
// ui.js — Toast, Loader, Modales, Formatters, Clipboard
// ============================================================

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

const Toast = {
  _container: null,

  _getContainer() {
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.id = 'toast-container';
      this._container.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        display: flex; flex-direction: column; gap: 8px;
        pointer-events: none;
      `;
      document.body.appendChild(this._container);
    }
    return this._container;
  },

  show(message, type = 'info', duration = 3500) {
    const container = this._getContainer();
    const toast = document.createElement('div');

    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle',
    };
    const colors = {
      success: { bg: 'var(--won-soft, #f0fdf4)', border: 'var(--won, #16a34a)', text: 'var(--won, #16a34a)' },
      error: { bg: 'var(--urgent-soft, #fef2f2)', border: 'var(--urgent, #dc2626)', text: 'var(--urgent, #dc2626)' },
      warning: { bg: 'var(--warning-soft, #fffbeb)', border: 'var(--warning, #d97706)', text: 'var(--warning, #d97706)' },
      info: { bg: 'var(--accent-soft, #f0eeff)', border: 'var(--accent, #5b4cf0)', text: 'var(--accent, #5b4cf0)' },
    };
    const c = colors[type] || colors.info;

    toast.style.cssText = `
      pointer-events: auto;
      background: ${c.bg}; border: 1px solid ${c.border}; border-left: 4px solid ${c.border};
      color: var(--text, #1a1917); border-radius: var(--radius, 12px);
      padding: 12px 16px; min-width: 280px; max-width: 420px;
      font-family: var(--font-body, 'DM Sans', sans-serif); font-size: 14px;
      display: flex; align-items: center; gap: 10px;
      box-shadow: var(--shadow, 0 2px 12px rgba(0,0,0,0.08));
      animation: toastIn 0.3s ease;
      transition: opacity 0.3s ease, transform 0.3s ease;
    `;
    toast.innerHTML = `
      <i class="fas ${icons[type] || icons.info}" style="color:${c.text}; font-size:16px; flex-shrink:0;"></i>
      <span style="flex:1;">${message}</span>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:14px;padding:0 0 0 8px;">
        <i class="fas fa-times"></i>
      </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(msg, d) { this.show(msg, 'success', d); },
  error(msg, d)   { this.show(msg, 'error', d); },
  warning(msg, d) { this.show(msg, 'warning', d); },
  info(msg, d)    { this.show(msg, 'info', d); },
};

// Injecter le keyframe pour le toast
(function injectToastCSS() {
  if (document.getElementById('toast-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'toast-keyframes';
  style.textContent = `
    @keyframes toastIn {
      from { opacity: 0; transform: translateX(40px); }
      to   { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);
})();


// ============================================================
// LOADER
// ============================================================

const Loader = {
  show(target = null) {
    const el = target || document.getElementById('main-content');
    if (!el) return;
    // Éviter les doublons
    if (el.querySelector('.crm-loader-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'crm-loader-overlay';
    overlay.style.cssText = `
      position: absolute; inset: 0; z-index: 100;
      background: rgba(255,255,255,0.7);
      display: flex; align-items: center; justify-content: center;
      border-radius: var(--radius, 12px);
    `;
    overlay.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <div class="crm-spinner"></div>
        <span style="font-family:var(--font-body);font-size:13px;color:var(--muted);">Chargement…</span>
      </div>
    `;
    // Le parent doit être positionné
    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
    }
    el.appendChild(overlay);
  },

  hide(target = null) {
    const el = target || document.getElementById('main-content');
    if (!el) return;
    const overlay = el.querySelector('.crm-loader-overlay');
    if (overlay) overlay.remove();
  },
};

// Spinner CSS
(function injectSpinnerCSS() {
  if (document.getElementById('spinner-css')) return;
  const style = document.createElement('style');
  style.id = 'spinner-css';
  style.textContent = `
    .crm-spinner {
      width: 32px; height: 32px;
      border: 3px solid var(--border, #e8e6e1);
      border-top-color: var(--accent, #5b4cf0);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
})();


// ============================================================
// MODALES
// ============================================================

const Modal = {
  /**
   * Ouvre une modale générique.
   * @param {Object} opts
   * @param {string} opts.title       — Titre de la modale
   * @param {string} opts.content     — HTML du body
   * @param {string} [opts.size]      — 'sm' | 'md' | 'lg' | 'xl' (défaut: 'md')
   * @param {Function} [opts.onClose] — Callback à la fermeture
   * @param {Array}  [opts.actions]   — [{label, class, onClick}]
   * @returns {HTMLElement} L'élément modale
   */
  open({ title = '', content = '', size = 'md', onClose = null, actions = [], id = null } = {}) {
    // Fermer une éventuelle modale existante avec le même id
    if (id) {
      const existing = document.getElementById(id);
      if (existing) existing.remove();
    }

    const sizes = { sm: '420px', md: '560px', lg: '720px', xl: '900px' };
    const maxW = sizes[size] || sizes.md;

    const overlay = document.createElement('div');
    overlay.className = 'crm-modal-overlay';
    if (id) overlay.id = id;
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 5000;
      background: rgba(0,0,0,0.35); backdrop-filter: blur(2px);
      display: flex; align-items: center; justify-content: center;
      animation: modalFadeIn 0.2s ease;
    `;

    // Fermer au clic sur l'overlay
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) Modal.close(overlay, onClose);
    });

    const dialog = document.createElement('div');
    dialog.className = 'crm-modal-dialog';
    dialog.style.cssText = `
      background: var(--surface, #fff); border-radius: var(--radius, 12px);
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      width: 90%; max-width: ${maxW}; max-height: 85vh;
      display: flex; flex-direction: column;
      animation: modalSlideIn 0.25s ease;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px 16px; border-bottom: 1px solid var(--border, #e8e6e1);
    `;
    header.innerHTML = `
      <h3 style="margin:0;font-family:var(--font-head);font-size:18px;font-weight:600;color:var(--text);">${title}</h3>
      <button class="crm-modal-close" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--muted);padding:4px 8px;border-radius:6px;transition:background 0.15s;"
        onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='none'">
        <i class="fas fa-times"></i>
      </button>
    `;
    header.querySelector('.crm-modal-close').addEventListener('click', () => Modal.close(overlay, onClose));

    // Body
    const body = document.createElement('div');
    body.className = 'crm-modal-body';
    body.style.cssText = `
      padding: 24px; overflow-y: auto; flex: 1;
      font-family: var(--font-body); font-size: 14px; color: var(--text);
    `;
    body.innerHTML = content;

    // Footer (si actions)
    dialog.appendChild(header);
    dialog.appendChild(body);

    if (actions.length > 0) {
      const footer = document.createElement('div');
      footer.style.cssText = `
        display: flex; justify-content: flex-end; gap: 10px;
        padding: 16px 24px 20px; border-top: 1px solid var(--border, #e8e6e1);
      `;
      actions.forEach(action => {
        const btn = document.createElement('button');
        btn.textContent = action.label;
        btn.className = action.class || 'btn-secondary';
        btn.style.cssText = action.style || '';
        btn.addEventListener('click', () => {
          if (action.onClick) action.onClick(overlay, body);
        });
        footer.appendChild(btn);
      });
      dialog.appendChild(footer);
    }

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Focus trap basique : ESC ferme
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        Modal.close(overlay, onClose);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
    overlay._escHandler = escHandler;

    return overlay;
  },

  close(overlayEl, onClose = null) {
    if (!overlayEl) return;
    if (overlayEl._escHandler) {
      document.removeEventListener('keydown', overlayEl._escHandler);
    }
    overlayEl.style.opacity = '0';
    setTimeout(() => {
      overlayEl.remove();
      if (onClose) onClose();
    }, 200);
  },

  closeAll() {
    document.querySelectorAll('.crm-modal-overlay').forEach(el => {
      Modal.close(el);
    });
  },

  /**
   * Dialogue de confirmation rapide.
   * @returns {Promise<boolean>}
   */
  confirm({ title = 'Confirmer', message = 'Êtes-vous sûr ?', confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false } = {}) {
    return new Promise((resolve) => {
      const modal = Modal.open({
        title,
        content: `<p style="margin:0;line-height:1.6;">${message}</p>`,
        size: 'sm',
        onClose: () => resolve(false),
        actions: [
          {
            label: cancelLabel,
            class: 'btn-secondary',
            onClick: (overlay) => { Modal.close(overlay); resolve(false); },
          },
          {
            label: confirmLabel,
            class: danger ? 'btn-danger' : 'btn-primary',
            onClick: (overlay) => { Modal.close(overlay); resolve(true); },
          },
        ],
      });
    });
  },
};

// Modal CSS keyframes
(function injectModalCSS() {
  if (document.getElementById('modal-css')) return;
  const style = document.createElement('style');
  style.id = 'modal-css';
  style.textContent = `
    @keyframes modalFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes modalSlideIn {
      from { opacity: 0; transform: translateY(-20px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(style);
})();


// ============================================================
// FORMATTERS
// ============================================================

const Fmt = {
  /** Format monétaire : 1 500,00 € */
  currency(amount) {
    if (amount == null || isNaN(amount)) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  },

  /** Format nombre : 1 500 */
  number(n) {
    if (n == null || isNaN(n)) return '0';
    return new Intl.NumberFormat('fr-FR').format(n);
  },

  /** Format pourcentage : 42 % */
  percent(n) {
    if (n == null || isNaN(n)) return '0 %';
    return `${Math.round(n)} %`;
  },

  /** Date courte : 13/03/2026 */
  date(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  /** Date longue : 13 mars 2026 */
  dateLong(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  },

  /** Date relative : il y a 3 jours, aujourd'hui, dans 2 jours */
  dateRelative(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Demain';
    if (diffDays === -1) return 'Hier';
    if (diffDays > 0) return `Dans ${diffDays} jours`;
    return `Il y a ${Math.abs(diffDays)} jours`;
  },

  /** Date pour input HTML : 2026-03-13 */
  dateInput(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toISOString().split('T')[0];
  },

  /** Initiales : "Jean Dupont" → "JD" */
  initials(name) {
    if (!name) return '?';
    return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  },

  /** Tronquer un texte */
  truncate(str, max = 50) {
    if (!str) return '';
    return str.length > max ? str.substring(0, max) + '…' : str;
  },

  /** Badge statut pipeline */
  statusBadge(status) {
    const map = {
      'Nouveau':     { bg: 'var(--accent-soft)', color: 'var(--accent)',   icon: 'fa-sparkles'      },
      'En cours':    { bg: 'var(--progress-soft)', color: 'var(--progress)', icon: 'fa-spinner'      },
      'À relancer':  { bg: 'var(--warning-soft)', color: 'var(--warning)',  icon: 'fa-clock'         },
      'Gagné':       { bg: 'var(--won-soft)',     color: 'var(--won)',      icon: 'fa-check-circle'  },
      'Perdu':       { bg: 'var(--urgent-soft)',  color: 'var(--urgent)',   icon: 'fa-times-circle'  },
      // Devis
      'Brouillon':   { bg: 'var(--surface2)',     color: 'var(--muted)',    icon: 'fa-file'          },
      'Envoyé':      { bg: 'var(--progress-soft)', color: 'var(--progress)', icon: 'fa-paper-plane'  },
      'Négociation': { bg: 'var(--warning-soft)', color: 'var(--warning)',  icon: 'fa-handshake'     },
      'Signé':       { bg: 'var(--won-soft)',     color: 'var(--won)',      icon: 'fa-file-signature'},
      'Refusé':      { bg: 'var(--urgent-soft)',  color: 'var(--urgent)',   icon: 'fa-ban'           },
    };
    const s = map[status] || { bg: 'var(--surface2)', color: 'var(--muted)', icon: 'fa-circle' };
    return `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:500;background:${s.bg};color:${s.color};">
      <i class="fas ${s.icon}" style="font-size:10px;"></i>${status}
    </span>`;
  },

  /** Badge room type */
  roomBadge(roomKey) {
    const room = ROOMS[roomKey];
    if (!room) return '';
    const c = ROOM_COLORS[room.type] || ROOM_COLORS.quiz;
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:500;background:${c.bg};color:${c.text};">
      ${room.label}
    </span>`;
  },

  /** Badge réactivité */
  reactivityBadge(score) {
    if (score == null) return '';
    if (score >= CONFIG.LEAD_SCORE.HOT) {
      return `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:var(--urgent-soft);color:var(--urgent);">
        <i class="fas fa-fire" style="font-size:10px;"></i>Hot
      </span>`;
    }
    if (score >= CONFIG.LEAD_SCORE.WARM) {
      return `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:var(--warning-soft);color:var(--warning);">
        <i class="fas fa-temperature-half" style="font-size:10px;"></i>Warm
      </span>`;
    }
    return `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:var(--progress-soft);color:var(--progress);">
      <i class="fas fa-snowflake" style="font-size:10px;"></i>Cold
    </span>`;
  },

  /** Lead score bar */
  scoreBar(score, max = 100) {
    const pct = Math.min(Math.max(((score || 0) / max) * 100, 0), 100);
    let color = 'var(--progress)';
    if (pct >= 70) color = 'var(--won)';
    else if (pct >= 40) color = 'var(--warning)';
    return `<div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;width:100%;">
      <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;transition:width 0.3s;"></div>
    </div>`;
  },
};


// ============================================================
// CLIPBOARD
// ============================================================

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    Toast.success('Copié dans le presse-papier !');
    return true;
  } catch {
    // Fallback pour les anciens navigateurs
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      Toast.success('Copié dans le presse-papier !');
      return true;
    } catch {
      Toast.error('Impossible de copier. Copiez manuellement.');
      return false;
    } finally {
      ta.remove();
    }
  }
}


// ============================================================
// HELPERS DOM
// ============================================================

/** Raccourci querySelector */
function $(selector, parent = document) {
  return parent.querySelector(selector);
}

/** Raccourci querySelectorAll */
function $$(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

/** Créer un élément avec attributs et enfants */
function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'style' && typeof val === 'object') {
      Object.assign(element.style, val);
    } else if (key === 'class') {
      element.className = val;
    } else if (key.startsWith('on') && typeof val === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), val);
    } else {
      element.setAttribute(key, val);
    }
  }
  children.forEach(child => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof HTMLElement) {
      element.appendChild(child);
    }
  });
  return element;
}

/** Vider un conteneur */
function clearEl(selector) {
  const target = typeof selector === 'string' ? $(selector) : selector;
  if (target) target.innerHTML = '';
  return target;
}

/** Afficher un message vide avec icône */
function emptyState(icon = 'fa-inbox', title = 'Aucun résultat', subtitle = '') {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;color:var(--muted);text-align:center;">
      <i class="fas ${icon}" style="font-size:40px;margin-bottom:16px;opacity:0.5;"></i>
      <p style="margin:0;font-weight:500;font-size:15px;color:var(--text);">${title}</p>
      ${subtitle ? `<p style="margin:6px 0 0;font-size:13px;">${subtitle}</p>` : ''}
    </div>
  `;
}

/** Debounce */
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Capitaliser un mot */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Générer un UUID v4 simple */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
