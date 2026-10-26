'use strict';
// Tests phase 7 : circuit PUBLIC v2 (demande / décision / essai) tel que le front l'utilise.
// Hors ligne, base factice, mailer capturé. On prouve le routage /api/public?a=…,
// l'exigence d'en-tête de mutation, le champ piège anti-robot, et le cookie d'essai.
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';
process.env.SITE_URL = 'https://memento.test';
process.env.ADMIN_EMAIL = 'admin@memento.test';

const test = require('node:test');
const assert = require('node:assert');
const { makeDb } = require('./fake-db');

const token = require('../api/_lib/token');
const essais = require('../api/_lib/essais');
const publicHandler = require('../api/public');

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
  const r = { method: o.method || 'GET', url: o.url || '/api/public', headers: h };
  if (o.body !== undefined) {
    const data = JSON.stringify(o.body);
    let lu = false;
    r.on = (ev, cb) => { if (ev === 'data' && !lu) { lu = true; cb(Buffer.from(data)); } if (ev === 'end') cb(); };
  }
  return r;
}
function mut() { return { 'x-requested-with': 'mh', 'content-type': 'application/json' }; }

function brancher(db) {
  const envois = [];
  publicHandler.__setDbFactory(() => db);
  publicHandler.__setMailer(async (to, subject, html) => { envois.push({ to, subject, html }); });
  return envois;
}
function nbDocs(db, prefix) {
  let n = 0;
  for (const k of db.__docs.keys()) { if (k.startsWith(prefix)) n++; }
  return n;
}

// ============ demande ============
test('demande sans en-tête X-Requested-With -> 403', async () => {
  const db = makeDb(); brancher(db);
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=demande', headers: { 'content-type': 'application/json' }, body: { nom: 'A', prenom: 'B', email: 'a@b.fr' } }), res);
  assert.strictEqual(res.statusCode, 403);
});

test('champ piège rempli -> 200 mais rien n\'est enregistré ni notifié', async () => {
  const db = makeDb(); const envois = brancher(db);
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=demande', headers: mut(), body: { nom: 'A', prenom: 'B', email: 'bot@spam.fr', site_web: 'http://spam' } }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.ok);
  assert.strictEqual(nbDocs(db, 'demandes/'), 0);
  assert.strictEqual(envois.length, 0);
});

test('demande valide -> 200 + demande stockée + email admin avec lien de décision', async () => {
  const db = makeDb(); const envois = brancher(db);
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=demande', headers: mut(), body: { nom: 'Durand', prenom: 'Léa', numero: '0600000000', email: 'lea@exemple.fr', message: 'Matières souhaitées : Thermodynamique' } }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.id);
  assert.strictEqual(nbDocs(db, 'demandes/'), 1);
  assert.strictEqual(envois.length, 1);
  assert.strictEqual(envois[0].to, 'admin@memento.test');
  assert.ok(/\/decision\?d=/.test(envois[0].html), 'l\'email admin doit contenir le lien de décision');
});

// ============ décision ============
async function creerDemande(db, envois, email) {
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=demande', headers: mut(), body: { nom: 'Durand', prenom: 'Léa', numero: '0600000000', email: email, message: 'test' } }), res);
  return res.body.id;
}

test('decision GET avec jeton valide -> renvoie la demande', async () => {
  const db = makeDb(); const envois = brancher(db);
  const id = await creerDemande(db, envois, 'lea@exemple.fr');
  const tok = token.signDecision(id);
  const res = makeRes();
  await publicHandler(makeReq({ url: '/api/public?a=decision&d=' + encodeURIComponent(tok) }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.demande.email, 'lea@exemple.fr');
});

test('decision POST approuver -> 403 (F4bis : approbation réservée à la console admin)', async () => {
  const db = makeDb(); const envois = brancher(db);
  const id = await creerDemande(db, envois, 'lea@exemple.fr');
  const tok = token.signDecision(id);
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=decision&d=' + encodeURIComponent(tok), headers: mut(), body: { decision: 'approuver', matieres: ['thermo'], dureeJours: 180, maxAppareils: 1, quotaHeures: 0 } }), res);
  assert.strictEqual(res.statusCode, 403);
  // aucun membre créé, la demande reste « nouvelle »
  assert.strictEqual(nbDocs(db, 'membres/'), 0);
  const d = await db.collection('demandes').doc(id).get();
  assert.strictEqual(d.data().statut, 'nouvelle');
});

test('decision POST refuser -> demande rejetée + email au demandeur', async () => {
  const db = makeDb(); const envois = brancher(db);
  const id = await creerDemande(db, envois, 'lea@exemple.fr');
  const tok = token.signDecision(id);
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=decision&d=' + encodeURIComponent(tok), headers: mut(), body: { decision: 'refuser', motif: 'Hors périmètre' } }), res);
  assert.strictEqual(res.statusCode, 200);
  const d = await db.collection('demandes').doc(id).get();
  assert.strictEqual(d.data().statut, 'rejetee');
});

test('decision POST sans en-tête -> 403', async () => {
  const db = makeDb(); const envois = brancher(db);
  const id = await creerDemande(db, envois, 'lea@exemple.fr');
  const tok = token.signDecision(id);
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=decision&d=' + encodeURIComponent(tok), headers: { 'content-type': 'application/json' }, body: { decision: 'refuser' } }), res);
  assert.strictEqual(res.statusCode, 403);
});

// ============ essai ============
test('essai : ouverture pose le cookie mh_e, puis le contenu est servi via ce cookie', async () => {
  const db = makeDb(); brancher(db);
  // Un essai préalablement accordé par l'admin.
  const r = await essais.accorderEssai(db, { nom: 'Le', prenom: 'A', email: 'ess@exemple.fr', dureeMin: 5 }, async () => {}, 'https://memento.test');
  const lien = token.signEssaiLien(r.hash, 5);
  const r1 = makeRes();
  await publicHandler(makeReq({ url: '/api/public?a=essai&i=' + encodeURIComponent(lien) }), r1);
  assert.strictEqual(r1.statusCode, 200);
  assert.ok(r1.body.restantSec > 0);
  const sc = String(r1.headers['set-cookie'] || '');
  const m = sc.match(/mh_e=([^;]+)/);
  assert.ok(m, 'un cookie mh_e doit être posé');
  const cookie = 'mh_e=' + m[1];
  const r2 = makeRes();
  await publicHandler(makeReq({ url: '/api/public?a=essai-contenu', cookie }), r2);
  assert.strictEqual(r2.statusCode, 200);
  assert.ok(r2.body.ok);
  assert.strictEqual(r2.body.lectureSeule, true);
  assert.strictEqual(r2.body.filigrane, 'ess@exemple.fr');
  assert.ok(r2.body.extrait && Array.isArray(r2.body.extrait.blocs));
});

test('essai-contenu sans cookie -> 401', async () => {
  const db = makeDb(); brancher(db);
  const res = makeRes();
  await publicHandler(makeReq({ url: '/api/public?a=essai-contenu' }), res);
  assert.strictEqual(res.statusCode, 401);
});
