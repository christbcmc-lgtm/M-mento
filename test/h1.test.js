'use strict';
// H1 — Révocation des liens personnels. Objectif : un lien personnel (?t=) est
// lié à la `tokenVersion` du membre. Quand l'admin régénère le lien, la version
// est incrémentée : tous les anciens liens ET cookies deviennent invalides.
// Chaque bloc : un test qui ÉCHOUE AVANT la correction, PASSE APRÈS.
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';
process.env.SITE_URL = 'https://memento.test';
process.env.ADMIN_EMAIL = 'admin@memento.test';

const test = require('node:test');
const assert = require('node:assert');
const { makeDb } = require('./fake-db');

const token = require('../api/_lib/token');
const sess = require('../api/_lib/session');
const insc = require('../api/_lib/inscription');
const authHandler = require('../api/auth');

function makeMailer() {
  const envoyes = [];
  const fn = async (to, subject, html) => { envoyes.push({ to, subject, html }); };
  fn.envoyes = envoyes;
  return fn;
}
function makeRes() {
  return {
    statusCode: 0, headers: {}, bodyRaw: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(s) { this.bodyRaw = s || ''; },
    get body() { try { return JSON.parse(this.bodyRaw); } catch (e) { return {}; } }
  };
}
function makeReq(opts) {
  const o = opts || {};
  const h = Object.assign({ 'x-requested-with': 'mh', 'user-agent': 'test' }, o.headers || {});
  return { method: o.method || 'GET', url: o.url || '/api/auth', headers: h, body: o.body || {} };
}
// Rejoue une poignée de main ?t= -> cookie via api/auth (a=session).
async function session(db, tok, cookie) {
  authHandler.__setDbFactory(() => db);
  const headers = {};
  if (cookie) headers.cookie = cookie;
  const req = makeReq({ method: 'GET', url: '/api/auth?a=session&t=' + encodeURIComponent(tok), headers });
  const res = makeRes();
  await authHandler(req, res);
  return res;
}
async function membreActif(db, id, extra) {
  await db.collection('membres').doc(id).set(Object.assign({
    prenom: 'Léa', nom: 'Test', email: 'lea@exemple.com', statut: 'actif',
    matieres: ['thermo'], dureeJours: 180, maxAppareils: 1, tokenVersion: 0,
    expireLe: Date.now() + 90 * 86400000, creeLe: Date.now(), majLe: Date.now()
  }, extra || {}));
}

// ===================== H1a : le jeton personnel embarque la version =====================
test('H1a : token.signPersonnel embarque la tokenVersion (v)', () => {
  const p = token.verify(token.signPersonnel('M1', 180, 3));
  assert.strictEqual(p.t, 'perso');
  assert.strictEqual(p.m, 'M1');
  assert.strictEqual(p.v, 3, 'le jeton personnel doit porter v=tokenVersion');
  // Rétro-compat : sans version -> v=0.
  assert.strictEqual(token.verify(token.signPersonnel('M1', 180)).v, 0);
});

// ===================== H1b : session rejette un lien de version périmée =====================
test('H1b : un lien dont v != tokenVersion du membre est refusé (401)', async () => {
  const db = makeDb();
  await membreActif(db, 'M1', { tokenVersion: 2 });
  const lienPerime = token.signPersonnel('M1', 180, 0); // ancienne version
  const res = await session(db, lienPerime);
  assert.strictEqual(res.statusCode, 401, 'un lien de version périmée doit être refusé');
  assert.strictEqual(res.body.ok, false);
  assert.ok(!res.headers['set-cookie'], 'aucun cookie ne doit être posé pour un lien périmé');
});

