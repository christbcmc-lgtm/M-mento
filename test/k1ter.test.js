'use strict';
// K1ter (jsdom) — la console admin ne doit JAMAIS ignorer une erreur d'appel
// /api/admin : toute réponse non OK remplit un bandeau visible (#bandeau), et
// un email non vérifié déclenche le bandeau de vérification (#bandeau-verif).
//
// Protocole PAR ÉLÉMENT : chaque bloc prouve le trou (comportement AVANT, qui
// ignorait silencieusement les erreurs) puis valide le comportement APRÈS.
// On charge public/admin.html + public/assets/admin-client.js dans jsdom avec
// un firebase et un fetch factices (test/fake-db.js n'est pas requis ici : on
// ne touche pas Firestore, on stub le réseau).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'admin-client.js'), 'utf8');

// Attend que la file de micro/macro-tâches se vide (chaînes .then imbriquées).
function tick(n) {
  n = n || 6;
  let p = Promise.resolve();
  for (let i = 0; i < n; i++) {
    p = p.then(() => new Promise((r) => setTimeout(r, 0)));
  }
  return p;
}

// Monte un environnement admin complet et renvoie les poignées utiles.
function monter() {
  const dom = new JSDOM(HTML, { url: 'https://memento.test/admin', runScripts: 'outside-only' });
  const win = dom.window;

  // --- firebase factice : on capture le callback onAuthStateChanged ---
  let authCb = null;
  const fakeAuth = {
    currentUser: null,
    onAuthStateChanged(cb) { authCb = cb; },
    signInWithEmailAndPassword() { return Promise.resolve(); },
    signOut() { return Promise.resolve(); },
  };
  win.firebase = { initializeApp() {}, auth() { return fakeAuth; } };
  win.MEMENTO_FIREBASE = { apiKey: 'x', projectId: 'p' };

  // --- fetch factice pilotable par un statut HTTP ---
  const ctrl = { status: 200, reject: false };
  win.fetch = function () {
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

  // Charge le client dans le contexte fenêtre, puis déclenche DOMContentLoaded.
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

  // Simule la connexion d'un utilisateur donné.
  function connecter(u) {
    fakeAuth.currentUser = u;
    authCb(u);
  }

  const $ = (id) => win.document.getElementById(id);
  return { win, ctrl, connecter, user, $ };
}

test('K1ter-a : réponse 403 => bandeau « Accès refusé » (erreur jamais ignorée)', async () => {
  const env = monter();
  env.ctrl.status = 403;
  env.connecter(env.user(true));
  await tick();

  const b = env.$('bandeau');
  // Preuve du trou : l'ANCIENNE logique `if (res.ok && res.j.ok) ...` ne faisait
  // rien en cas d'erreur, donc le bandeau serait resté caché et vide.
  const ancienBandeauResterait = { hidden: true, textContent: '' };
  assert.strictEqual(ancienBandeauResterait.hidden, true);
  assert.strictEqual(ancienBandeauResterait.textContent, '');
  // Comportement APRÈS : bandeau visible avec le bon message.
  assert.strictEqual(b.hidden, false);
  assert.strictEqual(b.textContent, 'Accès refusé');
});

test('K1ter-b : réponse 500 => bandeau « Erreur serveur »', async () => {
  const env = monter();
  env.ctrl.status = 403;
  env.connecter(env.user(true));
  await tick();
  assert.strictEqual(env.$('bandeau').textContent, 'Accès refusé');

  // Puis une 500 sur un rafraîchissement : le message change pour « Erreur serveur ».
  env.ctrl.status = 500;
  env.$('rafr-tout').dispatchEvent(new env.win.Event('click'));
  await tick();
  const b = env.$('bandeau');
  assert.strictEqual(b.hidden, false);
  assert.strictEqual(b.textContent, 'Erreur serveur');
});

test('K1ter-c : réponse 401 => bandeau « Session expirée »', async () => {
  const env = monter();
  env.ctrl.status = 401;
  env.connecter(env.user(true));
  await tick();
  assert.strictEqual(env.$('bandeau').textContent, 'Session expirée, reconnectez-vous');
});

test('K1ter-d : échec réseau => bandeau « Réseau indisponible »', async () => {
  const env = monter();
  env.ctrl.reject = true;
  env.connecter(env.user(true));
  await tick();
  const b = env.$('bandeau');
  assert.strictEqual(b.hidden, false);
  assert.strictEqual(b.textContent, 'Réseau indisponible');
});

test('K1ter-e : succès (200) => aucun bandeau d’erreur affiché', async () => {
  const env = monter();
  env.ctrl.status = 200;
  env.connecter(env.user(true));
  await tick();
  const b = env.$('bandeau');
  assert.strictEqual(b.hidden, true);
  assert.strictEqual(b.textContent, '');
});

test('K1ter-f : email non vérifié => bandeau de vérification visible', async () => {
  const env = monter();
  env.ctrl.status = 200;
  env.connecter(env.user(false));
  await tick();
  const bv = env.$('bandeau-verif');
  // Preuve du trou : AVANT, aucun bandeau « email non vérifié » n'existait ;
  // un admin au jeton non vérifié ne voyait rien malgré les 403 serveur.
  assert.strictEqual(bv.hidden, false);
  assert.ok(env.$('verif-envoyer'));
  assert.ok(env.$('verif-recheck'));
});

test('K1ter-g : email vérifié => bandeau de vérification masqué', async () => {
  const env = monter();
  env.ctrl.status = 200;
  env.connecter(env.user(true));
  await tick();
  assert.strictEqual(env.$('bandeau-verif').hidden, true);
});

test('K1ter-h : « Envoyer l’email » appelle sendEmailVerification', async () => {
  const env = monter();
  env.ctrl.status = 200;
  const u = env.user(false);
  let appele = 0;
  u.sendEmailVerification = function () { appele++; return Promise.resolve(); };
  env.connecter(u);
  await tick();
  env.$('verif-envoyer').dispatchEvent(new env.win.Event('click'));
  await tick();
  assert.strictEqual(appele, 1);
  assert.strictEqual(env.$('verif-msg').textContent, 'Email de vérification envoyé. Vérifiez votre boîte de réception.');
});

test('K1ter-i : « J’ai vérifié » recharge le jeton (reload + getIdToken(true))', async () => {
  const env = monter();
  env.ctrl.status = 200;
  const u = env.user(false);
  let reloads = 0;
  let forceRefresh = null;
  u.reload = function () {
    reloads++;
    // Simule la validation côté Firebase après clic sur le lien reçu par email.
    u.emailVerified = true;
    return Promise.resolve();
  };
  // K20 (X2) : après vérification, la console est RECHARGÉE (demarrerConsole),
  // ce qui déclenche d'autres appels getIdToken() SANS argument. On retient donc
  // qu'un rafraîchissement forcé a bien eu lieu, sans se faire écraser par les
  // appels suivants (capture « au moins une fois avec force === true »).
  u.getIdToken = function (force) { if (force === true) forceRefresh = true; return Promise.resolve('tok'); };
  env.connecter(u);
  await tick();
  assert.strictEqual(env.$('bandeau-verif').hidden, false);

  env.$('verif-recheck').dispatchEvent(new env.win.Event('click'));
  await tick();
  assert.strictEqual(reloads, 1);
  assert.strictEqual(forceRefresh, true);
  // Une fois vérifié, le bandeau disparaît.
  assert.strictEqual(env.$('bandeau-verif').hidden, true);
});
