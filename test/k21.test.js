'use strict';
// K21 (X6, X7) — Console admin : honnêteté du formulaire d'activation + essai.
//
// X6 — Formulaire « accorder un accès » :
//   a) le numéro devient OBLIGATOIRE (preuve d'identité, décision D7) ; sans
//      numéro valide, aucun appel approuver_nm ne part ;
//   b) il n'existe PLUS de case « générer un code par matière » (un seul code
//      par membre, D6) — l'élément #g-code a disparu du DOM ;
//   c) le libellé du quota est honnête : « non appliqué pour l'instant ».
//
// X7 — Essai gratuit : le bouton déclenche bien l'action serveur accorder_essai
//   (et plus l'ancienne inviter_essai, côté serveur = 410).
//
// Protocole PAR ÉLÉMENT : on prouve d'abord le comportement attendu APRÈS
// correction en exécutant réellement le code UI dans jsdom.

process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'admin-client.js'), 'utf8');

function tick(n) {
  n = n || 6;
  let p = Promise.resolve();
  for (let i = 0; i < n; i++) p = p.then(() => new Promise((r) => setTimeout(r, 0)));
  return p;
}

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

  // fetch factice : capture la DERNIÈRE action et son corps.
  const ctrl = { approuverBody: null, lastAction: null, lastBody: null };
  win.fetch = function (url, opts) {
    let body = {};
    try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) { body = {}; }
    const action = body.action;
    ctrl.lastAction = action; ctrl.lastBody = body;
    let payload = { ok: true };
    if (action === 'list_matieres') payload = { ok: true, matieres: CATALOGUE };
    else if (action === 'stats') payload = { ok: true, stats: { demandes: 0, demandesEnAttente: 0, membres: 0, membresActifs: 0, messages: 0, messagesOuverts: 0 } };
    else if (action === 'list_membres') payload = { ok: true, membres: [] };
    else if (action === 'list_demandes') payload = { ok: true, demandes: [] };
    else if (action === 'list_messages') payload = { ok: true, fils: [] };
    else if (action === 'approuver_nm') { ctrl.approuverBody = body; payload = { ok: true }; }
    else if (action === 'accorder_essai') payload = { ok: true, lien: 'https://memento.test/essai/abc' };
    return Promise.resolve({ ok: true, status: 200, json() { return Promise.resolve(payload); } });
  };

  win.eval(SRC);
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));

  const $ = (id) => win.document.getElementById(id);
  function connecter() {
    const u = { email: 'admin@memento.test', emailVerified: true, getIdToken() { return Promise.resolve('tok'); }, reload() { return Promise.resolve(); }, sendEmailVerification() { return Promise.resolve(); } };
    fakeAuth.currentUser = u; authCb(u);
  }
  // Coche la première matière cochable (thermo).
  function cocherThermo() {
    const chips = $('g-chips').querySelectorAll('.chip');
    const puce = Array.prototype.find.call(chips, (c) => /Thermodynamique/.test(c.textContent));
    puce.dispatchEvent(new win.Event('click'));
    return puce;
  }
  return { win, ctrl, $, connecter, cocherThermo };
}

// ---------------------------------------------------------------------------
// X6 — Statique (DOM déclaré) : numéro requis, pas de g-code, quota honnête.
// ---------------------------------------------------------------------------

test('K21a : le champ numéro porte l’attribut required (obligatoire)', () => {
  const env = monter();
  const num = env.$('g-num');
  assert.ok(num, 'le champ #g-num existe');
  // AVANT : numéro « facultatif », sans required. APRÈS : obligatoire.
  assert.ok(num.hasAttribute('required'), '#g-num doit être required');
  assert.ok(/obligatoire/i.test(env.$('g-form') ? env.$('g-form').textContent : env.win.document.body.textContent),
    'le mot « obligatoire » figure près du champ numéro');
});

test('K21b : la case « générer un code par matière » (#g-code) a disparu', () => {
  const env = monter();
  // AVANT : un <input type=checkbox id=g-code checked>. APRÈS : supprimée
  // (un seul code par membre, D6).
  assert.strictEqual(env.$('g-code'), null, '#g-code ne doit plus exister');
  assert.ok(/un seul code/i.test(env.win.document.body.textContent),
    'une note « un seul code » explique la décision');
});

