'use strict';
// K20 (X2, K1quater) — la console admin doit (1) EFFACER le bandeau d'erreur
// après un chargement réussi et au début de chaque « Rafraîchir », et (2) une
// fois l'email vérifié via « J'ai vérifié mon email », RECHARGER la console
// (les appels étaient refusés 403 tant que l'email n'était pas vérifié).
//
// jsdom qui EXÉCUTE le code. Protocole rouge-avant / vert-après par assertion.

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

  const ctrl = { status: 200, reject: false, calls: {} };
  win.fetch = function (url, opts) {
    let body = {};
    try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) {}
    ctrl.calls[body.action] = (ctrl.calls[body.action] || 0) + 1;
    if (ctrl.reject) return Promise.reject(new Error('net'));
    const status = ctrl.status;
    const ok = status < 400;
    const payload = ok
      ? { ok: true, stats: { demandes: 0, demandesEnAttente: 0, membres: 0, membresActifs: 0, messages: 0, messagesOuverts: 0 }, matieres: [], membres: [], demandes: [], fils: [] }
      : { ok: false, erreur: 'refus' };
    return Promise.resolve({ ok, status, json() { return Promise.resolve(payload); } });
  };

  win.eval(SRC);
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));

  function user(emailVerified) {
    return {
      email: 'admin@memento.test', emailVerified: emailVerified,
      getIdToken() { return Promise.resolve('tok'); },
      reload() { return Promise.resolve(); },
      sendEmailVerification() { return Promise.resolve(); },
    };
  }
  function connecter(u) { fakeAuth.currentUser = u; authCb(u); }
  const $ = (id) => win.document.getElementById(id);
  return { win, ctrl, connecter, user, $, fakeAuth };
}

test('K20a : un chargement réussi efface le bandeau d’erreur résiduel', async () => {
  const env = monter();
  env.ctrl.status = 403;
  env.connecter(env.user(true));
  await tick();
  assert.strictEqual(env.$('bandeau').textContent, 'Accès refusé');
  assert.strictEqual(env.$('bandeau').hidden, false);

  // Rafraîchissement réussi : le bandeau DOIT disparaître.
  // Preuve du trou : l'ANCIEN reponseOk ne faisait rien en cas de succès
  // (`if (...) return true;`), donc le bandeau serait resté visible.
  env.ctrl.status = 200;
  env.$('rafr-tout').dispatchEvent(new env.win.Event('click'));
  await tick();
  assert.strictEqual(env.$('bandeau').hidden, true);
  assert.strictEqual(env.$('bandeau').textContent, '');
});

test('K20b : le bandeau est effacé dès le DÉBUT d’un « Rafraîchir »', async () => {
  const env = monter();
  env.ctrl.status = 403;
  env.connecter(env.user(true));
  await tick();
  assert.strictEqual(env.$('bandeau').hidden, false);

  // Le clic appelle cacherBandeau() de façon SYNCHRONE avant l'appel réseau.
  env.$('rafr-dem').dispatchEvent(new env.win.Event('click'));
  // Immédiatement (avant que l'appel async revienne) : déjà caché.
  assert.strictEqual(env.$('bandeau').hidden, true);
  assert.strictEqual(env.$('bandeau').textContent, '');
});

test('K20c : après « J’ai vérifié mon email », la console est RECHARGÉE', async () => {
  const env = monter();
  env.ctrl.status = 200;
  const u = env.user(false);
  u.reload = function () { u.emailVerified = true; return Promise.resolve(); };
  env.connecter(u);
  await tick();
  // Premier démarrage (email non vérifié) : list_matieres appelé une fois.
  const avant = env.ctrl.calls['list_matieres'] || 0;
  assert.ok(avant >= 1);
  assert.strictEqual(env.$('bandeau-verif').hidden, false);

  env.$('verif-recheck').dispatchEvent(new env.win.Event('click'));
  await tick();
  // Preuve du trou : AVANT, le clic masquait seulement le bandeau de vérif
  // (afficherVerif) sans relancer demarrerConsole → list_matieres n'était PAS
  // rappelé. APRÈS : la console est rechargée (nouvel appel) et le bandeau caché.
  const apres = env.ctrl.calls['list_matieres'] || 0;
  assert.ok(apres > avant, 'demarrerConsole relancé (list_matieres rappelé) : ' + avant + ' -> ' + apres);
  assert.strictEqual(env.$('bandeau-verif').hidden, true);
  assert.strictEqual(env.$('bandeau').hidden, true);
});
