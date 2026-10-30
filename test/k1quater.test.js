'use strict';
// K1quater (jsdom) — affinages du bandeau d'erreur de la console admin :
//  (1) le bandeau d'erreur se masque dès qu'une série de chargements réussit et
//      au début de chaque « Rafraîchir » ;
//  (2) après « J'ai vérifié mon email » réussi, la console est rechargée
//      (cacherBandeau + demarrerConsole) → stats/demandes/messages/membres/
//      matières re-sollicités.
// Protocole PAR ÉLÉMENT : chaque bloc prouve le trou (comportement AVANT) puis
// valide le comportement APRÈS. Ne doit pas casser les 9 cas de k1ter.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'admin-client.js'), 'utf8');

function tick(n) {
  n = n || 8;
  let p = Promise.resolve();
  for (let i = 0; i < n; i++) p = p.then(() => new Promise((r) => setTimeout(r, 0)));
  return p;
}

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

  const ctrl = { status: 200, reject: false, appels: 0 };
  win.fetch = function () {
    ctrl.appels++;
    if (ctrl.reject) return Promise.reject(new Error('net'));
    const status = ctrl.status;
    const ok = status < 400;
    const body = ok
      ? {
          ok: true,
          stats: { demandes: 0, demandesEnAttente: 0, membres: 0, membresActifs: 0, messages: 0, messagesOuverts: 0 },
          matieres: [], membres: [], demandes: [], fils: [],
        }
      : { ok: false, erreur: 'refus' };
    return Promise.resolve({ ok, status, json() { return Promise.resolve(body); } });
  };

  win.eval(SRC);
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));

  function user(emailVerified) {
    return {
      email: 'admin@memento.test',
      emailVerified: emailVerified,
      getIdToken() { return Promise.resolve('tok'); },
      reload() { return Promise.resolve(); },
      sendEmailVerification() { return Promise.resolve(); },
    };
  }
  function connecter(u) { fakeAuth.currentUser = u; authCb(u); }
  const $ = (id) => win.document.getElementById(id);
  return { win, ctrl, connecter, user, $, auth: fakeAuth };
}

test('K1quater-a : bandeau d’erreur affiché puis masqué après un « Tout rafraîchir » réussi', async () => {
  const env = monter();
  env.ctrl.status = 403;
  env.connecter(env.user(true));
  await tick();
  // État initial : une erreur 403 a bien levé le bandeau.
  assert.strictEqual(env.$('bandeau').hidden, false);
  assert.strictEqual(env.$('bandeau').textContent, 'Accès refusé');

  // Un rafraîchissement global réussi doit le masquer.
  env.ctrl.status = 200;
  env.$('rafr-tout').dispatchEvent(new env.win.Event('click'));
  await tick();
  // Preuve du trou : AVANT, rafr-tout ne touchait jamais le bandeau, il serait
  // resté visible avec « Accès refusé ».
  assert.strictEqual(env.$('bandeau').hidden, true);
  assert.strictEqual(env.$('bandeau').textContent, '');
});

test('K1quater-b : « Rafraîchir » d’une section masque le bandeau au début', async () => {
  const env = monter();
  env.ctrl.status = 500;
  env.connecter(env.user(true));
  await tick();
  assert.strictEqual(env.$('bandeau').hidden, false);

  // Rafraîchir « Demandes » avec succès : le bandeau est masqué dès le début.
  env.ctrl.status = 200;
  env.$('rafr-dem').dispatchEvent(new env.win.Event('click'));
  await tick();
  assert.strictEqual(env.$('bandeau').hidden, true);
});

test('K1quater-c : console rechargée après « J’ai vérifié » (cacherBandeau + demarrerConsole)', async () => {
  const env = monter();
  // Admin non vérifié : la garde serveur renvoie 403 → bandeau d'erreur + bandeau verif.
  env.ctrl.status = 403;
  const u = env.user(false);
  u.reload = function () { u.emailVerified = true; return Promise.resolve(); };
  env.connecter(u);
  await tick();
  assert.strictEqual(env.$('bandeau-verif').hidden, false);
  assert.strictEqual(env.$('bandeau').hidden, false);
  const appelsAvant = env.ctrl.appels;

  // Après vérification, les appels repassent (jeton vérifié) → 200.
  env.ctrl.status = 200;
  env.$('verif-recheck').dispatchEvent(new env.win.Event('click'));
  await tick();
  // Preuve du trou : AVANT, le clic ne rechargeait pas la console ; aucun nouvel
  // appel /api/admin n'était émis et le bandeau d'erreur restait affiché.
  assert.ok(env.ctrl.appels > appelsAvant, 'de nouveaux chargements doivent être déclenchés');
  assert.strictEqual(env.$('bandeau-verif').hidden, true);
  assert.strictEqual(env.$('bandeau').hidden, true);
});

test('K1quater-d : chargement initial réussi → pas de bandeau résiduel', async () => {
  const env = monter();
  env.ctrl.status = 200;
  env.connecter(env.user(true));
  await tick();
  assert.strictEqual(env.$('bandeau').hidden, true);
  assert.strictEqual(env.$('bandeau').textContent, '');
});
