'use strict';
// Tests des évaluations protégées (phase 5). Hors ligne, base factice.
// But : prouver qu'aucune bonne réponse ne fuit avant la remise, que la note /20
// est calculée CÔTÉ SERVEUR, et que le résultat est bien archivé (suivi).
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';
process.env.SITE_URL = '';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { makeDb } = require('./fake-db');

const sess = require('../api/_lib/session');
const evalLib = require('../api/_lib/evaluation');
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
  return { method: o.method || 'GET', url: o.url || '/api/evaluation', headers: h, body: o.body || undefined };
}

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

// ===================== le fichier d'évaluations existe (côté serveur) =====================
test('le quiz thermo existe dans contenu/ et n\'est PAS un fichier public', () => {
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'contenu', 'thermo', 'quiz.json')), 'contenu/thermo/quiz.json doit exister');
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'public', 'assets', 'quiz-thermo.js')), 'aucun quiz public');
  const data = evalLib.lireFichier('thermo');
  assert.ok(Array.isArray(data.evaluations) && data.evaluations.length >= 1);
});

// ===================== 401 : rien sans session =====================
test('liste sans cookie -> 401 (aucune évaluation servie)', async () => {
  const { db } = await baseAvecMembre(['thermo']);
  evalHandler.__setDbFactory(() => db);
  const res = makeRes();
  await evalHandler(makeReq({ url: '/api/evaluation?a=liste&m=thermo' }), res);
  assert.strictEqual(res.statusCode, 401);
  assert.ok(!res.body.evaluations);
});

// ===================== 403 : abonnement manquant =====================
test('liste d\'une mati\u00e8re non incluse -> 403', async () => {
  const { db, cookie } = await baseAvecMembre(['proba']);
  evalHandler.__setDbFactory(() => db);
  const res = makeRes();
  await evalHandler(makeReq({ url: '/api/evaluation?a=liste&m=thermo', cookie }), res);
  assert.strictEqual(res.statusCode, 403);
});

// ===================== 404 : matière inconnue / traversal =====================
test('mati\u00e8re inconnue ou traversal -> 404', async () => {
  const { db, cookie } = await baseAvecMembre(['thermo']);
  evalHandler.__setDbFactory(() => db);
  let res = makeRes();
  await evalHandler(makeReq({ url: '/api/evaluation?a=liste&m=inexistante', cookie }), res);
  assert.strictEqual(res.statusCode, 404);
  res = makeRes();
  await evalHandler(makeReq({ url: '/api/evaluation?a=quiz&m=..%2F..%2Fsecret&q=q1', cookie }), res);
  assert.strictEqual(res.statusCode, 404);
});

