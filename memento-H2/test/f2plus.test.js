'use strict';
// Corrections F2a / F2b / F2c / F4bis.
//  F2a  numéro obligatoire dans la demande ; copié dans le membre à l'approbation.
//  F2b  reinitCode : email D'ABORD ; le code n'est écrasé qu'en cas de succès.
//  F2c  limite code-reset par email (3/h) en plus de la limite par IP.
//  F4bis public?a=decision : l'approbation par jeton est refusée (403).
// Chaque bloc échoue AVANT la correction, passe APRÈS.
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';
process.env.SITE_URL = 'https://memento.test';
process.env.ADMIN_EMAIL = 'admin@memento.test';

const test = require('node:test');
const assert = require('node:assert');
const { makeDb } = require('./fake-db');

const em = require('../api/_lib/emails');
const secret = require('../api/_lib/secret');
const token = require('../api/_lib/token');
const insc = require('../api/_lib/inscription');
const publicHandler = require('../api/public');

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

// ===================== F2a =====================
test('F2a : creerDemande exige le numéro, le stocke, et l\'approbation le copie dans le membre', async () => {
  const db = makeDb();
  const mailer = makeMailer();
  // sans numéro -> 400
  await assert.rejects(
    () => insc.creerDemande(db, { type: 'abonnement', nom: 'D', prenom: 'C', email: 'c@x.com', matieres: ['thermo'] }, mailer, ''),
    (e) => e.status === 400
  );
  // avec numéro -> enregistré sur la demande
  const r = await insc.creerDemande(db, { type: 'abonnement', nom: 'D', prenom: 'C', numero: '06 11 22 33 44', email: 'c@x.com', matieres: ['thermo'] }, mailer, '');
  const d = (await db.collection('demandes').doc(r.id).get()).data();
  assert.strictEqual(d.numero, '06 11 22 33 44');
  // approbation -> numéro copié sur le membre
  const a = await insc.approuverDemande(db, { demandeId: r.id, matieres: ['thermo'] }, mailer, '');
  const m = (await db.collection('membres').doc(a.membreId).get()).data();
  assert.strictEqual(m.numero, '06 11 22 33 44');
});

// ===================== F2b =====================
async function membre(db) {
  const now = Date.now();
  await db.collection('membres').doc('M1').set({
    prenom: 'Léa', nom: 'Dupont', email: 'lea@exemple.com', numero: '0612345678',
    statut: 'actif', codeHash: secret.hash('OLDCODE1'), matieres: ['thermo'], tokenVersion: 0, creeLe: now, majLe: now
  });
  await db.collection('emails').doc(em.hacheEmail('lea@exemple.com')).set({ type: 'membre', ref: 'M1', creeLe: now });
}
async function codeHash(db) { return ((await db.collection('membres').doc('M1').get()).data() || {}).codeHash; }

test('F2b : si l\'envoi de l\'email échoue, le code N\'est PAS écrasé et la réponse reste neutre', async () => {
  const db = makeDb();
  await membre(db);
  const avant = await codeHash(db);
  // mailer qui échoue
  const mailerKo = async () => { throw new Error('SMTP down'); };
  const r = await insc.reinitCode(db, { email: 'lea@exemple.com', numero: '0612345678' }, mailerKo, '');
  assert.deepStrictEqual(r, { ok: true });          // réponse neutre
  assert.strictEqual(await codeHash(db), avant);     // code inchangé
});

test('F2b : si l\'envoi réussit, le code EST renouvelé', async () => {
  const db = makeDb();
  await membre(db);
  const avant = await codeHash(db);
  const mailer = makeMailer();
  await insc.reinitCode(db, { email: 'lea@exemple.com', numero: '0612345678' }, mailer, '');
  assert.notStrictEqual(await codeHash(db), avant);
  assert.strictEqual(mailer.envoyes.length, 1);
});

// ===================== F2c =====================
test('F2c : limite par email (3/h) même depuis des IP différentes -> 4e tentative 429', async () => {
  const db = makeDb();
  await membre(db);
  publicHandler.__setDbFactory(() => db);
  publicHandler.__setMailer(makeMailer());
  // 3 tentatives sur le même email, IP différente à chaque fois (la limite IP ne joue pas)
  for (let i = 0; i < 3; i++) {
    const res = makeRes();
    await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=code-reset',
      headers: { 'x-forwarded-for': '10.0.0.' + (10 + i) }, body: { email: 'lea@exemple.com', numero: '0000' } }), res);
    assert.strictEqual(res.statusCode, 200, 'tentative ' + i);
  }
  // 4e sur le même email mais encore une IP nouvelle -> bloquée par la limite EMAIL
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=code-reset',
    headers: { 'x-forwarded-for': '10.0.0.99' }, body: { email: 'lea@exemple.com', numero: '0000' } }), res);
  assert.strictEqual(res.statusCode, 429);
});

// ===================== F4bis =====================
test('F4bis : public?a=decision POST approuver -> 403 (aucun membre créé)', async () => {
  const db = makeDb();
  const mailer = makeMailer();
  publicHandler.__setDbFactory(() => db);
  publicHandler.__setMailer(mailer);
  const r = await insc.creerDemande(db, { type: 'abonnement', nom: 'D', prenom: 'C', numero: '0600000000', email: 'c@x.com', matieres: ['thermo'] }, mailer, '');
  const tok = token.signDecision(r.id);
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=decision&d=' + encodeURIComponent(tok),
    body: { decision: 'approuver', matieres: ['thermo'] } }), res);
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual((await db.collection('membres').get()).size, 0);
  assert.strictEqual((await db.collection('demandes').doc(r.id).get()).data().statut, 'nouvelle');
});

test('F4bis : public?a=decision POST refuser reste autorisé par jeton', async () => {
  const db = makeDb();
  const mailer = makeMailer();
  publicHandler.__setDbFactory(() => db);
  publicHandler.__setMailer(mailer);
  const r = await insc.creerDemande(db, { type: 'abonnement', nom: 'D', prenom: 'C', numero: '0600000000', email: 'c@x.com', matieres: ['thermo'] }, mailer, '');
  const tok = token.signDecision(r.id);
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=decision&d=' + encodeURIComponent(tok),
    body: { decision: 'refuser', motif: 'Hors périmètre' } }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual((await db.collection('demandes').doc(r.id).get()).data().statut, 'rejetee');
});
