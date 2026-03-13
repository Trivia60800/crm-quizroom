// ============================================================
// scripts.js — Templates de scripts prédéfinis (email, téléphone)
// Remplace Claude API — personnalisables dans Paramètres
// ============================================================

const SCRIPTS_EMAIL = {
  CSE: {
    subject: "Une idée originale pour votre prochain événement CSE 🎯",
    body: `Bonjour,

Je me permets de vous contacter concernant l'animation de vos prochains événements CSE.

Quiz Room Amiens propose des soirées quiz animées, du karaoké privatisé et des animations sur-mesure, idéales pour fédérer vos équipes dans une ambiance conviviale.

Nous accueillons jusqu'à 36 personnes et proposons des formules à partir de 350 €.

Seriez-vous disponible pour un échange rapide de 15 minutes cette semaine ?

Cordialement,
{SIGNATURE}`
  },
  Entreprise: {
    subject: "Team-building original à Amiens — Quiz Room",
    body: `Bonjour,

Pour votre prochain team-building ou événement d'entreprise, Quiz Room Amiens propose une expérience unique : soirées quiz animées, karaoké privatisé, ambiance garantie.

Formules de 300 à 1 500 € selon vos besoins, jusqu'à 36 participants.

Un échange de 15 min pour en discuter ?

Cordialement,
{SIGNATURE}`
  },
  Association: {
    subject: "Animation soirée pour votre association — Quiz Room Amiens",
    body: `Bonjour,

Quiz Room Amiens propose des animations soirées clé en main pour les associations : quiz thématiques, karaoké, privatisation complète.

Tarifs adaptés aux associations, devis gratuit sous 24h.

Intéressé(e) par un échange rapide ?

Cordialement,
{SIGNATURE}`
  },
  École: {
    subject: "Sortie originale pour vos élèves/étudiants — Quiz Room",
    body: `Bonjour,

Pour une sortie pédagogique et ludique, Quiz Room Amiens accueille vos groupes pour des soirées quiz thématiques et du karaoké privatisé.

Formules groupes scolaires disponibles, jusqu'à 36 participants.

Je reste disponible pour en discuter !

Cordialement,
{SIGNATURE}`
  },
  Agence: {
    subject: "Partenariat événementiel — Quiz Room Amiens",
    body: `Bonjour,

Je vous contacte pour vous présenter Quiz Room Amiens comme partenaire événementiel : quiz animés, karaoké privatisé, animations sur-mesure pour vos clients.

Nous serions ravis d'intégrer votre réseau de prestataires.

Disponible pour un échange cette semaine ?

Cordialement,
{SIGNATURE}`
  },
  default: {
    subject: "Une animation événementielle à Amiens — Quiz Room",
    body: `Bonjour,

Quiz Room Amiens propose des soirées quiz animées et du karaoké privatisé pour tous types d'événements.

Formules à partir de 300 €, jusqu'à 36 personnes.

Seriez-vous disponible pour un échange rapide ?

Cordialement,
{SIGNATURE}`
  }
};

const SCRIPTS_PHONE = {
  CSE: {
    accroche: "Bonjour, je suis {PRENOM} de Quiz Room Amiens. Je vous contacte car nous proposons des animations clé en main pour les CSE : soirées quiz, karaoké privatisé, team-building original.",
    question_pivot: "Est-ce que votre CSE organise des sorties ou animations pour les salariés prochainement ?",
    objections: [
      { objection: "On n'a pas le budget", reponse: "Je comprends. Nos formules CSE démarrent à 350 € pour un groupe. Je peux vous envoyer un devis personnalisé sans engagement ?" },
      { objection: "On n'est pas intéressés", reponse: "Pas de souci. Je peux vous envoyer notre brochure par email, ça vous donnera une idée pour vos prochains événements ?" },
      { objection: "On a déjà un prestataire", reponse: "Très bien ! Si jamais vous souhaitez une alternative ou un deuxième avis pour un prochain événement, n'hésitez pas à nous recontacter." }
    ],
    cta: "Je vous envoie notre brochure et un devis indicatif par email, c'est bon pour vous ?"
  },
  Entreprise: {
    accroche: "Bonjour, je suis {PRENOM} de Quiz Room Amiens. Je vous contacte car nous organisons des team-buildings et soirées d'entreprise originales : quiz animés et karaoké privatisé.",
    question_pivot: "Est-ce que vous prévoyez un événement d'équipe ou un team-building dans les prochains mois ?",
    objections: [
      { objection: "On n'a pas le budget", reponse: "Je comprends tout à fait. Nos formules démarrent à 300 € pour un groupe. Je peux vous envoyer un devis personnalisé sans engagement ?" },
      { objection: "On n'est pas intéressés", reponse: "Pas de souci. Je peux vous envoyer notre brochure par email, ça vous donnera une idée pour vos prochains événements ?" },
      { objection: "On a déjà un prestataire", reponse: "Bien sûr ! Si jamais vous souhaitez une alternative pour un prochain événement, n'hésitez pas." }
    ],
    cta: "Je vous envoie notre brochure et un devis indicatif par email, c'est bon pour vous ?"
  },
  default: {
    accroche: "Bonjour, je suis {PRENOM} de Quiz Room Amiens. Je vous contacte car nous proposons des soirées quiz animées et du karaoké privatisé, idéales pour les événements d'entreprise et CSE.",
    question_pivot: "Est-ce que vous organisez des événements ou animations pour vos équipes en ce moment ?",
    objections: [
      { objection: "On n'a pas le budget", reponse: "Je comprends tout à fait. Nos formules démarrent à 300 € pour un groupe. Je peux vous envoyer un devis personnalisé sans engagement ?" },
      { objection: "On n'est pas intéressés", reponse: "Pas de souci. Je peux vous envoyer notre brochure par email, ça vous donnera une idée pour vos prochains événements ?" },
      { objection: "On a déjà un prestataire", reponse: "Bien sûr ! Si jamais vous souhaitez une alternative ou un deuxième avis pour votre prochain événement, n'hésitez pas à nous recontacter." }
    ],
    cta: "Je vous envoie notre brochure et un devis indicatif par email, c'est bon pour vous ?"
  }
};