test('K21c : le libellé du quota est honnête (non appliqué pour l’instant)', () => {
  const env = monter();
  assert.ok(/non appliqué pour l’instant|non appliqué pour l'instant/i.test(env.win.document.body.textContent),
    'le quota est annoncé comme non appliqué pour l’instant');
});

// ---------------------------------------------------------------------------
// X6 — Comportement (jsdom exécute accorder()) : numéro obligatoire.
// ---------------------------------------------------------------------------

test('K21d : SANS numéro, aucun appel approuver_nm et message « Numéro obligatoire »', async () => {
  const env = monter();
  env.connecter();
  await tick();
  env.cocherThermo();
  env.$('g-mail').value = 'membre@exemple.test';
  env.$('g-demande').value = 'dem123';
  env.$('g-num').value = '';            // numéro manquant
  env.$('g-ok').dispatchEvent(new env.win.Event('click'));
  await tick();
  assert.strictEqual(env.ctrl.approuverBody, null, 'pas d’approbation sans numéro');
  assert.ok(/numéro obligatoire/i.test(env.$('g-err').textContent),
    'message présent : ' + JSON.stringify(env.$('g-err').textContent));
});

test('K21e : numéro trop court (< 8 chiffres) → toujours refusé', async () => {
  const env = monter();
  env.connecter();
  await tick();
  env.cocherThermo();
  env.$('g-mail').value = 'membre@exemple.test';
  env.$('g-demande').value = 'dem123';
  env.$('g-num').value = '01 23';       // seulement 4 chiffres
  env.$('g-ok').dispatchEvent(new env.win.Event('click'));
  await tick();
  assert.strictEqual(env.ctrl.approuverBody, null, 'numéro trop court refusé');
});

test('K21f : avec un numéro valide, approuver_nm part et transporte le numéro', async () => {
  const env = monter();
  env.connecter();
  await tick();
  env.cocherThermo();
  env.$('g-mail').value = 'membre@exemple.test';
  env.$('g-demande').value = 'dem123';
  env.$('g-num').value = '+229 01 02 03 04 05';
  env.$('g-ok').dispatchEvent(new env.win.Event('click'));
  await tick();
  assert.ok(env.ctrl.approuverBody, 'approuver_nm appelé');
  assert.deepStrictEqual(env.ctrl.approuverBody.matieres, ['thermo']);
  assert.strictEqual(env.ctrl.approuverBody.demandeId, 'dem123');
  assert.strictEqual(env.ctrl.approuverBody.numero, '+229 01 02 03 04 05',
    'le numéro saisi est transmis au serveur');
});

// ---------------------------------------------------------------------------
// X7 — Essai gratuit : le bouton appelle accorder_essai (et pas inviter_essai).
// ---------------------------------------------------------------------------

test('K21g : le bouton d’essai déclenche l’action serveur accorder_essai', async () => {
  const env = monter();
  env.connecter();
  await tick();
  env.$('e-mail').value = 'prospect@exemple.test';
  env.$('e-ok').dispatchEvent(new env.win.Event('click'));
  await tick();
  assert.strictEqual(env.ctrl.lastAction, 'accorder_essai',
    'action attendue accorder_essai, reçu : ' + env.ctrl.lastAction);
  assert.notStrictEqual(env.ctrl.lastAction, 'inviter_essai',
    'l’ancienne action inviter_essai ne doit plus être utilisée');
  assert.strictEqual(env.ctrl.lastBody.email, 'prospect@exemple.test');
});

test('K21h : le libellé du bouton d’essai dit « accorder » (pas « inviter »)', () => {
  const env = monter();
  const txt = env.$('e-ok').textContent.toLowerCase();
  assert.ok(/accorder/.test(txt), 'bouton : ' + JSON.stringify(env.$('e-ok').textContent));
  assert.ok(!/invit/.test(txt), 'le bouton ne doit plus parler d’invitation');
});
