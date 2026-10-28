'use strict';
// I4 (complément) — Boutons d'action sur la fiche membre de la console admin.
// Objectif : rendreMembres() dans public/assets/admin-client.js expose, par
// membre, deux boutons « Vider les appareils » et « Régénérer le lien »,
// chacun avec une confirmation (window.confirm) AVANT l'appel, câblés sur les
// actions serveur déjà testées en I1 (vider_appareils / regenerer_lien) avec
// { membreId: m.id }, et un message de résultat clair.
//
// Nature du test : CONTRAT STATIQUE sur la source front. admin-client.js est un
// IIFE non exporté qui s'exécute sur DOMContentLoaded et exige window.firebase ;
// jsdom ne remplace pas un vrai navigateur (fetch/window.confirm/Firebase).
// L'acceptation COMPORTEMENTALE se fait par gestes propriétaire sur téléphone
// (voir RAPPORT_I4.md). Ce test échoue AVANT l'ajout (aucun bouton dans
// rendreMembres) et PASSE APRÈS.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'assets', 'admin-client.js'), 'utf8');

// Isole le corps de rendreMembres() (jusqu'à la fonction suivante chargerMembres).
function corpsRendreMembres() {
  const i = SRC.indexOf('function rendreMembres');
  assert.ok(i >= 0, 'rendreMembres introuvable dans admin-client.js');
  const j = SRC.indexOf('function chargerMembres', i);
  assert.ok(j > i, 'chargerMembres introuvable après rendreMembres');
  return SRC.slice(i, j);
}

test('rendreMembres câble les deux actions admin avec membreId', () => {
  const body = corpsRendreMembres();
  assert.match(body, /appel\(\s*action\s*,\s*\{\s*membreId:\s*m\.id\s*\}\s*\)/,
    'appel(action, { membreId: m.id }) attendu');
  assert.ok(body.includes("'vider_appareils'"), "action 'vider_appareils' attendue");
  assert.ok(body.includes("'regenerer_lien'"), "action 'regenerer_lien' attendue");
});

test('chaque bouton demande une confirmation AVANT l\'appel', () => {
  const body = corpsRendreMembres();
  // window.confirm dans le garde confirmé, et un early-return si l'admin annule.
  assert.ok(body.includes('window.confirm('), 'window.confirm attendu');
  assert.match(body, /if\s*\(\s*!window\.confirm\([^)]*\)\s*\)\s*return/,
    'un refus de confirmation doit annuler l\'action (return)');
});

test('les deux boutons portent les libellés français attendus', () => {
  const body = corpsRendreMembres();
  assert.ok(body.includes('Vider les appareils'), 'libellé « Vider les appareils » attendu');
  assert.ok(body.includes('Régénérer le lien'), 'libellé « Régénérer le lien » attendu');
});

test('un message de résultat (succès ✔ / échec ✗) est affiché', () => {
  const body = corpsRendreMembres();
  assert.ok(body.includes('✔'), 'marqueur de succès ✔ attendu');
  assert.ok(body.includes('✗'), 'marqueur d\'échec ✗ attendu');
  // Le message doit refléter la réponse serveur { ok, appareilsSupprimes, erreur }.
  assert.ok(body.includes('appareilsSupprimes'), 'lecture de res.j.appareilsSupprimes attendue');
  assert.ok(body.includes('erreur'), 'affichage de res.j.erreur en cas d\'échec attendu');
});

test('garde-fou anti double-clic : le bouton est désactivé pendant l\'appel', () => {
  const body = corpsRendreMembres();
  assert.ok(body.includes('.disabled = true'), 'désactivation du bouton pendant l\'appel attendue');
  assert.ok(body.includes('.disabled = false'), 'réactivation du bouton après l\'appel attendue');
});