// ============================================================
// Fonctions utilitaires scripts
// ============================================================

/**
 * Récupère le script email pour un secteur donné.
 * Personnalise avec la signature utilisateur.
 */
function getEmailScript(sector, { prenom = '', companyName = '' } = {}) {
  const tpl = SCRIPTS_EMAIL[sector] || SCRIPTS_EMAIL.default;
  // Récupérer la signature depuis les settings en session
  const signature = sessionStorage.getItem('crm_user_name') || prenom || '[Votre prénom] — Quiz Room Amiens';

  let subject = tpl.subject;
  let body = tpl.body;

  // Remplacements dynamiques
  body = body.replace(/\{SIGNATURE\}/g, signature);
  body = body.replace(/\{PRENOM\}/g, prenom || signature.split(' ')[0] || '');
  if (companyName) {
    // Insérer le nom de l'entreprise au début si pertinent
    body = body.replace(/^Bonjour,/, `Bonjour,\n\n(Entreprise : ${companyName})`);
  }

  return { subject, body };
}

/**
 * Récupère le script téléphonique pour un secteur donné.
 */
function getPhoneScript(sector, { prenom = '' } = {}) {
  const tpl = SCRIPTS_PHONE[sector] || SCRIPTS_PHONE.default;
  const name = prenom || sessionStorage.getItem('crm_user_name') || '[Prénom]';

  return {
    accroche: tpl.accroche.replace(/\{PRENOM\}/g, name),
    question_pivot: tpl.question_pivot,
    objections: tpl.objections,
    cta: tpl.cta,
  };
}

/**
 * Ouvre une modale affichant le script email avec bouton Copier.
 */
function openEmailScriptModal(sector, { companyName = '', contactName = '' } = {}) {
  const script = getEmailScript(sector, { companyName });

  const content = `
    <div style="margin-bottom:16px;">
      <label style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Objet</label>
      <div id="script-subject" style="margin-top:4px;padding:10px 12px;background:var(--surface2);border-radius:8px;font-size:14px;cursor:text;" contenteditable="true">${script.subject}</div>
    </div>
    <div style="margin-bottom:16px;">
      <label style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Corps du message</label>
      <div id="script-body" style="margin-top:4px;padding:12px;background:var(--surface2);border-radius:8px;font-size:14px;white-space:pre-wrap;line-height:1.6;min-height:180px;cursor:text;" contenteditable="true">${script.body}</div>
    </div>
    ${contactName ? `<p style="font-size:12px;color:var(--muted);margin:0 0 8px;">Contact : ${contactName}</p>` : ''}
    <p style="font-size:12px;color:var(--muted);margin:0;">
      <i class="fas fa-info-circle"></i> Modifiez le texte si besoin, puis copiez pour coller dans Gmail.
    </p>
  `;

  Modal.open({
    title: `📧 Script email — ${sector}`,
    content,
    size: 'lg',
    actions: [
      {
        label: 'Fermer',
        class: 'btn-secondary',
        onClick: (overlay) => Modal.close(overlay),
      },
      {
        label: '📋 Copier l\'objet',
        class: 'btn-secondary',
        onClick: () => {
          const subject = document.getElementById('script-subject')?.innerText || script.subject;
          copyToClipboard(subject);
        },
      },
      {
        label: '📋 Copier le message',
        class: 'btn-primary',
        onClick: () => {
          const body = document.getElementById('script-body')?.innerText || script.body;
          copyToClipboard(body);
        },
      },
    ],
  });
}

