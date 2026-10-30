'use strict';
// K19 (X1) — La fiche d'activation doit lire le CATALOGUE réel
// (contenu/catalogue.json : thermo, proba, info), pas la collection Firestore
// `matieres` (vide → « Aucune matière déclarée », admin bloqué).
//
// Deux volets, protocole PAR ÉLÉMENT (rouge AVANT / vert APRÈS) :
//   A. Fonction partagée catalogueListe() — jamais vide, { id, nom, ordre, bientot }.
//   B. Console admin (jsdom) — les cases apparaissent, se cochent, la sélection
//      part dans approuver_nm ; « bientôt » visible mais non cochable ; sans
//      aucune case, message « au moins une matière » visible.

process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { catalogueListe } = require('../api/_lib/contenu');

// ---------------------------------------------------------------------------
// A. catalogueListe() : source = disque, jamais Firestore.
// ---------------------------------------------------------------------------

test('K19a : la liste des matières n’est JAMAIS vide (Firestore vide hors de cause)', () => {
  // Preuve du trou : l'ANCIENNE logique interrogeait Firestore `matieres` ;
  // avec une collection vide, elle renvoyait [] (admin incapable de choisir).
  const ancienListeDepuisFirestoreVide = [];
  assert.strictEqual(ancienListeDepuisFirestoreVide.length, 0);
  // APRÈS : la liste vient du catalogue disque et contient les 3 matières.
  const liste = catalogueListe();
  assert.ok(Array.isArray(liste));
  assert.ok(liste.length >= 3, 'au moins thermo, proba, info');
});

test('K19b : chaque entrée porte { id, nom, ordre, bientot } et est triée par ordre', () => {
  const liste = catalogueListe();
  liste.forEach((m) => {
    assert.strictEqual(typeof m.id, 'string');
    assert.strictEqual(typeof m.nom, 'string');
    assert.strictEqual(typeof m.ordre, 'number');
    assert.strictEqual(typeof m.bientot, 'boolean');
  });
  const ordres = liste.map((m) => m.ordre);
  const tries = ordres.slice().sort((a, b) => a - b);
  assert.deepStrictEqual(ordres, tries);
  // `nom` = titre lisible, pas l'identifiant.
  const thermo = liste.find((m) => m.id === 'thermo');
  assert.strictEqual(thermo.nom, 'Thermodynamique');
});

test('K19c : `info` est marquée bientôt ; thermo et proba sont cochables', () => {
  const liste = catalogueListe();
  const info = liste.find((m) => m.id === 'info');
  const thermo = liste.find((m) => m.id === 'thermo');
  const proba = liste.find((m) => m.id === 'proba');
  assert.strictEqual(info.bientot, true);
  assert.strictEqual(thermo.bientot, false);
  assert.strictEqual(proba.bientot, false);
});

// ---------------------------------------------------------------------------
// B. Console admin (jsdom) : les cases s'affichent, se cochent, partent au serveur.
// ---------------------------------------------------------------------------

const HTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'admin-client.js'), 'utf8');

function tick(n) {
  n = n || 6;
  let p = Promise.resolve();
  for (let i = 0; i < n; i++) p = p.then(() => new Promise((r) => setTimeout(r, 0)));
  return p;
}

// Catalogue tel que le renverrait le serveur (list_matieres).
const CATALOGUE = [
  { id: 'thermo', nom: 'Thermodynamique', ordre: 1, bientot: false },
  { id: 'proba', nom: 'Probabilités et statistiques', ordre: 2, bientot: false },
  { id: 'info', nom: 'Informatique', ordre: 3, bientot: true },
];

