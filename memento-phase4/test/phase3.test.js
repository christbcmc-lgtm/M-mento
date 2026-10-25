'use strict';
// Tests du circuit d'entrée (phase 3) : demande, décision, approbation, essais.
// Hors ligne, base de données factice, expéditeur d'emails capturé.
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';
process.env.SITE_URL = 'https://memento.test';
process.env.ADMIN_EMAIL = 'admin@memento.test';

const test = require('node:test');
const assert = require('node:assert');
const { makeDb } = require('./fake-db');

const em = require('../api/_lib/emails');
const secret = require('../api/_lib/secret');
const insc = require('../api/_lib/inscription');
const essais = require('../api/_lib/essais');
const publicHandler = require('../api/public');

// ---- expéditeur d'emails factice (capture to/subject/html) ----
function makeMailer() {
  const envoyes = [];
  const fn = async (to, subject, html) => { envoyes.push({ to, subject, html }); };
  fn.envoyes = envoyes;
  return fn;
}
// ---- requête / réponse factices ----
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

// ===================== 1. demande + unicité =====================
test('creerDemande: enregistre, verrouille l\'email et notifie l\'admin ; doublon -> 409', async () => {
  const db = makeDb();
  const mailer = makeMailer();
  const r = await insc.creerDemande(db,
    { type: 'abonnement', nom: 'Dupont', prenom: 'Léa', email: 'Lea@Exemple.com', matieres: ['thermo', 'xxx'], message: '<b>salut</b>' },
    mailer, 'https://memento.test');
  assert.ok(r.id);
  const d = (await db.collection('demandes').doc(r.id).get()).data();
  assert.strictEqual(d.statut, 'nouvelle');
  assert.deepStrictEqual(d.matieres, ['thermo']); // matiere inconnue filtrée
  // verrou email posé
  assert.ok((await db.collection('emails').doc(em.hacheEmail('lea@exemple.com')).get()).exists);
  // notif admin avec lien décision + message échappé (pas de <b>)
  assert.strictEqual(mailer.envoyes.length, 1);
  assert.strictEqual(mailer.envoyes[0].to, 'admin@memento.test');
  assert.match(mailer.envoyes[0].html, /\/decision\?d=/);
  assert.ok(!mailer.envoyes[0].html.includes('<b>salut</b>'));
  // deuxième demande, même email -> 409, et aucun nouvel email
  await assert.rejects(() => insc.creerDemande(db,
    { type: 'abonnement', nom: 'Autre', prenom: 'Max', email: 'lea@exemple.com' }, mailer, ''),
    (e) => e.status === 409);
  assert.strictEqual(mailer.envoyes.length, 1);
});

// ===================== 2. honeypot + limite via public.js =====================
test('public demande: honeypot -> 200 sans enregistrer ; 4e demande -> 429', async () => {
  const db = makeDb();
  const mailer = makeMailer();
  publicHandler.__setDbFactory(() => db);
  publicHandler.__setMailer(mailer);

  // honeypot rempli : 200 ok, rien enregistré
  let res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=demande', body: { nom: 'A', prenom: 'B', email: 'bot@x.com', site_web: 'http://spam' } }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual((await db.collection('demandes').get()).size, 0);
  assert.strictEqual(mailer.envoyes.length, 0);

  // 3 demandes OK (emails distincts), la 4e -> 429 (limite 3/h/IP)
  for (let i = 1; i <= 3; i++) {
    res = makeRes();
    await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=demande', body: { nom: 'N' + i, prenom: 'P', email: 'u' + i + '@x.com' } }), res);
    assert.strictEqual(res.statusCode, 200, 'demande ' + i);
  }
  res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=demande', body: { nom: 'N4', prenom: 'P', email: 'u4@x.com' } }), res);
  assert.strictEqual(res.statusCode, 429);
});

// ===================== 3. en-tête exigé =====================
test('public demande: sans X-Requested-With -> 403', async () => {
  const db = makeDb();
  publicHandler.__setDbFactory(() => db);
  publicHandler.__setMailer(makeMailer());
  const res = makeRes();
  await publicHandler(makeReq({ method: 'POST', url: '/api/public?a=demande', headers: { 'x-requested-with': '' }, body: { nom: 'A', prenom: 'B', email: 'z@x.com' } }), res);
  assert.strictEqual(res.statusCode, 403);
});

// ===================== 4. décision : lecture + refus =====================
test('decision: GET lit la demande ; refus -> rejetee + verrou libéré + email au demandeur', async () => {
  const db = makeDb();
  const mailer = makeMailer();
  const { id } = await insc.creerDemande(db, { type: 'abonnement', nom: 'D', prenom: 'C', email: 'c@x.com', matieres: ['proba'] }, mailer, '');
  const tok = require('../api/_lib/token').signDecision(id);

  const vue = await insc.decisionGet(db, tok);
  assert.strictEqual(vue.email, 'c@x.com');
  assert.deepStrictEqual(vue.matieres, ['proba']);

  await insc.decisionRefus(db, tok, 'Dossier incomplet', mailer);
  const d = (await db.collection('demandes').doc(id).get()).data();
  assert.strictEqual(d.statut, 'rejetee');
  assert.strictEqual(d.motif, 'Dossier incomplet');
  assert.strictEqual((await db.collection('emails').doc(em.hacheEmail('c@x.com')).get()).exists, false); // libéré
  const dernier = mailer.envoyes[mailer.envoyes.length - 1];
  assert.strictEqual(dernier.to, 'c@x.com');
  assert.match(dernier.html, /Dossier incomplet/);

  // une 2e décision sur une demande déjà traitée -> 410
  await assert.rejects(() => insc.decisionGet(db, tok), (e) => e.status === 410);
});

