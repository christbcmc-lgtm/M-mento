'use strict';
// Corrections G1→G5. Chaque groupe : un test qui échoue AVANT, passe APRÈS.
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';
process.env.SITE_URL = 'https://memento.test';
process.env.ADMIN_EMAIL = 'admin@memento.test';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { makeDb } = require('./fake-db');

const em = require('../api/_lib/emails');
const insc = require('../api/_lib/inscription');
const token = require('../api/_lib/token');
const publicHandler = require('../api/public');

const racine = path.join(__dirname, '..');
function lire(p) { return fs.readFileSync(path.join(racine, p), 'utf8'); }

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
  return { method: o.method || 'GET', url: o.url || '/api/public', headers: h, body: o.body || {} };
}

// ===================== G1 : normalisation d'email (D9) =====================
test('G1 : minuscules + retrait de +suffixe + points gmail/googlemail', () => {
  assert.strictEqual(em.normaliser('Jean.Dupont+promo@Gmail.com'), 'jeandupont@gmail.com');
  assert.strictEqual(em.normaliser('a.b.c@googlemail.com'), 'abc@gmail.com'); // I2 : googlemail.com canonisé en gmail.com
  // domaine non-gmail : les points sont CONSERVÉS, le +suffixe retiré
  assert.strictEqual(em.normaliser('Foo.Bar+x@Exemple.com'), 'foo.bar@exemple.com');
});
test('G1 : même email normalisé -> même verrou (demande / essai / membre)', async () => {
  const db = makeDb();
  // verrou posé avec une variante
  await em.verrouiller(db, 'A.B+promo@Gmail.com', 'membre', 'M1');
  // une autre variante du même compte doit retrouver le même verrou
  assert.strictEqual(await em.refDepuisEmail(db, 'ab@gmail.com'), 'M1');
  assert.strictEqual(em.hacheEmail('A.B+promo@Gmail.com'), em.hacheEmail('ab@gmail.com'));
});

// ===================== G2 : approuverDemande envoie AVANT d'écrire =====================
test('G2 : échec d\'envoi -> rien créé, demande reste nouvelle, erreur claire', async () => {
  const db = makeDb();
  await db.collection('demandes').doc('D1').set({
    type: 'abonnement', nom: 'N', prenom: 'P', email: 'p@x.com',
    matieres: ['thermo'], statut: 'nouvelle', creeLe: Date.now()
  });
  const boom = async () => { throw new Error('smtp down'); };
  await assert.rejects(
    () => insc.approuverDemande(db, { demandeId: 'D1', matieres: ['thermo'] }, boom, 'https://memento.test'),
    (e) => { assert.ok(e.message && /email|envoi/i.test(e.message)); return true; }
  );
  // demande inchangée
  assert.strictEqual((await db.collection('demandes').doc('D1').get()).data().statut, 'nouvelle');
  // aucun membre créé, aucun verrou membre posé
  assert.strictEqual((await db.collection('membres').get()).size, 0);
  assert.strictEqual(await em.refDepuisEmail(db, 'p@x.com'), null);
});
test('G2 : envoi réussi -> membre créé et demande traitée (après l\'email)', async () => {
  const db = makeDb();
  await db.collection('demandes').doc('D2').set({
    type: 'abonnement', nom: 'N', prenom: 'P', email: 'q@x.com',
    matieres: ['thermo'], statut: 'nouvelle', creeLe: Date.now()
  });
  const mailer = makeMailer();
  const r = await insc.approuverDemande(db, { demandeId: 'D2', matieres: ['thermo'] }, mailer, 'https://memento.test');
  assert.ok(r.membreId);
  assert.strictEqual(mailer.envoyes.length, 1);
  assert.strictEqual((await db.collection('demandes').doc('D2').get()).data().statut, 'traitee');
});

