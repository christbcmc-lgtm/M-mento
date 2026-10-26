'use strict';
// H0 — Le contrat d'API (docs/CONTRAT-API.md) doit décrire le code RÉEL :
// chaque fonction (fichier api/*.js) et chaque action (a=) réellement gérée par
// le code doit apparaître dans le document. Ce test échoue AVANT (doc absente /
// incomplète) et passe APRÈS.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');
const doc = path.join(racine, 'docs', 'CONTRAT-API.md');

// Actions réellement gérées, extraites à la main par lecture du code (source de vérité).
const ATTENDU = {
  'auth':       ['activer', 'session', 'acces', 'code', 'lien-perdu', 'deconnexion'],
  'public':     ['demande', 'decision', 'essai', 'essai-contenu', 'code-reset', 'matieres'],
  'contenu':    ['profil', 'cours'],
  'evaluation': ['liste', 'quiz', 'resultats', 'soumettre'],
  'message':    [],                 // pas de a= : routes GET / POST
  'admin':      ['list_matieres', 'stats', 'list_membres', 'list_demandes', 'rejeter',
                 'list_messages', 'repondre', 'inviter_essai', 'accorder_essai',
                 'list_essais', 'supprimer_essai', 'approuver_nm', 'regenerer_lien',
                 'marquer_lu', 'supprimer_fil']
};

test('H0 : docs/CONTRAT-API.md existe', () => {
  assert.ok(fs.existsSync(doc), 'docs/CONTRAT-API.md doit exister');
});

test('H0 : chaque action du code source est effectivement gérée (garde-fou)', () => {
  // Garantit que la liste ATTENDU ci-dessus reste alignée sur le code.
  const extraire = (fichier, kind) => {
    const src = fs.readFileSync(path.join(racine, 'api', fichier), 'utf8');
    const re = kind === 'case' ? /case\s+'([^']+)'/g
      : kind === 'action' ? /action\s*===\s*'([^']+)'/g
      : /a\s*[!=]==\s*'([^']+)'/g;
    const trouve = new Set();
    let m; while ((m = re.exec(src)) !== null) trouve.add(m[1]);
    return trouve;
  };
  const srcMap = {
    'auth': extraire('auth.js', 'case'),
    'public': extraire('public.js', 'a'),
    'contenu': extraire('contenu.js', 'a'),
    'evaluation': extraire('evaluation.js', 'a'),
    'admin': extraire('admin.js', 'action')
  };
  for (const fn of Object.keys(srcMap)) {
    for (const act of ATTENDU[fn]) {
      assert.ok(srcMap[fn].has(act), fn + ' doit gérer l\'action ' + act + ' (code réel)');
    }
  }
});

test('H0 : le contrat documente chaque fonction et chaque action', () => {
  const texte = fs.readFileSync(doc, 'utf8');
  for (const fn of Object.keys(ATTENDU)) {
    assert.ok(new RegExp('`?' + fn + '`?').test(texte), 'le contrat doit mentionner la fonction ' + fn);
    for (const act of ATTENDU[fn]) {
      assert.ok(texte.includes(act), 'le contrat doit documenter ' + fn + ' · ' + act);
    }
  }
});

test('H0 : le contrat indique les contrôles (session / code / admin) et les codes d\'erreur', () => {
  const texte = fs.readFileSync(doc, 'utf8');
  // Vocabulaire de contrôle d'accès attendu dans le document.
  for (const mot of ['session', 'code', 'admin', 'X-Requested-With']) {
    assert.ok(texte.includes(mot), 'le contrat doit parler de ' + mot);
  }
  // Codes d'erreur réels employés par le code.
  for (const code of ['400', '401', '403', '404', '405', '429', '502']) {
    assert.ok(texte.includes(code), 'le contrat doit lister le code ' + code);
  }
});
