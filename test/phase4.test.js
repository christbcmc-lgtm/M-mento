'use strict';
// Tests de la protection réelle des cours (phase 4). Hors ligne, base factice.
// But : prouver qu'aucun cours n'est servi sans session valide + abonnement.
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';
process.env.SITE_URL = '';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { makeDb } = require('./fake-db');

const sess = require('../api/_lib/session');
const contenuLib = require('../api/_lib/contenu');
const contenuHandler = require('../api/contenu');

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
  return { method: o.method || 'GET', url: o.url || '/api/contenu', headers: h };
}

// Base avec un membre actif abonné à thermo (pas à proba) + son cookie de session.
async function baseAvecMembre(matieres) {
  const db = makeDb();
  const exp = Date.now() + 1e8;
  await db.collection('membres').doc('M1').set({
    prenom: 'Léa', nom: 'D', statut: 'actif', tokenVersion: 0, expireLe: exp,
    maxAppareils: 1, matieres: matieres
  });
  // Appareil déverrouillé (code saisi) : requis depuis la correction F1.
  await db.collection('membres').doc('M1').collection('appareils').doc('d1').set({
    creeLe: Date.now(), dernierLe: Date.now(), ua: 'test', deverrouilleJusqua: Date.now() + 1e7
  });
  const cookie = 'mh_s=' + sess.signerSession('M1', 'd1', 0, exp);
  return { db, cookie };
}

// ===================== le contenu existe bien sur disque (migré) =====================
test('le cours thermo a été migré dans contenu/ et n\'est plus un fichier public', () => {
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'contenu', 'thermo', 'cours.json')), 'contenu/thermo/cours.json doit exister');
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'public', 'assets', 'cours-thermo.js')), 'le fichier public cours-thermo.js doit être supprimé');
  const c = contenuLib.lireCours('thermo');
  assert.strictEqual(c.id, 'thermo');
  assert.ok(Array.isArray(c.chapitres) && c.chapitres.length >= 1);
});

// ===================== 401 : aucun contenu sans session =====================
test('cours sans cookie -> 401 (rien n\'est servi)', async () => {
  const { db } = await baseAvecMembre(['thermo']);
  contenuHandler.__setDbFactory(() => db);
  const res = makeRes();
  await contenuHandler(makeReq({ url: '/api/contenu?a=cours&m=thermo' }), res);
  assert.strictEqual(res.statusCode, 401);
  assert.ok(!res.body.cours);
});

// ===================== 403 : abonnément manquant =====================
test('cours d\'une matière non incluse -> 403', async () => {
  const { db, cookie } = await baseAvecMembre(['proba']); // pas abonné à thermo
  contenuHandler.__setDbFactory(() => db);
  const res = makeRes();
  await contenuHandler(makeReq({ url: '/api/contenu?a=cours&m=thermo', cookie }), res);
  assert.strictEqual(res.statusCode, 403);
  assert.ok(!res.body.cours);
});

// ===================== 404 : matière hors catalogue / traversal =====================
test('matière inconnue ou tentative de traversal -> 404', async () => {
  const { db, cookie } = await baseAvecMembre(['thermo']);
  contenuHandler.__setDbFactory(() => db);
  let res = makeRes();
  await contenuHandler(makeReq({ url: '/api/contenu?a=cours&m=inexistante', cookie }), res);
  assert.strictEqual(res.statusCode, 404);
  res = makeRes();
  await contenuHandler(makeReq({ url: '/api/contenu?a=cours&m=..%2F..%2Fsecret', cookie }), res);
  assert.strictEqual(res.statusCode, 404);
});

// ===================== 200 : membre abonné -> cours servi =====================
test('membre actif abonné -> 200 + cours complet', async () => {
  const { db, cookie } = await baseAvecMembre(['thermo']);
  contenuHandler.__setDbFactory(() => db);
  const res = makeRes();
  await contenuHandler(makeReq({ url: '/api/contenu?a=cours&m=thermo', cookie }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.matiere.id, 'thermo');
  assert.ok(res.body.cours && Array.isArray(res.body.cours.chapitres) && res.body.cours.chapitres.length >= 1);
  assert.strictEqual(res.headers['cache-control'], 'no-store'); // jamais mis en cache
});

// ===================== profil : matières du membre =====================
test('profil -> liste les matières abonnées avec titre et disponibilité', async () => {
  const { db, cookie } = await baseAvecMembre(['thermo', 'proba']);
  contenuHandler.__setDbFactory(() => db);
  const res = makeRes();
  await contenuHandler(makeReq({ url: '/api/contenu?a=profil', cookie }), res);
  assert.strictEqual(res.statusCode, 200);
  const ids = res.body.matieres.map((m) => m.id);
  assert.deepStrictEqual(ids.sort(), ['proba', 'thermo']);
  const th = res.body.matieres.filter((m) => m.id === 'thermo')[0];
  assert.strictEqual(th.titre, 'Thermodynamique');
  assert.strictEqual(th.disponible, true); // cours.json présent
  const pr = res.body.matieres.filter((m) => m.id === 'proba')[0];
  assert.strictEqual(pr.disponible, false); // pas encore de contenu
});