// ===================== H1c : session accepte un lien de bonne version =====================
test('H1c : un lien dont v == tokenVersion est accepté et pose un cookie à la bonne version', async () => {
  const db = makeDb();
  await membreActif(db, 'M1', { tokenVersion: 2 });
  const lien = token.signPersonnel('M1', 180, 2);
  const res = await session(db, lien);
  assert.strictEqual(res.statusCode, 200);
  const cookie = res.headers['set-cookie'];
  assert.ok(cookie && /mh_s=/.test(cookie), 'un cookie de session doit être posé');
  const payload = sess.verifierSession(cookie.match(/mh_s=([^;]+)/)[1]);
  assert.strictEqual(payload.v, 2, 'le cookie doit porter la tokenVersion courante');
});

// ===================== H1d : regenererLien incrémente, email AVANT écriture, révoque =====================
test('H1d : regenererLien incrémente tokenVersion, envoie le NOUVEAU lien, et révoque l\'ancien', async () => {
  const db = makeDb();
  await membreActif(db, 'M1', { tokenVersion: 0 });
  const ancienLien = token.signPersonnel('M1', 180, 0);
  // L'ancien lien marche avant régénération (et ouvre un appareil).
  const avant = await session(db, ancienLien);
  assert.strictEqual(avant.statusCode, 200);
  const cookie = avant.headers['set-cookie']; // même navigateur -> appareil réutilisé

  const mailer = makeMailer();
  const r = await insc.regenererLien(db, { membreId: 'M1' }, mailer, 'https://memento.test');
  assert.strictEqual(r.ok, true);

  // tokenVersion incrémentée en base.
  const m = (await db.collection('membres').doc('M1').get()).data();
  assert.strictEqual(m.tokenVersion, 1, 'tokenVersion doit passer de 0 à 1');

  // Un email contenant le NOUVEAU lien part vers l'adresse du membre.
  assert.strictEqual(mailer.envoyes.length, 1);
  assert.strictEqual(mailer.envoyes[0].to, 'lea@exemple.com');
  const t = (mailer.envoyes[0].html.match(/[?&]t=([A-Za-z0-9._-]+)/) || [])[1];
  assert.ok(t, 'l\'email doit contenir le nouveau lien ?t=');
  assert.strictEqual(token.verify(t).v, 1, 'le nouveau lien doit porter v=1');

  // L'ancien lien est désormais refusé ; le nouveau est accepté (appareil réutilisé).
  assert.strictEqual((await session(db, ancienLien, cookie)).statusCode, 401, 'l\'ancien lien doit être révoqué');
  assert.strictEqual((await session(db, t, cookie)).statusCode, 200, 'le nouveau lien doit fonctionner');
});

// ===================== H1e : si l'email échoue, RIEN n'est écrit (502) =====================
test('H1e : échec d\'envoi -> tokenVersion inchangée, ancien lien toujours valide, 502', async () => {
  const db = makeDb();
  await membreActif(db, 'M1', { tokenVersion: 0 });
  const ancienLien = token.signPersonnel('M1', 180, 0);
  const mailer = async () => { throw new Error('smtp down'); };

  let status = 0;
  try { await insc.regenererLien(db, { membreId: 'M1' }, mailer, 'https://memento.test'); }
  catch (e) { status = e.status; }
  assert.strictEqual(status, 502, 'un échec d\'envoi doit lever une erreur 502');

  const m = (await db.collection('membres').doc('M1').get()).data();
  assert.strictEqual(m.tokenVersion, 0, 'aucune écriture : tokenVersion reste à 0');
  assert.strictEqual((await session(db, ancienLien)).statusCode, 200, 'l\'ancien lien doit rester valide');
});

// ===================== H1f : membre introuvable -> 404 =====================
test('H1f : regenererLien sur un membre inconnu -> 410/404, aucun email', async () => {
  const db = makeDb();
  const mailer = makeMailer();
  let status = 0;
  try { await insc.regenererLien(db, { membreId: 'ZZZ' }, mailer, 'https://memento.test'); }
  catch (e) { status = e.status; }
  assert.ok(status === 404 || status === 410, 'membre inconnu -> 404/410');
  assert.strictEqual(mailer.envoyes.length, 0);
});
