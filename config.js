// ============================================================
// config.js — Configuration globale CRM Quiz Room Amiens
// ============================================================

const CONFIG = {
  // --- Supabase ---
  SUPABASE_URL: 'https://akahfbtcxnfdhkzsccut.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrYWhmYnRjeG5mZGhrenNjY3V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mjc1NDcsImV4cCI6MjA4OTAwMzU0N30.gVCJOkuBhF68MKK2DbfqkJUnN22fR0JzxDqgZHTQYr4',

  // --- Mot de passe CRM ---
  CRM_PASSWORD: 'AMIENS2026',

  // --- Google Maps ---
  // Sera surchargé par la valeur stockée dans Supabase (table settings, key = 'google_maps_key')
  GOOGLE_MAPS_KEY: '',

  // --- Quiz Room infos par défaut ---
  BUSINESS: {
    name: 'Quiz Room Amiens',
    address: 'Amiens, France',
    siret: '',
    email: '',
    phone: '',
    mentions_legales: '',
  },

  // --- Devis ---
  QUOTE_PREFIX: 'QR',
  TVA_DEFAULT: 20,
  QUOTE_VALIDITY_DAYS: 30,
  RELANCE_DELAYS: [3, 7, 14], // jours après envoi

  // --- Pipeline ---
  PIPELINE_STATUSES: ['Nouveau', 'En cours', 'À relancer', 'Gagné', 'Perdu'],
  QUOTE_STATUSES: ['Brouillon', 'Envoyé', 'Négociation', 'Signé', 'Refusé'],

  // --- Lead scoring seuils ---
  LEAD_SCORE: {
    HOT: 70,
    WARM: 40,
  },

  // --- Prospection ---
  MAP_CENTER: { lat: 49.8941, lng: 2.2958 }, // Amiens
  MAP_ZOOM: 13,
  SEARCH_RADIUS: 5000, // mètres
};

// --- Salles Quiz Room ---
const ROOMS = {
  quiz_standard:   { label: 'Quiz – 1 salle',           capacity: 18,  type: 'quiz'    },
  quiz_tournoi:    { label: 'Quiz – Tournoi (2 salles)', capacity: 36,  type: 'quiz'    },
  karaoke_cabaret: { label: 'Karaoké – Cabaret',         capacity: 13,  type: 'karaoke' },
  karaoke_jungle:  { label: 'Karaoké – Jungle',          capacity: 17,  type: 'karaoke' },
  pack_quiz_cabaret: { label: 'Pack Quiz + Cabaret',     capacity: 31,  type: 'pack'    },
  pack_quiz_jungle:  { label: 'Pack Quiz + Jungle',      capacity: 35,  type: 'pack'    },
  pack_tournoi_cabaret: { label: 'Pack Tournoi + Cabaret', capacity: 49, type: 'pack'   },
  pack_tournoi_jungle:  { label: 'Pack Tournoi + Jungle',  capacity: 53, type: 'pack'   },
  privatisation:   { label: 'Privatisation complète',    capacity: null, type: 'full'    },
};

// --- Tags couleurs par type de salle ---
const ROOM_COLORS = {
  quiz:    { bg: '#f0eeff', text: '#5b4cf0', label: 'Quiz'          },
  karaoke: { bg: '#f0f9ff', text: '#0284c7', label: 'Karaoké'       },
  pack:    { bg: '#faf5ff', text: '#7c3aed', label: 'Pack'          },
  full:    { bg: '#fffbeb', text: '#d97706', label: 'Privatisation'  },
};

// --- Secteurs prospects ---
const SECTORS = [
  'CSE',
  'Entreprise',
  'Association',
  'École',
  'Agence',
  'Particulier',
  'Autre',
];

// --- Sources de leads ---
const LEAD_SOURCES = [
  'Prospection',
  'Site web',
  'Bouche à oreille',
  'Réseaux sociaux',
  'Google Maps',
  'Salon / Événement',
  'Partenaire',
  'Autre',
];
