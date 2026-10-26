'use strict';
// Correction F2 : la réinitialisation du code de déverrouillage devient PUBLIQUE.
//  - action publique  /api/public?a=code-reset  (email + numéro, sans session)
//  - le nouveau code n'est envoyé QU'À l'adresse ENREGISTRÉE du membre
//  - réponse TOUJOURS neutre (identique que l'email/numéro existe ou non)
//  - limite 3 / heure / IP
//  - l'ancienne version AUTHENTIFIÉE (auth?a=code-reset) est SUPPRIMÉE
// Ce test échoue AVANT la correction, passe APRÈS.
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';
process.env.SITE_URL = 'https://memento.test';
process.env.ADMIN_EMAIL = 'admin@memento.test';

const test = require('node:test');
const assert = require('node:assert');
const { makeDb } = require('./fake-db');

const em = require('../api/_lib/emails');
const secret = require('../api/_lib/secret');
const publicHandler = require('../api/public');
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
  const h = Object.assign({ 'x-requested-with': 'mh', 'user-agent': 'test', 'x-forwarded-for': '10.0.0.1' }, o.headers || {});
  if (o.cookie) h.cookie = o.cookie;
  return { method: o.method || 'GET', url: o.url || '/api/public', headers: h, body: o.body || {} };
}

async function membre(db, over) {
  const o = over || {};
  const email = o.email || 'lea@exemple.com';
  const now = Date.now();
  await db.collection('membres').doc('M1').set({
    prenom: 'Léa', nom: 'Dupont', email, numero: o.numero != null ? o.numero : '06 12 34 56 78',
    statut: o.statut || 'actif', codeHash: secret.hash('OLDCODE1'),
    matieres: ['thermo'], tokenVersion: 0, creeLe: now, majLe: now
  });
  await db.collection('emails').doc(em.hacheEmail(email)).set({ type: 'membre', ref: 'M1', creeLe: now });
}
async function codeHash(db) {
  return ((await db.collection('membres').doc('M1').get()).data() || {}).codeHash;
}

// ===== 1. public code-reset : email + numéro corrects -> nouveau code à l'adresse enregistrée =====
test('F2 public code-reset : email + numéro corrects -> code renouvelé + email à l\'adresse enregistrée', async () => {
  const db = makeDb();
  await membre(db);
  const avant = await codeHash(db);
  const mailer = makeMailer();
  publicHandler.__setDbFactory(() => db);
  publicHandler.__setMailer(mailer);
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=code-reset',
    body: { email: 'Lea@Exemple.com', numero: '0612345678' } }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.ok, true);
  // code effectivement renouvelé
  assert.notStrictEqual(await codeHash(db), avant);
  // email envoyé à l'adresse ENREGISTRÉE, une seule fois
  assert.strictEqual(mailer.envoyes.length, 1);
  assert.strictEqual(mailer.envoyes[0].to, 'lea@exemple.com');
});

// ===== 2. numéro incorrect -> réponse neutre, AUCUN email, code inchangé =====
test('F2 public code-reset : numéro incorrect -> neutre, aucun email, code inchangé', async () => {
  const db = makeDb();
  await membre(db);
  const avant = await codeHash(db);
  const mailer = makeMailer();
  publicHandler.__setDbFactory(() => db);
  publicHandler.__setMailer(mailer);
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=code-reset',
    body: { email: 'lea@exemple.com', numero: '0000000000' } }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.ok, true);
  assert.strictEqual(await codeHash(db), avant);
  assert.strictEqual(mailer.envoyes.length, 0);
});

// ===== 3. email inconnu -> même réponse neutre, aucun email =====
test('F2 public code-reset : email inconnu -> même réponse neutre, aucun email', async () => {
  const db = makeDb();
  await membre(db);
  const mailer = makeMailer();
  publicHandler.__setDbFactory(() => db);
  publicHandler.__setMailer(mailer);
  const r1 = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=code-reset',
    body: { email: 'inconnu@exemple.com', numero: '0612345678' } }), r1);
  const r2 = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=code-reset',
    body: { email: 'lea@exemple.com', numero: '0000000000' } }), r2);
  // réponse strictement identique (aucune fuite d'existence)
  assert.deepStrictEqual(r1.body, r2.body);
  assert.strictEqual(mailer.envoyes.length, 0);
});

// ===== 4. limite 3 / heure / IP -> la 4e tentative renvoie 429 =====
test('F2 public code-reset : 4e tentative sur la même IP -> 429', async () => {
  const db = makeDb();
  await membre(db);
  const mailer = makeMailer();
  publicHandler.__setDbFactory(() => db);
  publicHandler.__setMailer(mailer);
  for (let i = 0; i < 3; i++) {
    const res = makeRes();
    await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=code-reset',
      body: { email: 'x@y.com', numero: '1' } }), res);
    assert.strictEqual(res.statusCode, 200);
  }
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=code-reset',
    body: { email: 'x@y.com', numero: '1' } }), res);
  assert.strictEqual(res.statusCode, 429);
});

// ===== 5. mutation sans en-tête X-Requested-With -> refus =====
test('F2 public code-reset : sans en-tête X-Requested-With -> refus', async () => {
  const db = makeDb();
  await membre(db);
  publicHandler.__setDbFactory(() => db);
  publicHandler.__setMailer(makeMailer());
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=code-reset',
    headers: { 'x-requested-with': '' }, body: { email: 'lea@exemple.com', numero: '0612345678' } }), res);
  assert.notStrictEqual(res.statusCode, 200);
});

// ===== 6. l'ancienne version AUTHENTIFIÉE de code-reset est supprimée =====
test('F2 auth : l\'action authentifiée code-reset n\'existe plus (404 action inconnue)', async () => {
  const db = makeDb();
  await membre(db);
  authHandler.__setDbFactory(() => db);
  const res = makeRes();
  await authHandler(makeReq({ method: 'POST', url: '/api/auth?a=code-reset',
    body: { email: 'lea@exemple.com' } }), res);
  assert.strictEqual(res.statusCode, 404);
  assert.match(res.body.erreur || '', /inconnue/i);
});