// ===================== 5. approbation =====================
test('approuverDemande: crée un membre cle_emise, rattache le verrou, envoie la clé', async () => {
  const db = makeDb();
  const mailer = makeMailer();
  const { id } = await insc.creerDemande(db, { type: 'abonnement', nom: 'R', prenom: 'Sam', email: 's@x.com', matieres: ['thermo', 'info'] }, mailer, '');
  const r = await insc.approuverDemande(db,
    { demandeId: id, matieres: ['thermo', 'info'], dureeJours: 60, maxAppareils: 2, quotaHeures: 10 }, mailer, 'https://memento.test');
  assert.ok(r.membreId);
  const m = (await db.collection('membres').doc(r.membreId).get()).data();
  assert.strictEqual(m.statut, 'cle_emise');
  assert.ok(m.cleHash && m.cleHash.startsWith('s1$'));
  assert.ok(m.codeHash && m.codeHash.startsWith('s1$'));
  assert.strictEqual(m.maxAppareils, 2);
  assert.strictEqual(m.dureeJours, 60);
  assert.deepStrictEqual(m.matieres, ['thermo', 'info']);
  // verrou email rattaché au membre
  const lock = (await db.collection('emails').doc(em.hacheEmail('s@x.com')).get()).data();
  assert.strictEqual(lock.type, 'membre');
  assert.strictEqual(lock.ref, r.membreId);
  // demande traitée
  assert.strictEqual((await db.collection('demandes').doc(id).get()).data().statut, 'traitee');
  // email contient une clé au format XXXXX-XXXXX-XXXXX-XXXXX
  const dernier = mailer.envoyes[mailer.envoyes.length - 1];
  assert.strictEqual(dernier.to, 's@x.com');
  assert.match(dernier.html, /[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}/);
  // ne pas pouvoir approuver une 2e fois
  await assert.rejects(() => insc.approuverDemande(db, { demandeId: id }, mailer, ''), (e) => e.status === 410);
});

// ===================== 6. essais gratuits =====================
test('essais: accorder (2-5 min) + doublon 409 ; ouvrir ne prolonge pas ; expiré -> 410', async () => {
  const db = makeDb();
  const mailer = makeMailer();
  const token = require('../api/_lib/token');

  const a = await essais.accorderEssai(db, { email: 'E@x.com', nom: 'N', prenom: 'P', dureeMin: 3 }, mailer, 'https://memento.test');
  assert.ok(a.ok);
  const h = em.hacheEmail('e@x.com');
  assert.strictEqual((await db.collection('essais').doc(h).get()).data().dureeMin, 3);
  assert.match(mailer.envoyes[0].html, /\/essai\?i=/);
  // doublon -> 409
  await assert.rejects(() => essais.accorderEssai(db, { email: 'e@x.com' }, mailer, ''), (e) => e.status === 409);

  // ouverture : pose utiliseLe + cookie essai_c
  const lien = token.signEssaiLien(h, 3);
  const o1 = await essais.ouvrirEssai(db, lien);
  assert.ok(o1.cookie && o1.restantSec > 0);
  const t1 = (await db.collection('essais').doc(h).get()).data().utiliseLe;
  assert.ok(t1 > 0);
  // 2e ouverture : NE prolonge PAS (utiliseLe inchangé)
  const o2 = await essais.ouvrirEssai(db, lien);
  const t2 = (await db.collection('essais').doc(h).get()).data().utiliseLe;
  assert.strictEqual(t1, t2);
  assert.ok(o2.restantSec <= o1.restantSec);

  // contenu via cookie : filigrane = email, lecture seule
  const c = await essais.essaiContenu(db, o1.cookie);
  assert.strictEqual(c.filigrane, 'e@x.com');
  assert.strictEqual(c.lectureSeule, true);
  assert.ok(c.extrait && Array.isArray(c.extrait.blocs));

  // essai expiré : utiliseLe placé dans le passé -> 410
  await db.collection('essais').doc(h).update({ utiliseLe: Date.now() - 4 * 60000 });
  await assert.rejects(() => essais.ouvrirEssai(db, lien), (e) => e.status === 410);
  await assert.rejects(() => essais.essaiContenu(db, o1.cookie), (e) => e.status === 410);
});

// ===================== 7. liste / suppression d'essais =====================
test('essais: list + supprimer', async () => {
  const db = makeDb();
  const mailer = makeMailer();
  await essais.accorderEssai(db, { email: 'a@x.com', dureeMin: 5 }, mailer, '');
  await essais.accorderEssai(db, { email: 'b@x.com', dureeMin: 2 }, mailer, '');
  let liste = await essais.listEssais(db);
  assert.strictEqual(liste.length, 2);
  await essais.supprimerEssai(db, em.hacheEmail('a@x.com'));
  liste = await essais.listEssais(db);
  assert.strictEqual(liste.length, 1);
  assert.strictEqual(liste[0].email, 'b@x.com');
});