// ===================== G3 : fiche d'approbation (console) =====================
test('G3 : la fiche propose durée 7/30/90/180 + champ, appareils 1/2, quota', () => {
  const html = lire('public/admin.html');
  for (const id of ['g-duree', 'g-duree-perso', 'g-appareils', 'g-quota']) {
    assert.ok(html.includes('id="' + id + '"'), 'champ absent : ' + id);
  }
  for (const v of ['value="7"', 'value="30"', 'value="90"', 'value="180"']) {
    assert.ok(html.includes(v), 'option durée absente : ' + v);
  }
});
test('G3 : approuver_nm reçoit dureeJours / maxAppareils / quotaHeures', () => {
  const js = lire('public/assets/admin-client.js');
  assert.ok(/approuver_nm/.test(js));
  for (const k of ['dureeJours', 'maxAppareils', 'quotaHeures']) {
    assert.ok(js.includes(k), 'paramètre non transmis : ' + k);
  }
});
test('G3 : approuverDemande applique durée / appareils / quota', async () => {
  const db = makeDb();
  await db.collection('demandes').doc('D3').set({
    type: 'abonnement', nom: 'N', prenom: 'P', email: 'r@x.com',
    matieres: ['thermo'], statut: 'nouvelle', creeLe: Date.now()
  });
  const t0 = Date.now();
  const r = await insc.approuverDemande(db,
    { demandeId: 'D3', matieres: ['thermo'], dureeJours: 90, maxAppareils: 2, quotaHeures: 10 },
    makeMailer(), 'https://memento.test');
  const m = (await db.collection('membres').doc(r.membreId).get()).data();
  assert.strictEqual(m.dureeJours, 90);
  assert.strictEqual(m.maxAppareils, 2);
  assert.strictEqual(m.quotaHeures, 10);
});

// ===================== G4 : suppression de l'action admin « approuver » =====================
test('G4 : l\'action serveur approuver (ancien format) est supprimée, approuver_nm conservée', () => {
  const src = lire('api/admin.js');
  assert.ok(!src.includes("action === 'approuver'"), 'ancienne action approuver encore présente');
  assert.ok(src.includes("action === 'approuver_nm'"), 'approuver_nm manquante');
});
test('G4 : le front n\'appelle plus appel(\'approuver\') mais appel(\'approuver_nm\')', () => {
  const js = lire('public/assets/admin-client.js');
  assert.ok(!/appel\(\s*'approuver'/.test(js), 'appel à l\'ancien approuver encore présent');
  assert.ok(/appel\(\s*'approuver_nm'/.test(js), 'appel à approuver_nm manquant');
});

// ===================== G5 : decision exige 'refuser' =====================
async function demandePourDecision(db, id, email) {
  await db.collection('demandes').doc(id).set({
    type: 'abonnement', nom: 'N', prenom: 'P', email: email,
    matieres: ['thermo'], statut: 'nouvelle', creeLe: Date.now()
  });
  await db.collection('emails').doc(em.hacheEmail(email)).set({ type: 'demande', ref: id, creeLe: Date.now() });
  return token.signDecision(id);
}
test('G5 : decision avec une valeur autre que refuser/approuver -> 400', async () => {
  const db = makeDb();
  const tok = await demandePourDecision(db, 'DX', 'dx@x.com');
  publicHandler.__setDbFactory(() => db);
  publicHandler.__setMailer(makeMailer());
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=decision&d=' + encodeURIComponent(tok),
    body: { decision: 'autre' } }), res);
  assert.strictEqual(res.statusCode, 400);
  // la demande n'est NI rejetée NI traitée
  assert.strictEqual((await db.collection('demandes').doc('DX').get()).data().statut, 'nouvelle');
});
test('G5 : decision refuser -> 200 et demande rejetée', async () => {
  const db = makeDb();
  const tok = await demandePourDecision(db, 'DR', 'dr@x.com');
  publicHandler.__setDbFactory(() => db);
  publicHandler.__setMailer(makeMailer());
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=decision&d=' + encodeURIComponent(tok),
    body: { decision: 'refuser', motif: 'hors périmètre' } }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual((await db.collection('demandes').doc('DR').get()).data().statut, 'rejetee');
});
test('G5 : decision approuver via jeton -> 403 (réservé à la console admin, F4bis) et rien créé', async () => {
  const db = makeDb();
  const tok = await demandePourDecision(db, 'DA', 'da@x.com');
  publicHandler.__setDbFactory(() => db);
  publicHandler.__setMailer(makeMailer());
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=decision&d=' + encodeURIComponent(tok),
    body: { decision: 'approuver', matieres: ['thermo'] } }), res);
  assert.strictEqual(res.statusCode, 403);
  // la demande reste intacte : aucune approbation par simple possession du jeton
  assert.strictEqual((await db.collection('demandes').doc('DA').get()).data().statut, 'nouvelle');
});
