'use strict';
// K7 — Ressources PDF côté administrateur.
// DECISIONS §1 : l'administrateur peut « joindre des PDF / livres » et
// « envoyer des réponses ET ressources ». Les ressources sont des pièces
// jointes (liens https, validées par messagerie.validerPieces, recette §9.B.10).
//
// Changement K7 : `repondreAdmin` n'exige plus un TEXTE obligatoire ; l'admin
// peut envoyer une RESSOURCE seule (au moins une pièce https valide). On ne
// refuse (400) que si le texte est vide ET qu'aucune pièce valide n'accompagne.
//   AVANT : texte vide -> 400 'Reponse vide.' (ressource seule impossible) => K7a ECHOUE.
//   APRES : ressource seule acceptée => K7a PASSE.
process.env.TOKEN_SECRET = 'test-secret-0123456789abcdef-xyz';

const test = require('node:test');
const assert = require('node:assert');
const { makeDb } = require('./fake-db');
const msg = require('../api/_lib/messagerie');

function mailer() { const envoyes = []; const f = async (to, s, h) => { envoyes.push({ to, s, h }); }; f.envoyes = envoyes; return f; }
async function seedMembre(db, id) {
  await db.collection('membres').doc(id).set({ prenom: 'Lea', nom: 'Dupont', email: id + '@exemple.com', statut: 'actif' });
}
const PDF = { nom: 'Cours de thermodynamique.pdf', url: 'https://cdn.exemple.com/thermo.pdf' };

// ---- K7a : RESSOURCE SEULE (PDF, sans texte) acceptee + lisible par le membre ----
test('K7a : l\'admin envoie une ressource PDF sans texte ; elle apparaît dans le fil', async () => {
  const db = makeDb();
  const mail = mailer();
  await seedMembre(db, 'm1');
  const r = await msg.repondreAdmin(db, 'm1', '', [PDF], mail, 'https://memento.test');
  assert.strictEqual(r.ok, true);
  const fil = await msg.listerFil(db, 'm1');
  assert.strictEqual(fil.length, 1);
  assert.strictEqual(fil[0].de, 'admin');
  assert.strictEqual(fil[0].texte, '');
  assert.strictEqual(fil[0].pieces.length, 1);
  assert.strictEqual(fil[0].pieces[0].url, PDF.url);
  assert.strictEqual(fil[0].pieces[0].nom, PDF.nom);
  // notification best-effort envoyée au membre (sans adresse admin)
  assert.strictEqual(mail.envoyes.length, 1);
  assert.strictEqual(mail.envoyes[0].to, 'm1@exemple.com');
});

// ---- K7b : texte vide ET aucune piece -> 400 (rien a envoyer) ----
test('K7b : ni texte ni ressource -> 400 Message ou ressource requis', async () => {
  const db = makeDb();
  await seedMembre(db, 'm2');
  await assert.rejects(() => msg.repondreAdmin(db, 'm2', '   ', [], mailer(), ''), (e) => e.status === 400);
  assert.strictEqual((await msg.listerFil(db, 'm2')).length, 0);
});

// ---- K7c : une « ressource » non-https / javascript: ne compte pas ----
test('K7c : pièce non-https ou javascript: rejetée ; sans texte -> 400', async () => {
  const db = makeDb();
  await seedMembre(db, 'm3');
  await assert.rejects(
    () => msg.repondreAdmin(db, 'm3', '', [{ nom: 'x', url: 'javascript:alert(1)' }, { nom: 'y', url: 'http://pas-sur.com/a.pdf' }], mailer(), ''),
    (e) => e.status === 400);
  assert.strictEqual((await msg.listerFil(db, 'm3')).length, 0);
});

// ---- K7d : regression — texte + ressource fonctionne toujours ----
test('K7d : texte + ressource PDF : les deux sont enregistrés', async () => {
  const db = makeDb();
  await seedMembre(db, 'm4');
  const r = await msg.repondreAdmin(db, 'm4', 'Voici le polycopié :', [PDF], mailer(), '');
  assert.strictEqual(r.ok, true);
  const fil = await msg.listerFil(db, 'm4');
  assert.strictEqual(fil.length, 1);
  assert.strictEqual(fil[0].texte, 'Voici le polycopié :');
  assert.strictEqual(fil[0].pieces.length, 1);
});

// ---- K7e : regression — membre introuvable -> 404 ----
test('K7e : répondre à un membre inexistant -> 404', async () => {
  const db = makeDb();
  await assert.rejects(() => msg.repondreAdmin(db, 'inconnu', '', [PDF], mailer(), ''), (e) => e.status === 404);
});

// ---- K7f : plafond 10 pièces + nom borné (contrat validerPieces) ----
test('K7f : au plus 10 ressources, nom par défaut si vide', async () => {
  const trop = [];
  for (let i = 0; i < 15; i++) trop.push({ url: 'https://cdn.exemple.com/f' + i + '.pdf' });
  const p = msg.validerPieces(trop);
  assert.strictEqual(p.length, 10);
  assert.strictEqual(p[0].nom, 'pièce');
});