// ===================== 200 : liste SANS réponses =====================
test('liste -> 200 + évaluations sans aucune bonne réponse', async () => {
  const { db, cookie } = await baseAvecMembre(['thermo']);
  evalHandler.__setDbFactory(() => db);
  const res = makeRes();
  await evalHandler(makeReq({ url: '/api/evaluation?a=liste&m=thermo', cookie }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.evaluations.length >= 1);
  const brut = res.bodyRaw;
  assert.ok(brut.indexOf('"bonne"') < 0, 'la liste ne doit jamais contenir le champ bonne');
  assert.ok(brut.indexOf('explication') < 0, 'la liste ne doit pas contenir les explications');
  res.body.evaluations.forEach((e) => { assert.strictEqual(e.bareme, 20); assert.ok(e.nbQuestions >= 1); });
});

// ===================== 200 : passage de quiz SANS réponses =====================
test('quiz -> 200 + questions sans bonne r\u00e9ponse ni explication', async () => {
  const { db, cookie } = await baseAvecMembre(['thermo']);
  evalHandler.__setDbFactory(() => db);
  const res = makeRes();
  await evalHandler(makeReq({ url: '/api/evaluation?a=quiz&m=thermo&q=q1', cookie }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.quiz.id, 'q1');
  assert.ok(res.body.quiz.questions.length >= 1);
  res.body.quiz.questions.forEach((q) => {
    assert.ok(Array.isArray(q.options) && q.options.length >= 2);
    assert.strictEqual(q.bonne, undefined, 'aucune bonne r\u00e9ponse ne doit \u00eatre expos\u00e9e');
    assert.strictEqual(q.explication, undefined);
  });
});

// ===================== 403 : mutation sans en-tête =====================
test('soumettre sans X-Requested-With -> 403', async () => {
  const { db, cookie } = await baseAvecMembre(['thermo']);
  evalHandler.__setDbFactory(() => db);
  const res = makeRes();
  await evalHandler(makeReq({ method: 'POST', url: '/api/evaluation?a=soumettre&m=thermo', cookie,
    body: { q: 'q1', reponses: {} } }), res);
  assert.strictEqual(res.statusCode, 403);
});

// ===================== 200 : correction parfaite = 20/20 + archivage =====================
test('soumettre toutes les bonnes r\u00e9ponses -> 20/20 et r\u00e9sultat archiv\u00e9', async () => {
  const { db, cookie } = await baseAvecMembre(['thermo']);
  evalHandler.__setDbFactory(() => db);
  const res = makeRes();
  await evalHandler(makeReq({ method: 'POST', url: '/api/evaluation?a=soumettre&m=thermo', cookie,
    headers: { 'x-requested-with': 'mh' },
    body: { q: 'q1', reponses: { q1a: 2, q1b: 0, q1c: 1, q1d: 0, q1e: 1 } } }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.resultat.note, 20);
  assert.strictEqual(res.body.resultat.sur, 20);
  assert.strictEqual(res.body.resultat.bonnes, 5);
  assert.strictEqual(res.body.resultat.total, 5);
  // la correction (bonne + explication) n'est r\u00e9v\u00e9l\u00e9e qu'APR\u00c8S remise
  assert.ok(res.body.resultat.details.every((d) => Number.isInteger(d.bonne)));
  assert.ok(res.body.archive && res.body.archive.id);
});

// ===================== 200 : note partielle correcte =====================
test('soumettre 3 bonnes sur 5 -> 12/20', async () => {
  const { db, cookie } = await baseAvecMembre(['thermo']);
  evalHandler.__setDbFactory(() => db);
  const res = makeRes();
  await evalHandler(makeReq({ method: 'POST', url: '/api/evaluation?a=soumettre&m=thermo', cookie,
    headers: { 'x-requested-with': 'mh' },
    body: { q: 'q1', reponses: { q1a: 2, q1b: 0, q1c: 1, q1d: 3, q1e: 3 } } }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.resultat.bonnes, 3);
  assert.strictEqual(res.body.resultat.note, 12);
});

// ===================== 404 : quiz inexistant =====================
test('soumettre un quiz inexistant -> 404', async () => {
  const { db, cookie } = await baseAvecMembre(['thermo']);
  evalHandler.__setDbFactory(() => db);
  const res = makeRes();
  await evalHandler(makeReq({ method: 'POST', url: '/api/evaluation?a=soumettre&m=thermo', cookie,
    headers: { 'x-requested-with': 'mh' }, body: { q: 'zzz', reponses: {} } }), res);
  assert.strictEqual(res.statusCode, 404);
});

// ===================== suivi : l'historique remonte le résultat archivé =====================
test('resultats -> 200 + historique des copies rendues (plus r\u00e9cent d\'abord)', async () => {
  const { db, cookie } = await baseAvecMembre(['thermo']);
  evalHandler.__setDbFactory(() => db);
  // deux soumissions successives
  await evalHandler(makeReq({ method: 'POST', url: '/api/evaluation?a=soumettre&m=thermo', cookie,
    headers: { 'x-requested-with': 'mh' }, body: { q: 'q1', reponses: { q1a: 2 } } }), makeRes());
  await evalHandler(makeReq({ method: 'POST', url: '/api/evaluation?a=soumettre&m=thermo', cookie,
    headers: { 'x-requested-with': 'mh' }, body: { q: 'q2', reponses: { q2a: 0, q2b: 2 } } }), makeRes());
  const res = makeRes();
  await evalHandler(makeReq({ url: '/api/evaluation?a=resultats&m=thermo', cookie }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.resultats.length, 2);
  res.body.resultats.forEach((r) => { assert.strictEqual(r.sur, 20); assert.ok(typeof r.note === 'number'); });
  // tri d\u00e9croissant par date
  assert.ok(res.body.resultats[0].le >= res.body.resultats[1].le);
});