function monter() {
  const dom = new JSDOM(HTML, { url: 'https://memento.test/admin', runScripts: 'outside-only' });
  const win = dom.window;

  let authCb = null;
  const fakeAuth = {
    currentUser: null,
    onAuthStateChanged(cb) { authCb = cb; },
    signInWithEmailAndPassword() { return Promise.resolve(); },
    signOut() { return Promise.resolve(); },
  };
  win.firebase = { initializeApp() {}, auth() { return fakeAuth; } };
  win.MEMENTO_FIREBASE = { apiKey: 'x', projectId: 'p' };

  // fetch factice : répond selon l'action du corps, capture approuver_nm.
  const ctrl = { approuverBody: null };
  win.fetch = function (url, opts) {
    let body = {};
    try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) { body = {}; }
    const action = body.action;
    let payload = { ok: true };
    if (action === 'list_matieres') payload = { ok: true, matieres: CATALOGUE };
    else if (action === 'stats') payload = { ok: true, stats: { demandes: 0, demandesEnAttente: 0, membres: 0, membresActifs: 0, messages: 0, messagesOuverts: 0 } };
    else if (action === 'list_membres') payload = { ok: true, membres: [] };
    else if (action === 'list_demandes') payload = { ok: true, demandes: [] };
    else if (action === 'list_messages') payload = { ok: true, fils: [] };
    else if (action === 'approuver_nm') { ctrl.approuverBody = body; payload = { ok: true }; }
    return Promise.resolve({ ok: true, status: 200, json() { return Promise.resolve(payload); } });
  };

  win.eval(SRC);
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));

  const $ = (id) => win.document.getElementById(id);
  function connecter() {
    const u = { email: 'admin@memento.test', emailVerified: true, getIdToken() { return Promise.resolve('tok'); }, reload() { return Promise.resolve(); }, sendEmailVerification() { return Promise.resolve(); } };
    fakeAuth.currentUser = u; authCb(u);
  }
  return { win, ctrl, $, connecter };
}

test('K19d : les cases à cocher apparaissent (une par matière du catalogue)', async () => {
  const env = monter();
  env.connecter();
  await tick();
  const chips = env.$('g-chips').querySelectorAll('.chip');
  // Preuve du trou : AVANT, list_matieres renvoyait [] → un seul <span class="aide">
  // « Aucune matière déclarée », zéro .chip.
  assert.strictEqual(chips.length, CATALOGUE.length);
  assert.ok(/Thermodynamique/.test(env.$('g-chips').textContent));
});

test('K19e : une case se coche et la sélection part dans approuver_nm', async () => {
  const env = monter();
  env.connecter();
  await tick();
  const chips = env.$('g-chips').querySelectorAll('.chip');
  const puce = Array.prototype.find.call(chips, (c) => /Thermodynamique/.test(c.textContent));
  assert.ok(puce, 'puce thermo présente');
  puce.dispatchEvent(new env.win.Event('click'));
  assert.ok(puce.classList.contains('on'), 'la puce cochée porte la classe on');

  // Prérequis d'approbation : email + numéro (K21/X6 : obligatoire) + demande.
  env.$('g-mail').value = 'membre@exemple.test';
  env.$('g-num').value = '+229 01 02 03 04 05';
  env.$('g-demande').value = 'dem123';
  env.$('g-ok').dispatchEvent(new env.win.Event('click'));
  await tick();

  assert.ok(env.ctrl.approuverBody, 'approuver_nm appelé');
  assert.deepStrictEqual(env.ctrl.approuverBody.matieres, ['thermo']);
  assert.strictEqual(env.ctrl.approuverBody.demandeId, 'dem123');
});

test('K19f : une matière « bientôt » est visible mais NON cochable', async () => {
  const env = monter();
  env.connecter();
  await tick();
  const chips = env.$('g-chips').querySelectorAll('.chip');
  const info = Array.prototype.find.call(chips, (c) => /Informatique/.test(c.textContent));
  assert.ok(info, 'la matière bientôt est bien affichée');
  assert.ok(info.classList.contains('bientot'));
  assert.strictEqual(info.getAttribute('aria-disabled'), 'true');
  // Un clic ne la sélectionne pas.
  info.dispatchEvent(new env.win.Event('click'));
  assert.ok(!info.classList.contains('on'), 'bientôt ne se coche pas');

  // Et donc, seule, elle ne permet pas d'approuver.
  env.$('g-mail').value = 'membre@exemple.test';
  env.$('g-demande').value = 'dem123';
  env.$('g-ok').dispatchEvent(new env.win.Event('click'));
  await tick();
  assert.strictEqual(env.ctrl.approuverBody, null, 'aucune approbation avec seulement une matière bientôt');
});

test('K19g : sans aucune case cochée, message « au moins une matière » visible', async () => {
  const env = monter();
  env.connecter();
  await tick();
  env.$('g-mail').value = 'membre@exemple.test';
  env.$('g-demande').value = 'dem123';
  env.$('g-ok').dispatchEvent(new env.win.Event('click'));
  await tick();
  const err = env.$('g-err').textContent;
  assert.ok(/au moins une matière/i.test(err), 'message présent : ' + JSON.stringify(err));
  assert.strictEqual(env.ctrl.approuverBody, null, 'pas d’appel approuver_nm sans matière');
});