/**
 * Ouvre une modale affichant le script téléphonique.
 */
function openPhoneScriptModal(sector, { companyName = '' } = {}) {
  const script = getPhoneScript(sector);

  const objectionsHtml = script.objections.map(o => `
    <div style="padding:10px 12px;background:var(--surface2);border-radius:8px;margin-bottom:8px;">
      <div style="font-weight:600;font-size:13px;color:var(--urgent);margin-bottom:4px;">
        <i class="fas fa-comment-dots" style="font-size:11px;"></i> « ${o.objection} »
      </div>
      <div style="font-size:13px;color:var(--text);line-height:1.5;">↳ ${o.reponse}</div>
    </div>
  `).join('');

  const content = `
    ${companyName ? `<p style="font-size:12px;color:var(--muted);margin:0 0 12px;"><i class="fas fa-building"></i> ${companyName}</p>` : ''}
    <div style="margin-bottom:16px;">
      <label style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Accroche</label>
      <div style="margin-top:4px;padding:12px;background:var(--accent-soft);border-radius:8px;font-size:14px;line-height:1.6;border-left:3px solid var(--accent);">${script.accroche}</div>
    </div>
    <div style="margin-bottom:16px;">
      <label style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Question pivot</label>
      <div style="margin-top:4px;padding:12px;background:var(--won-soft);border-radius:8px;font-size:14px;line-height:1.6;border-left:3px solid var(--won);font-weight:500;">${script.question_pivot}</div>
    </div>
    <div style="margin-bottom:16px;">
      <label style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Objections & réponses</label>
      <div style="margin-top:8px;">${objectionsHtml}</div>
    </div>
    <div>
      <label style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Call to Action</label>
      <div style="margin-top:4px;padding:12px;background:var(--warning-soft);border-radius:8px;font-size:14px;line-height:1.6;border-left:3px solid var(--warning);font-weight:500;">${script.cta}</div>
    </div>
  `;

  Modal.open({
    title: `📞 Script téléphone — ${sector}`,
    content,
    size: 'lg',
    actions: [
      {
        label: 'Fermer',
        class: 'btn-secondary',
        onClick: (overlay) => Modal.close(overlay),
      },
      {
        label: '📋 Copier tout',
        class: 'btn-primary',
        onClick: () => {
          const fullScript = [
            `ACCROCHE :\n${script.accroche}`,
            `\nQUESTION PIVOT :\n${script.question_pivot}`,
            `\nOBJECTIONS :`,
            ...script.objections.map(o => `\n• « ${o.objection} »\n→ ${o.reponse}`),
            `\nCTA :\n${script.cta}`,
          ].join('\n');
          copyToClipboard(fullScript);
        },
      },
    ],
  });
}

/**
 * Ouvre un sélecteur de type de script (email ou téléphone) puis le script lui-même.
 */
function openScriptSelector(sector = 'default', { companyName = '', contactName = '' } = {}) {
  const content = `
    <p style="margin:0 0 20px;font-size:14px;color:var(--muted);">Quel type de script souhaitez-vous générer ?</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <button id="btn-script-email" class="btn-secondary" style="padding:20px;display:flex;flex-direction:column;align-items:center;gap:8px;border-radius:var(--radius);cursor:pointer;transition:all 0.15s;">
        <i class="fas fa-envelope" style="font-size:24px;color:var(--accent);"></i>
        <span style="font-weight:600;">Email</span>
        <span style="font-size:12px;color:var(--muted);">Script à copier/coller dans Gmail</span>
      </button>
      <button id="btn-script-phone" class="btn-secondary" style="padding:20px;display:flex;flex-direction:column;align-items:center;gap:8px;border-radius:var(--radius);cursor:pointer;transition:all 0.15s;">
        <i class="fas fa-phone" style="font-size:24px;color:var(--won);"></i>
        <span style="font-weight:600;">Téléphone</span>
        <span style="font-size:12px;color:var(--muted);">Guide d'appel avec objections</span>
      </button>
    </div>
  `;

  const modal = Modal.open({
    title: `Générer un script — ${sector}`,
    content,
    size: 'sm',
  });

  // Bind les boutons après ouverture
  setTimeout(() => {
    document.getElementById('btn-script-email')?.addEventListener('click', () => {
      Modal.close(modal);
      openEmailScriptModal(sector, { companyName, contactName });
    });
    document.getElementById('btn-script-phone')?.addEventListener('click', () => {
      Modal.close(modal);
      openPhoneScriptModal(sector, { companyName });
    });
  }, 50);
}
