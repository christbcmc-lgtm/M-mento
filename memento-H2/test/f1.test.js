'use strict';
// Correction F1 : le contenu (cours) ET les évaluations ne doivent être servis
// QUE si l'appareil a déverrouillé le code (deverrouilleJusqua > maintenant).
// Sinon : 403 « Code requis ». Ce test échoue AVANT la correction, passe APRÈS.
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';
process.env.SITE_URL = '';

const test = require('node:test');
const assert = require('node:assert');
const { makeDb } = require('./fake-db');

const sess = require('../api/_lib/session');
const contenuHandler = require('../api/contenu');
const evalHandler = require('../api/evaluation');

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
  const h = Object.assign({ 'user-agent': 'test' }, o.headers || {});
  if (o.cookie) h.cookie = o.cookie;
  return { method: o.method || 'GET', url: o.url, headers: h, body: o.body || undefined };
}

async function base(deverrouille) {
  const db = makeDb();
  const exp = Date.now() + 1e8;
  await db.collection('membres').doc('M1').set({
    prenom: 'Léa', statut: 'actif', tokenVersion: 0, expireLe: exp,
    maxAppareils: 1, matieres: ['thermo']
  });
  // Appareil enregistré ; déverrouillé ou non selon le paramètre.
  await db.collection('membres').doc('M1').collection('appareils').doc('d1').set({
    creeLe: Date.now(), dernierLe: Date.now(), ua: 'test',
    deverrouilleJusqua: deverrouille ? (Date.now() + 1e7) : 0
  });
  const cookie = 'mh_s=' + sess.signerSession('M1', 'd1', 0, exp);
  return { db, cookie };
}

// ---- cours : code non déverrouillé -> 403 Code requis ----
test('F1 cours : appareil non d\u00e9verrouill\u00e9 -> 403 « Code requis »', async () => {
  const { db, cookie } = await base(false);
  contenuHandler.__setDbFactory(() => db);
  const res = makeRes();
  await contenuHandler(makeReq({ url: '/api/contenu?a=cours&m=thermo', cookie }), res);
  assert.strictEqual(res.statusCode, 403);
  assert.match(res.body.erreur || '', /Code requis/);
  assert.ok(!res.body.cours);
});

// ---- cours : code déverrouillé -> 200 ----
test('F1 cours : appareil d\u00e9verrouill\u00e9 -> 200', async () => {
  const { db, cookie } = await base(true);
  contenuHandler.__setDbFactory(() => db);
  const res = makeRes();
  await contenuHandler(makeReq({ url: '/api/contenu?a=cours&m=thermo', cookie }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.cours);
});

// ---- évaluations : code non déverrouillé -> 403 Code requis ----
test('F1 éval : appareil non d\u00e9verrouill\u00e9 -> 403 « Code requis »', async () => {
  const { db, cookie } = await base(false);
  evalHandler.__setDbFactory(() => db);
  const res = makeRes();
  await evalHandler(makeReq({ url: '/api/evaluation?a=liste&m=thermo', cookie }), res);
  assert.strictEqual(res.statusCode, 403);
  assert.match(res.body.erreur || '', /Code requis/);
  assert.ok(!res.body.evaluations);
});

// ---- évaluations : code déverrouillé -> 200 ----
test('F1 éval : appareil d\u00e9verrouill\u00e9 -> 200', async () => {
  const { db, cookie } = await base(true);
  evalHandler.__setDbFactory(() => db);
  const res = makeRes();
  await evalHandler(makeReq({ url: '/api/evaluation?a=liste&m=thermo', cookie }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.evaluations);
});

// ---- la lecture du profil (navigation) NE demande PAS le code ----
test('F1 profil : accessible sans d\u00e9verrouillage (navigation)', async () => {
  const { db, cookie } = await base(false);
  contenuHandler.__setDbFactory(() => db);
  const res = makeRes();
  await contenuHandler(makeReq({ url: '/api/contenu?a=profil', cookie }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.matieres));
});
