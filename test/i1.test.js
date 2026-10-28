'use strict';
// I1 — Vidage des appareils d'un membre (D5 : « L'admin peut vider la liste » ;
// fiche membre §4.3 : « vider les appareils »). Objectif : une action admin
// `vider_appareils` supprime TOUTE la sous-collection `membres/{id}/appareils`,
// journalise l'action, et la régénération de lien (`regenerer_lien`) vide aussi
// les appareils par défaut (option `viderAppareils:false` pour s'en abstenir).
// Chaque bloc : un test qui ÉCHOUE AVANT la correction, PASSE APRÈS.
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';
process.env.SITE_URL = 'https://memento.test';
process.env.ADMIN_EMAIL = 'admin@memento.test';

const test = require('node:test');
const assert = require('node:assert');
const { makeDb } = require('./fake-db');

const sess = require('../api/_lib/session');
const insc = require('../api/_lib/inscription');

function makeMailer() {
  const envoyes = [];
  const fn = async (to, subject, html) => { envoyes.push({ to, subject, html }); };
  fn.envoyes = envoyes;
  return fn;
}
async function membreActif(db, id, extra) {
  await db.collection('membres').doc(id).set(Object.assign({
    prenom: 'Léa', nom: 'Test', email: 'lea@exemple.com', statut: 'actif',
    matieres: ['thermo'], dureeJours: 180, maxAppareils: 2, tokenVersion: 0,
    expireLe: Date.now() + 90 * 86400000, creeLe: Date.now(), majLe: Date.now()
  }, extra || {}));
}
async function ajouterAppareils(db, membreId, ids) {
  const col = db.collection('membres').doc(membreId).collection('appareils');
  for (const d of ids) {
    await col.doc(d).set({ creeLe: Date.now(), dernierLe: Date.now(), ua: 'test', deverrouilleJusqua: 0 });
  }
}
async function compterAppareils(db, membreId) {
  const snap = await db.collection('membres').doc(membreId).collection('appareils').get();
  return snap.size;
}
async function actionsJournal(db) {
  const snap = await db.collection('journal').get();
  const out = [];
  snap.forEach((d) => out.push(d.data().action));
  return out;
}

// ===================== I1a : session.viderAppareils supprime tout =====================
test('I1a : sess.viderAppareils supprime tous les appareils et renvoie le nombre', async () => {
  const db = makeDb();
  await membreActif(db, 'M1');
  await ajouterAppareils(db, 'M1', ['dev1', 'dev2', 'dev3']);
  assert.strictEqual(await compterAppareils(db, 'M1'), 3);
  const n = await sess.viderAppareils(db, 'M1');
  assert.strictEqual(n, 3, 'doit renvoyer le nombre d\'appareils supprimés');
  assert.strictEqual(await compterAppareils(db, 'M1'), 0, 'la sous-collection doit être vide');
  // Idempotent : rappeler sur une liste vide renvoie 0 sans erreur.
  assert.strictEqual(await sess.viderAppareils(db, 'M1'), 0);
});

// ===================== I1b : action admin viderAppareilsMembre + journal =====================
test('I1b : insc.viderAppareilsMembre vide les appareils et journalise', async () => {
  const db = makeDb();
  await membreActif(db, 'M1');
  await ajouterAppareils(db, 'M1', ['dev1', 'dev2']);
  const r = await insc.viderAppareilsMembre(db, { membreId: 'M1' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.appareilsSupprimes, 2, 'doit indiquer 2 appareils supprimés');
  assert.strictEqual(await compterAppareils(db, 'M1'), 0);
  assert.ok((await actionsJournal(db)).includes('vider_appareils'), 'une entrée journal « vider_appareils » doit exister');
});

// ===================== I1b' : membre inconnu -> 404, aucun journal =====================
test('I1b\' : viderAppareilsMembre sur un membre inconnu -> 404', async () => {
  const db = makeDb();
  let status = 0;
  try { await insc.viderAppareilsMembre(db, { membreId: 'ZZZ' }); }
  catch (e) { status = e.status; }
  assert.strictEqual(status, 404, 'membre inconnu -> 404');
  assert.ok(!(await actionsJournal(db)).includes('vider_appareils'), 'aucune entrée journal ne doit être écrite');
});

// ===================== I1b'' : membre requis -> 400 =====================
test('I1b\'\' : viderAppareilsMembre sans membreId -> 400', async () => {
  const db = makeDb();
  let status = 0;
  try { await insc.viderAppareilsMembre(db, {}); }
  catch (e) { status = e.status; }
  assert.strictEqual(status, 400, 'membre requis -> 400');
});

// ===================== I1c : regenererLien vide les appareils PAR DÉFAUT =====================
test('I1c : regenererLien vide les appareils par défaut', async () => {
  const db = makeDb();
  await membreActif(db, 'M1', { tokenVersion: 0 });
  await ajouterAppareils(db, 'M1', ['dev1', 'dev2']);
  const mailer = makeMailer();
  const r = await insc.regenererLien(db, { membreId: 'M1' }, mailer, 'https://memento.test');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.appareilsSupprimes, 2, 'regenererLien doit rapporter les appareils vidés');
  assert.strictEqual(await compterAppareils(db, 'M1'), 0, 'les appareils doivent être vidés par défaut');
  // La tokenVersion a bien été incrémentée (comportement H1 préservé).
  const m = (await db.collection('membres').doc('M1').get()).data();
  assert.strictEqual(m.tokenVersion, 1);
});

// ===================== I1d : option viderAppareils:false conserve les appareils =====================
test('I1d : regenererLien avec viderAppareils:false conserve les appareils', async () => {
  const db = makeDb();
  await membreActif(db, 'M1', { tokenVersion: 0 });
  await ajouterAppareils(db, 'M1', ['dev1', 'dev2']);
  const mailer = makeMailer();
  const r = await insc.regenererLien(db, { membreId: 'M1', viderAppareils: false }, mailer, 'https://memento.test');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.appareilsSupprimes, 0, 'aucun appareil ne doit être vidé');
  assert.strictEqual(await compterAppareils(db, 'M1'), 2, 'les appareils doivent être conservés');
  const m = (await db.collection('membres').doc('M1').get()).data();
  assert.strictEqual(m.tokenVersion, 1, 'la tokenVersion est tout de même incrémentée');
});

// ===================== I1e : échec d'email -> rien n'est vidé (502) =====================
test('I1e : si l\'email échoue, les appareils ne sont PAS vidés (502)', async () => {
  const db = makeDb();
  await membreActif(db, 'M1', { tokenVersion: 0 });
  await ajouterAppareils(db, 'M1', ['dev1', 'dev2']);
  const mailer = async () => { throw new Error('smtp down'); };
  let status = 0;
  try { await insc.regenererLien(db, { membreId: 'M1' }, mailer, 'https://memento.test'); }
  catch (e) { status = e.status; }
  assert.strictEqual(status, 502, 'un échec d\'envoi doit lever une erreur 502');
  assert.strictEqual(await compterAppareils(db, 'M1'), 2, 'aucune écriture : appareils conservés');
  const m = (await db.collection('membres').doc('M1').get()).data();
  assert.strictEqual(m.tokenVersion, 0, 'tokenVersion inchangée');
});
