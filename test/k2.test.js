'use strict';
// K2 (QUALITE-MATIERE : cycle de vie membre ; Guide D5/D12/D20/D21).
// Actions admin : prolonger / suspendre / reactiver / supprimer_membre.
// Suppression = cascade (profil + appareils + notes + messages + resultats + evals)
// ET liberation du verrou d'email (D9/D21). Chaque bloc teste un comportement
// verifiable sur une base Firestore en memoire (aucun reseau).
// Cycle : AVANT l'ajout des fonctions dans inscription.js ces cas echouent
// (fonctions absentes => TypeError) ; APRES ils passent.
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';
process.env.ADMIN_EMAIL = 'admin@memento.test';

const test = require('node:test');
const assert = require('node:assert');
const { makeDb } = require('./fake-db');
const insc = require('../api/_lib/inscription');
const em = require('../api/_lib/emails');

const JOUR = 24 * 3600 * 1000;

async function seedMembre(db, id, data) {
  await db.collection('membres').doc(id).set(Object.assign({
    prenom: 'Lea', nom: 'Dupont', email: id + '@exemple.com', statut: 'actif',
    matieres: ['thermo'], dureeJours: 30, maxAppareils: 1, tokenVersion: 0,
    creeLe: Date.now(), majLe: Date.now()
  }, data || {}));
}

test('K2a : prolonger un acces encore valide repousse expireLe', async () => {
  const db = makeDb();
  const expire = Date.now() + 10 * JOUR;
  await seedMembre(db, 'm1', { statut: 'actif', expireLe: expire });
  const r = await insc.prolongerMembre(db, { membreId: 'm1', jours: 7 });
  assert.strictEqual(r.ok, true);
  const m = (await db.collection('membres').doc('m1').get()).data();
  assert.strictEqual(m.expireLe, expire + 7 * JOUR);
});

test('K2b : prolonger un acces expire repart de maintenant et reactive', async () => {
  const db = makeDb();
  await seedMembre(db, 'm2', { statut: 'expire', expireLe: Date.now() - 5 * JOUR });
  const avant = Date.now();
  const r = await insc.prolongerMembre(db, { membreId: 'm2', jours: 30 });
  assert.strictEqual(r.ok, true);
  const m = (await db.collection('membres').doc('m2').get()).data();
  assert.ok(m.expireLe >= avant + 30 * JOUR - 2000, 'expireLe repart de maintenant');
  assert.strictEqual(m.statut, 'actif');
});

test('K2c : prolonger un membre pas encore active ajuste dureeJours', async () => {
  const db = makeDb();
  await seedMembre(db, 'm3', { statut: 'cle_emise', dureeJours: 30, expireLe: undefined });
  const r = await insc.prolongerMembre(db, { membreId: 'm3', jours: 15 });
  assert.strictEqual(r.ok, true);
  const m = (await db.collection('membres').doc('m3').get()).data();
  assert.strictEqual(m.dureeJours, 45);
});

test('K2d : suspendre coupe les sessions (statut suspendu + tokenVersion++)', async () => {
  const db = makeDb();
  await seedMembre(db, 'm4', { statut: 'actif', tokenVersion: 3 });
  const r = await insc.suspendreMembre(db, { membreId: 'm4' });
  assert.strictEqual(r.ok, true);
  const m = (await db.collection('membres').doc('m4').get()).data();
  assert.strictEqual(m.statut, 'suspendu');
  assert.strictEqual(m.tokenVersion, 4);
});

test('K2e : reactiver remet le statut actif', async () => {
  const db = makeDb();
  await seedMembre(db, 'm5', { statut: 'suspendu', tokenVersion: 4 });
  const r = await insc.reactiverMembre(db, { membreId: 'm5' });
  assert.strictEqual(r.ok, true);
  const m = (await db.collection('membres').doc('m5').get()).data();
  assert.strictEqual(m.statut, 'actif');
});

test('K2f : supprimer_membre efface tout en cascade et libere le verrou email', async () => {
  const db = makeDb();
  const email = 'victime@exemple.com';
  await seedMembre(db, 'm6', { email });
  // verrou d'email pointant vers le membre
  await db.collection('emails').doc(em.hacheEmail(email)).set({ type: 'membre', ref: 'm6', creeLe: Date.now() });
  // sous-collections
  await db.collection('membres').doc('m6').collection('appareils').doc('dev1').set({ creeLe: Date.now() });
  await db.collection('membres').doc('m6').collection('appareils').doc('dev2').set({ creeLe: Date.now() });
  await db.collection('membres').doc('m6').collection('notes').doc('main').set({ texte: 'secret' });
  await db.collection('membres').doc('m6').collection('messages').doc('msg1').set({ texte: 'coucou' });
  // collections de premier niveau rattachees par membreId
  await db.collection('resultats').doc('r1').set({ membreId: 'm6', matiere: 'thermo', note: 12 });
  await db.collection('resultats').doc('r2').set({ membreId: 'm6', matiere: 'thermo', note: 8 });
  await db.collection('evals').doc('e1').set({ membreId: 'm6', matiere: 'thermo' });
  // un AUTRE membre dont les donnees NE doivent PAS etre touchees
  await db.collection('resultats').doc('autre').set({ membreId: 'zzz', matiere: 'proba', note: 15 });

  const r = await insc.supprimerMembre(db, { membreId: 'm6' });
  assert.strictEqual(r.ok, true);
  // profil efface
  assert.strictEqual((await db.collection('membres').doc('m6').get()).exists, false);
  // sous-collections effacees
  assert.strictEqual((await db.collection('membres').doc('m6').collection('appareils').get()).size, 0);
  assert.strictEqual((await db.collection('membres').doc('m6').collection('notes').get()).size, 0);
  assert.strictEqual((await db.collection('membres').doc('m6').collection('messages').get()).size, 0);
  // resultats/evals du membre effaces
  assert.strictEqual((await db.collection('resultats').doc('r1').get()).exists, false);
  assert.strictEqual((await db.collection('resultats').doc('r2').get()).exists, false);
  assert.strictEqual((await db.collection('evals').doc('e1').get()).exists, false);
  // l'autre membre intact
  assert.strictEqual((await db.collection('resultats').doc('autre').get()).exists, true);
  // verrou d'email libere => l'adresse redevient disponible
  assert.strictEqual(await em.refDepuisEmail(db, email), null);
  // comptes renvoyes
  assert.strictEqual(r.supprime.appareils, 2);
  assert.strictEqual(r.supprime.resultats, 2);
  assert.strictEqual(r.supprime.evals, 1);
});

test('K2g : garde-fous (membreId manquant => 400, inconnu => 404)', async () => {
  const db = makeDb();
  await assert.rejects(() => insc.suspendreMembre(db, {}), (e) => e.status === 400);
  await assert.rejects(() => insc.supprimerMembre(db, { membreId: 'inexistant' }), (e) => e.status === 404);
  await assert.rejects(() => insc.prolongerMembre(db, { membreId: 'inexistant', jours: 7 }), (e) => e.status === 404);
});
